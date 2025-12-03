# Transla.to Project Context (Claude Memory)

**Last Updated:** December 3, 2024
**Project Status:** Active Development
**New Domain:** https://transla.to (live)
**OAuth Domain:** https://mg.falconsoft.dev (for Google approval)

---

## PROJECT OVERVIEW

**Transla.to** (formerly MGtranslate) is a real-time translation service for video meetings. It captures audio, transcribes with AI, translates to target language, and outputs via TTS - all in real-time.

### Supported Platforms
| Platform | Status | Technology |
|----------|--------|------------|
| Google Meet | Awaiting API approval | Chrome Extension + Media API |
| Microsoft Teams | In Development | Bot Framework + Graph API |
| Zoom | Planned | TBD |

### Brand Evolution
- Original: **MGtranslate**
- New: **Transla.to** (commercial name)
- Both domains active, same backend

---

## OAUTH CREDENTIALS

```
Client ID: 11797612538-nbno5j7k8ppj3av2kg177523hs2rv97o.apps.googleusercontent.com
Client Secret: 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
Redirect URI: https://mg.falconsoft.dev/auth/callback
JavaScript Origins: https://mg.falconsoft.dev
Project Number: 11797612538
```

---

## CURRENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                         TRANSLA.TO                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   FRONTEND   │    │  MEDIA API   │    │ ORCHESTRATOR │       │
│  │  (Website)   │    │  (Port 3002) │    │  (Port 3001) │       │
│  │              │    │   RUNNING    │    │   STOPPED    │       │
│  │  home.html   │    │              │    │              │       │
│  │  docs.html   │    │  OAuth       │    │  WebSocket   │       │
│  │  client.html │    │  Client      │    │  Translation │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                    │               │
│         └───────────────────┴────────────────────┘               │
│                             │                                    │
│                      ┌──────┴──────┐                            │
│                      │    NGINX    │                            │
│                      │   Reverse   │                            │
│                      │    Proxy    │                            │
│                      └─────────────┘                            │
│                             │                                    │
│              ┌──────────────┴──────────────┐                    │
│              │                              │                    │
│      ┌───────┴───────┐            ┌────────┴────────┐          │
│      │  transla.to   │            │ mg.falconsoft   │          │
│      │  (Cloudflare) │            │     .dev        │          │
│      │   HTTPS 443   │            │    HTTPS 443    │          │
│      └───────────────┘            └─────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Translation Pipeline
```
Audio Input → Whisper STT → GPT Translation → Google TTS → Audio Output
```

---

## SERVICES STRUCTURE

```
/home/scalp/MGtranslate/
├── services/
│   ├── media-api/              # Main API (Node.js/TypeScript) - PORT 3002
│   │   ├── src/index.ts        # Express server, OAuth, routes
│   │   ├── public/
│   │   │   ├── home.html       # Homepage (Transla.to branding)
│   │   │   ├── docs.html       # Documentation page
│   │   │   ├── client.html     # Meeting client
│   │   │   └── logo-icon.png
│   │   ├── nginx-transla.to.conf
│   │   └── nginx-mg.falconsoft.dev.conf
│   │
│   ├── orchestrator/           # WebSocket hub - PORT 3001 (STOPPED)
│   │   └── src/index.js
│   │
│   ├── integration/            # Python: Whisper + GPT (STOPPED)
│   │   └── src/main.py
│   │
│   └── meet-bot/               # Puppeteer fallback
│       └── src/index.js
│
├── extension/                  # Chrome extension
│   └── content.js
│
├── website/                    # Static website
│
└── CLAUDE_MEMORY.md           # This file
```

---

## SESSION DECEMBER 3, 2024 - COMPLETED TASKS

### Domain & Branding
- [x] Purchased domain **transla.to**
- [x] Configured DNS (Cloudflare)
- [x] Created nginx config for transla.to with HTTPS
- [x] Fixed 502 error (added HTTPS server block)
- [x] Updated ALL branding from "MGtranslate" to "Transla.to"
- [x] Updated home.html - multi-platform messaging (Meet, Teams, Zoom)
- [x] Updated docs.html - new branding throughout
- [x] Both domains live: transla.to and mg.falconsoft.dev

### Infrastructure Fixes
- [x] Killed memory-leaking Next.js process (67GB RAM freed!)
- [x] Deleted unused /services/ui folder
- [x] Stopped translation services to save API costs
- [x] Renamed public/index.html to client.html (fixed Express static conflict)

### Documentation
- [x] Created comprehensive docs.html page
- [x] Added /docs route to media-api
- [x] Added Documentation link to navigation

### Microsoft Teams Research
- [x] Analyzed GitHub reference project
- [x] Documented architecture requirements
- [x] Identified Azure services needed
- [x] Created implementation roadmap

---

## MICROSOFT TEAMS INTEGRATION (NEXT PHASE)

