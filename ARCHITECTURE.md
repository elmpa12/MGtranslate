# MGtranslate Architecture

## Overview

MGtranslate is a real-time bidirectional translation system for Google Meet calls. It captures audio from both the user's microphone and other meeting participants, transcribes it using Google Speech-to-Text, translates using GPT-4o-mini with context memory, and plays back the translation as synthesized speech.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MGtranslate System                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   Chrome     │    │ Orchestrator │    │ Integration  │                   │
│  │  Extension   │◄──►│   Service    │◄──►│   Service    │                   │
│  │              │    │  (Node.js)   │    │  (Python)    │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   │                            │
│         │                   │                   ▼                            │
│         │                   │          ┌──────────────────┐                 │
│         │                   │          │  Cloud Services  │                 │
│         │                   │          │  - Google STT    │                 │
│         │                   │          │  - OpenAI GPT    │                 │
│         │                   │          │  - Google TTS    │                 │
│         │                   │          └──────────────────┘                 │
│         │                   │                                                │
│         ▼                   │                                                │
│  ┌──────────────┐          │                                                │
│  │ Google Meet  │          │                                                │
│  │    Tab       │          │                                                │
│  └──────────────┘          │                                                │
│                             │                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
MGtranslate/
├── extension/                    # Chrome Extension (Manifest V3)
│   ├── manifest.json            # Extension configuration
│   ├── background.js            # Service worker
│   ├── content.js               # Audio capture & TTS playback
│   ├── offscreen.js             # Offscreen audio processing
│   ├── offscreen.html           # Offscreen document
│   ├── popup.html               # Extension popup UI
│   ├── popup.js                 # Popup logic
│   └── icons/                   # Extension icons
│
├── services/
│   ├── orchestrator/            # Message routing hub (Node.js)
│   │   ├── src/index.js         # Main server code
│   │   └── package.json         # Dependencies
│   │
│   └── integration/             # STT → Translation → TTS (Python)
│       ├── src/main.py          # Main service code
│       ├── requirements.txt     # Python dependencies
│       └── .env                 # Environment variables
│
├── docs/                        # Documentation
│   ├── Agents/                  # Agent documentation
│   └── Workflows/               # Workflow documentation
│
├── ARCHITECTURE.md              # This file
├── README.md                    # Project overview
└── KNOWN_ISSUES.md              # Known issues tracker
```

---

## Components

### 1. Chrome Extension (`/extension`)

Browser-side component running on Google Meet pages.

#### Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration (Manifest V3) |
| `background.js` | Service worker, tab capture permissions |
| `content.js` | Audio capture, WebSocket communication, TTS playback |
| `offscreen.js` | Alternative audio capture via chrome.tabCapture |
| `popup.html/js` | User interface for start/stop, language selection |

#### Audio Capture

The extension captures audio from two sources:

```
┌─────────────────────────────────────────────────────────┐
│                    Google Meet Tab                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐       ┌─────────────────┐          │
│  │ Tab Audio       │       │ Microphone      │          │
│  │ (Other people)  │       │ (Your voice)    │          │
│  │                 │       │                 │          │
│  │ getDisplayMedia │       │ getUserMedia    │          │
│  └────────┬────────┘       └────────┬────────┘          │
│           │                         │                    │
│           ▼                         ▼                    │
│  ┌──────────────────────────────────────────────┐       │
│  │         AudioContext + ScriptProcessor        │       │
│  │         - Downsample 48kHz → 16kHz           │       │
│  │         - Convert Float32 → Int16 PCM        │       │
│  │         - Silence detection (amplitude)      │       │
│  └──────────────────────────────────────────────┘       │
│                           │                              │
│                           ▼                              │
│                   WebSocket (WSS)                        │
│                   wss://mg.falconsoft.dev/ws          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Key Features:**
- Bidirectional capture (tab + microphone)
- Real-time audio processing
- Silence detection before sending
- Loop prevention (blocks capture during TTS playback)

### 2. Orchestrator Service (`/services/orchestrator`)

Central message routing hub connecting all components.

**Technology:** Node.js + Fastify + WebSocket

#### Responsibilities

- WebSocket server for all clients
- Message routing between services
- Session management
- Client registration by type
- Audio forwarding with loop prevention

#### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ws` | WebSocket | Main communication channel |
| `/sessions` | GET/POST | Session management |
| `/sessions/:id` | GET/DELETE | Individual session |

#### WebSocket Message Types

**Incoming:**
| Type | Source | Description |
|------|--------|-------------|
| `register` | Any | Client registration |
| `audio` | content_script | Audio chunk to process |
| `clearBuffer` | content_script | Clear buffer (TTS playing) |
| `startTranslation` | extension | Start session |
| `stopTranslation` | extension | Stop session |
| `integration:tts` | integration | TTS audio ready |

