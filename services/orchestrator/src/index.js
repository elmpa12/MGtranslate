/**
 * MGtranslate Orchestrator Service
 *
 * Central hub that coordinates all services:
 * - Manages translation sessions
 * - Routes audio between Meet Bot and Integration Service
 * - Sends real-time updates to UI via WebSocket
 */

import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const PORT = parseInt(process.env.ORCHESTRATOR_PORT) || 3001;

// SSL certificates for HTTPS/WSS
const certsPath = path.resolve(__dirname, '../certs');
let httpsOptions = null;

if (fs.existsSync(path.join(certsPath, 'key.pem')) && fs.existsSync(path.join(certsPath, 'cert.pem'))) {
  httpsOptions = {
    key: fs.readFileSync(path.join(certsPath, 'key.pem')),
    cert: fs.readFileSync(path.join(certsPath, 'cert.pem'))
  };
  console.log('SSL certificates loaded - HTTPS/WSS enabled');
} else {
  console.log('No SSL certificates found - running HTTP/WS only');
}

// Session storage
const sessions = new Map();
const clients = new Map(); // WebSocket clients by type

// Audio blocking to prevent infinite loop
// Maps clientId -> timestamp until which audio should be blocked
const audioBlockedUntil = new Map();
const AUDIO_BLOCK_DURATION = 10000; // Block audio for 10 seconds after TTS

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  },
  ...(httpsOptions && { https: httpsOptions })
});

await fastify.register(cors, { origin: true });
await fastify.register(websocket);

// ============================================
// REST API Endpoints
// ============================================

// Health check
fastify.get('/health', async () => ({ status: 'ok', service: 'orchestrator' }));

// Create new translation session
fastify.post('/sessions', async (request, reply) => {
  const { meetLink, sourceLang = 'en-US', targetLang = 'pt-BR' } = request.body;

  if (!meetLink) {
    return reply.code(400).send({ error: 'meetLink is required' });
  }

  const sessionId = randomUUID();
  const session = {
    id: sessionId,
    meetLink,
    sourceLang,
    targetLang,
    status: 'created',
    createdAt: new Date().toISOString(),
    botStatus: 'pending',
    transcripts: []
  };

  sessions.set(sessionId, session);

  // Notify UI clients
  broadcast('ui', { type: 'session:created', session });

  // Request bot to join
  broadcast('meet-bot', {
    type: 'bot:join',
    sessionId,
    meetLink
  });

  fastify.log.info({ sessionId, meetLink }, 'Session created');
  return session;
});

// Get session by ID
fastify.get('/sessions/:id', async (request, reply) => {
  const session = sessions.get(request.params.id);
  if (!session) {
    return reply.code(404).send({ error: 'Session not found' });
  }
  return session;
});

// List all sessions
fastify.get('/sessions', async () => {
  return Array.from(sessions.values());
});

// End session
fastify.delete('/sessions/:id', async (request, reply) => {
  const session = sessions.get(request.params.id);
  if (!session) {
    return reply.code(404).send({ error: 'Session not found' });
  }

  session.status = 'ended';
  session.endedAt = new Date().toISOString();

  // Tell bot to leave
  broadcast('meet-bot', {
    type: 'bot:leave',
    sessionId: session.id
  });

  broadcast('ui', { type: 'session:ended', sessionId: session.id });

  fastify.log.info({ sessionId: session.id }, 'Session ended');
  return { success: true };
});

// ============================================
// WebSocket Handler
// ============================================

fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const clientId = randomUUID();
    let clientType = 'unknown';

    fastify.log.info({ clientId }, 'WebSocket client connected');

    connection.socket.on('message', (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());

        // Log all incoming message types for debugging
        if (message.type !== 'audio') {
          fastify.log.info({ clientId, clientType, messageType: message.type }, 'Message received');
        } else {
          fastify.log.info({ clientId, clientType, messageType: 'audio', dataLength: message.data?.length || 0 }, 'Audio received');
        }

        handleMessage(clientId, clientType, message, connection.socket);

        // Register client type on first message
        if (message.type === 'register') {
          clientType = message.clientType;
          if (!clients.has(clientType)) {
            clients.set(clientType, new Map());
          }
          clients.get(clientType).set(clientId, connection.socket);
          fastify.log.info({ clientId, clientType }, 'Client registered');
        }
      } catch (err) {
        fastify.log.error({ err, clientId }, 'Failed to parse message');
      }
    });

    connection.socket.on('close', () => {
      // Remove from clients
      for (const [type, typeClients] of clients) {
        if (typeClients.has(clientId)) {
          typeClients.delete(clientId);
          fastify.log.info({ clientId, clientType: type }, 'Client disconnected');
        }
      }
    });
  });
});

