import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { IntlShape, defineMessages } from 'react-intl';
import { useMutation, useSubscription } from '@apollo/client';
import { BBButton } from '@bigbluebutton/bbb-ui-components-react';
import Button from '/imports/ui/components/common/button/component';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import logger from '/imports/startup/client/logger';
import Styled from './styles';
import { uploadMediaFile } from './service';
import { removeMediaFileMutation, startMediaFileMutation } from './mutation';
import { getMediaFiles } from './queries';

// A coarse pointer is a touch-first device, which has no drag and drop: offering it there is a
// hint for a gesture the user cannot make.
const CAN_DROP_FILES = !window.matchMedia('(pointer: coarse)').matches;

interface MediaFileViewProps {
  intl: IntlShape;
  onActionCompleted: () => void;
}

interface MediaFileRow {
  mediaFileId: string;
  filename: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
}

const mediaFileSettings = () => window.meetingClientSettings.public.mediaFile;

const intlMessages = defineMessages({
  chooseFile: {
    id: 'app.mediaFile.upload.chooseFile',
    description: 'Button that opens the file picker',
  },
  dropHint: {
    id: 'app.mediaFile.upload.dropHint',
    description: 'Hint next to the file picker button',
  },
  limits: {
    id: 'app.mediaFile.upload.limits',
    description: 'Accepted file types and size limit',
  },
  uploadButton: {
    id: 'app.mediaFile.upload.button',
    description: 'Starts the upload and the playback',
  },
  uploading: {
    id: 'app.mediaFile.upload.uploading',
    description: 'Upload progress',
  },
  cancel: {
    id: 'app.mediaFile.upload.cancel',
    description: 'Closes the media file view',
  },
  listTitle: {
    id: 'app.mediaFile.list.title',
    description: 'Title of the list of files uploaded in this meeting',
  },
  listPlay: {
    id: 'app.mediaFile.list.play',
    description: 'Plays a file that was uploaded before',
  },
  listRemove: {
    id: 'app.mediaFile.list.remove',
    description: 'Removes an uploaded file from the meeting',
  },
  errorWrongType: {
    id: 'app.mediaFile.error.wrongType',
    description: 'The chosen file type is not accepted',
  },
  errorTooLarge: {
    id: 'app.mediaFile.error.tooLarge',
    description: 'The chosen file is over the size limit',
  },
  errorUnavailable: {
    id: 'app.mediaFile.error.unavailable',
    description: 'The upload failed',
  },
});

