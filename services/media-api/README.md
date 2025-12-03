# MGtranslate Media API Service

This service uses the **Google Meet Media API** to capture real-time audio streams from meeting participants for translation.

## Architecture

```
Google Meet → Meet Media API (WebRTC) → This Service → Orchestrator → Integration
                                                                         ↓
                                                                   Whisper STT
                                                                         ↓
                                                                   GPT Translation
                                                                         ↓
                                                                   Google TTS
```

## Prerequisites

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select your project
3. Enable the following APIs:
   - **Google Meet REST API**
   - **Google Meet Media API** (if available separately)

### 2. OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Select **Web application**
4. Add authorized redirect URI: `http://localhost:3002/auth/callback`
5. Copy the **Client ID** and **Client Secret**

### 3. OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Configure the consent screen
3. Add the restricted scope: `https://www.googleapis.com/auth/meetings.conference.media.audio.readonly`
4. **Important:** This is a restricted scope - you'll need to go through Google's verification process for production use

### 4. Environment Variables

Add to your `.env` file:

```bash
# Google Cloud Project
GOOGLE_CLOUD_PROJECT_NUMBER=123456789

# OAuth2 Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3002/auth/callback

# Service Port
MEDIA_API_PORT=3002
```

## Installation

```bash
cd services/media-api
npm install
```

## Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/auth` | Start OAuth flow |
| GET | `/auth/callback` | OAuth callback |
| GET | `/auth/status` | Check authentication status |
| POST | `/meetings/join` | Join a meeting |
| POST | `/meetings/leave` | Leave a meeting |
| GET | `/meetings` | List active meetings |

## Usage

1. Start the service: `npm run dev`
2. Authenticate: Visit `http://localhost:3002/auth`
3. Join a meeting:
   ```bash
   curl -X POST http://localhost:3002/meetings/join \
     -H "Content-Type: application/json" \
     -d '{"meetingCode": "abc-defg-hij"}'
   ```

## Notes

- The Media API is currently in **Developer Preview** for some features
- All meeting participants may need to be enrolled in the Developer Preview
- The API doesn't work with encrypted meetings or meetings with watermarks
- See [Meet Media API Requirements](https://developers.google.com/workspace/meet/media-api/guides/get-started) for details
