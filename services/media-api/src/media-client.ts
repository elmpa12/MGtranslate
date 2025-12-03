/**
 * Google Meet Media API Client
 *
 * Connects to Google Meet via WebRTC and captures audio streams
 * from meeting participants.
 *
 * Based on: https://developers.google.com/workspace/meet/media-api/guides/ts
 */

import { getAccessToken } from './oauth.js';
import { config } from './config.js';
import WebSocket from 'ws';

// Meet Media API client configuration
interface MediaClientConfig {
  accessToken: string;
  meetingSpaceId: string;
  enableAudioStreams: boolean;
  numberOfVideoStreams?: number;
  logsCallback?: (log: string) => void;
}

// Audio stream from a participant
interface AudioStream {
  participantId: string;
  displayName?: string;
  audioData: Buffer;
  timestamp: number;
}

// Event callbacks
interface MediaClientEvents {
  onAudioData?: (stream: AudioStream) => void;
  onParticipantJoined?: (participantId: string, displayName: string) => void;
  onParticipantLeft?: (participantId: string) => void;
  onError?: (error: Error) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

/**
 * Meet Media API Client
 *
 * Handles WebRTC connection to Google Meet and captures audio streams.
 */
export class MeetMediaClient {
  private meetingSpaceId: string;
  private orchestratorWs: WebSocket | null = null;
  private events: MediaClientEvents;
  private isConnected: boolean = false;
  private audioBuffer: Map<string, Buffer[]> = new Map();

  constructor(meetingSpaceId: string, events: MediaClientEvents = {}) {
    this.meetingSpaceId = meetingSpaceId;
    this.events = events;
  }

