import { gql } from '@apollo/client';

// One row while the room is playing a file: the view only exposes rows where
// stoppedSharingAt is null, so an empty list means nothing is being played. Two rapid starts can
// still leave two open rows, so the newest wins instead of whichever Hasura returns first.
export const MEDIA_PLAYER_SUBSCRIPTION = gql`
  subscription MediaPlayerSubscription {
    mediaPlayer(order_by: { startedSharingAt: desc }, limit: 1) {
      mediaPlayerId
      mediaFileId
      filename
      contentType
      fileSize
      playerPlaying
      playerCurrentTime
      playerPlaybackRate
      startedSharingAt
      updatedAt
      playerCompact
    }
  }
`;

export default { MEDIA_PLAYER_SUBSCRIPTION };
