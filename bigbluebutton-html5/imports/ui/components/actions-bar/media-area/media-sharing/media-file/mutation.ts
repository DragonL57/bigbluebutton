import { gql } from '@apollo/client';

export const requestMediaFileUploadTokenMutation = gql`
  mutation RequestMediaFileUploadToken($filename: String!, $uploadTemporaryId: String!) {
    mediaFileRequestUploadToken(
      filename: $filename,
      uploadTemporaryId: $uploadTemporaryId,
    )
  }
`;

export const startMediaFileMutation = gql`
  mutation MediaFileStart($mediaFileId: String!) {
    mediaFileStart(
      mediaFileId: $mediaFileId
    )
  }
`;

export const removeMediaFileMutation = gql`
  mutation MediaFileRemove($mediaFileId: String!) {
    mediaFileRemove(
      mediaFileId: $mediaFileId
    )
  }
`;

export default {
  requestMediaFileUploadTokenMutation,
  removeMediaFileMutation,
  startMediaFileMutation,
};
