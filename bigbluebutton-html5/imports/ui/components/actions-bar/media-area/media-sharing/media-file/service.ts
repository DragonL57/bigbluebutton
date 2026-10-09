import { v4 as uuid } from 'uuid';
import logger from '/imports/startup/client/logger';
import apolloContextHolder from '/imports/ui/core/graphql/apolloContextHolder/apolloContextHolder';
import Auth from '/imports/ui/services/auth';
import { getMediaFileUploadToken } from './queries';
import { requestMediaFileUploadTokenMutation } from './mutation';

const TOKEN_TIMEOUT = 5000;
const TOKEN_POLL_INTERVAL = 1000;
const TOKEN_POLL_ATTEMPTS = 10;

export interface MediaFileUploadTarget {
  mediaFileId: string;
  uploadToken: string;
}

// fetch doesn't report upload progress, so the file body goes through XHR.
const futch = (
  url: string,
  opts: { method?: string, headers?: Record<string, string>, body?: FormData } = {},
  onProgress?: (event: ProgressEvent) => void,
): Promise<string> => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();

  xhr.open(opts.method || 'get', url);

  Object.keys(opts.headers || {}).forEach((k) => xhr.setRequestHeader(k, opts.headers![k]));

  xhr.onload = (e) => {
    const target = e.target as XMLHttpRequest;
    if (target.status !== 200) {
      reject(new Error(`upload failed with status ${target.status}`));
      return;
    }
    resolve(target.responseText);
  };
  xhr.onerror = () => reject(new Error('upload failed'));
  if (xhr.upload && onProgress) {
    xhr.upload.addEventListener('progress', onProgress, false);
  }
  xhr.send(opts.body);
});

// Asks akka-apps for a single use upload token and waits for the row to show up in
// v_mediaFile_uploadToken, the same two step flow the presentation uploader uses. The
// timeout and the poll each stop the other, so the promise settles once and no timer
// outlives it.
export const requestMediaFileUploadToken = (
  uploadTemporaryId: string,
  filename: string,
): Promise<MediaFileUploadTarget> => new Promise((resolve, reject) => {
  const client = apolloContextHolder.getClient();
  let settled = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pollTimeout: ReturnType<typeof setTimeout> | null = null;

  const finish = (error?: Error, target?: MediaFileUploadTarget) => {
    if (settled) return;
    settled = true;
    if (timeout) clearTimeout(timeout);
    if (pollTimeout) clearTimeout(pollTimeout);
    if (target) resolve(target);
    else reject(error);
  };

  client.mutate({
    mutation: requestMediaFileUploadTokenMutation,
    variables: { filename, uploadTemporaryId },
  }).catch((error) => {
    logger.debug({
      logCode: 'media_file_uploader_service',
      extraInfo: { error },
    }, 'Media file upload token request failed');
    finish(error as Error);
  });

  timeout = setTimeout(() => {
    finish(new Error('requestMediaFileUploadToken timeout'));
  }, TOKEN_TIMEOUT);

  const poll = (attempt = 0) => {
    if (settled) return;
    if (attempt > TOKEN_POLL_ATTEMPTS) {
      finish(new Error('requestMediaFileUploadToken gave up'));
      return;
    }

    client.query({
      query: getMediaFileUploadToken,
      variables: { uploadTemporaryId },
      fetchPolicy: 'network-only',
    }).then((result) => {
      const rows = result.data?.mediaFile_uploadToken ?? [];
      if (rows.length > 0) {
        finish(undefined, { mediaFileId: rows[0].mediaFileId, uploadToken: rows[0].uploadToken });
        return;
      }
      pollTimeout = setTimeout(() => poll(attempt + 1), TOKEN_POLL_INTERVAL);
    }).catch((error) => {
      finish(error as Error);
    });
  };

  pollTimeout = setTimeout(poll, 100);
});

export const uploadMediaFile = (
  file: File,
  uploadEndpoint: string,
  onProgress: (percent: number) => void,
): Promise<MediaFileUploadTarget> => {
  const uploadTemporaryId = uuid();
  const data = new FormData();
  data.append('fileUpload', file);
  // bbb-web checks the token scope against this value, the way the presentation
  // uploader sends it.
  data.append('conference', String(Auth.meetingID ?? ''));

  return requestMediaFileUploadToken(uploadTemporaryId, file.name)
    .then(({ mediaFileId, uploadToken }) => futch(
      // uploadEndpoint is /bigbluebutton/media/upload; the token replaces the last
      // segment, the same substitution the presentation uploader makes. The pattern is
      // anchored so a host that contains the word is left alone.
      `${uploadEndpoint.replace(/upload$/, `${uploadToken}/upload`)}`,
      { method: 'POST', body: data },
      (event: ProgressEvent) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      },
    ).then(() => ({ mediaFileId, uploadToken })));
};

export default { uploadMediaFile, requestMediaFileUploadToken };