**Outgoing:**
| Type | Target | Description |
|------|--------|-------------|
| `audio:process` | integration | Audio for STT pipeline |
| `translation` | extensions | Translation with audio |
| `clearBuffer` | integration | Clear audio buffer |

### 3. Integration Service (`/services/integration`)

Python service handling the STT → Translation → TTS pipeline.

**Technology:** Python 3.11+ + asyncio + WebSocket

#### Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Service Pipeline                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Audio Input (PCM16, 16kHz)                                     │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────┐                        │
│  │     Audio Buffering                  │                        │
│  │     - MIN: 64KB (~2s)               │                        │
│  │     - MAX: 960KB (~30s)             │                        │
│  │     - Silence detection triggers    │                        │
│  │       immediate processing          │                        │
│  └────────────────┬────────────────────┘                        │
│                   │                                              │
│                   ▼                                              │
│  ┌─────────────────────────────────────┐                        │
│  │     Google Speech-to-Text           │                        │
│  │     - Bidirectional detection       │                        │
│  │     - en-US + pt-BR alternatives    │                        │
│  │     - Confidence threshold: 50%     │                        │
│  └────────────────┬────────────────────┘                        │
│                   │                                              │
│                   ▼                                              │
│  ┌─────────────────────────────────────┐                        │
│  │     GPT-4o-mini Translation         │                        │
│  │     - Context memory (6 exchanges)  │                        │
│  │     - Business meeting optimized    │                        │
│  │     - Natural, idiomatic output     │                        │
│  └────────────────┬────────────────────┘                        │
│                   │                                              │
│                   ▼                                              │
│  ┌─────────────────────────────────────┐                        │
│  │     Google Text-to-Speech           │                        │
│  │     - Neural voices                 │                        │
│  │     - Speaking rate: 0.9x           │                        │
│  │     - MP3 output                    │                        │
│  └────────────────┬────────────────────┘                        │
│                   │                                              │
│                   ▼                                              │
│         TTS Audio Output (MP3)                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Configuration

```python
# Audio Buffer Settings
MIN_BUFFER_SIZE = 64000    # ~2 seconds minimum
MAX_BUFFER_SIZE = 960000   # ~30 seconds maximum
BUFFER_TIMEOUT = 5.0       # Process after 5s silence
SILENCE_THRESHOLD = 200    # Amplitude threshold for silence detection

# Translation Context
MAX_CONTEXT_SIZE = 6       # Keep last 6 exchanges for context

# STT Settings
MIN_CONFIDENCE = 0.5       # Reject below 50% confidence
```

#### GPT-4o-mini System Prompt

The translation uses a specialized prompt for business meetings:

```
You are a professional interpreter for business meetings, translating to {target_language}.

Context: Two groups speaking different languages are in a meeting. They don't
understand each other's language, so your translation is their only way to
communicate. Make every translation crystal clear.

Rules:
- Translate naturally and idiomatically, interpreting the full context and intent
- Make the message clear and unambiguous for the listener
- Preserve professional tone while ensuring comprehension
- For technical/business terms, translate AND briefly clarify if unclear
- Keep company names, product names, and proper nouns as-is
- Use previous context to maintain consistency in terminology
```

---

## Data Flow

### Complete Translation Flow

```
User speaks (Portuguese)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. AUDIO CAPTURE (Chrome Extension)                              │
│    - Microphone captures user voice                              │
│    - Tab capture gets other participants                         │
│    - Downsampled to 16kHz PCM16                                  │
│    - Sent via WebSocket                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ORCHESTRATOR (Node.js)                                        │
│    - Receives audio chunks                                       │
│    - Routes to Integration service                               │
│    - Manages session state                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. AUDIO BUFFERING (Integration)                                 │
│    - Accumulates audio (2-30 seconds)                            │
│    - Detects silence → triggers processing                       │
│    - OR timeout → triggers processing                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. SPEECH-TO-TEXT (Google Cloud)                                 │
│    - Bidirectional language detection                            │
│    - Returns: "Precisamos entregar até sexta"                    │
│    - Detected language: pt-BR                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. TRANSLATION (OpenAI GPT-4o-mini)                              │
│    - Context from previous 6 exchanges                           │
│    - Business meeting optimized prompt                           │
│    - Output: "We need to deliver by Friday"                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. TEXT-TO-SPEECH (Google Cloud)                                 │
│    - Neural voice (en-US)                                        │
│    - Speaking rate 0.9x for clarity                              │
│    - Output: MP3 audio                                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. PLAYBACK (Chrome Extension)                                   │
│    - Receives audio via WebSocket                                │
│    - Plays through Audio element                                 │
│    - Pauses audio capture during playback                        │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
             Other participants hear: "We need to deliver by Friday"
```

---

## Loop Prevention

The system has multiple layers to prevent infinite translation loops (TTS being re-captured):