### Reference Project
[TeamsRecordingBotAndAzureCognitiveServicesAtWork](https://github.com/vasalis/TeamsRecordingBotAndAzureCongitiveServicesAtWork)

### Teams Architecture
```
Teams Meeting
    ↓
Recording Bot (C# .NET) → Captures 16kHz mono audio
    ↓
Middleware (Azure Functions) → Processes and stores
    ↓
Frontend (React/TypeScript) → Teams Tab app
```

### Azure Services Required
1. **Azure Bot Service** - Bot registration
2. **Azure Cognitive Services - Speech** - Transcription
3. **Azure Cosmos DB** - Data storage
4. **Azure Functions** - Middleware
5. **AKS (Windows nodes)** - Bot hosting (REQUIRED for media library)

### Key Technical Requirements
- **Windows Server** mandatory for Microsoft.Skype.Bots.Media library
- **Audio format:** 16kHz mono PCM
- **Estimated cost:** $125-425/month
- **Deploy time:** ~2 hours (automated with GitHub Actions)

### Implementation Phases
1. Azure AD App Registration (manual in Azure Portal)
2. Bot that joins meetings
3. Audio capture implementation
4. Integration with translation pipeline
5. Teams Tab frontend

---

## PENDING TASKS (TODO)

### Immediate (Before Restart)
- [x] Create this documentation
- [x] Save context with Serena
- [ ] Commit to Git

### Teams Integration
- [ ] Create Azure AD App Registration
- [ ] Set up Azure resource group
- [ ] Clone/adapt Teams Bot reference project
- [ ] Implement audio capture
- [ ] Integrate with translation pipeline (Whisper + GPT)
- [ ] Create Teams Tab app

### Google Meet
- [ ] Wait for Media API Developer Preview approval
- [ ] Test full pipeline once approved

### Long-term
- [ ] Zoom integration
- [ ] Mobile apps
- [ ] Enterprise features

---

## ACTIVE SERVICES STATUS

| Service | Port | Status | Notes |
|---------|------|--------|-------|
| media-api | 3002 | **RUNNING** | Homepage, OAuth, Docs |
| orchestrator | 3001 | STOPPED | Translation (saves costs) |
| integration | - | STOPPED | Python service |
| nginx | 80/443 | **RUNNING** | Reverse proxy |

### Start Commands
```bash
# Media API only (current state)
cd /home/scalp/MGtranslate/services/media-api
npm start

# Full translation stack (when needed)
cd /home/scalp/MGtranslate/services/orchestrator && npm start &
cd /home/scalp/MGtranslate/services/integration && python src/main.py &
cd /home/scalp/MGtranslate/services/media-api && npm start &
```

---

## NGINX CONFIGURATIONS

### transla.to
**File:** `/etc/nginx/sites-enabled/transla.to`
- HTTP → HTTPS redirect
- HTTPS with SSL (uses mg.falconsoft.dev cert for Cloudflare Full mode)
- All routes proxy to localhost:3002

### mg.falconsoft.dev
**File:** `/etc/nginx/sites-enabled/mg.falconsoft.dev`
- Full HTTPS with dedicated cert
- Same proxy configuration
- **KEEP ACTIVE** for Google OAuth approval

---

## TEST URLS

| URL | Description |
|-----|-------------|
| https://transla.to | Production homepage |
| https://transla.to/docs | Documentation |
| https://mg.falconsoft.dev | OAuth approval domain |
| https://mg.falconsoft.dev/auth | OAuth flow |
| https://mg.falconsoft.dev/client?meetingCode=xxx | Meeting client |

---

## USEFUL COMMANDS

```bash
# Check services
fuser 3002/tcp  # media-api
fuser 3001/tcp  # orchestrator

# Kill service
fuser -k 3002/tcp

# Nginx
sudo nginx -t
sudo systemctl reload nginx

# Logs
tail -f /tmp/media-api.log

# Test endpoints
curl http://localhost:3002/
curl https://transla.to/
curl -k https://mg.falconsoft.dev/
```

---

## ENVIRONMENT VARIABLES

```bash
# Google OAuth (configured)
GOOGLE_CLIENT_ID=11797612538-nbno5j7k8ppj3av2kg177523hs2rv97o.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://mg.falconsoft.dev/auth/callback
GOOGLE_CLOUD_PROJECT_NUMBER=11797612538

# Azure (to be configured for Teams)
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_BOT_ID=

# Translation Services
OPENAI_API_KEY=<configured>
ORCHESTRATOR_WS=wss://mg.falconsoft.dev/ws
```

---

## CONTACTS & RESOURCES

### Project Owner
- **Email:** marcelo@falconsoft.dev
- **Company:** Mp5 Marketing e Consultoria LTDA (Falcon Soft)
- **Location:** Recife, PE - Brasil

### URLs
- **Production:** https://transla.to
- **OAuth:** https://mg.falconsoft.dev
- **Company:** https://falconsoft.dev

### Reference Projects
- [Teams Recording Bot](https://github.com/vasalis/TeamsRecordingBotAndAzureCongitiveServicesAtWork)
- [Microsoft Graph Comms Samples](https://github.com/microsoftgraph/microsoft-graph-comms-samples)

---

## CRITICAL NOTES

1. **KEEP mg.falconsoft.dev ACTIVE** - Required for Google OAuth approval
2. **DO NOT** attempt automated Google account access - accounts get suspended
3. **Translation services STOPPED** to avoid unnecessary API costs
4. **Teams integration requires Windows Server** - plan for AKS Windows node pool

---

## TEST ACCOUNT
- **Email:** test@falconsoft.dev
- **Password:** nNuq3jS>

---

## FILES MODIFIED (Dec 3, 2024)

- `/services/media-api/public/home.html` - Transla.to branding, multi-platform
- `/services/media-api/public/docs.html` - Transla.to branding
- `/services/media-api/nginx-transla.to.conf` - New domain config with HTTPS
- `/services/media-api/public/index.html` → renamed to `client.html`
- `/etc/nginx/sites-enabled/transla.to` - Symlink to config
- Deleted: `/services/ui/` folder (memory leak source)