// ============================================
// Message Handlers
// ============================================

// Extension sessions (separate from bot sessions)
const extensionSessions = new Map();

function handleMessage(clientId, clientType, message, socket) {
  const { type, sessionId } = message;

  switch (type) {
    case 'register':
      // Handled above
      break;

    case 'bot:status':
      // Bot reporting status
      updateBotStatus(sessionId, message.status, message.data);
      break;

    case 'bot:audio':
      // Bot sending audio chunk - forward to integration service
      // Include language settings from session for bidirectional translation
      const audioSession = sessions.get(sessionId);
      broadcast('integration', {
        type: 'audio:process',
        sessionId,
        audio: message.audio,
        format: message.format || 'webm',
        sourceLang: audioSession?.sourceLang || 'en-US',
        targetLang: audioSession?.targetLang || 'pt-BR'
      });
      break;

    // Extension-specific messages
    case 'startTranslation':
      // Extension starting translation
      const extSessionId = `ext-${clientId}`;
      extensionSessions.set(extSessionId, {
        clientId,
        socket,
        sourceLang: message.sourceLang || 'en-US',
        targetLang: message.targetLang || 'pt-BR',
        tabId: message.tabId,
        startedAt: new Date().toISOString()
      });
      fastify.log.info({ extSessionId, sourceLang: message.sourceLang, targetLang: message.targetLang }, 'Extension translation started');
      break;

    case 'stopTranslation':
      // Extension stopping translation
      for (const [sid, session] of extensionSessions) {
        if (session.clientId === clientId) {
          extensionSessions.delete(sid);
          fastify.log.info({ sessionId: sid }, 'Extension translation stopped');
        }
      }
      break;

    case 'audio':
      // Check if this client is blocked (TTS playing, prevent echo loop)
      const blockUntil = audioBlockedUntil.get(clientId);
      if (blockUntil && Date.now() < blockUntil) {
        // Client is blocked, drop this audio
        return;
      } else if (blockUntil) {
        // Block expired, remove it
        audioBlockedUntil.delete(clientId);
        fastify.log.info({ clientId }, 'Audio block expired, resuming');
      }

      // Extension or audio_processor sending audio chunk
      // Forward to integration service for processing
      const extSession = findExtensionSessionByClient(clientId);
      const audioData = {
        type: 'audio:process',
        sessionId: extSession?.clientId || clientId,
        audio: message.data,
        format: 'pcm16',
        sampleRate: message.sampleRate || 16000,
        channels: message.channels || 1,
        sourceLang: message.sourceLang || extSession?.sourceLang || 'en-US',
        targetLang: message.targetLang || extSession?.targetLang || 'pt-BR'
      };

      // Store socket for response
      if (!clients.has('extension-audio')) {
        clients.set('extension-audio', new Map());
      }
      clients.get('extension-audio').set(clientId, socket);

      broadcast('integration', audioData);
      break;

    case 'clearBuffer':
      // Content script requesting buffer clear (TTS is playing)
      fastify.log.info({ clientId, reason: message.reason }, 'Buffer clear requested');
      broadcast('integration', {
        type: 'clearBuffer',
        sessionId: clientId,
        reason: message.reason
      });
      break;

    case 'caption':
      // Meet's live captions scraped from DOM
      // Send directly to integration for translation (no STT needed)
      fastify.log.info({ clientId, text: message.text?.substring(0, 50) }, 'Caption received');

      const captionSession = findExtensionSessionByClient(clientId);
      broadcast('integration', {
        type: 'caption:translate',
        sessionId: captionSession?.clientId || clientId,
        text: message.text,
        sourceLang: message.sourceLang || captionSession?.sourceLang || 'en-US',
        targetLang: message.targetLang || captionSession?.targetLang || 'pt-BR'
      });
      break;

    case 'integration:transcript':
      // Integration service sending transcript
      addTranscript(sessionId, message.transcript);
      break;

    case 'integration:translation':
      // Integration service sending translation
      addTranslation(sessionId, message.translation);

      // Also send to extension clients
      broadcastToExtensions({
        type: 'translation',
        originalText: message.translation.original,
        translatedText: message.translation.text,
        audioUrl: message.translation.audioUrl
      });
      break;

    case 'integration:tts':
      // TTS audio ready - forward to bot and extensions
      broadcast('meet-bot', {
        type: 'tts:play',
        sessionId,
        audio: message.audio
      });

      // BLOCK all content_script clients from sending audio for 10 seconds
      // This prevents the infinite loop where TTS gets captured by tab audio
      const contentScriptClients = clients.get('content_script');
      if (contentScriptClients) {
        const blockUntilTime = Date.now() + AUDIO_BLOCK_DURATION;
        for (const [cId] of contentScriptClients) {
          audioBlockedUntil.set(cId, blockUntilTime);
          fastify.log.info({ clientId: cId, blockDuration: AUDIO_BLOCK_DURATION }, 'Blocking audio from client (TTS playing)');
        }
      }

      // Also send to extensions
      broadcastToExtensions({
        type: 'translation',
        originalText: message.originalText || '',
        translatedText: message.translatedText || '',
        audioUrl: message.audioUrl || `data:audio/mp3;base64,${message.audio}`
      });
      break;

    default:
      fastify.log.warn({ type, clientType }, 'Unknown message type');
  }
}