### Layer 1: Client-Side (content.js)
```javascript
// Block tab capture when TTS is playing
let isPlayingTranslation = false;

tabProcessor.onaudioprocess = (event) => {
  if (isPlayingTranslation) return; // Don't capture during TTS
  // ... process audio
};
```

### Layer 2: Integration Service (main.py)
```python
# Dynamic pause based on TTS duration
def estimate_tts_duration(text: str) -> float:
    chars = len(text)
    duration = (chars / 10.0) + 0.5  # ~10 chars/sec + buffer
    return max(1.5, min(duration, 8.0))

# Pause after sending TTS
pause_duration = self.estimate_tts_duration(translation)
self.paused_until[session_id] = time.time() + pause_duration
```

### Layer 3: Silence Detection
```python
# Process immediately when user stops speaking
avg_amplitude = sum(abs(s) for s in samples) / len(samples)
is_silence = avg_amplitude < 200

if buffer_size >= MIN_BUFFER_SIZE and is_silence:
    await self.process_buffered_audio(session_id)  # Process now!
```

---

## Audio Specifications

### Capture Format
| Property | Value |
|----------|-------|
| Sample Rate | 48kHz (native) → 16kHz (downsampled) |
| Channels | 1 (mono) |
| Bit Depth | 16-bit signed integer (PCM16) |
| Chunk Size | 4096 samples (~85ms at 48kHz) |
| Transport | Base64 encoded JSON over WebSocket |

### TTS Output Format
| Property | Value |
|----------|-------|
| Format | MP3 |
| Sample Rate | 24kHz |
| Voice | Neural (Google Cloud TTS) |
| Speaking Rate | 0.9x (slightly slower for clarity) |
| Transport | Base64 data URL |

---

## Environment Variables

### Integration Service (.env)
```bash
# Google Cloud credentials
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# OpenAI API key for GPT translations
OPENAI_API_KEY=sk-...

# WebSocket connection
ORCHESTRATOR_URL=ws://localhost:3001/ws
```

### Orchestrator Service
```bash
# Server port
ORCHESTRATOR_PORT=3001
```

---

## Deployment

### Development Setup

```
┌─────────────────────────────────────────────────────────────────┐
│  Local Machine                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │ Orchestrator│     │ Integration │     │ localtunnel │       │
│  │ :3001       │◄───►│ Service     │     │             │       │
│  └──────┬──────┘     └─────────────┘     └──────┬──────┘       │
│         │                                        │               │
│         └────────────────────────────────────────┘               │
│                              │                                   │
│                              │ WSS tunnel                        │
│                              ▼                                   │
│                    wss://mg.falconsoft.dev                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Starting Services

```bash
# 1. Start Orchestrator
cd services/orchestrator
npm install
node src/index.js

# 2. Start Integration Service
cd services/integration
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python src/main.py

# 3. Start Localtunnel (for Chrome extension access)
npx lt --port 3001 --subdomain mgtranslate

# 4. Load Chrome Extension
# Go to chrome://extensions
# Enable Developer mode
# Load unpacked → select /extension folder
```

---

## API Services Used

| Service | Provider | Purpose | Cost |
|---------|----------|---------|------|
| Speech-to-Text | Google Cloud | Audio → Text | ~$0.006/15s |
| Translation | OpenAI GPT-4o-mini | Natural translation | ~$0.15/1M tokens |
| Text-to-Speech | Google Cloud | Text → Audio | ~$4/1M chars |

---

## Performance Characteristics

### Latency Breakdown
| Stage | Typical Duration |
|-------|------------------|
| Audio capture → WebSocket | ~50ms |
| Audio buffering | 2-30 seconds (until silence) |
| STT processing | 500-1500ms |
| GPT translation | 300-800ms |
| TTS generation | 200-500ms |
| Response delivery | ~50ms |
| **Total (after speech ends)** | **~1-3 seconds** |

### Resource Usage
| Component | CPU | Memory |
|-----------|-----|--------|
| Chrome Extension | Low | ~50MB |
| Orchestrator | Low | ~100MB |
| Integration | Medium | ~200MB |

---

## Security Considerations

### Current Implementation
- WebSocket over WSS (encrypted via localtunnel)
- Google Cloud credentials via service account
- OpenAI API key in environment variables

### Production Recommendations
1. Use proper SSL certificates (not localtunnel)
2. Implement authentication (JWT/API keys)
3. Add rate limiting
4. Store credentials in secret manager
5. Implement user sessions

---

## Future Improvements

1. **Streaming STT** - Lower latency with streaming recognition
2. **WebRTC** - Direct audio streaming
3. **Speaker Diarization** - Identify who is speaking
4. **Custom Vocabulary** - Domain-specific terms
5. **Multiple Languages** - Support 3+ languages
6. **Local TTS Option** - Browser's SpeechSynthesis for faster playback
7. **Caching** - Cache common translations

---

*Last updated: 2024-11-29*
