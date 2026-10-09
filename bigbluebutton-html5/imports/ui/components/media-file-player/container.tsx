import React from 'react';
import { useSubscription } from '@apollo/client';
import useCurrentUser from '/imports/ui/core/hooks/useCurrentUser';
import useTimeSync from '/imports/ui/core/local-states/useTimeSync';
import Auth from '/imports/ui/services/auth';
import { MEDIA_PLAYER_SUBSCRIPTION } from './queries';
import { getMediaFileSettings, MediaPlayerRow } from './service';
import MediaFilePlayer from './component';

// Mounted by the app next to the external video player. It renders nothing unless the
// meeting has a playback in progress, so no layout slot is needed.
const MediaFilePlayerContainer: React.FC = () => {
  const { data, loading } = useSubscription(MEDIA_PLAYER_SUBSCRIPTION);
  const { data: currentUser } = useCurrentUser();
  const [timeSync] = useTimeSync();
  const settings = getMediaFileSettings();

  if (loading || !currentUser) return null;
  if (settings.enabled === false || !settings.sharingUrl) return null;

  const mediaPlayer = (data?.mediaPlayer ?? [])[0] as MediaPlayerRow | undefined;
  if (!mediaPlayer?.mediaFileId) return null;

  return (
    <MediaFilePlayer
      mediaPlayer={mediaPlayer}
      isPresenter={currentUser.presenter ?? false}
      meetingId={String(Auth.meetingID ?? '')}
      sharingUrl={settings.sharingUrl}
      timeSync={timeSync}
    />
  );
};

export default MediaFilePlayerContainer;
