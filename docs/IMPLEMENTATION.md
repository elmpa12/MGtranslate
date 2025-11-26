# MGtranslate - Implementation Guide

**Last Updated:** 2024-11-26
**Status:** Core services implemented, PoC validated

## Current State

### Validated PoC

The Proof of Concept has been **fully validated** with real audio capture:

| Test | Status | Details |
|------|--------|---------|
| Bot Google Login | ✅ | Chrome profile authentication |
| Bot Enter Meeting | ✅ | Successfully joins as participant |
| WebRTC Audio Capture | ✅ | 470KB captured in test session |
| Audio Streaming | ✅ | Chunks streamed via WebSocket |

### Implemented Services

All 4 core services are implemented and functional:

1. **Orchestrator** - Central hub (Node.js/Fastify)
2. **Meet Bot** - Puppeteer bot (Node.js)
3. **Integration** - AI pipeline (Python)
4. **UI** - Web interface (Next.js)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
│                    http://SERVER_IP:4000                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                      Orchestrator (:3001)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  REST API   │  │  WebSocket  │  │    Session Manager      │ │
│  │  /sessions  │  │    Hub      │  │    (in-memory Map)      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │                    │                      │
          │ ws                 │ ws                   │ ws
          ▼                    ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│     Meet Bot     │  │    Integration   │  │   UI Clients     │
│   (Puppeteer)    │  │     (Python)     │  │    (Browser)     │
│                  │  │                  │  │                  │
│ - Join Meet      │  │ - STT (Google)   │  │ - Display status │
│ - Capture WebRTC │  │ - Translation    │  │ - Show transcript│
│ - Stream audio   │  │ - TTS (Google)   │  │ - Controls       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
          │
          ▼
┌──────────────────┐
│   Google Meet    │
│   (WebRTC)       │
└──────────────────┘
```

---

## Service Details

### 1. Orchestrator Service

**Location:** `services/orchestrator/`
**Stack:** Node.js 20, Fastify, WebSocket
**Port:** 3001

**Key Files:**
- `src/index.js` - Main server

**REST Endpoints:**
```
GET  /health              - Health check
POST /sessions            - Create new session
GET  /sessions            - List all sessions
GET  /sessions/:id        - Get session by ID
DELETE /sessions/:id      - End session
```

**WebSocket Protocol:**
```javascript
// Client registration
{ type: 'register', clientType: 'ui' | 'meet-bot' | 'integration' }

// Bot status update
{ type: 'bot:status', sessionId, status, data }

// Audio from bot
{ type: 'bot:audio', sessionId, audio: 'base64...', format: 'webm' }

// Transcript from integration
{ type: 'integration:transcript', sessionId, transcript: { id, text, lang } }

// Translation from integration
{ type: 'integration:translation', sessionId, translation: { text, lang } }

// TTS ready
{ type: 'integration:tts', sessionId, audio: 'base64...' }
```

### 2. Meet Bot Service

**Location:** `services/meet-bot/`
**Stack:** Node.js 20, Puppeteer, Stealth Plugin
**Chrome Profile:** `poc/meet-audio-capture/session/chrome-profile/`

**Key Files:**
- `src/index.js` - Bot logic and WebRTC capture

**Capabilities:**
- Profile-based authentication (no login at runtime)
- WebRTC audio track interception
- MediaRecorder for audio capture
- 1-second audio chunks
- Auto-reconnect to Orchestrator

**WebRTC Capture Script:**
The bot injects a script that:
1. Overrides `RTCPeerConnection`
2. Captures audio tracks from `ontrack` events
3. Records using MediaRecorder
4. Streams base64-encoded chunks to server

### 3. Integration Service

**Location:** `services/integration/`
**Stack:** Python 3.11, Google Cloud APIs
**Dependencies:** `requirements.txt`

**Key Files:**
- `src/main.py` - Pipeline logic

**Pipeline:**
```
Audio (webm) → STT → Text → Translation → Translated Text → TTS → Audio (mp3)
```

**Google Cloud APIs Used:**
- `google-cloud-speech` - Speech-to-Text
- `google-cloud-translate` - Translation
- `google-cloud-texttospeech` - Text-to-Speech

### 4. UI Service

**Location:** `services/ui/`
**Stack:** Next.js 14, React 18, Tailwind CSS
**Port:** 4000

**Key Files:**
- `src/app/page.js` - Main component
- `src/app/globals.css` - Styles

**Features:**
- Session creation/management
- Language selection (source/target)
- Real-time bot status display
- Live transcript feed
- Dynamic orchestrator URL (works on LAN)

---

## Setup Instructions

### Prerequisites

```bash
# Node.js 20+
node --version  # v20.x.x

# Python 3.11+
python3 --version  # 3.11.x

# Chrome/Chromium (for bot)
google-chrome --version
```

### 1. Clone Repository

```bash
git clone git@github.com:elmpa12/MGtranslate.git
cd MGtranslate
```

### 2. Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit with your values
nano .env
```

**Required .env values:**
```env
# Google Cloud (required for Integration Service)
GOOGLE_APPLICATION_CREDENTIALS=./config/credentials/gcp-service-account.json
GOOGLE_PROJECT_ID=your-project-id

# Bot Google Account
BOT_GOOGLE_EMAIL=mgtranslate58@gmail.com
BOT_GOOGLE_PASSWORD=your-password

# Ports
ORCHESTRATOR_PORT=3001
UI_PORT=4000
```