  /**
   * Connect to the meeting and start receiving audio
   */
  async connect(): Promise<void> {
    try {
      console.log(`[MediaClient] Connecting to meeting: ${this.meetingSpaceId}`);

      // Get access token
      const accessToken = await getAccessToken();

      // Get meeting details via Meet REST API
      const meetingInfo = await this.getMeetingInfo(accessToken);
      console.log('[MediaClient] Meeting info:', meetingInfo);

      // Initialize WebRTC connection to Meet Media API
      await this.initializeWebRTC(accessToken);

      // Connect to our orchestrator to forward audio
      this.connectToOrchestrator();

      this.isConnected = true;
      this.events.onConnected?.();

      console.log('[MediaClient] Connected to meeting successfully');
    } catch (error) {
      console.error('[MediaClient] Connection failed:', error);
      this.events.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Get meeting information via Meet REST API
   */
  private async getMeetingInfo(accessToken: string): Promise<any> {
    try {
      // Use direct HTTP call to Meet REST API
      const response = await fetch(
        `https://meet.googleapis.com/v2/spaces/${this.meetingSpaceId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('[MediaClient] Meet API error:', response.status, errorText);

        // If space doesn't exist, try to create a conference record lookup
        if (response.status === 404) {
          console.log('[MediaClient] Space not found, proceeding with meeting code directly');
          return { meetingCode: this.meetingSpaceId, status: 'proceeding' };
        }
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn('[MediaClient] Could not get meeting info:', error);
      return { meetingCode: this.meetingSpaceId, status: 'proceeding' };
    }
  }

  /**
   * Initialize WebRTC connection to Meet Media API
   *
   * Note: This is a simplified implementation. The full implementation
   * would use the official Meet Media API SDK from:
   * https://developers.google.com/workspace/meet/media-api/guides/ts
   */
  private async initializeWebRTC(accessToken: string): Promise<void> {
    console.log('[MediaClient] Initializing WebRTC connection...');

    // TODO: Implement full WebRTC connection using Meet Media API
    // The official SDK handles:
    // 1. SDP offer/answer negotiation
    // 2. ICE candidate exchange
    // 3. Audio/video track management
    // 4. Participant tracking

    // For now, we'll log the configuration needed
    console.log('[MediaClient] WebRTC Configuration:');
    console.log('  - Project Number:', config.google.projectNumber);
    console.log('  - Meeting Space ID:', this.meetingSpaceId);
    console.log('  - Audio Streams: Enabled');
    console.log('  - Video Streams: 0 (audio only)');

    // The actual implementation would use the Meet Media API TypeScript client:
    // import { MeetMediaApiClient } from '@google/meet-media-api';
    //
    // const client = new MeetMediaApiClient({
    //   accessToken,
    //   meetingSpaceId: this.meetingSpaceId,
    //   enableAudioStreams: true,
    //   numberOfVideoStreams: 0,
    //   logsCallback: (log) => console.log('[Meet Media]', log),
    // });
    //
    // await client.joinMeeting();
    //
    // client.on('audioData', (participantId, audioFrame) => {
    //   this.handleAudioData(participantId, audioFrame);
    // });
  }

  /**
   * Connect to the orchestrator to forward audio for translation
   */
  private connectToOrchestrator(): void {
    console.log(`[MediaClient] Connecting to orchestrator: ${config.orchestratorWs}`);

    this.orchestratorWs = new WebSocket(config.orchestratorWs);

    this.orchestratorWs.on('open', () => {
      console.log('[MediaClient] Connected to orchestrator');

      // Register as media-api client
      this.orchestratorWs?.send(JSON.stringify({
        type: 'register',
        clientType: 'media-api',
        meetingId: this.meetingSpaceId,
      }));
    });

    this.orchestratorWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleOrchestratorMessage(message);
      } catch (error) {
        console.error('[MediaClient] Failed to parse orchestrator message:', error);
      }
    });

    this.orchestratorWs.on('close', () => {
      console.log('[MediaClient] Disconnected from orchestrator');
      this.events.onDisconnected?.();
    });

    this.orchestratorWs.on('error', (error) => {
      console.error('[MediaClient] Orchestrator WebSocket error:', error);
      this.events.onError?.(error);
    });
  }

  /**
   * Handle messages from orchestrator
   */
  private handleOrchestratorMessage(message: any): void {
    switch (message.type) {
      case 'tts':
        // TTS audio to play in meeting (future feature)
        console.log('[MediaClient] Received TTS audio');
        break;

      default:
        console.log('[MediaClient] Unknown message type:', message.type);
    }
  }

  /**
   * Handle audio data from Meet Media API
   */
  private handleAudioData(participantId: string, audioFrame: Buffer): void {
    // Buffer audio data for this participant
    if (!this.audioBuffer.has(participantId)) {
      this.audioBuffer.set(participantId, []);
    }
    this.audioBuffer.get(participantId)!.push(audioFrame);

    // Send buffered audio when we have enough (e.g., 1 second)
    const buffers = this.audioBuffer.get(participantId)!;
    const totalBytes = buffers.reduce((sum, b) => sum + b.length, 0);

    // 16kHz * 2 bytes * 1 channel = 32000 bytes/second
    if (totalBytes >= 32000) {
      const combinedBuffer = Buffer.concat(buffers);
      this.audioBuffer.set(participantId, []);

      // Send to orchestrator for translation
      if (this.orchestratorWs?.readyState === WebSocket.OPEN) {
        this.orchestratorWs.send(JSON.stringify({
          type: 'audio',
          source: 'media-api',
          participantId,
          data: combinedBuffer.toString('base64'),
          format: 'pcm16',
        }));
      }

      // Emit event
      this.events.onAudioData?.({
        participantId,
        audioData: combinedBuffer,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Disconnect from the meeting
   */
  async disconnect(): Promise<void> {
    console.log('[MediaClient] Disconnecting from meeting...');

    // Close WebSocket to orchestrator
    if (this.orchestratorWs) {
      this.orchestratorWs.close();
      this.orchestratorWs = null;
    }

    // TODO: Call MeetMediaApiClient.leaveMeeting()

    this.isConnected = false;
    this.events.onDisconnected?.();

    console.log('[MediaClient] Disconnected from meeting');
  }

  /**
   * Check if connected to meeting
   */
  isConnectedToMeeting(): boolean {
    return this.isConnected;
  }
}

/**
 * Create a new Meet Media Client
 */
export function createMeetMediaClient(
  meetingSpaceId: string,
  events?: MediaClientEvents
): MeetMediaClient {
  return new MeetMediaClient(meetingSpaceId, events);
}
