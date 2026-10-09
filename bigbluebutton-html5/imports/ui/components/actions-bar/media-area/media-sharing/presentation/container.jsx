import React from 'react';
import ErrorBoundary from '/imports/ui/components/common/error-boundary/component';
import PropTypes from 'prop-types';
import FallbackModal from '/imports/ui/components/common/fallback-errors/fallback-modal/component';
import { useMutation } from '@apollo/client';
import Service from './service';
import PresUploaderToast from '/imports/ui/components/presentation/presentation-toast/presentation-uploader-toast/component';
import PresentationUploader from './component';
import {
  useIsPresentationEnabled,
  useIsDownloadPresentationOriginalFileEnabled,
  useIsDownloadPresentationConvertedToPdfEnabled,
  useIsDownloadPresentationWithAnnotationsEnabled,
} from '/imports/ui/services/features';
import {
  PRESENTATIONS_SUBSCRIPTION,
} from '/imports/ui/components/whiteboard/queries';
import {
  PRESENTATION_SET_DOWNLOADABLE,
  PRESENTATION_EXPORT,
  PRESENTATION_SET_CURRENT,
  PRESENTATION_REMOVE,
} from '/imports/ui/components/presentation/mutations';
import useDeduplicatedSubscription from '/imports/ui/core/hooks/useDeduplicatedSubscription';
import usePresentationFitToWidth from '/imports/ui/components/presentation/hooks/usePresentationFitToWidth';
import { MEDIA_FILE_STOP } from '/imports/ui/components/media-file-player/mutations';
import { layoutSelectInput } from '/imports/ui/components/layout/context';
import { MEDIA_FILE_GENERIC_CONTENT_ID } from '/imports/ui/components/media-file-player/service';

const PresentationUploaderContainer = (props) => {
  const {
    amIPresenter, onActionCompleted, ...restProps
  } = props;

  const { data: presentationData } = useDeduplicatedSubscription(PRESENTATIONS_SUBSCRIPTION);
  const presentations = presentationData?.pres_presentation || [];
  const currentPresentation = presentations.find((p) => p.current)?.presentationId || '';
  // eslint-disable-next-line no-unused-vars
  const [_, setPresentationFitToWidth] = usePresentationFitToWidth();

  // Sharing a presentation is how the presenter asks for the slides back. A shared file owns the
  // media area while it plays, so the file yields first and the slides come up after it.
  const genericMainContent = layoutSelectInput((i) => i.genericMainContent);
  const isVideoSharing = genericMainContent.genericContentId === MEDIA_FILE_GENERIC_CONTENT_ID;
  const [mediaFileStop] = useMutation(MEDIA_FILE_STOP);
  const stopMediaFileSharing = () => mediaFileStop();

  const [presentationSetDownloadable] = useMutation(PRESENTATION_SET_DOWNLOADABLE);
  const [presentationExport] = useMutation(PRESENTATION_EXPORT);
  const [presentationSetCurrent] = useMutation(PRESENTATION_SET_CURRENT);
  const [presentationRemove] = useMutation(PRESENTATION_REMOVE);

  const exportPresentation = (presentationId, fileStateType) => {
    presentationExport({
      variables: {
        presentationId,
        fileStateType,
      },
    });
  };

  const dispatchChangePresentationDownloadable = (presentationId, downloadable, fileStateType) => {
    presentationSetDownloadable({
      variables: {
        presentationId,
        downloadable,
        fileStateType,
      },
    });
  };

  const setPresentation = (presentationId) => {
    setPresentationFitToWidth(false);
    presentationSetCurrent({ variables: { presentationId } });
  };

  const removePresentation = (presentationId) => {
    presentationRemove({ variables: { presentationId } });
  };

  const presentationEnabled = useIsPresentationEnabled();
  const allowDownloadOriginal = useIsDownloadPresentationOriginalFileEnabled();
  const allowDownloadConverted = useIsDownloadPresentationConvertedToPdfEnabled();
  const allowDownloadWithAnnotations = useIsDownloadPresentationWithAnnotationsEnabled();
  const externalUploadData = Service.useExternalUploadData();
  const PRESENTATION_CONFIG = window.meetingClientSettings.public.presentation;

  if (!amIPresenter) {
    return null;
  }

  return (
    <ErrorBoundary Fallback={FallbackModal}>
      <PresentationUploader
        isPresenter={amIPresenter}
        presentations={presentations.filter((p) => p && p.uploadCompleted)}
        currentPresentation={currentPresentation}
        exportPresentation={exportPresentation}
        dispatchChangePresentationDownloadable={dispatchChangePresentationDownloadable}
        setPresentation={setPresentation}
        removePresentation={removePresentation}
        fileUploadConstraintsHint={PRESENTATION_CONFIG.fileUploadConstraintsHint}
        fileSizeMax={PRESENTATION_CONFIG.mirroredFromBBBCore.uploadSizeMax}
        filePagesMax={PRESENTATION_CONFIG.mirroredFromBBBCore.uploadPagesMax}
        fileValidMimeTypes={PRESENTATION_CONFIG.uploadValidMimeTypes}
        allowDownloadOriginal={allowDownloadOriginal}
        allowDownloadConverted={allowDownloadConverted}
        allowDownloadWithAnnotations={allowDownloadWithAnnotations}
        presentationEnabled={presentationEnabled}
        externalUploadData={externalUploadData}
        handleSave={Service.handleSavePresentation}
        handleDismissToast={PresUploaderToast.handleDismissToast}
        renderToastList={Service.renderToastList}
        renderPresentationItemStatus={PresUploaderToast.renderPresentationItemStatus}
        handleFiledrop={Service.handleFiledrop}
        dispatchDisableDownloadable={Service.dispatchDisableDownloadable}
        dispatchEnableDownloadable={Service.dispatchEnableDownloadable}
        onActionCompleted={onActionCompleted}
        isVideoSharing={isVideoSharing}
        stopMediaFileSharing={stopMediaFileSharing}
        {...restProps}
      />
    </ErrorBoundary>
  );
};

PresentationUploaderContainer.propTypes = {
  amIPresenter: PropTypes.bool.isRequired,
  onActionCompleted: PropTypes.func.isRequired,
};

export default PresentationUploaderContainer;
