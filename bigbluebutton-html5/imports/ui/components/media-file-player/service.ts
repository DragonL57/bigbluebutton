import Auth from '/imports/ui/services/auth';

// The media area shows one content at a time, and the generic content slot is how a component
// outside the presentation claims it: the pile entry opens the area, keeps the cameras in their dock
// and hands back the rectangle the content stands in.
export const MEDIA_FILE_GENERIC_CONTENT_ID = 'mediaFilePlayer';
export interface MediaPlayerRow {
  mediaPlayerId: string;
  mediaFileId: string;
  filename: string;
  contentType: string;
  fileSize: number;
  playerPlaying: boolean;
  playerCurrentTime: number;
  playerPlaybackRate: number;
  startedSharingAt: string;
  updatedAt: string;
  playerCompact: boolean;
}

export interface MediaFileSettings {
  enabled?: boolean;
  sharingUrl?: string;
  mirroredFromBBBCore?: { uploadSizeMax?: number };
}

export const getMediaFileSettings = (): MediaFileSettings => (
  window.meetingClientSettings.public.mediaFile ?? {}
);

export const isAudioContentType = (contentType: string): boolean => (
  contentType?.startsWith('audio/') ?? false
);

// The last segment carries the file extension because the player picks its backend
// from it, and nginx reads the extension to find the file on disk. The session token
// authorizes the request: the endpoint runs behind an nginx auth_request, so the file
// is only readable by a session in this meeting.
export const buildMediaFileUrl = (
  sharingUrl: string,
  meetingId: string,
  mediaFileId: string,
  filename: string,
): string => {
  const path = `${window.location.origin}${sharingUrl}/${meetingId}/${mediaFileId}/${encodeURIComponent(filename)}`;
  return `${path}?sessionToken=${Auth.sessionToken}`;
};

// Position the room should be at right now: the stored position while paused, and that
// position plus the elapsed time times the rate while playing. The external video's
// calculateCurrentTime skips the rate multiplication, which drifts on anything but 1x.
export const calculateMediaCurrentTime = (
  timeSync: number | undefined,
  mediaPlayer: MediaPlayerRow,
): number => {
  const storedTime = mediaPlayer.playerCurrentTime ?? 0;
  if (!mediaPlayer.playerPlaying) return storedTime;

  const elapsedSeconds = (Date.now() + (timeSync ?? 0) - new Date(mediaPlayer.updatedAt).getTime()) / 1000;
  const rate = mediaPlayer.playerPlaybackRate || 1;

  return Math.max(0, storedTime + elapsedSeconds * rate);
};

// Sent to akka on every play, pause and seek. time is the position in seconds at the
// moment of the event, which is what every other client seeks to.
export const playerStatusFromEvent = (
  event: 'play' | 'pause' | 'seek' | 'stop',
  time: number,
  rate: number,
  // The element's own state at the moment of the event: a seek while paused must not be
  // broadcast as playing, which is what the state field carries.
  playing: boolean,
  compact: boolean,
) => ({
  status: event,
  rate,
  time,
  state: playing ? 1 : 0,
  compact,
});

export default {
  getMediaFileSettings,
  isAudioContentType,
  buildMediaFileUrl,
  calculateMediaCurrentTime,
  playerStatusFromEvent,
};
