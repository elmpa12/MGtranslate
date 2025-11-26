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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

const PORT = parseInt(process.env.ORCHESTRATOR_PORT) || 3001;

// Session storage
const sessions = new Map();
const clients = new Map(); // WebSocket clients by type

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  }
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

    case 'integration:transcript':
      // Integration service sending transcript
      addTranscript(sessionId, message.transcript);
      break;

    case 'integration:translation':
      // Integration service sending translation
      addTranslation(sessionId, message.translation);
      break;

    case 'integration:tts':
      // TTS audio ready - forward to bot
      broadcast('meet-bot', {
        type: 'tts:play',
        sessionId,
        audio: message.audio
      });
      break;

    default:
      fastify.log.warn({ type, clientType }, 'Unknown message type');
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
  fastify.log.info(`
╔═══════════════════════════════════════════════════════════════╗
║          MGtranslate Orchestrator Service                     ║
╠═══════════════════════════════════════════════════════════════╣
║  REST API:    http://localhost:${PORT}                          ║
║  WebSocket:   ws://localhost:${PORT}/ws                         ║
╚═══════════════════════════════════════════════════════════════╝
  `);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
