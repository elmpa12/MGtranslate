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
import json
import logging
from typing import Optional
from pathlib import Path

import websockets
from dotenv import load_dotenv
from google.cloud import speech_v1 as speech
from google.cloud import translate_v2 as translate
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
        self.translate_client = None
        self.tts_client = None
        self.running = True

    async def initialize_clients(self):
        """Initialize Google Cloud clients"""
        try:
            self.speech_client = speech.SpeechClient()
            self.translate_client = translate.Client()
            self.tts_client = tts.TextToSpeechClient()
            logger.info("Google Cloud clients initialized")
        except Exception as e:
            logger.error(f"Failed to initialize clients: {e}")
            raise

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

        if msg_type == "audio:process":
            await self.process_audio(
                session_id,
                message.get("audio"),
                message.get("sourceLang", "en-US"),
                message.get("targetLang", "pt-BR")
            )

    async def process_audio(
        self,
        session_id: str,
        audio_b64: str,
        source_lang: str,
        target_lang: str
    ):
        """Full pipeline: STT -> Translate -> TTS"""
        try:
            # Decode audio
            audio_bytes = base64.b64decode(audio_b64)

            # 1. Speech-to-Text
            transcript = await self.speech_to_text(audio_bytes, source_lang)
            if not transcript:
                return

            logger.info(f"[{session_id}] Transcript: {transcript[:50]}...")

            # Send transcript to orchestrator
            await self.send({
                "type": "integration:transcript",
                "sessionId": session_id,
                "transcript": {
                    "id": f"{session_id}-{asyncio.get_event_loop().time()}",
                    "text": transcript,
                    "lang": source_lang
                }
            })

            # 2. Translate
            translation = await self.translate_text(transcript, target_lang)
            logger.info(f"[{session_id}] Translation: {translation[:50]}...")

            await self.send({
                "type": "integration:translation",
                "sessionId": session_id,
                "translation": {
                    "text": translation,
                    "lang": target_lang
                }
            })

            # 3. Text-to-Speech
            tts_audio = await self.text_to_speech(translation, target_lang)

            await self.send({
                "type": "integration:tts",
                "sessionId": session_id,
                "audio": base64.b64encode(tts_audio).decode()
            })

        except Exception as e:
            logger.error(f"[{session_id}] Pipeline error: {e}")

    async def speech_to_text(self, audio_bytes: bytes, lang: str) -> Optional[str]:
        """Convert audio to text using Google Speech-to-Text"""
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

    async def translate_text(self, text: str, target_lang: str) -> str:
        """Translate text using Google Translate"""
        try:
            # Extract language code (pt-BR -> pt)
            target = target_lang.split("-")[0]
            result = self.translate_client.translate(text, target_language=target)
            return result["translatedText"]

        except Exception as e:
            logger.error(f"Translation error: {e}")
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
                audio_encoding=tts.AudioEncoding.MP3
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
