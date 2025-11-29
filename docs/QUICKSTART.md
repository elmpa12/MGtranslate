# MGtranslate - Quick Start Guide

## Prerequisites

- Node.js 18+
- Python 3.11+
- Chrome browser
- Google Cloud credentials (Speech-to-Text, Text-to-Speech APIs enabled)
- OpenAI API key

## Installation

```bash
# 1. Clone and enter directory
git clone <repo-url>
cd MGtranslate

# 2. Install Orchestrator
cd services/orchestrator
npm install
cd ../..

# 3. Install Integration Service
cd services/integration
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..
```

## Configuration

### Google Cloud Credentials

```bash
# Set environment variable pointing to your service account JSON
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/gcp-service-account.json"
```

### OpenAI API Key

```bash
# Create .env file in integration service
echo "OPENAI_API_KEY=sk-your-key-here" > services/integration/.env
```

## Running the Services

Open 3 terminal windows:

```bash
# Terminal 1: Orchestrator
cd services/orchestrator
node src/index.js

# Terminal 2: Integration Service
cd services/integration
source .venv/bin/activate
python src/main.py

# Terminal 3: Localtunnel
npx lt --port 3001 --subdomain mgtranslate
```

## Installing Chrome Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder

## Usage

1. Join a Google Meet call
2. Click MGtranslate extension icon
3. Select languages (Portuguese ↔ English)
4. Click **Start Translation**
5. Share tab with **audio enabled** when prompted
6. Speak - translations play automatically!

## Ports

| Service | Port | URL |
|---------|------|-----|
| Orchestrator | 3001 | http://localhost:3001 |
| Localtunnel | - | wss://mg.falconsoft.dev/ws |

## Key Files

| File | Purpose |
|------|---------|
| `extension/content.js` | Audio capture & TTS playback |
| `extension/popup.js` | Extension UI |
| `services/orchestrator/src/index.js` | WebSocket hub |
| `services/integration/src/main.py` | STT → GPT → TTS pipeline |
| `services/integration/.env` | API keys |

## Verify Services

```bash
# Check orchestrator health
curl http://localhost:3001/health

# Check localtunnel
curl https://mg.falconsoft.dev/health

# Watch integration logs
tail -f /tmp/integration.log
```

## Troubleshooting

### Services not connecting
```bash
# Kill and restart all
pkill -f "node.*index.js"
pkill -f "python.*main.py"
pkill -f "lt --port"

# Restart in order: Orchestrator → Integration → Localtunnel
```

### Extension not working
1. Reload extension in `chrome://extensions`
2. Close and reopen Google Meet tab
3. Check Chrome console (F12) for errors

### No audio captured
- Make sure to check "Share tab audio" in the permission dialog
- Only works on Google Meet pages

## Full Documentation

- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) - Known issues & solutions
- [README.md](../README.md) - Project overview