### 3. Setup Chrome Profile for Bot

The bot needs a Chrome profile with a logged-in Google account:

```bash
# On a machine with GUI (not headless server)
google-chrome --user-data-dir="$HOME/chrome-bot-profile"

# Log in to the bot's Google account (e.g., mgtranslate58@gmail.com)
# Close Chrome completely

# Compress the profile
tar -czvf chrome-profile.tar.gz chrome-bot-profile/

# Transfer to server
scp chrome-profile.tar.gz user@server:/path/to/MGtranslate/poc/meet-audio-capture/session/

# On server, extract
cd /path/to/MGtranslate/poc/meet-audio-capture/session/
tar -xzf chrome-profile.tar.gz
mv chrome-bot-profile chrome-profile
```

### 4. Install Dependencies

```bash
# Orchestrator
cd services/orchestrator && npm install && cd ../..

# Meet Bot
cd services/meet-bot && npm install && cd ../..

# UI
cd services/ui && npm install && cd ../..

# Integration (Python)
cd services/integration
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..
```

### 5. Setup Google Cloud Credentials

1. Create GCP project
2. Enable APIs:
   - Cloud Speech-to-Text
   - Cloud Translation
   - Cloud Text-to-Speech
3. Create service account with roles:
   - Cloud Speech-to-Text User
   - Cloud Translation API User
   - Cloud Text-to-Speech User
4. Download JSON key
5. Place at `config/credentials/gcp-service-account.json`

---

## Running the Services

### Development Mode

**All services at once:**
```bash
./scripts/dev.sh
```

**Individual services:**
```bash
# Terminal 1 - Orchestrator
cd services/orchestrator
ORCHESTRATOR_PORT=3001 npm run dev

# Terminal 2 - Meet Bot
cd services/meet-bot
npm run dev

# Terminal 3 - Integration
cd services/integration
source .venv/bin/activate
python src/main.py

# Terminal 4 - UI
cd services/ui
npm run dev
```

### Production (Docker)

```bash
docker-compose up -d
```

### Access URLs

| Service | Local | Network |
|---------|-------|---------|
| UI | http://localhost:4000 | http://SERVER_IP:4000 |
| API | http://localhost:3001 | http://SERVER_IP:3001 |
| WebSocket | ws://localhost:3001/ws | ws://SERVER_IP:3001/ws |

---

## Bot Account Details

**Current bot account:**
- Email: `mgtranslate58@gmail.com`
- Password: (stored in .env)
- Purpose: Joins Google Meet calls as participant

**Alternative account (owner's):**
- Email: `marcelomargolis102@gmail.com`
- Use for: Testing as the "host" of calls

---

## Known Issues & Solutions

### 1. Port not loading from .env

**Symptom:** Orchestrator uses wrong port
**Solution:** Set port explicitly:
```bash
ORCHESTRATOR_PORT=3001 node src/index.js
```

### 2. Chrome sandbox error on Ubuntu

**Symptom:** "No usable sandbox" error
**Solution:** Use `--no-sandbox` flag (already in code)

### 3. Bot can't join (same account as host)

**Symptom:** Shows "Switch here" instead of "Join"
**Solution:** Use different Google accounts for bot and host

### 4. Cookies not working for auth

**Symptom:** Bot not authenticated despite cookies
**Solution:** Use full Chrome profile instead of just cookies

---

## File Structure

```
MGtranslate/
├── services/
│   ├── orchestrator/
│   │   ├── src/index.js       # Main server
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── meet-bot/
│   │   ├── src/index.js       # Bot with WebRTC capture
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── integration/
│   │   ├── src/main.py        # STT/Translation/TTS
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── ui/
│       ├── src/app/
│       │   ├── page.js        # Main React component
│       │   ├── layout.js
│       │   └── globals.css
│       ├── package.json
│       ├── tailwind.config.js
│       └── Dockerfile
├── poc/
│   └── meet-audio-capture/
│       ├── src/               # PoC test scripts
│       │   ├── test-with-profile.js
│       │   ├── test-with-cookies.js
│       │   └── ...
│       ├── session/
│       │   └── chrome-profile/  # Bot's Chrome profile
│       └── output/            # Test screenshots/audio
├── config/
│   └── credentials/
│       └── gcp-service-account.json
├── docs/
│   ├── IMPLEMENTATION.md      # This file
│   └── Agents/                # Agent specifications
├── scripts/
│   └── dev.sh                 # Development script
├── docker-compose.yml
├── .env                       # Environment config
└── README.md                  # Original specification
```

---

## Next Steps

1. **Test full flow** - Create session via UI, verify bot joins, check transcripts
2. **Audio playback** - Implement TTS audio playback in Meet call
3. **Error handling** - Add retry logic, better error messages
4. **Authentication** - Add user auth to UI
5. **Persistence** - Replace in-memory Map with Redis/DB
6. **Monitoring** - Add logging, metrics, health checks

---

## Useful Commands

```bash
# Check what's running on ports
lsof -i :3001,:4000

# Kill processes on ports
fuser -k 3001/tcp 4000/tcp

# View orchestrator logs
cd services/orchestrator && npm run dev

# Test PoC manually
cd poc/meet-audio-capture
node src/test-with-profile.js "https://meet.google.com/xxx-xxxx-xxx"

# Git push changes
git add -A && git commit -m "message" && git push origin main
```

---

## Contact

- GitHub: https://github.com/elmpa12/MGtranslate
- Bot Account: mgtranslate58@gmail.com
