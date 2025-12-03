# Transla.to Teams Bot

Real-time translation bot for Microsoft Teams meetings.

## Architecture

```
Teams Meeting
    ↓
Recording Bot (C# .NET) → Captures 16kHz mono PCM audio
    ↓
Audio Processor → Sends to translation pipeline
    ↓
Whisper STT → GPT Translation → Google TTS
    ↓
Translated audio back to user
```

## Prerequisites

### Azure Resources Required
1. **Azure AD App Registration** - Bot identity
2. **Azure Bot Service** - Bot channel registration
3. **Azure Cognitive Services** - Speech (optional, we use Whisper)
4. **Azure Cosmos DB** - Session storage
5. **AKS with Windows nodes** - Bot hosting (required for media library)

### Development Requirements
- .NET 6.0 or later
- Visual Studio 2022 or VS Code with C# extension
- Azure CLI
- Docker Desktop (for local testing)

## Azure AD App Registration

### Step 1: Create App Registration
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to Azure Active Directory > App registrations
3. Click "New registration"
4. Name: `Transla.to Teams Bot`
5. Supported account types: "Accounts in any organizational directory"
6. Redirect URI: Leave blank for now
7. Click "Register"

### Step 2: Configure API Permissions
Add these permissions (Application type):
- `Calls.AccessMedia.All`
- `Calls.Initiate.All`
- `Calls.InitiateGroupCall.All`
- `Calls.JoinGroupCall.All`
- `Calls.JoinGroupCallAsGuest.All`
- `OnlineMeetings.Read.All`
- `OnlineMeetings.ReadWrite.All`

### Step 3: Create Client Secret
1. Go to "Certificates & secrets"
2. Click "New client secret"
3. Description: `Transla.to Bot Secret`
4. Expiry: 24 months
5. Copy the secret value immediately!

### Step 4: Enable Bot Channel
1. Go to Azure Bot Service
2. Create new Bot
3. Use the App ID from step 1
4. Enable Microsoft Teams channel
5. Enable "Calling" in Teams channel settings

## Environment Variables

```bash
# Azure AD
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<app-registration-client-id>
AZURE_CLIENT_SECRET=<client-secret>

# Bot Configuration
BOT_ID=<same-as-client-id>
BOT_NAME=Transla.to
CALLBACK_URL=https://your-domain/api/calls

# Translation Pipeline
ORCHESTRATOR_WS=wss://transla.to/ws
OPENAI_API_KEY=<your-key>

# Optional: Azure Cosmos DB
COSMOS_ENDPOINT=<cosmos-endpoint>
COSMOS_KEY=<cosmos-key>
```

## Project Structure

```
teams-bot/
├── src/
│   ├── Bot/
│   │   ├── BotService.cs          # Main bot service
│   │   ├── CallHandler.cs         # Handles individual calls
│   │   └── BotMediaStream.cs      # Audio capture
│   ├── Audio/
│   │   ├── AudioProcessor.cs      # Processes audio buffers
│   │   └── TranslationClient.cs   # Connects to translation pipeline
│   ├── Controllers/
│   │   ├── CallsController.cs     # Webhook for call events
│   │   └── JoinController.cs      # API to join meetings
│   └── Program.cs
├── Dockerfile
├── appsettings.json
└── teams-bot.csproj
```

## Quick Start

```bash
# Clone and setup
cd /home/scalp/MGtranslate/services/teams-bot

# Build
dotnet build

# Run locally (requires ngrok for callbacks)
dotnet run

# Docker build
docker build -t transla-teams-bot .

# Deploy to AKS
kubectl apply -f k8s/
```

## Reference
- [Microsoft Graph Communications API](https://docs.microsoft.com/en-us/graph/cloud-communications-concept-overview)
- [Teams Recording Bot Sample](https://github.com/vasalis/TeamsRecordingBotAndAzureCongitiveServicesAtWork)
- [Bot Media SDK](https://microsoftgraph.github.io/microsoft-graph-comms-samples/docs/bot_media/index.html)

## Notes
- Windows Server required for `Microsoft.Skype.Bots.Media` library
- Audio format: 16kHz mono PCM (compatible with Azure Speech)
- Bot must be hosted on AKS with Windows node pool
