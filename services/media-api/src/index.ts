/**
 * MGtranslate Media API Service
 *
 * This service uses the Google Meet Media API to capture real-time
 * audio streams from meeting participants for translation.
 *
 * Architecture:
 *   Google Meet → Media API (WebRTC) → This Service → Orchestrator → Integration
 *                                                                    ↓
 *                                                              Whisper STT
 *                                                                    ↓
 *                                                              GPT Translation
 *                                                                    ↓
 *                                                              Google TTS
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig } from './config.js';
import { initOAuth, createOAuthRoutes, isAuthenticated, getAccessToken } from './oauth.js';
import { createMeetMediaClient, MeetMediaClient } from './media-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Active meeting connections
const activeMeetings: Map<string, MeetMediaClient> = new Map();

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          MGtranslate Media API Service                        ║
╠═══════════════════════════════════════════════════════════════╣
║  Uses Google Meet Media API for real-time audio capture       ║
║  Connects via WebRTC for clean, per-participant audio         ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // Validate configuration
  validateConfig();

  // Initialize OAuth
  initOAuth();

  // Create Express app
  const app = express();
  app.use(express.json());

  // OAuth routes
  app.use(createOAuthRoutes());

  // Serve static files (public folder and SDK)
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use('/sdk', express.static(path.join(__dirname, '..', 'sdk')));

  // Homepage
  app.get('/', async (req, res) => {
    const fs = await import('fs/promises');
    const homePath = path.join(__dirname, '..', 'public', 'home.html');
    try {
      const homeHtml = await fs.readFile(homePath, 'utf-8');
      res.send(homeHtml);
    } catch {
      res.redirect('/client');
    }
  });

  // Documentation page
  app.get('/docs', async (req, res) => {
    const fs = await import('fs/promises');
    const docsPath = path.join(__dirname, '..', 'public', 'docs.html');
    try {
      const docsHtml = await fs.readFile(docsPath, 'utf-8');
      res.send(docsHtml);
    } catch {
      res.status(404).send('Documentation not found');
    }
  });

  // Client page with injected config
  app.get('/client', async (req, res) => {
    const { meetingCode } = req.query;

    if (!meetingCode) {
      res.status(400).send('Meeting code is required. Use /client?meetingCode=xxx-xxxx-xxx');
      return;
    }

    if (!isAuthenticated()) {
      res.redirect('/auth');
      return;
    }

    try {
      const accessToken = await getAccessToken();

      // Read the index.html and inject config
      const fs = await import('fs/promises');
      const indexHtml = await fs.readFile(path.join(__dirname, '..', 'public', 'index.html'), 'utf-8');

      // Inject config before the closing </head> tag
      const configScript = `
        <script>
          window.MGTRANSLATE_CONFIG = {
            orchestratorWs: '${config.orchestratorWs}',
            accessToken: '${accessToken}',
            meetingCode: '${meetingCode}'
          };
        </script>
      `;

      const modifiedHtml = indexHtml.replace('</head>', `${configScript}</head>`);
      res.send(modifiedHtml);
    } catch (error) {
      res.status(500).send(`Error: ${(error as Error).message}`);
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      authenticated: isAuthenticated(),
      activeMeetings: activeMeetings.size,
    });
  });

  // Join a meeting
  app.post('/meetings/join', async (req, res) => {
    const { meetingCode } = req.body;

    if (!meetingCode) {
      res.status(400).json({ error: 'meetingCode is required' });
      return;
    }

    if (!isAuthenticated()) {
      res.status(401).json({
        error: 'Not authenticated',
        authUrl: '/auth',
      });
      return;
    }

    // Check if already connected
    if (activeMeetings.has(meetingCode)) {
      res.json({
        status: 'already_connected',
        meetingCode,
      });
      return;
    }

    try {
      // Create and connect client
      const client = createMeetMediaClient(meetingCode, {
        onAudioData: (stream) => {
          console.log(`[Audio] Participant ${stream.participantId}: ${stream.audioData.length} bytes`);
        },
        onParticipantJoined: (id, name) => {
          console.log(`[Participant] ${name} (${id}) joined`);
        },
        onParticipantLeft: (id) => {
          console.log(`[Participant] ${id} left`);
        },
        onError: (error) => {
          console.error('[Meeting Error]', error);
        },
        onDisconnected: () => {
          console.log(`[Meeting] Disconnected from ${meetingCode}`);
          activeMeetings.delete(meetingCode);
        },
      });

      await client.connect();
      activeMeetings.set(meetingCode, client);

      res.json({
        status: 'connected',
        meetingCode,
      });
    } catch (error) {
      console.error('Failed to join meeting:', error);
      res.status(500).json({
        error: 'Failed to join meeting',
        details: (error as Error).message,
      });
    }
  });

  // Leave a meeting
  app.post('/meetings/leave', async (req, res) => {
    const { meetingCode } = req.body;

    if (!meetingCode) {
      res.status(400).json({ error: 'meetingCode is required' });
      return;
    }

    const client = activeMeetings.get(meetingCode);
    if (!client) {
      res.status(404).json({ error: 'Not connected to this meeting' });
      return;
    }

    await client.disconnect();
    activeMeetings.delete(meetingCode);

    res.json({
      status: 'disconnected',
      meetingCode,
    });
  });

  // List active meetings
  app.get('/meetings', (req, res) => {
    res.json({
      meetings: Array.from(activeMeetings.keys()),
    });
  });

  // Start server
  app.listen(config.port, () => {
    console.log(`
[Media API] Server running on http://localhost:${config.port}

Endpoints:
  GET  /health              - Health check
  GET  /auth                - Start OAuth flow
  GET  /auth/callback       - OAuth callback
  GET  /auth/status         - Check authentication status
  POST /meetings/join       - Join a meeting
  POST /meetings/leave      - Leave a meeting
  GET  /meetings            - List active meetings

To get started:
  1. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CLOUD_PROJECT_NUMBER to .env
  2. Visit http://localhost:${config.port}/auth to authenticate
  3. POST to /meetings/join with { "meetingCode": "abc-defg-hij" }
    `);
  });
}

main().catch(console.error);
