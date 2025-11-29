"""
MGtranslate Integration Service

Handles the AI pipeline:
- Speech-to-Text (Google Cloud Speech)
- Translation (Google Cloud Translate)
- Text-to-Speech (Google Cloud TTS)
"""

import os
import asyncio
import base64
import html
import json
import logging
import time
from typing import Optional
from pathlib import Path

import websockets
from dotenv import load_dotenv
from openai import OpenAI
from google.cloud import speech_v1 as speech
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

# Set credentials path
if GOOGLE_CREDENTIALS:
    cred_path = Path(__file__).parent.parent.parent.parent / GOOGLE_CREDENTIALS.lstrip("./")
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(cred_path)


class IntegrationService:
    def __init__(self):
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.speech_client = None
        self.openai_client = None
        self.tts_client = None
        self.running = True

        # Context memory for better GPT translations (keeps last N exchanges per session)
        self.translation_context: dict[str, list] = {}
        self.MAX_CONTEXT_SIZE = 6  # Keep last 6 exchanges for context

        # Audio buffering per session
        # We need to accumulate ~2-3 seconds of audio before sending to STT
        self.audio_buffers: dict[str, bytearray] = {}
        self.buffer_timers: dict[str, asyncio.Task] = {}
        self.session_configs: dict[str, dict] = {}

        # Pause state to prevent infinite loop
        # When TTS is playing, we pause audio processing for that session
        self.paused_until: dict[str, float] = {}
        # We now calculate pause duration dynamically based on TTS text length

        # Minimum STT confidence threshold to filter out garbled/low-quality transcriptions
        self.MIN_CONFIDENCE = 0.35  # Lowered for accented speech recognition

        # Buffer settings (16kHz, 16-bit mono = 32000 bytes/second)
        self.MIN_BUFFER_SIZE = 48000  # ~1.5 seconds minimum
        self.MAX_BUFFER_SIZE = 960000  # ~30 seconds maximum (for longer explanations)
        self.BUFFER_TIMEOUT = 3.0  # Process after 3 seconds of no audio

        # Silence detection - require CONSECUTIVE silence to trigger
        self.SILENCE_THRESHOLD = 300  # Amplitude below this = silence
        self.SILENCE_DURATION_REQUIRED = 1.0  # Seconds of continuous silence before processing (was 1.5s)
        self.silence_start_time: dict[str, float] = {}  # Track when silence started per session

    async def initialize_clients(self):
        """Initialize Google Cloud and OpenAI clients"""
        try:
            self.speech_client = speech.SpeechClient()
            self.tts_client = tts.TextToSpeechClient()

            # Initialize OpenAI client for translations
            openai_key = os.getenv("OPENAI_API_KEY")
            if openai_key and not openai_key.startswith("sk-your"):
                self.openai_client = OpenAI(api_key=openai_key)
                logger.info("OpenAI client initialized (GPT-4o-mini for translations)")
            else:
                logger.warning("OpenAI API key not configured - translations will fail!")

            logger.info("Google Cloud clients initialized")
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

            # Clear existing buffer
            if session_id in self.audio_buffers:
                self.audio_buffers[session_id] = bytearray()
            if session_id in self.buffer_timers:
                self.buffer_timers[session_id].cancel()
                del self.buffer_timers[session_id]
        elif msg_type == "audio:process":
            await self.buffer_audio(
                session_id,
                message.get("audio"),
                message.get("sourceLang", "en-US"),
                message.get("targetLang", "pt-BR"),
                message.get("format", "webm")
            )
        elif msg_type == "caption:translate":
            # Direct translation from Meet's live captions (no STT needed)
            text = message.get("text", "")
            source_lang = message.get("sourceLang", "en-US")
            target_lang = message.get("targetLang", "pt-BR")

            if text:
                logger.info(f"[{session_id}] Caption received: {text[:50]}...")
                await self.translate_and_speak(session_id, text, source_lang, target_lang)

    async def buffer_audio(
        self,
        session_id: str,
        audio_b64: str,
        source_lang: str,
        target_lang: str,
        audio_format: str = "webm"
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

            # Initialize buffer for this session if needed
            if session_id not in self.audio_buffers:
                self.audio_buffers[session_id] = bytearray()
                self.session_configs[session_id] = {
                    "source_lang": source_lang,
                    "target_lang": target_lang,
                    "format": audio_format
                }
                logger.info(f"[{session_id}] Started buffering audio")

            # Append audio to buffer
            self.audio_buffers[session_id].extend(audio_bytes)
            buffer_size = len(self.audio_buffers[session_id])

            # Check amplitude of this chunk to detect silence
            samples = [int.from_bytes(audio_bytes[i:i+2], 'little', signed=True)
                       for i in range(0, len(audio_bytes) - 1, 2)]
            avg_amplitude = sum(abs(s) for s in samples) / len(samples) if samples else 0
            is_silence = avg_amplitude < self.SILENCE_THRESHOLD

            # Track consecutive silence duration
            current_time = asyncio.get_event_loop().time()
            if is_silence:
                if session_id not in self.silence_start_time:
                    self.silence_start_time[session_id] = current_time
                silence_duration = current_time - self.silence_start_time[session_id]
            else:
                # Speaking again, reset silence timer
                self.silence_start_time.pop(session_id, None)
                silence_duration = 0

            # Cancel existing timer if any
            if session_id in self.buffer_timers:
                self.buffer_timers[session_id].cancel()

            # Check if buffer is large enough to process
            if buffer_size >= self.MAX_BUFFER_SIZE:
                # Buffer is full, process immediately
                logger.info(f"[{session_id}] Buffer full ({buffer_size} bytes), processing...")
                self.silence_start_time.pop(session_id, None)
                await self.process_buffered_audio(session_id)
            elif buffer_size >= self.MIN_BUFFER_SIZE and silence_duration >= self.SILENCE_DURATION_REQUIRED:
                # Have enough audio AND sustained silence - speaker finished!
                logger.info(f"[{session_id}] Sustained silence ({silence_duration:.1f}s) with {buffer_size} bytes, processing...")
                self.silence_start_time.pop(session_id, None)
                await self.process_buffered_audio(session_id)
            elif buffer_size >= self.MIN_BUFFER_SIZE:
                # Have enough audio but speaker might continue, set short timer
                self.buffer_timers[session_id] = asyncio.create_task(
                    self.delayed_process(session_id, 2.0)  # 2s delay as backup
                )
            else:
                # Not enough audio yet, set timeout
                self.buffer_timers[session_id] = asyncio.create_task(
                    self.delayed_process(session_id, self.BUFFER_TIMEOUT)
                )

        except Exception as e:
            logger.error(f"[{session_id}] Buffer error: {e}")

    async def delayed_process(self, session_id: str, delay: float):
        """Process audio after a delay (triggered by silence)"""
        try:
            await asyncio.sleep(delay)
            if session_id in self.audio_buffers and len(self.audio_buffers[session_id]) > 0:
                await self.process_buffered_audio(session_id)
        except asyncio.CancelledError:
            pass  # Timer was cancelled, new audio arrived

    async def process_buffered_audio(self, session_id: str):
        """Process the buffered audio through the pipeline"""
        if session_id not in self.audio_buffers:
            return

        buffer = bytes(self.audio_buffers[session_id])
        config = self.session_configs.get(session_id, {})

        # Clear the buffer
        self.audio_buffers[session_id] = bytearray()

        if len(buffer) < 8000:  # Less than 0.25 seconds, skip
            logger.debug(f"[{session_id}] Buffer too small ({len(buffer)} bytes), skipping")
            return

        # Process through the full pipeline
        await self.process_audio(
            session_id,
            base64.b64encode(buffer).decode(),
            config.get("source_lang", "en-US"),
            config.get("target_lang", "pt-BR"),
            config.get("format", "pcm16")
        )

    async def process_audio(
        self,
        session_id: str,
        audio_b64: str,
        source_lang: str,
        target_lang: str,
        audio_format: str = "webm"
    ):
        """Full pipeline: STT (with language detection) -> Translate -> TTS

        Bidirectional translation:
        - Detects which language is being spoken (source or target)
        - Translates to the opposite language
        """
        try:
            # Decode audio
            audio_bytes = base64.b64decode(audio_b64)

            logger.info(f"[{session_id}] Processing audio: {len(audio_bytes)} bytes, format: {audio_format}")

            # 1. Speech-to-Text with bidirectional language detection
            # Try to recognize in both languages and pick the best result
            transcript, detected_lang = await self.speech_to_text_bidirectional(
                audio_bytes, source_lang, target_lang, audio_format
            )
            if not transcript:
                return

            logger.info(f"[{session_id}] Detected: {detected_lang} | Transcript: {transcript[:50]}...")

            # Determine translation direction
            # If spoken in source lang, translate to target; otherwise translate to source
            if detected_lang.startswith(source_lang.split("-")[0]):
                translate_to = target_lang
            else:
                translate_to = source_lang

            # Send transcript to orchestrator
            await self.send({
                "type": "integration:transcript",
                "sessionId": session_id,
                "transcript": {
                    "id": f"{session_id}-{asyncio.get_event_loop().time()}",
                    "text": transcript,
                    "lang": detected_lang,
                    "direction": f"{detected_lang} → {translate_to}"
                }
            })

            # 2. Translate to the opposite language (with session context)
            translation = await self.translate_text(transcript, translate_to, session_id)
            logger.info(f"[{session_id}] Translation ({translate_to}): {translation[:50]}...")

            await self.send({
                "type": "integration:translation",
                "sessionId": session_id,
                "translation": {
                    "text": translation,
                    "lang": translate_to
                }
            })

            # 3. Text-to-Speech in the target language
            tts_audio = await self.text_to_speech(translation, translate_to)

            # Auto-pause this session based on estimated TTS duration
            pause_duration = self.estimate_tts_duration(translation)
            pause_until = time.time() + pause_duration
            self.paused_until[session_id] = pause_until
            logger.info(f"[{session_id}] Auto-PAUSING after TTS for {pause_duration:.1f}s")

            await self.send({
                "type": "integration:tts",
                "sessionId": session_id,
                "audio": base64.b64encode(tts_audio).decode()
            })

        except Exception as e:
            logger.error(f"[{session_id}] Pipeline error: {e}")

    async def speech_to_text_bidirectional(
        self,
        audio_bytes: bytes,
        lang1: str,
        lang2: str,
        audio_format: str = "webm"
    ) -> tuple[Optional[str], str]:
        """
        Speech-to-Text with automatic language detection between two languages.

        Uses Google's alternative_language_codes feature to detect and transcribe
        in whichever language is being spoken.

        Returns: (transcript, detected_language_code)
        """
        try:
            audio = speech.RecognitionAudio(content=audio_bytes)

            # Configure encoding based on format
            if audio_format == "pcm16":
                encoding = speech.RecognitionConfig.AudioEncoding.LINEAR16
                sample_rate = 16000
            else:
                encoding = speech.RecognitionConfig.AudioEncoding.WEBM_OPUS
                sample_rate = 48000

            # Configure STT with both languages
            # Google will auto-detect which one is being spoken
            config = speech.RecognitionConfig(
                encoding=encoding,
                sample_rate_hertz=sample_rate,
                language_code=lang1,  # Primary language
                alternative_language_codes=[lang2],  # Also check this language
                enable_automatic_punctuation=True,
                model="latest_long",  # Better accuracy model
                use_enhanced=True,  # Enhanced model for better recognition
            )

            # Analyze audio content to check if it's actually audio or silence
            import struct
            samples = struct.unpack(f'<{len(audio_bytes)//2}h', audio_bytes)  # Little-endian int16
            max_amp = max(abs(s) for s in samples)
            avg_amp = sum(abs(s) for s in samples) / len(samples)
            logger.info(f"Calling STT with {len(audio_bytes)} bytes, encoding={encoding}, sample_rate={sample_rate}")
            logger.info(f"Audio analysis: max_amplitude={max_amp}, avg_amplitude={avg_amp:.1f} (samples={len(samples)})")
            response = self.speech_client.recognize(config=config, audio=audio)

            logger.info(f"STT response: {len(response.results)} results")

            if response.results:
                result = response.results[0]
                transcript = result.alternatives[0].transcript
                confidence = result.alternatives[0].confidence if hasattr(result.alternatives[0], 'confidence') else 0
                # Get the detected language from the result
                detected_lang = result.language_code if hasattr(result, 'language_code') else lang1
                logger.info(f"STT result: '{transcript}' (confidence: {confidence:.2f}, lang: {detected_lang})")

                # Filter out low-confidence results to avoid garbled translations
                if confidence < self.MIN_CONFIDENCE:
                    logger.info(f"STT confidence {confidence:.2f} below threshold {self.MIN_CONFIDENCE}, ignoring")
                    return None, lang1

                return transcript, detected_lang

            logger.info("STT returned no results (possibly silence)")
            return None, lang1

        except Exception as e:
            logger.error(f"STT bidirectional error: {e}", exc_info=True)
            return None, lang1

    async def speech_to_text(self, audio_bytes: bytes, lang: str) -> Optional[str]:
        """Convert audio to text using Google Speech-to-Text (single language)"""
        try:
            audio = speech.RecognitionAudio(content=audio_bytes)
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
                sample_rate_hertz=48000,
                language_code=lang,
                enable_automatic_punctuation=True,
            )

            response = self.speech_client.recognize(config=config, audio=audio)

            if response.results:
                return response.results[0].alternatives[0].transcript

            return None

        except Exception as e:
            logger.error(f"STT error: {e}")
            return None

    async def translate_text(self, text: str, target_lang: str, session_id: str = "default") -> str:
        """Translate text using GPT-4o-mini with context memory for natural translations"""
        try:
            if not self.openai_client:
                logger.error("OpenAI client not initialized - check OPENAI_API_KEY")
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

            # Initialize context for this session if needed
            if session_id not in self.translation_context:
                self.translation_context[session_id] = []

            # Build context from previous exchanges
            context_messages = []
            for prev in self.translation_context[session_id]:
                context_messages.append({"role": "user", "content": prev["original"]})
                context_messages.append({"role": "assistant", "content": prev["translation"]})

            # System prompt - STRICT translation only, no conversation
            system_prompt = f"""You are a TRANSLATION MACHINE. Translate the input text to {target_name}.

STRICT RULES:
1. Output ONLY the direct translation - nothing else
2. NEVER respond to the content - ONLY translate it word-for-word
3. NEVER add greetings, emotions, commentary, or reactions
4. NEVER expand or interpret beyond what was literally said

Examples of CORRECT behavior:
- "I'm not having a good day" → "Não estou tendo um bom dia" (NOT "Sinto muito...")
- "Hello" → "Olá" (NOT "Olá! Como você está?")
- "Try to be nice" → "Tente ser gentil" (NOT "Olá! Espero que...")

You are an invisible translator. Output ONLY the translation."""

            messages = [
                {"role": "system", "content": system_prompt},
                *context_messages,
                {"role": "user", "content": text}
            ]

            # Call GPT-4o-mini (fast and cheap)
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=500,
                temperature=0.3,  # Low temperature for consistent translations
            )

            translated = response.choices[0].message.content.strip()

            # Store in context (keep last N exchanges)
            self.translation_context[session_id].append({
                "original": text,
                "translation": translated
            })
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
                    "source": "caption"
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
                    "audio": base64.b64encode(tts_audio).decode()
                })

        except Exception as e:
            logger.error(f"[{session_id}] translate_and_speak error: {e}")

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
