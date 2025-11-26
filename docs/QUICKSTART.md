# MGtranslate - Quick Start

## TL;DR

```bash
# Install
cd services/orchestrator && npm install && cd ../..
cd services/meet-bot && npm install && cd ../..
cd services/ui && npm install && cd ../..
cd services/integration && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cd ../..

# Run (all services)
./scripts/dev.sh

# Or run manually
ORCHESTRATOR_PORT=3001 node services/orchestrator/src/index.js &
node services/meet-bot/src/index.js &
cd services/integration && source .venv/bin/activate && python src/main.py &
cd services/ui && npm run dev &

# Access
# UI: http://SERVER_IP:4000
# API: http://SERVER_IP:3001
```

## Bot Chrome Profile Setup

**On a machine with GUI:**
```bash
google-chrome --user-data-dir="$HOME/chrome-bot-profile"
# Log in to: mgtranslate58@gmail.com
# Close Chrome

tar -czvf chrome-profile.tar.gz chrome-bot-profile/
scp chrome-profile.tar.gz server:/path/to/MGtranslate/poc/meet-audio-capture/session/
```

**On server:**
```bash
cd poc/meet-audio-capture/session/
tar -xzf chrome-profile.tar.gz
mv chrome-bot-profile chrome-profile
```

## Test PoC

```bash
cd poc/meet-audio-capture
node src/test-with-profile.js "https://meet.google.com/xxx-xxxx-xxx"
```

## Ports

| Service | Port |
|---------|------|
| UI | 4000 |
| Orchestrator | 3001 |

## Key Files

- `services/orchestrator/src/index.js` - API + WebSocket hub
- `services/meet-bot/src/index.js` - Puppeteer bot
- `services/integration/src/main.py` - STT/Translation/TTS
- `services/ui/src/app/page.js` - React UI
- `poc/meet-audio-capture/session/chrome-profile/` - Bot's Chrome profile
- `.env` - Environment config

## Credentials

- **Bot Account:** mgtranslate58@gmail.com
- **GCP Service Account:** config/credentials/gcp-service-account.json
