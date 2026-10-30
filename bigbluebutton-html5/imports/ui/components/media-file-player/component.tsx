import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useMutation } from '@apollo/client';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import BBBMenu from '/imports/ui/components/common/menu/component';
import {
  layoutDispatch,
  layoutSelectInput,
  layoutSelectOutput,
} from '/imports/ui/components/layout/context';
import { Input, Output } from '/imports/ui/components/layout/layoutTypes';
import DEFAULT_VALUES from '/imports/ui/components/layout/defaultValues';
import { ACTIONS, PRESENTATION_AREA } from '/imports/ui/components/layout/enums';
import Styled from './styles';
import { MEDIA_FILE_UPDATE, MEDIA_FILE_STOP } from './mutations';
import {
  MediaPlayerRow,
  buildMediaFileUrl,
  calculateMediaCurrentTime,
  isAudioContentType,
  playerStatusFromEvent,
  MEDIA_FILE_GENERIC_CONTENT_ID,
} from './service';
import {
  PlayerAnchor,
  PlayerDensity,
  getStoredAnchor,
  getStoredMuted,
  getStoredVolume,
  setStoredAnchor,
  setStoredMuted,
  setStoredVolume,
} from './local-settings';

// A viewer corrects its position only when it drifts further than this from where the
// room should be. Correcting every tick would make playback stutter.
const SYNC_THRESHOLD_SECONDS = 1.5;
// A presenter reports at most one seek per interval: dragging a progress bar fires a
// seek event per pixel otherwise.
const SEEK_REPORT_INTERVAL_MS = 500;
const SECONDS_PER_MINUTE = 60;
// Player decisions, not M3 values: M3 publishes a control band height but this player picks
// its own, and the compact form is the pill the presenter collapses to.
const BAR_HEIGHT_PX = 56;
const PILL_HEIGHT_PX = 44;
// The compact form hugs its own controls, so this is the widest it may become, not a width.
const PILL_MAX_WIDTH_PX = 320;
const MIN_BAND_WIDTH_PX = 160;
// The gap the layout engine leaves between the content above and the band. It is the same value the
// media area already uses between its other pieces (DEFAULT_VALUES.camerasMargin): the engine
// applies it when it reserves the band, and this copy covers the fallback where the engine cannot.
const BAND_GAP_PX = DEFAULT_VALUES.camerasMargin;

const ANCHORS: PlayerAnchor[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

const intlMessages = defineMessages({
  regionLabel: {
    id: 'app.mediaFile.player.regionLabel',
    description: 'Accessible name of the media player region',
  },
  play: {
    id: 'app.mediaFile.player.play',
  },
  pause: {
    id: 'app.mediaFile.player.pause',
  },
  stop: {
    id: 'app.mediaFile.player.stop',
  },
  seek: {
    id: 'app.mediaFile.player.seek',
  },
  volume: {
    id: 'app.mediaFile.player.volume',
  },
  mute: {
    id: 'app.mediaFile.player.mute',
  },
  unmute: {
    id: 'app.mediaFile.player.unmute',
  },
  collapse: {
    id: 'app.mediaFile.player.collapse',
  },
  expand: {
    id: 'app.mediaFile.player.expand',
  },
  move: {
    id: 'app.mediaFile.player.move',
  },
  moreOptions: {
    id: 'app.mediaFile.player.moreOptions',
  },
  presenterOnly: {
    id: 'app.mediaFile.player.presenterOnly',
  },
  anchorTop: {
    id: 'app.mediaFile.player.anchorTop',
  },
  anchorBottom: {
    id: 'app.mediaFile.player.anchorBottom',
  },
  anchorTopLeft: {
    id: 'app.mediaFile.player.anchorTopLeft',
  },
  anchorTopRight: {
    id: 'app.mediaFile.player.anchorTopRight',
  },
  anchorBottomLeft: {
    id: 'app.mediaFile.player.anchorBottomLeft',
  },
  anchorBottomRight: {
    id: 'app.mediaFile.player.anchorBottomRight',
  },
  errorUnavailable: {
    id: 'app.mediaFile.error.unavailable',
  },
  audioLabel: {
    id: 'app.mediaFile.player.audioLabel',
  },
  videoLabel: {
    id: 'app.mediaFile.player.videoLabel',
  },
});

interface MenuAction {
  key: string;
  label?: React.ReactNode;
  dataTest?: string;
  disabled?: boolean;
  isTitle?: boolean;
  isSeparator?: boolean;
  onClick?: () => void;
}

interface MediaFilePlayerProps {
  mediaPlayer: MediaPlayerRow;
  isPresenter: boolean;
  meetingId: string;
  sharingUrl: string;
  timeSync: number;
}

const anchorLabels = {
  'top-left': intlMessages.anchorTopLeft,
  'top-right': intlMessages.anchorTopRight,
  'bottom-left': intlMessages.anchorBottomLeft,
  'bottom-right': intlMessages.anchorBottomRight,
};

// A bar spans the whole media width, so the only choice it has is which edge it sits on. A pill is
// narrow enough for a corner to mean something, so it gets all four.
const EDGE_ANCHORS: Array<'top' | 'bottom'> = ['top', 'bottom'];
const edgeLabels = {
  top: intlMessages.anchorTop,
  bottom: intlMessages.anchorBottom,
};

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  const rest = total % SECONDS_PER_MINUTE;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
};

