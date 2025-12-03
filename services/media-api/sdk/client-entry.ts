/**
 * MGtranslate - Meet Media API Client Entry Point
 *
 * This file exports the Google Meet Media API SDK for browser use.
 * Built with webpack to create a bundled JS file.
 */

import { MeetMediaApiClientImpl } from './internal/meetmediaapiclient_impl';
import { MeetConnectionState } from './types/enums';
import type { MeetStreamTrack, MediaEntry, Participant } from './types/mediatypes';
import type { MeetSessionStatus } from './types/meetmediaapiclient';

// Re-export main classes and types
export {
  MeetMediaApiClientImpl,
  MeetConnectionState,
};

export type {
  MeetStreamTrack,
  MediaEntry,
  Participant,
  MeetSessionStatus,
};

// Helper to create a client with simpler configuration
export interface MGtranslateClientConfig {
  meetingCode: string;
  accessToken: string;
  enableVideo?: boolean;
}

export function createClient(config: MGtranslateClientConfig) {
  return new MeetMediaApiClientImpl({
    meetingSpaceId: config.meetingCode,
    numberOfVideoStreams: config.enableVideo ? 1 : 0,
    enableAudioStreams: true,
    accessToken: config.accessToken,
  });
}

// Expose to window for easy access from vanilla JS
if (typeof window !== 'undefined') {
  (window as any).MeetMediaClient = {
    MeetMediaApiClientImpl,
    MeetConnectionState,
    createClient,
  };
}
