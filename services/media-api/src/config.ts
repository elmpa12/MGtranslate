/**
 * Configuration for Meet Media API Service
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root .env
dotenv.config({ path: resolve(__dirname, '../../../.env') });

export const config = {
  // Server settings
  port: parseInt(process.env.MEDIA_API_PORT || '3002', 10),

  // Google OAuth2 settings
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3002/auth/callback',
    projectNumber: process.env.GOOGLE_CLOUD_PROJECT_NUMBER || '',
  },

  // Orchestrator WebSocket URL
  orchestratorWs: process.env.ORCHESTRATOR_WS || 'ws://localhost:3001/ws',

  // Audio settings
  audio: {
    sampleRate: 16000, // 16kHz for Whisper
    channels: 1, // Mono
    bitDepth: 16, // 16-bit PCM
  },
};

// Validate required configuration
export function validateConfig(): void {
  const required = [
    ['GOOGLE_CLIENT_ID', config.google.clientId],
    ['GOOGLE_CLIENT_SECRET', config.google.clientSecret],
    ['GOOGLE_CLOUD_PROJECT_NUMBER', config.google.projectNumber],
  ];

  const missing = required.filter(([_, value]) => !value);

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(([name]) => console.error(`  - ${name}`));
    console.error('\nPlease add these to your .env file.');
  }
}