const MediaFilePlayer: React.FC<MediaFilePlayerProps> = ({
  mediaPlayer,
  isPresenter,
  meetingId,
  sharingUrl,
  timeSync,
}) => {
  const intl = useIntl();
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  // The element is created after the first render, and the effects below have to run once it is
  // there: the state form makes them run again on attach, where the ref alone left them doing
  // nothing and the player frozen for anyone who joined after the file started.
  const [attachedMedia, setAttachedMedia] = useState<HTMLVideoElement | HTMLAudioElement | null>(null);
  const lastSeekReportRef = useRef(0);
  // The presenter leads its own element for each file, so the room state that arrives back from
  // akka does not fight the local controls. Keyed on the file: a switch to the next file has to
  // sync again, and a viewer who becomes the presenter has to start leading.
  const presenterSyncedRef = useRef<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(getStoredVolume);
  const [muted, setMuted] = useState(getStoredMuted);
  // The size of the player is room state: the presenter picks it and every client renders it, so it
  // comes from the subscribed row and the override only covers the round trip of the click.
  const [densityOverride, setDensityOverride] = useState<PlayerDensity | null>(null);
  const densityFromRow: PlayerDensity = mediaPlayer.playerCompact ? 'pill' : 'bar';
  const density: PlayerDensity = densityOverride ?? densityFromRow;
  const [anchor, setAnchor] = useState<PlayerAnchor>(getStoredAnchor);
  const [volumeOpen, setVolumeOpen] = useState(false);

  // A different file is a different element at a different position, so the state that belonged to
  // the previous one goes away with it.
  useEffect(() => {
    setFailed(false);
    setBlocked(false);
    setDuration(0);
    setCurrentTime(0);
  }, [mediaPlayer.mediaFileId]);

  const [updateMediaFile] = useMutation(MEDIA_FILE_UPDATE);
  const [stopMediaFile] = useMutation(MEDIA_FILE_STOP);

  const isAudio = isAudioContentType(mediaPlayer.contentType);
  // A video needs the rectangle for its picture, so only an audio file has a compact form.
  const pill = density === 'pill' && isAudio;
  const bandHeight = pill ? PILL_HEIGHT_PX : BAR_HEIGHT_PX;
  const url = useMemo(
    () => buildMediaFileUrl(sharingUrl, meetingId, mediaPlayer.mediaFileId, mediaPlayer.filename),
    [sharingUrl, meetingId, mediaPlayer.mediaFileId, mediaPlayer.filename],
  );

  const report = useCallback((event: 'play' | 'pause' | 'seek', compact: boolean) => {
    const element = mediaRef.current;
    if (!element) return;
    updateMediaFile({
      variables: playerStatusFromEvent(event, element.currentTime, element.playbackRate || 1, !element.paused, compact),
    });
  }, [updateMediaFile]);

  // A stable callback ref: a new function per render would make React detach and
  // reattach the element on every render.
  const setMediaRef = useCallback((element: HTMLVideoElement | HTMLAudioElement | null) => {
    mediaRef.current = element;
    setAttachedMedia(element);
  }, []);

  // The room state decides where the playback is, for viewers on every change and for
  // the presenter on the first one (a presenter that refreshed must catch up too).
  useEffect(() => {
    const element = attachedMedia;
    if (!element) return;
    if (isPresenter && presenterSyncedRef.current === mediaPlayer.mediaFileId) return;

    const target = calculateMediaCurrentTime(timeSync, mediaPlayer);
    if (Math.abs(element.currentTime - target) > SYNC_THRESHOLD_SECONDS) {
      element.currentTime = target;
    }
    element.playbackRate = mediaPlayer.playerPlaybackRate || 1;
    presenterSyncedRef.current = mediaPlayer.mediaFileId;
  }, [attachedMedia, mediaPlayer.updatedAt, mediaPlayer.mediaFileId]);

  useEffect(() => {
    const element = attachedMedia;
    if (!element) return;
    element.playbackRate = mediaPlayer.playerPlaybackRate || 1;

    // The room decides whether the element runs, and a paused element has to be started here: a
    // viewer that joined late, or whose browser refused the first attempt, would otherwise stay
    // frozen with a disabled control and no way to ask for playback.
    if (!mediaPlayer.playerPlaying) {
      element.pause();
      return;
    }
    // An element that is already running needs nothing from the room.
    if (!element.paused) return;
    // A viewer's browser may refuse to start audio without a gesture, which is why the overlay
    // exists: the rejection is what puts it on screen.
    element.play().catch(() => setBlocked(true));
  }, [attachedMedia, mediaPlayer.playerPlaying, mediaPlayer.mediaFileId, mediaPlayer.updatedAt]);

  // Volume and mute are the one part of playback the room does not share: every client
  // keeps its own level, and only the presenter's play, pause and seek travel.
  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;
    element.volume = volume;
    element.muted = muted;
  }, [attachedMedia, volume, muted, duration]);

  // The row is the source of truth for the size, so the override goes away as soon as the row
  // carries the value the presenter clicked.
  useEffect(() => {
    setDensityOverride(null);
  }, [mediaPlayer.playerCompact]);

  const handleTimeUpdate = () => {
    const element = mediaRef.current;
    if (!element) return;
    setCurrentTime(element.currentTime);

    if (isPresenter) return;
    const target = calculateMediaCurrentTime(timeSync, mediaPlayer);
    if (Math.abs(element.currentTime - target) > SYNC_THRESHOLD_SECONDS) {
      element.currentTime = target;
    }
  };

  const handleTogglePlay = () => {
    const element = mediaRef.current;
    if (!element) return;
    setBlocked(false);
    if (element.paused) {
      element.play().catch(() => setBlocked(true));
    } else {
      element.pause();
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const element = mediaRef.current;
    if (!element) return;
    element.currentTime = Number(event.target.value);
    setCurrentTime(element.currentTime);
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    setVolume(next);
    setStoredVolume(next);
    // Raising the slider from zero is the intent to hear something, and pulling it to zero
    // is the intent to mute, so the icon follows instead of contradicting the slider.
    if (next > 0 && muted) {
      setMuted(false);
      setStoredMuted(false);
    } else if (next === 0 && !muted) {
      setMuted(true);
      setStoredMuted(true);
    }
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setStoredMuted(next);
  };

  const handleToggleDensity = () => {
    const element = mediaRef.current;
    if (!element || !isPresenter) return;
    const next: PlayerDensity = density === 'bar' ? 'pill' : 'bar';
    setDensityOverride(next);
    // The size rides along with a playback report, so the row is still written by the presenter's
    // own client and every other client follows it through the subscription.
    report(element.paused ? 'pause' : 'play', next === 'pill');
  };

  const handleAnchor = (next: PlayerAnchor) => {
    setAnchor(next);
    setStoredAnchor(next);
  };

  const handleStop = () => {
    setStopped(true);
    stopMediaFile();
  };

  const layoutContextDispatch = layoutDispatch();
  const genericContent = layoutSelectInput((i: Input) => i.genericMainContent);
  const genericContentArea = layoutSelectOutput((i: Output) => i.genericMainContent);
  const mediaPlayerArea = layoutSelectOutput((i: Output) => i.mediaPlayer);

  // A screenshare, an external video, the pinned notes and a plugin main area item each claim the
  // media rectangle for themselves, and a room shows one media content at a time. A video claims it
  // the same way, so the slides yield to it. An audio file is small enough to share the area: it
  // asks the layout engine for a band instead, and everything else relayouts around that band.

  // The controls sit inside the rectangle the media area gave the player, so they are never drawn
  // over another content. The row height follows the density, and its edge follows the anchor.
  const bandPosition: 'top' | 'bottom' = anchor.startsWith('top') ? 'top' : 'bottom';
  // The pile entry is what opens the media area, exactly as it does for an external video, and what
  // keeps the cameras in their dock while a video plays. An audio file reserves a band instead and
  // leaves this alone, so the slides stay on screen next to it.
  const claimedArea = useRef(false);
  useEffect(() => {
    const shouldClaim = !stopped && !isAudio;
    if (claimedArea.current === shouldClaim) return;
    layoutContextDispatch({
      type: ACTIONS.SET_PILE_CONTENT_FOR_PRESENTATION_AREA,
      value: {
        content: PRESENTATION_AREA.GENERIC_CONTENT,
        genericContentId: MEDIA_FILE_GENERIC_CONTENT_ID,
        open: shouldClaim,
      },
    });
    claimedArea.current = shouldClaim;
  }, [stopped, isAudio, layoutContextDispatch]);
  useEffect(() => () => {
    if (!claimedArea.current) return;
    layoutContextDispatch({
      type: ACTIONS.SET_PILE_CONTENT_FOR_PRESENTATION_AREA,
      value: {
        content: PRESENTATION_AREA.GENERIC_CONTENT,
        genericContentId: MEDIA_FILE_GENERIC_CONTENT_ID,
        open: false,
      },
    });
    claimedArea.current = false;
  }, [layoutContextDispatch]);

  // The band an audio file asks for, and where it sits. The engine takes it out of the media area,
  // so the slides, the camera dock and every other content shrink or move instead of being covered.
  const reportedBand = useRef('');
  useEffect(() => {
    const hasMediaPlayer = !stopped && isAudio;
    const signature = `${hasMediaPlayer}:${bandHeight}:${bandPosition}`;
    if (reportedBand.current === signature) return;
    layoutContextDispatch({
      type: ACTIONS.SET_MEDIA_PLAYER_INPUT,
      value: { hasMediaPlayer, height: bandHeight, position: bandPosition },
    });
    reportedBand.current = signature;
  }, [stopped, isAudio, bandHeight, bandPosition, layoutContextDispatch]);
  useEffect(() => () => {
    layoutContextDispatch({
      type: ACTIONS.SET_MEDIA_PLAYER_INPUT,
      value: { hasMediaPlayer: false, height: 0, position: 'bottom' },
    });
  }, [layoutContextDispatch]);

  // The rectangle comes from the engine, the same way a screenshare or an external video gets its
  // own, and the player draws nothing at all while the area belongs to another content.
  // A video reads the rectangle the generic content slot hands it. An audio file reads the band the
  // engine reserved for it, and draws nothing when the engine reports no band.
  const ownsArea = isAudio
    ? mediaPlayerArea.display === true
    : genericContent.genericContentId === MEDIA_FILE_GENERIC_CONTENT_ID;
  const area = isAudio ? mediaPlayerArea : genericContentArea;
  const contentWidth = area.width ?? 0;
  const contentHeight = area.height ?? 0;
  const contentLeft = area.left ?? 0;
  const contentTop = area.top ?? 0;
  const contentZIndex = area.zIndex ?? 1;
  if (!ownsArea || stopped || !contentWidth || !contentHeight) return null;

  // The row fills the rectangle the media area gave the player: for a video it is the control band
  // under the picture, and for an audio file it is the whole visual. The picture keeps the gap above
  // the row, so it is never covered by its own controls.
  // The reserved band is the row itself, so an audio file fills it. A video owns its rectangle, so
  // the row is carved out of it and the picture keeps the gap above the row.
  const rowHeight = isAudio ? contentHeight : Math.min(bandHeight, contentHeight);
  const bandTop = isAudio || bandPosition === 'top'
    ? contentTop
    : contentTop + contentHeight - rowHeight;
  const bandWidth = contentWidth;
  const bandLeft = contentLeft;
  const bandZIndex = contentZIndex + 1;
  const mediaTop = bandPosition === 'top' ? contentTop + rowHeight + BAND_GAP_PX : contentTop;
  const mediaHeight = Math.max(0, contentHeight - rowHeight - BAND_GAP_PX);

  // The compact form shrinks into one corner of the band and hugs its own controls, which keeps the
  // reserved row but stops the controls from spanning the whole width. It never overlaps anything
  // because the row it sits in is its own.
  const bandPillMaxWidth = Math.max(
    MIN_BAND_WIDTH_PX,
    Math.min(PILL_MAX_WIDTH_PX, bandWidth),
  );
  // A pill on the right edge is placed by that edge and pulled back over its own width, so the cap
  // stays a maximum and no measurement of the content is needed.
  const pillAtEnd = pill && anchor.endsWith('right');
  const visibleBandWidth = pill ? bandPillMaxWidth : bandWidth;
  const visibleBandLeft = pillAtEnd ? bandLeft + bandWidth : bandLeft;

  const handleLoadedMetadata = (event: React.SyntheticEvent<HTMLMediaElement>) => {
    setDuration(event.currentTarget.duration);
    const element = mediaRef.current;
    if (!element) return;
    element.playbackRate = mediaPlayer.playerPlaybackRate || 1;
    element.volume = volume;
    element.muted = muted;
  };

  const handlePlay = () => {
    setBlocked(false);
    setIsPlaying(true);
    if (isPresenter) report('play', pill);
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (isPresenter) report('pause', pill);
  };

  const handleSeeked = () => {
    if (!isPresenter) return;
    const now = Date.now();
    if (now - lastSeekReportRef.current < SEEK_REPORT_INTERVAL_MS) return;
    lastSeekReportRef.current = now;
    report('seek', pill);
  };

  const handleError = () => setFailed(true);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  // Only the presenter writes playback state, so a viewer gets a read-only progress bar and a
  // play button that exists for one purpose: granting the gesture a browser demands before it
  // will start audio on its own.
  const playDisabled = !isPresenter && !blocked;
  const playLabel = intl.formatMessage(isPlaying ? intlMessages.pause : intlMessages.play);
  const volumeLabel = intl.formatMessage(muted || volume === 0 ? intlMessages.unmute : intlMessages.mute);
  // The size is the presenter's call, so a viewer's control only says why it is inert.
  const densityIconLabel = pill ? intlMessages.expand : intlMessages.collapse;
  const densityToggleLabel = isPresenter ? densityIconLabel : intlMessages.presenterOnly;

  const menuActions: MenuAction[] = [
    {
      key: 'stop',
      label: <Styled.StopItem>{intl.formatMessage(intlMessages.stop)}</Styled.StopItem>,
      dataTest: 'mediaFileStop',
      disabled: !isPresenter,
      onClick: handleStop,
    },
    {
      key: 'move-title',
      label: intl.formatMessage(intlMessages.move),
      isTitle: true,
    },
    ...(pill
      ? ANCHORS.map((value) => ({
        key: `anchor-${value}`,
        label: intl.formatMessage(anchorLabels[value]),
        dataTest: `mediaFileAnchor-${value}`,
        onClick: () => handleAnchor(value),
      }))
      : EDGE_ANCHORS.map((value) => ({
        key: `anchor-${value}`,
        label: intl.formatMessage(edgeLabels[value]),
        dataTest: `mediaFileAnchor-${value}`,
        // A bar only moves between the edges, so the corner it would use as a pill is kept.
        onClick: () => handleAnchor(`${value}-${anchor.endsWith('right') ? 'right' : 'left'}`),
      }))),
  ];

  const controls = (
    <Styled.Row>
      {!pill && (
        <Styled.MediaKind title={mediaPlayer.filename}>
          {intl.formatMessage(isAudio ? intlMessages.audioLabel : intlMessages.videoLabel)}
        </Styled.MediaKind>
      )}
      <Styled.IconButton
        type="button"
        onClick={handleTogglePlay}
        disabled={playDisabled}
        aria-label={playLabel}
        title={playDisabled ? intl.formatMessage(intlMessages.presenterOnly) : playLabel}
      >
        {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
      </Styled.IconButton>
      <Styled.TimeLabel>{`${formatTime(currentTime)} / ${formatTime(duration)}`}</Styled.TimeLabel>
      {!pill && (
        <Styled.Slider
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          $progress={progress}
          onChange={handleSeek}
          disabled={!isPresenter}
          aria-label={intl.formatMessage(intlMessages.seek)}
          aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
        />
      )}
      <Styled.VolumeControl>
        <Styled.IconButton
          type="button"
          onClick={pill ? handleToggleMute : () => setVolumeOpen((open) => !open)}
          aria-label={volumeLabel}
          aria-expanded={pill ? undefined : volumeOpen}
          title={volumeLabel}
        >
          {muted || volume === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}
        </Styled.IconButton>
        {!pill && volumeOpen && (
          <Styled.Slider
            $compact
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={muted ? 0 : volume}
            $progress={(muted ? 0 : volume) * 100}
            onChange={handleVolumeChange}
            aria-label={intl.formatMessage(intlMessages.volume)}
          />
        )}
      </Styled.VolumeControl>
      {isAudio && (
        <Styled.IconButton
          type="button"
          onClick={handleToggleDensity}
          disabled={!isPresenter}
          aria-label={intl.formatMessage(densityToggleLabel)}
          title={intl.formatMessage(densityToggleLabel)}
        >
          {pill ? <OpenInFullIcon /> : <CloseFullscreenIcon />}
        </Styled.IconButton>
      )}
      <BBBMenu
        trigger={(
          <Styled.MenuTrigger type="button" aria-label={intl.formatMessage(intlMessages.moreOptions)}>
            <MoreVertIcon />
          </Styled.MenuTrigger>
        )}
        actions={menuActions}
        opts={{
          id: 'media-file-player-menu',
          keepMounted: false,
          transitionDuration: 0,
        }}
      />
    </Styled.Row>
  );

  const mediaElement = isAudio ? (
    <Styled.AudioMedia
      ref={setMediaRef}
      src={url}
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onPlay={handlePlay}
      onPause={handlePause}
      onSeeked={handleSeeked}
      onError={handleError}
      aria-label={mediaPlayer.filename}
    />
  ) : (
    <Styled.Video
      ref={setMediaRef}
      src={url}
      controls={false}
      playsInline
      preload="auto"
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onPlay={handlePlay}
      onPause={handlePause}
      onSeeked={handleSeeked}
      onError={handleError}
      aria-label={mediaPlayer.filename}
    />
  );

  return (
    <>
      {!isAudio && (
        <Styled.ContentFrame
          $top={mediaTop}
          $left={contentLeft}
          $width={contentWidth}
          $height={mediaHeight}
          $zIndex={contentZIndex}
        >
          {mediaElement}
        </Styled.ContentFrame>
      )}
      <Styled.Band
        $top={bandTop}
        $left={visibleBandLeft}
        $width={visibleBandWidth}
        $height={rowHeight}
        $zIndex={bandZIndex}
        $pill={pill}
        $alignEnd={pillAtEnd}
        role="region"
        aria-label={intl.formatMessage(intlMessages.regionLabel)}
      >
        {isAudio && mediaElement}
        {failed
          ? <Styled.Notice>{intl.formatMessage(intlMessages.errorUnavailable)}</Styled.Notice>
          : controls}
        {blocked && (
          <Styled.StartOverlay type="button" onClick={handleTogglePlay}>
            {intl.formatMessage(intlMessages.play)}
          </Styled.StartOverlay>
        )}
      </Styled.Band>
    </>
  );
};

export default MediaFilePlayer;
