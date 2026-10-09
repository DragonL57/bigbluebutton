import { gql } from '@apollo/client';

// status is the event name ('play', 'pause', 'seek', 'stop') and state is the
// integer the external video also sends: 1 playing, 0 not playing.
export const MEDIA_FILE_UPDATE = gql`
  mutation MediaFileUpdate(
    $status: String!
    $rate: Float!,
    $time: Float!,
    $state: Float!,
    $compact: Boolean!,
  ) {
    mediaFileUpdate(
      status: $status,
      rate: $rate,
      time: $time,
      state: $state,
      compact: $compact,
    )
  }
`;

export const MEDIA_FILE_STOP = gql`
  mutation MediaFileStop {
    mediaFileStop
  }
`;

export default { MEDIA_FILE_UPDATE, MEDIA_FILE_STOP };