function findExtensionSessionByClient(clientId) {
  for (const [sid, session] of extensionSessions) {
    if (session.clientId === clientId) {
      return session;
    }
  }
  return null;
}

function broadcastToExtensions(message) {
  const data = JSON.stringify(message);

  // Send to extension clients
  const extensionClients = clients.get('extension');
  if (extensionClients) {
    for (const [clientId, socket] of extensionClients) {
      try {
        socket.send(data);
      } catch (err) {
        fastify.log.error({ err, clientId }, 'Failed to send to extension');
      }
    }
  }

  // Send to audio_processor clients
  const audioClients = clients.get('audio_processor');
  if (audioClients) {
    for (const [clientId, socket] of audioClients) {
      try {
        socket.send(data);
      } catch (err) {
        fastify.log.error({ err, clientId }, 'Failed to send to audio_processor');
      }
    }
  }

  // Send to content_script clients
  const contentClients = clients.get('content_script');
  if (contentClients) {
    for (const [clientId, socket] of contentClients) {
      try {
        socket.send(data);
      } catch (err) {
        fastify.log.error({ err, clientId }, 'Failed to send to content_script');
      }
    }
  }
}

function updateBotStatus(sessionId, status, data = {}) {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.botStatus = status;
  if (data.participants) session.participants = data.participants;

  broadcast('ui', {
    type: 'bot:status',
    sessionId,
    status,
    data
  });

  fastify.log.info({ sessionId, status }, 'Bot status updated');
}

function addTranscript(sessionId, transcript) {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.transcripts.push({
    ...transcript,
    timestamp: new Date().toISOString()
  });

  broadcast('ui', {
    type: 'transcript:new',
    sessionId,
    transcript
  });
}

function addTranslation(sessionId, translation) {
  const session = sessions.get(sessionId);
  if (!session) return;

  // Find matching transcript and add translation
  const transcript = session.transcripts.find(t => t.id === translation.transcriptId);
  if (transcript) {
    transcript.translation = translation.text;
  }

  broadcast('ui', {
    type: 'translation:new',
    sessionId,
    translation
  });
}

// ============================================
// Broadcast Helper
// ============================================

function broadcast(targetType, message) {
  const typeClients = clients.get(targetType);
  if (!typeClients) return;

  const data = JSON.stringify(message);
  for (const [clientId, socket] of typeClients) {
    try {
      socket.send(data);
    } catch (err) {
      fastify.log.error({ err, clientId, targetType }, 'Failed to send message');
    }
  }
}

// ============================================
// Start Server
// ============================================

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  const protocol = httpsOptions ? 'https' : 'http';
  const wsProtocol = httpsOptions ? 'wss' : 'ws';
  fastify.log.info(`
╔═══════════════════════════════════════════════════════════════╗
║          MGtranslate Orchestrator Service                     ║
╠═══════════════════════════════════════════════════════════════╣
║  REST API:    ${protocol}://0.0.0.0:${PORT}                          ║
║  WebSocket:   ${wsProtocol}://0.0.0.0:${PORT}/ws                         ║
║  SSL:         ${httpsOptions ? 'ENABLED ✓' : 'DISABLED'}                                      ║
╚═══════════════════════════════════════════════════════════════╝
  `);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
