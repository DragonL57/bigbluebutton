import Local from '/imports/ui/services/storage/local';

// Volume, mute and the player anchor belong to the person watching, not to the room: two
// participants have different speakers and different screen sizes. Play, pause, seek, stop and the
// size of the player are room state and travel to every client through the mediaPlayer row.
export type PlayerDensity = 'bar' | 'pill';
export type PlayerAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const VOLUME_KEY = 'mediaFileVolume';
const MUTED_KEY = 'mediaFileMuted';
const ANCHOR_KEY = 'mediaFileAnchor';

export const DEFAULT_VOLUME = 1;
export const DEFAULT_ANCHOR: PlayerAnchor = 'bottom-right';

const isAnchor = (value: unknown): value is PlayerAnchor => (
  value === 'top-left'
  || value === 'top-right'
  || value === 'bottom-left'
  || value === 'bottom-right'
);

export const getStoredVolume = (): number => {
  // A key nobody wrote reads back as null, and Number(null) is 0, which the range check below would
  // happily accept: the player then started silent instead of at full volume. Only a number the
  // person set themselves counts as a level.
  const stored = Local.getItem(VOLUME_KEY);
  if (stored === null || stored === undefined || stored === '') return DEFAULT_VOLUME;
  const value = Number(stored);
  if (!Number.isFinite(value) || value <= 0 || value > 1) return DEFAULT_VOLUME;
  return value;
};

export const setStoredVolume = (volume: number): void => {
  Local.setItem(VOLUME_KEY, volume);
};

export const getStoredMuted = (): boolean => Local.getItem(MUTED_KEY) === true;

export const setStoredMuted = (muted: boolean): void => {
  Local.setItem(MUTED_KEY, muted);
};

export const getStoredAnchor = (): PlayerAnchor => {
  const value = Local.getItem(ANCHOR_KEY);
  return isAnchor(value) ? value : DEFAULT_ANCHOR;
};

export const setStoredAnchor = (anchor: PlayerAnchor): void => {
  Local.setItem(ANCHOR_KEY, anchor);
};
