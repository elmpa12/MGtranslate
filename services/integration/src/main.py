"""
MGtranslate Integration Service

Handles the AI pipeline:
- Speech-to-Text (OpenAI Whisper)
- Translation (OpenAI GPT-4o-mini)
- Text-to-Speech (Google Cloud TTS)
"""

import os
import io
import wave
import asyncio
import base64
import json
import logging
import time
import subprocess
from typing import Optional
from pathlib import Path

import websockets
from dotenv import load_dotenv
from openai import OpenAI
from google.cloud import texttospeech_v1 as tts

# Load environment
env_path = Path(__file__).parent.parent.parent.parent / ".env"
load_dotenv(env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("integration")

# Config
ORCHESTRATOR_WS = os.getenv("ORCHESTRATOR_WS", "ws://localhost:3001/ws")
GOOGLE_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
ALLOWED_LANGS = [
    lang.strip() for lang in os.getenv("ALLOWED_LANGS", "en-US,pt-BR").split(",") if lang.strip()
]

# Set credentials path
if GOOGLE_CREDENTIALS:
    cred_path = Path(__file__).parent.parent.parent.parent / GOOGLE_CREDENTIALS.lstrip("./")
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(cred_path)


class IntegrationService:
    def __init__(self):
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.openai_client = None
        self.tts_client = None
        self.running = True

        # Context memory for better GPT translations (keeps last N exchanges per session)
        self.translation_context: dict[str, list] = {}
        self.context_last_used: dict[str, float] = {}  # Track last use time per session
        self.MAX_CONTEXT_SIZE = 4  # Keep last 4 exchanges (reduced to avoid drift)
        self.CONTEXT_EXPIRY_SECONDS = 60  # Clear context if no activity for 60 seconds

        # Audio buffering per session
        # We need to accumulate ~2-3 seconds of audio before sending to STT
        self.audio_buffers: dict[str, bytearray] = {}
        self.buffer_timers: dict[str, asyncio.Task] = {}
        self.session_configs: dict[str, dict] = {}

        # Pause state to prevent infinite loop
        # When TTS is playing, we pause audio processing for that session
        self.paused_until: dict[str, float] = {}
        # We now calculate pause duration dynamically based on TTS text length

        # Buffer settings (16kHz, 16-bit mono = 32000 bytes/second)
        self.MIN_BUFFER_SIZE = int(os.getenv("MIN_BUFFER_SIZE", "16000"))  # ~0.5 seconds minimum (ultra-fast turn-taking)
        self.MAX_BUFFER_SIZE = int(os.getenv("MAX_BUFFER_SIZE", "640000"))  # ~20 seconds maximum
        self.BUFFER_TIMEOUT = float(os.getenv("BUFFER_TIMEOUT", "1.5"))  # Process after 1.5s silence

        # Silence detection - require CONSECUTIVE silence to trigger
        self.SILENCE_THRESHOLD = int(os.getenv("SILENCE_THRESHOLD", "300"))  # Amplitude below this = silence
        self.SILENCE_DURATION_REQUIRED = float(os.getenv("SILENCE_DURATION_REQUIRED", "0.5"))  # 0.5s silence to trigger (ultra-fast)
        self.silence_start_time: dict[str, float] = {}  # Track when silence started per session

        # Echo prevention - track last TTS output per session
        self.last_tts_text: dict[str, str] = {}
        # Track last transcript to avoid processing duplicates
        self.last_transcript: dict[str, str] = {}

        # Speech amplitude guard (drop ultra-quiet audio before Whisper)
        # Balanced at 350 - filters keyboard noise but allows normal speech
        self.MIN_SPEECH_AMPLITUDE = int(os.getenv("MIN_SPEECH_AMPLITUDE", "350"))

    def _buffer_key(self, session_id: str, source_lang: str, target_lang: str, source: str | None) -> str:
        """Create a unique buffer key per direction/source to avoid mixing mic/tab audio."""
        return f"{session_id}|{source_lang}->{target_lang}|{source or 'unknown'}"

    def _clear_session_buffers(self, session_id: str):
        """Clear all buffers/timers for a given session id."""
        key_prefix = f"{session_id}|"
        for store in (self.audio_buffers, self.buffer_timers, self.session_configs, self.silence_start_time):
            for key in list(store.keys()):
                if isinstance(key, str) and key.startswith(key_prefix):
                    item = store.pop(key, None)
                    if isinstance(item, asyncio.Task):
                        item.cancel()

    async def initialize_clients(self):
        """Initialize OpenAI and Google Cloud TTS clients"""
        try:
            # Initialize OpenAI client for STT (Whisper) and translations (GPT-4o-mini)
            openai_key = os.getenv("OPENAI_API_KEY")
            if openai_key and not openai_key.startswith("sk-your"):
                self.openai_client = OpenAI(api_key=openai_key)
                logger.info("OpenAI client initialized (Whisper STT + GPT-4o-mini translations)")
            else:
                logger.warning("OpenAI API key not configured - STT and translations will fail!")

            # Initialize Google TTS client
            self.tts_client = tts.TextToSpeechClient()
            logger.info("Google Cloud TTS client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize clients: {e}")
            raise

    def estimate_tts_duration(self, text: str) -> float:
        """
        Estimate TTS audio duration based on text length.
        At speaking_rate=0.9, roughly 12-14 chars/second.
        Be aggressive - better to be ready early than make user wait.
        """
        chars = len(text)
        # ~15 chars/sec - aggressive estimate to minimize wait time
        duration = chars / 15.0
        # Minimum 0.5s, maximum 3s - be ready fast!
        return max(0.5, min(duration, 3.0))

    def detect_text_language(self, text: str, whisper_guess: str) -> str:
        """
        Detect language based on text content to override Whisper's guess.
        Whisper often misdetects accented English as Portuguese.
        """
        text_lower = text.lower()
        words = text_lower.split()

        # Common English words (articles, pronouns, verbs, etc.)
        english_markers = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'have', 'has', 'had', 'do', 'does', 'did', "don't", "doesn't",
            'i', "i'm", "i've", "i'll", 'you', "you're", "you've", 'he', 'she', 'it', 'we', 'they', 'my', 'your',
            'this', 'that', 'what', 'how', 'why', 'when', 'where', 'who',
            'can', 'could', 'would', 'should', 'will', 'please', 'thank',
            'yes', 'no', 'not', 'and', 'or', 'but', 'if', 'so', 'just',
            'now', 'here', 'there', 'very', 'really', 'actually', 'right',
            'okay', 'ok', 'well', 'let', 'get', 'go', 'come', 'see', 'know',
            'think', 'want', 'need', 'like', 'make', 'say', 'said', 'tell',
            'hello', 'hi', 'hey', 'bye', 'goodbye', 'sorry', 'thanks',
            'happy', 'today', 'good', 'great', 'nice', 'fine', 'bad',
            'work', 'working', 'meeting', 'time', 'day', 'week', 'about',
            'sure', 'maybe', 'also', 'too', 'more', 'much', 'many', 'some',
            'thing', 'things', 'something', 'anything', 'nothing', 'everything',
            'because', 'then', 'than', 'with', 'from', 'into', 'over', 'after', 'before'
        }

        # Common Portuguese words
        portuguese_markers = {
            'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
            'é', 'são', 'está', 'estão', 'foi', 'eram', 'ser', 'estar',
            'eu', 'você', 'ele', 'ela', 'nós', 'eles', 'elas', 'meu', 'seu',
            'isso', 'isto', 'aquilo', 'que', 'qual', 'como', 'porque', 'onde',
            'pode', 'posso', 'podemos', 'quero', 'quer', 'preciso', 'precisa',
            'sim', 'não', 'mas', 'se', 'então', 'agora', 'aqui', 'ali',
            'muito', 'bem', 'bom', 'boa', 'obrigado', 'obrigada', 'por favor',
            'olá', 'oi', 'tchau', 'desculpa', 'desculpe', 'com', 'para', 'de'
        }

        # Count matches
        en_count = sum(1 for w in words if w in english_markers)
        pt_count = sum(1 for w in words if w in portuguese_markers)

        # Calculate percentages
        total_words = len(words) if words else 1
        en_pct = en_count / total_words
        pt_pct = pt_count / total_words

        logger.debug(f"Language detection: en={en_count}({en_pct:.1%}), pt={pt_count}({pt_pct:.1%})")

        # Override Whisper if text analysis strongly suggests different language
        # Relaxed thresholds: just need more markers of one language than the other
        if en_count > pt_count and en_count >= 1:
            if whisper_guess != "en-US":
                logger.info(f"Overriding Whisper ({whisper_guess}) -> en-US based on text (en={en_count}, pt={pt_count})")
            return "en-US"
        elif pt_count > en_count and pt_count >= 1:
            if whisper_guess != "pt-BR":
                logger.info(f"Overriding Whisper ({whisper_guess}) -> pt-BR based on text (en={en_count}, pt={pt_count})")
            return "pt-BR"

        # Trust Whisper if text analysis is inconclusive
        return whisper_guess

    def normalize_lang(self, code: str) -> str:
        """Normalize language codes to a canonical form (e.g., en-US -> en, pt-BR -> pt).
        Also handles full language names from Whisper (e.g., 'portuguese' -> 'pt', 'english' -> 'en').
        """
        if not code:
            return ""
        lower = code.lower()
        # Handle full language names from Whisper
        if lower in ("english", "en", "en-us", "en-gb"):
            return "en"
        if lower in ("portuguese", "pt", "pt-br", "pt-pt"):
            return "pt"
        if lower in ("spanish", "es", "es-es", "es-mx"):
            return "es"
        if lower in ("french", "fr", "fr-fr"):
            return "fr"
        if lower in ("german", "de", "de-de"):
            return "de"
        if lower in ("italian", "it", "it-it"):
            return "it"
        if lower in ("japanese", "ja", "ja-jp"):
            return "ja"
        if lower in ("korean", "ko", "ko-kr"):
            return "ko"
        if lower in ("chinese", "zh", "zh-cn", "zh-tw"):
            return "zh"
        # Fallback: check prefixes for any other codes
        if lower.startswith("en"):
            return "en"
        if lower.startswith("pt"):
            return "pt"
        if lower.startswith("es"):
            return "es"
        if lower.startswith("fr"):
            return "fr"
        if lower.startswith("de"):
            return "de"
        if lower.startswith("it"):
            return "it"
        if lower.startswith("ja"):
            return "ja"
        if lower.startswith("ko"):
            return "ko"
        if lower.startswith("zh"):
            return "zh"
        return lower

    def allowed_langs_normalized(self) -> set[str]:
        return {self.normalize_lang(l) for l in ALLOWED_LANGS}

    def is_allowed_lang(self, lang_code: str) -> bool:
        if not ALLOWED_LANGS:
            return True
        return self.normalize_lang(lang_code) in self.allowed_langs_normalized()

    def whisper_language_hint(self, source_lang: str, target_lang: str) -> Optional[str]:
        """
        Provide a hint to Whisper when the expected languages are known (at most 2).
        Returns a 2-letter code or None to let it auto-detect.
        """
        langs = {self.normalize_lang(source_lang), self.normalize_lang(target_lang)}
        langs.discard("")
        if len(langs) == 1:
            return list(langs)[0]
        return None

    async def connect(self):
        """Connect to Orchestrator WebSocket"""
        while self.running:
            try:
                logger.info(f"Connecting to {ORCHESTRATOR_WS}")
                async with websockets.connect(ORCHESTRATOR_WS) as ws:
                    self.ws = ws

                    # Register as integration service
                    await ws.send(json.dumps({
                        "type": "register",
                        "clientType": "integration"
                    }))
                    logger.info("Connected to Orchestrator")

                    # Message loop
                    async for message in ws:
                        await self.handle_message(json.loads(message))

            except websockets.ConnectionClosed:
                logger.warning("Connection closed, reconnecting...")
            except Exception as e:
                logger.error(f"Connection error: {e}")

            await asyncio.sleep(5)

    async def handle_message(self, message: dict):
        """Handle incoming messages from Orchestrator"""
        msg_type = message.get("type")
        session_id = message.get("sessionId")

        if msg_type == "clearBuffer":
            # Clear audio buffer for this session (TTS is playing, avoid loop)
            # Use duration from message if provided, else short fallback
            reason = message.get("reason", "unknown")
            duration = message.get("duration", 1.5)  # Short fallback since main pause is when we send TTS
            pause_until = time.time() + duration
            self.paused_until[session_id] = pause_until
            logger.info(f"[{session_id}] PAUSING audio processing for {duration:.1f}s (reason: {reason})")

            # Clear existing buffers for this session (all directions)
            self._clear_session_buffers(session_id)
        elif msg_type == "audio:process":
            await self.buffer_audio(
                session_id,
                message.get("audio"),
                message.get("sourceLang", "en-US"),
                message.get("targetLang", "pt-BR"),
                message.get("format", "webm"),
                message.get("source", "unknown")
            )
        elif msg_type == "caption:translate":
            # Direct translation from Meet's live captions (no STT needed)
            text = message.get("text", "")
            source_lang = message.get("sourceLang", "en-US")
            target_lang = message.get("targetLang", "pt-BR")

            if text:
                logger.info(f"[{session_id}] Caption received: {text[:50]}...")
                await self.translate_and_speak(session_id, text, source_lang, target_lang)

        elif msg_type == "generateSummary":
            # Generate meeting summary using GPT
            transcripts = message.get("transcripts", [])
            transcript_text = message.get("transcriptText", "")
            logger.info(f"[{session_id}] Generating summary for {len(transcripts)} transcripts")
            await self.generate_meeting_summary(session_id, transcripts, transcript_text)

    async def buffer_audio(
        self,
        session_id: str,
        audio_b64: str,
        source_lang: str,
        target_lang: str,
        audio_format: str = "webm",
        source: str = "unknown"
    ):
        """Buffer audio chunks until we have enough for STT"""
        try:
            # Check if this session is paused (TTS is playing)
            if session_id in self.paused_until:
                if time.time() < self.paused_until[session_id]:
                    # Still paused, ignore this audio
                    return
                else:
                    # Pause has expired, remove it
                    del self.paused_until[session_id]
                    logger.info(f"[{session_id}] Audio processing RESUMED")

            audio_bytes = base64.b64decode(audio_b64)
            buffer_key = self._buffer_key(session_id, source_lang, target_lang, source)

            # Initialize buffer for this session if needed
            if buffer_key not in self.audio_buffers:
                self.audio_buffers[buffer_key] = bytearray()
                self.session_configs[buffer_key] = {
                    "session_id": session_id,
                    "source_lang": source_lang,
                    "target_lang": target_lang,
                    "format": audio_format,
                    "source": source
                }
                logger.info(f"[{session_id}] Started buffering audio ({source_lang}->{target_lang}, source={source})")

            # Append audio to buffer
            self.audio_buffers[buffer_key].extend(audio_bytes)
            buffer_size = len(self.audio_buffers[buffer_key])

            # Check amplitude of this chunk to detect silence
            samples = [int.from_bytes(audio_bytes[i:i+2], 'little', signed=True)
                       for i in range(0, len(audio_bytes) - 1, 2)]
            avg_amplitude = sum(abs(s) for s in samples) / len(samples) if samples else 0
            is_silence = avg_amplitude < self.SILENCE_THRESHOLD

            # Track consecutive silence duration
            current_time = asyncio.get_event_loop().time()
            if is_silence:
                if buffer_key not in self.silence_start_time:
                    self.silence_start_time[buffer_key] = current_time
                silence_duration = current_time - self.silence_start_time[buffer_key]
            else:
                # Speaking again, reset silence timer
                self.silence_start_time.pop(buffer_key, None)
                silence_duration = 0

            # Cancel existing timer if any
            if buffer_key in self.buffer_timers:
                self.buffer_timers[buffer_key].cancel()

            # Check if buffer is large enough to process
            if buffer_size >= self.MAX_BUFFER_SIZE:
                # Buffer is full, process immediately
                logger.info(f"[{session_id}] Buffer full ({buffer_size} bytes), processing...")
                self.silence_start_time.pop(buffer_key, None)
                await self.process_buffered_audio(buffer_key)
            elif buffer_size >= self.MIN_BUFFER_SIZE and silence_duration >= self.SILENCE_DURATION_REQUIRED:
                # Have enough audio AND sustained silence - speaker finished!
                logger.info(f"[{session_id}] Sustained silence ({silence_duration:.1f}s) with {buffer_size} bytes, processing...")
                self.silence_start_time.pop(buffer_key, None)
                await self.process_buffered_audio(buffer_key)
            elif buffer_size >= self.MIN_BUFFER_SIZE:
                # Have enough audio but speaker might continue, set short timer
                self.buffer_timers[buffer_key] = asyncio.create_task(
                    self.delayed_process(buffer_key, 2.0)  # 2s delay as backup
                )
            else:
                # Not enough audio yet, set timeout
                self.buffer_timers[buffer_key] = asyncio.create_task(
                    self.delayed_process(buffer_key, self.BUFFER_TIMEOUT)
                )

        except Exception as e:
            logger.error(f"[{session_id}] Buffer error: {e}")

    async def delayed_process(self, buffer_key: str, delay: float):
        """Process audio after a delay (triggered by silence)"""
        try:
            await asyncio.sleep(delay)
            if buffer_key in self.audio_buffers and len(self.audio_buffers[buffer_key]) > 0:
                await self.process_buffered_audio(buffer_key)
        except asyncio.CancelledError:
            pass  # Timer was cancelled, new audio arrived

    async def process_buffered_audio(self, buffer_key: str):
        """Process the buffered audio through the pipeline"""
        if buffer_key not in self.audio_buffers:
            return

        buffer = bytes(self.audio_buffers[buffer_key])
        config = self.session_configs.get(buffer_key, {})

        # Clear the buffer
        self.audio_buffers[buffer_key] = bytearray()
        self.buffer_timers.pop(buffer_key, None)

        if len(buffer) < 8000:  # Less than 0.25 seconds, skip
            logger.debug(f"[{config.get('session_id', 'unknown')}] Buffer too small ({len(buffer)} bytes), skipping")
            return

        # Process through the full pipeline
        await self.process_audio(
            config.get("session_id", "unknown"),
            base64.b64encode(buffer).decode(),
            config.get("source_lang", "en-US"),
            config.get("target_lang", "pt-BR"),
            config.get("format", "pcm16"),
            config.get("source", "unknown")
        )

    async def process_audio(
        self,
        session_id: str,
        audio_b64: str,
        source_lang: str,
        target_lang: str,
        audio_format: str = "webm",
        source: str = "unknown"
    ):
        """Full pipeline: STT (with language detection) -> Translate -> TTS

        Bidirectional translation:
        - Detects which language is being spoken (source or target)
        - Translates to the opposite language
        """
        try:
            # Decode audio and convert to 16k PCM
            raw_audio_bytes = base64.b64decode(audio_b64)
            audio_bytes = await self.decode_to_pcm16(raw_audio_bytes, audio_format)
            if audio_bytes is None:
                logger.warning(f"[{session_id}] Could not decode audio (format={audio_format}), skipping")
                return

            logger.info(f"[{session_id}] Processing audio: {len(audio_bytes)} bytes, format: {audio_format}")

            # 1. Speech-to-Text with OpenAI Whisper (auto language detection)
            transcript, detected_lang = await self.speech_to_text_whisper(
                audio_bytes, source_lang, target_lang
            )
            if not transcript:
                return

            logger.info(f"[{session_id}] Detected: {detected_lang} | Transcript: {transcript[:50]}...")

            # Check for duplicate transcript (prevents processing same speech twice)
            last_transcript = self.last_transcript.get(session_id)
            if last_transcript and transcript.strip() == last_transcript:
                logger.info(f"[{session_id}] Duplicate transcript, skipping to avoid reprocessing")
                return
            self.last_transcript[session_id] = transcript.strip()

            # Determine translation direction
            # Prefer declared source_lang -> target_lang (mic/tab direction).
            # Only flip if Whisper clearly matches the opposite language.
            src_norm = self.normalize_lang(source_lang)
            tgt_norm = self.normalize_lang(target_lang)
            det_norm = self.normalize_lang(detected_lang)

            if det_norm == src_norm:
                translate_to = target_lang
            elif det_norm == tgt_norm:
                translate_to = source_lang
            else:
                # Unknown/ambiguous detection: stick to declared source direction
                translate_to = target_lang
                logger.info(f"[{session_id}] Ambiguous lang detection (det={det_norm}, src={src_norm}, tgt={tgt_norm}), using declared direction {source_lang}->{target_lang}")

            transcript_id = f"{session_id}-{asyncio.get_event_loop().time()}"

            # 2. Translate and send transcript notification in PARALLEL (latency optimization)
            transcript_msg = {
                "type": "integration:transcript",
                "sessionId": session_id,
                "transcript": {
                    "id": transcript_id,
                    "text": transcript,
                    "lang": detected_lang,
                    "direction": f"{detected_lang} → {translate_to}"
                }
            }
            # Fire-and-forget transcript, start translation immediately
            asyncio.create_task(self.send(transcript_msg))
            translation = await self.translate_text(transcript, translate_to, session_id)
            logger.info(f"[{session_id}] Translation ({translate_to}): {translation[:50]}...")

            # ===== PRE-TTS SANITY CHECKS =====
            clean = translation.strip()

            # Skip if translation is empty or too short
            if not clean or len(clean) < 2:
                logger.info(f"[{session_id}] Translation too short/empty, skipping TTS")
                return

            # Skip very short courtesy noise (prevents endless 'obrigado/thanks')
            courtesy = {'obrigado', 'obrigada', 'thank you', 'thanks', 'ok', 'okay', 'certo'}
            if clean.lower() in courtesy and len(transcript.split()) <= 2:
                logger.info(f"[{session_id}] Courtesy-only translation '{clean}', skipping TTS")
                return

            # Skip if identical to last TTS (echo/loop prevention)
            last = self.last_tts_text.get(session_id)
            if last and clean == last:
                logger.info(f"[{session_id}] Same translation as last TTS, skipping to avoid echo")
                return

            # Skip if no alphabetic characters (likely noise/garbage)
            if not any(c.isalpha() for c in clean):
                logger.info(f"[{session_id}] Translation has no letters, likely noise. Skipping TTS.")
                return

            # Update last TTS text for this session
            self.last_tts_text[session_id] = clean
            # ===== END SANITY CHECKS =====

            # 3. Send translation notification AND generate TTS in PARALLEL (latency optimization)
            translation_msg = {
                "type": "integration:translation",
                "sessionId": session_id,
                "translation": {
                    "original": transcript,
                    "transcriptId": transcript_id,
                    "text": translation,
                    "lang": translate_to
                }
            }
            # Run translation notification and TTS generation in parallel
            send_task = asyncio.create_task(self.send(translation_msg))
            tts_audio = await self.text_to_speech(translation, translate_to)
            await send_task  # Ensure send completes before continuing

            # Auto-pause this session based on estimated TTS duration
            pause_duration = self.estimate_tts_duration(translation)
            pause_until = time.time() + pause_duration
            self.paused_until[session_id] = pause_until
            logger.info(f"[{session_id}] Auto-PAUSING after TTS for {pause_duration:.1f}s")

            await self.send({
                "type": "integration:tts",
                "sessionId": session_id,
                "audio": base64.b64encode(tts_audio).decode(),
                "duration": pause_duration,  # Send duration for sync with extension/orchestrator
                "originalText": transcript,
                "translatedText": translation
            })

        except Exception as e:
            logger.error(f"[{session_id}] Pipeline error: {e}")

    async def decode_to_pcm16(self, audio_bytes: bytes, audio_format: str) -> Optional[bytes]:
        """
        Normalize incoming audio to 16kHz mono PCM16.
        - 'pcm16' input is returned as-is
        - 'webm'/'opus' is decoded via ffmpeg on the command line
        """
        fmt = (audio_format or "pcm16").lower()
        if fmt in ("pcm16", "raw"):
            return audio_bytes

        if fmt in ("webm", "opus"):
            return await asyncio.to_thread(self._decode_with_ffmpeg, audio_bytes, fmt)

        logger.warning(f"Unknown audio format '{audio_format}', attempting to process raw bytes")
        return audio_bytes

    def _decode_with_ffmpeg(self, audio_bytes: bytes, fmt: str) -> Optional[bytes]:
        """Decode compressed audio using ffmpeg to PCM16 16k mono."""
        try:
            cmd = [
                "ffmpeg",
                "-loglevel", "error",
                "-f", fmt if fmt != "webm" else "webm",
                "-i", "pipe:0",
                "-ac", "1",
                "-ar", "16000",
                "-f", "s16le",
                "pipe:1"
            ]
            proc = subprocess.run(cmd, input=audio_bytes, capture_output=True)
            if proc.returncode != 0:
                logger.error(f"ffmpeg decode failed (fmt={fmt}): {proc.stderr.decode(errors='ignore')}")
                return None
            return proc.stdout
        except FileNotFoundError:
            logger.error("ffmpeg not found - install ffmpeg to decode webm/opus input")
            return None
        except Exception as e:
            logger.error(f"ffmpeg decode error: {e}")
            return None

    async def speech_to_text_whisper(
        self,
        audio_bytes: bytes,
        source_lang: str,
        target_lang: str
    ) -> tuple[Optional[str], str]:
        """
        Speech-to-Text using OpenAI Whisper API.

        Whisper automatically detects the language being spoken.
        Returns: (transcript, detected_language_code)
        """
        try:
            if not self.openai_client:
                logger.error("OpenAI client not initialized")
                return None, "en"

            # Convert PCM16 to WAV format (Whisper needs a file-like object)
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(16000)
                wav_file.writeframes(audio_bytes)
            wav_buffer.seek(0)
            wav_buffer.name = "audio.wav"  # OpenAI requires a filename

            # Analyze audio before sending to Whisper
            import struct
            samples = struct.unpack(f'<{len(audio_bytes)//2}h', audio_bytes)
            max_amp = max(abs(s) for s in samples)
            avg_amp = sum(abs(s) for s in samples) / len(samples)
            logger.info(f"Audio analysis: max_amplitude={max_amp}, avg_amplitude={avg_amp:.1f}")

            # Skip Whisper if audio is too quiet (prevents hallucinations on silence)
            if max_amp < self.MIN_SPEECH_AMPLITUDE:
                logger.info(f"Audio too quiet (max_amp={max_amp}), skipping Whisper")
                return None, "en"

            logger.info(f"Calling Whisper with {len(audio_bytes)} bytes")

            # Use whisper-1 model WITHOUT prompt to avoid prompt echo hallucinations
            language_hint = self.whisper_language_hint(source_lang, target_lang)
            response = self.openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=wav_buffer,
                response_format="verbose_json",
                # NO PROMPT - prompts cause echo hallucinations on noisy audio
                **({"language": language_hint} if language_hint else {})
            )

            transcript = response.text.strip() if response.text else ""
            whisper_lang = getattr(response, 'language', 'en')

            logger.info(f"Whisper raw: '{transcript[:50]}...' (lang: {whisper_lang})")

            if not transcript:
                logger.info("Whisper returned empty transcript (possibly silence)")
                return None, "en"

            # Reject very short transcripts (< 3 chars) - likely noise
            if len(transcript.strip()) < 3:
                logger.info(f"Transcript too short ({len(transcript)} chars), skipping")
                return None, "en"

            # Detect repetitive Whisper hallucinations (e.g., "Hello hello hello")
            words = transcript.lower().split()
            if len(words) >= 2:
                unique_words = set(w.strip('.,!?') for w in words)
                # If very repetitive (same word repeated 3+ times), it's likely hallucination
                if len(unique_words) <= 2 and len(words) >= 3:
                    logger.warning(f"Rejecting repetitive Whisper transcript: '{transcript}'")
                    return None, "en"

            # CRITICAL: Filter out hallucinations - only accept allowed languages
            if not self.is_allowed_lang(whisper_lang):
                logger.warning(f"Rejecting hallucination - detected '{whisper_lang}' not in allowed: {ALLOWED_LANGS}")
                return None, "en"

            # Reject common hallucination phrases (Whisper often outputs these on unclear audio)
            hallucination_phrases = [
                'thanks for watching', 'subscribe', 'like and subscribe',
                'mbc', '뉴스', 'news', 'bye', 'okay bye', 'otter.ai',
                'thank you for watching', 'see you next time', 'transcribed by',
                'amara.org', 'legendas', 'subtitles', 'comunidade', 'community',
                # Whisper prompt bleed / meeting context
                'this is a business meeting conversation',
                'os falantes podem ter sotaques',
                'esta é uma conversa de reunião de negócios',
                'reunião de negócios',
                # Common noise interpretations
                'clicky', 'click', 'pomba', 'boom', 'beep', 'ding',
                'hmm', 'uhh', 'ahh', 'mmm', 'shh', 'psst',
                # Music/video artifacts
                '♪', '🎵', 'music', 'música', 'playing',
                # Common Whisper noise hallucinations
                'you', 'the', 'a', 'i',  # Single words often from noise
            ]
            # Short words that are likely noise when alone
            noise_words = {
                'clicky', 'click', 'pomba', 'boom', 'beep', 'ding', 'tick', 'tock',
                'hmm', 'uhh', 'ahh', 'mmm', 'shh', 'psst', 'uh', 'um', 'eh',
                'you', 'the', 'a', 'i', 'o', 'e', 'é', 'oh', 'ah',
            }
            short_courtesy = {
                'obrigado', 'obrigada', 'thank you', 'thanks', 'ok', 'okay', 'certo'
            }
            transcript_lower = transcript.lower().strip()
            words = transcript_lower.split()

            # Reject very short transcripts (1-2 words) that are likely noise
            if len(words) <= 2:
                # Check if it's just noise words
                if all(w.strip('.,!?') in noise_words for w in words):
                    logger.warning(f"Rejecting noise words: '{transcript}'")
                    return None, "en"
                # Check if it's just courtesy
                if transcript_lower.strip('.,!?') in short_courtesy:
                    logger.warning(f"Rejecting short courtesy: '{transcript}'")
                    return None, "en"

            # Check for hallucination phrases
            if any(phrase in transcript_lower for phrase in hallucination_phrases):
                if len(transcript) < 50:  # Short generic phrases are likely hallucinations
                    logger.warning(f"Rejecting hallucination phrase: '{transcript}'")
                    return None, "en"

            # Reject if transcript has no real alphabetic content
            alpha_chars = sum(1 for c in transcript if c.isalpha())
            if alpha_chars < 3:
                logger.warning(f"Rejecting non-alphabetic content: '{transcript}'")
                return None, "en"

            # Detect repetitive hallucinations (same phrase repeated)
            words = transcript_lower.split()
            if len(words) >= 6:
                # Check if the same 3-word pattern repeats
                for i in range(len(words) - 5):
                    pattern = ' '.join(words[i:i+3])
                    rest = ' '.join(words[i+3:])
                    if pattern in rest:
                        logger.warning(f"Rejecting repetitive hallucination: '{transcript[:50]}...'")
                        return None, "en"

            # Guard against prompt echo (if transcript equals prompt-ish)
            prompt_hint = "this is a business meeting conversation"
            if prompt_hint in transcript_lower and len(transcript_lower) <= len(prompt_hint) + 20:
                logger.warning(f"Rejecting prompt echo: '{transcript[:50]}...'")
                return None, "en"

            # Map 2-letter codes to our full codes
            lang_map = {
                "en": "en-US",
                "english": "en-US",
                "pt": "pt-BR",
                "portuguese": "pt-BR"
            }
            whisper_detected = lang_map.get(whisper_lang.lower(), "en-US")

            # Override Whisper's detection with text-based heuristic
            # Whisper often misdetects accented English as Portuguese
            detected_lang = self.detect_text_language(transcript, whisper_detected)

            logger.info(f"Whisper accepted: '{transcript[:50]}...' (whisper: {whisper_detected}, final: {detected_lang})")

            if not self.is_allowed_lang(detected_lang):
                logger.warning(f"Detected language '{detected_lang}' not allowed ({ALLOWED_LANGS}), skipping")
                return None, detected_lang

            return transcript, detected_lang

        except Exception as e:
            logger.error(f"Whisper STT error: {e}", exc_info=True)
            return None, "en"

    async def translate_text(self, text: str, target_lang: str, session_id: str = "default") -> str:
        """Translate text using GPT-4o-mini with short context memory for natural translations"""
        try:
            if not self.openai_client:
                logger.error("OpenAI client not initialized - check OPENAI_API_KEY")
                return text

            if not self.is_allowed_lang(target_lang):
                logger.warning(f"Target language '{target_lang}' not allowed ({ALLOWED_LANGS}), returning original")
                return text

            # Get language names for clearer prompts
            lang_names = {
                "pt": "Brazilian Portuguese",
                "pt-BR": "Brazilian Portuguese",
                "en": "English",
                "en-US": "English",
                "es": "Spanish",
                "fr": "French",
                "de": "German",
            }
            target = target_lang.split("-")[0]
            target_name = lang_names.get(target_lang, lang_names.get(target, target_lang))

            # Check if context has expired (no activity for too long)
            current_time = time.time()
            last_used = self.context_last_used.get(session_id, 0)
            if current_time - last_used > self.CONTEXT_EXPIRY_SECONDS:
                # Context expired, clear it to prevent drift
                if session_id in self.translation_context:
                    logger.info(f"[{session_id}] Context expired ({current_time - last_used:.0f}s), clearing")
                    self.translation_context[session_id] = []

            # Short context to keep coherence without drifting (only last 3 for prompt)
            history = self.translation_context.get(session_id, [])[-3:]
            context_lines = [
                f"- {item['original']} => {item['translation']}" for item in history
                if item.get("original") and item.get("translation")
            ]
            context_str = "\n".join(context_lines)

            system_prompt = (
                f"You are a TRANSLATION MACHINE. Your ONLY function is to translate text to {target_name}."
                f"{' Recent context:\n' + context_str if context_str else ''}\n\n"
                "ABSOLUTE RULES - VIOLATION MEANS FAILURE:\n"
                "1. Output ONLY the direct translation of the input - NOTHING ELSE\n"
                "2. NEVER respond, comment, or react to the content\n"
                "3. NEVER add words that aren't in the original (no greetings, no apologies, no emotions)\n"
                "4. NEVER say 'thank you', 'sorry', 'obrigado', 'desculpe', etc. unless those exact words are in the input\n"
                "5. If input is noise/unclear, return EMPTY STRING\n"
                "6. If input is already in target language, return it unchanged\n"
                "7. Do NOT translate proper names, brands, or technical terms\n"
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ]

            # Call GPT-4o-mini with temperature=0 for deterministic output
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=256,  # Short translations don't need 500 tokens
                temperature=0.0,  # Deterministic - no creativity/hallucination
            )

            translated = response.choices[0].message.content.strip()

            # POST-TRANSLATION FILTER: Reject common GPT hallucinations
            translated_lower = translated.lower().strip('.,!?')

            # If translation is empty or just whitespace
            if not translated or not translated.strip():
                logger.warning("Empty translation, returning original")
                return text

            # Detect GPT refusal phrases - these mean it refused to translate
            refusal_phrases = [
                "i'm sorry",
                "i am sorry",
                "i can't",
                "i cannot",
                "i'm not able",
                "i am not able",
                "not going to be able",
                "i apologize",
                "as an ai",
                "as a language model",
                "i don't understand",
                "could you please",
                "please provide",
                "sinto muito",
                "desculpe, mas",
                "não consigo",
                "não posso",
            ]
            for phrase in refusal_phrases:
                if phrase in translated_lower:
                    logger.warning(f"Rejecting GPT refusal phrase: '{translated}'")
                    return text

            # Common conversational responses GPT adds (NOT translations)
            hallucination_words = {
                # Portuguese
                'obrigado', 'obrigada', 'desculpe', 'desculpa', 'sinto',
                'olá', 'oi', 'tchau', 'adeus', 'certo', 'claro',
                # English
                'thank', 'thanks', 'sorry', 'apologize',
                'hello', 'hi', 'bye', 'goodbye', 'sure',
                # System/meta
                'understand', 'entendo', 'understood', 'entendido',
            }

            # Check if translation is mostly hallucination words
            words = [w.strip('.,!?') for w in translated_lower.split()]
            if words:
                hallucination_count = sum(1 for w in words if w in hallucination_words)
                # If >50% of words are hallucinations, reject
                if hallucination_count / len(words) > 0.5:
                    logger.warning(f"Rejecting hallucination translation (>{hallucination_count}/{len(words)} halluc words): '{translated}'")
                    return text

            # Detect repetitive patterns (e.g., "Obrigado. Obrigado. Obrigado.")
            if len(words) >= 2:
                unique_words = set(words)
                # If very repetitive (same word repeated), it's likely noise
                if len(unique_words) <= 2 and len(words) >= 3:
                    logger.warning(f"Rejecting repetitive translation: '{translated}'")
                    return text

            # Store in context for future use and update timestamp
            if session_id not in self.translation_context:
                self.translation_context[session_id] = []
            self.translation_context[session_id].append({
                "original": text,
                "translation": translated
            })
            self.context_last_used[session_id] = time.time()  # Update last used timestamp
            if len(self.translation_context[session_id]) > self.MAX_CONTEXT_SIZE:
                self.translation_context[session_id].pop(0)

            return translated

        except Exception as e:
            logger.error(f"GPT Translation error: {e}")
            return text

    async def text_to_speech(self, text: str, lang: str) -> bytes:
        """Convert text to speech using Google TTS"""
        try:
            synthesis_input = tts.SynthesisInput(text=text)

            voice = tts.VoiceSelectionParams(
                language_code=lang,
                ssml_gender=tts.SsmlVoiceGender.NEUTRAL
            )

            audio_config = tts.AudioConfig(
                audio_encoding=tts.AudioEncoding.MP3,
                speaking_rate=0.9  # Slightly slower for better clarity
            )

            response = self.tts_client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )

            return response.audio_content

        except Exception as e:
            logger.error(f"TTS error: {e}")
            return b""

    async def translate_and_speak(
        self,
        session_id: str,
        text: str,
        source_lang: str,
        target_lang: str
    ):
        """
        Translate text (from captions) and generate TTS.
        This skips the STT step since captions are already text.
        """
        try:
            # Send the original text as transcript
            await self.send({
                "type": "integration:transcript",
                "sessionId": session_id,
                "transcript": {
                    "id": f"{session_id}-caption-{asyncio.get_event_loop().time()}",
                    "text": text,
                    "lang": source_lang,
                    "source": "caption"
                }
            })

            # Translate to target language (with session context)
            translation = await self.translate_text(text, target_lang, session_id)
            logger.info(f"[{session_id}] Caption translation: {translation[:50]}...")

            await self.send({
                "type": "integration:translation",
                "sessionId": session_id,
                "translation": {
                    "original": text,
                    "text": translation,
                    "lang": target_lang,
                    "source": "caption",
                    "transcriptId": f"{session_id}-caption"
                }
            })

            # Generate TTS audio
            tts_audio = await self.text_to_speech(translation, target_lang)

            if tts_audio:
                # Auto-pause this session based on estimated TTS duration
                pause_duration = self.estimate_tts_duration(translation)
                pause_until = time.time() + pause_duration
                self.paused_until[session_id] = pause_until
                logger.info(f"[{session_id}] Auto-PAUSING after caption TTS for {pause_duration:.1f}s")

                await self.send({
                    "type": "integration:tts",
                    "sessionId": session_id,
                    "originalText": text,
                    "translatedText": translation,
                    "audio": base64.b64encode(tts_audio).decode(),
                    "duration": pause_duration  # Send duration for sync
                })

        except Exception as e:
            logger.error(f"[{session_id}] translate_and_speak error: {e}")

    async def generate_meeting_summary(self, session_id: str, transcripts: list, transcript_text: str):
        """Generate a meeting summary using GPT-4o-mini"""
        try:
            if not transcripts and not transcript_text:
                await self.send({
                    "type": "integration:summary",
                    "sessionId": session_id,
                    "summary": "Nenhuma transcrição disponível para resumir."
                })
                return

            # Format transcripts if not already formatted
            if not transcript_text and transcripts:
                transcript_text = "\n".join([
                    f"[{t.get('timestamp', 'N/A')}] {t.get('source', 'unknown')}: {t.get('original', '')} → {t.get('translated', '')}"
                    for t in transcripts
                ])

            # Generate summary with GPT
            prompt = f"""Analise esta transcrição de uma reunião e gere um resumo detalhado em português.

TRANSCRIÇÃO:
{transcript_text}

Por favor, inclua:
1. **Pontos Principais**: Os tópicos mais importantes discutidos
2. **Decisões Tomadas**: Quaisquer decisões ou acordos feitos
3. **Ações/Próximos Passos**: Tarefas ou ações mencionadas
4. **Participantes**: Quem falou sobre o quê (se identificável)

Formate de forma clara e organizada."""

            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Você é um assistente especializado em resumir reuniões de forma clara e concisa."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1500,
                temperature=0.3
            )

            summary = response.choices[0].message.content
            logger.info(f"[{session_id}] Summary generated: {len(summary)} chars")

            await self.send({
                "type": "integration:summary",
                "sessionId": session_id,
                "summary": summary
            })

        except Exception as e:
            logger.error(f"[{session_id}] Summary generation error: {e}")
            await self.send({
                "type": "integration:summary",
                "sessionId": session_id,
                "summary": f"Erro ao gerar resumo: {str(e)}"
            })

    async def send(self, message: dict):
        """Send message to Orchestrator"""
        if self.ws:
            await self.ws.send(json.dumps(message))


async def main():
    logger.info("""
╔═══════════════════════════════════════════════════════════════╗
║          MGtranslate Integration Service                      ║
╠═══════════════════════════════════════════════════════════════╣
║  Pipeline: STT -> Translation -> TTS                          ║
╚═══════════════════════════════════════════════════════════════╝
    """)

    service = IntegrationService()
    await service.initialize_clients()
    await service.connect()


if __name__ == "__main__":
    asyncio.run(main())
