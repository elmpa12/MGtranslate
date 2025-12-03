/**
 * OAuth 2.0 Handler for Google Meet Media API
 *
 * Handles authentication with restricted scopes:
 * - meetings.conference.media.readonly (video + audio)
 * - meetings.conference.media.audio.readonly (audio only)
 */

import { OAuth2Client } from 'google-auth-library';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Token file path (store in parent directory for persistence)
const TOKEN_FILE = path.join(__dirname, '..', '.tokens.json');

// Meet Media API Scopes (Restricted - require verification)
export const MEET_MEDIA_SCOPES = [
  'https://www.googleapis.com/auth/meetings.conference.media.audio.readonly',
  // Add video scope if needed for future features
  // 'https://www.googleapis.com/auth/meetings.conference.media.readonly',
];

// OAuth2 client instance
let oauth2Client: OAuth2Client | null = null;

// Token storage (persisted to file)
let storedTokens: {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
} | null = null;

/**
 * Load tokens from file
 */
function loadTokensFromFile(): void {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
      storedTokens = JSON.parse(data);
      console.log('[OAuth] Loaded tokens from file');
    }
  } catch (error) {
    console.warn('[OAuth] Could not load tokens from file:', error);
  }
}

/**
 * Save tokens to file
 */
function saveTokensToFile(): void {
  try {
    if (storedTokens) {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(storedTokens, null, 2));
      console.log('[OAuth] Saved tokens to file');
    }
  } catch (error) {
    console.error('[OAuth] Could not save tokens to file:', error);
  }
}

/**
 * Initialize the OAuth2 client
 */
export function initOAuth(): OAuth2Client {
  if (oauth2Client) return oauth2Client;

  // Load tokens from file on startup
  loadTokensFromFile();

  oauth2Client = new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );

  // Load stored tokens if available
  if (storedTokens) {
    oauth2Client.setCredentials(storedTokens);
    console.log('[OAuth] Restored authentication from saved tokens');
  }

  return oauth2Client;
}

/**
 * Get the OAuth2 client instance
 */
export function getOAuthClient(): OAuth2Client {
  if (!oauth2Client) {
    return initOAuth();
  }
  return oauth2Client;
}

/**
 * Generate the authorization URL for user consent
 */
export function getAuthUrl(): string {
  const client = getOAuthClient();

  return client.generateAuthUrl({
    access_type: 'offline', // Get refresh token
    scope: MEET_MEDIA_SCOPES,
    prompt: 'consent', // Force consent screen to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<void> {
  const client = getOAuthClient();

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Store tokens
  storedTokens = {
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  };

  // Persist tokens to file
  saveTokensToFile();

  console.log('[OAuth] Tokens obtained successfully');
}

/**
 * Get a valid access token (refreshing if necessary)
 */
export async function getAccessToken(): Promise<string> {
  const client = getOAuthClient();

  // Check if we have tokens
  const credentials = client.credentials;
  if (!credentials.access_token) {
    throw new Error('No access token available. User needs to authorize.');
  }

  // Check if token is expired
  if (credentials.expiry_date && credentials.expiry_date < Date.now()) {
    console.log('[OAuth] Token expired, refreshing...');
    const { credentials: newCredentials } = await client.refreshAccessToken();
    client.setCredentials(newCredentials);
    storedTokens = {
      access_token: newCredentials.access_token ?? undefined,
      refresh_token: newCredentials.refresh_token ?? storedTokens?.refresh_token,
      expiry_date: newCredentials.expiry_date ?? undefined,
    };
    // Persist refreshed tokens
    saveTokensToFile();
  }

  return client.credentials.access_token!;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const client = getOAuthClient();
  return !!client.credentials.access_token;
}

/**
 * Create Express routes for OAuth flow
 */
export function createOAuthRoutes(): express.Router {
  const router = express.Router();

  // Initiate OAuth flow
  router.get('/auth', (req: Request, res: Response) => {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
  });

  // OAuth callback
  router.get('/auth/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;

    if (!code) {
      res.status(400).send('Authorization code missing');
      return;
    }

    try {
      await exchangeCodeForTokens(code);
      res.send(`
        <html>
          <body>
            <h1>Authentication Successful!</h1>
            <p>You can now close this window and return to the app.</p>
            <script>window.close();</script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('[OAuth] Token exchange failed:', error);
      res.status(500).send('Authentication failed');
    }
  });

  // Check auth status
  router.get('/auth/status', (req: Request, res: Response) => {
    res.json({
      authenticated: isAuthenticated(),
    });
  });

  return router;
}
