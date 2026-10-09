import { gql } from '@apollo/client';

export const getMediaFileUploadToken = gql`
  query getMediaFileUploadToken ($uploadTemporaryId: String!) {
    mediaFile_uploadToken(where: { uploadTemporaryId: { _eq: $uploadTemporaryId } }) {
      mediaFileId
      uploadTemporaryId
      uploadToken
    }
  }
`;

// A subscription, not a query: the list has to follow uploads and removals that happen
// while the modal is open, and it is the mechanism the media player already uses.
export const getMediaFiles = gql`
  subscription getMediaFiles {
    mediaFile(order_by: { uploadedAt: desc }) {
      mediaFileId
      filename
      contentType
      fileSize
      uploadedAt
    }
  }
`;

export default {
  getMediaFileUploadToken,
  getMediaFiles,
};