// Human readable file size for the file list.
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MediaFileView: React.FC<MediaFileViewProps> = ({ intl, onActionCompleted }) => {
  const {
    uploadEndpoint,
    mirroredFromBBBCore: { uploadSizeMax },
    uploadValidMimeTypes,
  } = mediaFileSettings();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [startMediaFile] = useMutation(startMediaFileMutation);
  const [removeMediaFile] = useMutation(removeMediaFileMutation);
  const { data, error } = useSubscription(getMediaFiles);

  // The list is live: a subscription keeps it in step with uploads and removals in the meeting.
  useEffect(() => {
    if (!error) return;
    logger.error({
      logCode: 'media_file_list',
      extraInfo: { error },
    }, 'Could not read the list of media files');
    setErrorMessage(intl.formatMessage(intlMessages.errorUnavailable));
  }, [error, intl]);

  const files: MediaFileRow[] = data?.mediaFile ?? [];
  const uploading = progress !== null;

  const acceptedExtensions = useMemo(
    () => uploadValidMimeTypes.map((entry: { extension: string }) => entry.extension),
    [uploadValidMimeTypes],
  );
  const limitsText = intl.formatMessage(intlMessages.limits, {
    types: acceptedExtensions.join(', '),
    size: formatBytes(uploadSizeMax),
  });

  // The selected size and the drop hint share one line, and a touch device gets neither the hint
  // nor an empty row.
  const sizeOrDropHint = selectedFile
    ? formatBytes(selectedFile.size)
    : CAN_DROP_FILES && intl.formatMessage(intlMessages.dropHint);
  const extensionOf = (filename: string) => {
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
  };

  const validateFile = (file: File): string | null => {
    if (!acceptedExtensions.includes(extensionOf(file.name))) {
      return intl.formatMessage(intlMessages.errorWrongType);
    }
    if (file.size > uploadSizeMax) {
      return intl.formatMessage(intlMessages.errorTooLarge, { size: formatBytes(uploadSizeMax) });
    }
    return null;
  };

  const handleFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setErrorMessage(file ? validateFile(file) : null);
    setSelectedFile(file);
  };

  // Removal deletes the row and the stored file, so the row goes from the list and a player
  // showing that file stops for everyone.
  const removeFile = useCallback((mediaFileId: string) => {
    removeMediaFile({ variables: { mediaFileId } }).catch((error) => {
      logger.error({
        logCode: 'media_file_service',
        extraInfo: { error },
      }, 'Could not remove the media file');
      setErrorMessage(intl.formatMessage(intlMessages.errorUnavailable));
    });
  }, [removeMediaFile, intl]);

  const playFile = useCallback((mediaFileId: string) => {
    startMediaFile({ variables: { mediaFileId } }).then(() => {
      onActionCompleted();
    }).catch((error) => {
      logger.error({
        logCode: 'media_file_service',
        extraInfo: { error },
      }, 'Could not start the media player');
      setErrorMessage(intl.formatMessage(intlMessages.errorUnavailable));
    });
  }, [startMediaFile, onActionCompleted, intl]);

  const handleUploadAndPlay = () => {
    if (!selectedFile || validateFile(selectedFile)) return;

    setErrorMessage(null);
    setProgress(0);
    uploadMediaFile(selectedFile, uploadEndpoint, setProgress)
      .then(({ mediaFileId }) => {
        setSelectedFile(null);
        playFile(mediaFileId);
      })
      .catch((error) => {
        logger.error({
          logCode: 'media_file_service',
          extraInfo: { error },
        }, 'Media file upload failed');
        setErrorMessage(intl.formatMessage(intlMessages.errorUnavailable));
      })
      .finally(() => setProgress(null));
  };

  return (
    <Styled.Container>
      <Styled.UploadArea aria-disabled={uploading} data-test="mediaFileDropArea">
        <Styled.FileInput
          type="file"
          accept={uploadValidMimeTypes
            .map((entry: { extension: string, mime: string }) => `${entry.extension},${entry.mime}`)
            .join(',')}
          onChange={handleFileChosen}
          disabled={uploading}
        />
        {selectedFile
          ? <Styled.FileName>{selectedFile.name}</Styled.FileName>
          : <Styled.FileName>{intl.formatMessage(intlMessages.chooseFile)}</Styled.FileName>}
        {sizeOrDropHint && (
          <Styled.LimitsText>{sizeOrDropHint}</Styled.LimitsText>
        )}
        <Styled.LimitsText>{limitsText}</Styled.LimitsText>
      </Styled.UploadArea>

      {uploading && (
        <Styled.ProgressWrapper>
          <Styled.ProgressTrack>
            <Styled.ProgressFill $percent={progress ?? 0} />
          </Styled.ProgressTrack>
          <Styled.LimitsText>
            {intl.formatMessage(intlMessages.uploading, { percent: progress })}
          </Styled.LimitsText>
        </Styled.ProgressWrapper>
      )}

      {errorMessage && <Styled.ErrorText>{errorMessage}</Styled.ErrorText>}

      <Styled.ProgressWrapper>
        <BBButton
          dataTest="uploadMediaFile"
          label={intl.formatMessage(intlMessages.uploadButton)}
          variant="primary"
          disabled={!selectedFile || uploading || errorMessage !== null}
          onClick={handleUploadAndPlay}
        />
        <BBButton
          dataTest="cancelMediaFileUpload"
          label={intl.formatMessage(intlMessages.cancel)}
          disabled={uploading}
          onClick={onActionCompleted}
        />
      </Styled.ProgressWrapper>

      {files.length > 0 && (
        <>
          <Styled.ListTitle>{intl.formatMessage(intlMessages.listTitle)}</Styled.ListTitle>
          <Styled.FileList>
            {files.map((file) => (
              <Styled.FileRow key={file.mediaFileId}>
                <Styled.FileRowName>{file.filename}</Styled.FileRowName>
                <Styled.FileRowMeta>{formatBytes(file.fileSize)}</Styled.FileRowMeta>
                <BBButton
                  dataTest={`playMediaFile-${file.mediaFileId}`}
                  label={intl.formatMessage(intlMessages.listPlay)}
                  size="sm"
                  iconStart={<PlayArrowIcon />}
                  onClick={() => playFile(file.mediaFileId)}
                />
                <Button
                  data-test={`removeMediaFile-${file.mediaFileId}`}
                  label={intl.formatMessage(intlMessages.listRemove)}
                  aria-label={`${intl.formatMessage(intlMessages.listRemove)} ${file.filename}`}
                  size="sm"
                  icon="delete"
                  hideLabel
                  onClick={() => removeFile(file.mediaFileId)}
                />
              </Styled.FileRow>
            ))}
          </Styled.FileList>
        </>
      )}
    </Styled.Container>
  );
};

export default MediaFileView;
