import styled, { css } from 'styled-components';
import {
  lgBorderRadius,
} from '/imports/ui/stylesheets/styled-components/general';
import {
  fontSizeBase,
  fontSizeSmaller,
  textFontWeight,
} from '/imports/ui/stylesheets/styled-components/typography';
import { smallOnly } from '/imports/ui/stylesheets/styled-components/breakpoints';
import {
  colorPrimary,
  colorOffWhite,
  colorText,
  colorGrayLight,
  colorDanger,
  colorBlueLightestBorder,
} from '/imports/ui/stylesheets/styled-components/palette';

// Measurements follow Material 3 where M3 publishes one, and are the player's own decisions
// where it does not. M3 numbers: the icon button is a 40dp container at full corner with a
// 24dp icon, and text is label large 14sp. Player decisions, because M3 publishes no strip
// geometry: the 56px control band, the 44px compact band, the cap on the compact width, the 6px
// slider track and the 16px slider handle.
interface RectProps {
  $top: number;
  $left: number;
  $width: number;
  $height: number;
  $zIndex: number;
}

// The controls live in their own row the layout engine reserves, so they never sit on top of
// the slides or the picture. The shape follows the other surfaces of the room: the same large
// corner as the presentation, the screenshare and the shared notes, and a gap above instead of a
// shared edge. Only the compact width is chosen here: the band spans the media area in the bar
// density and shrinks into one corner in the pill density, where it hugs its own controls.
const Band = styled.div<RectProps & { $pill?: boolean; $alignEnd?: boolean }>`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: ${({ $width }) => $width}px;
  height: ${({ $height }) => $height}px;
  z-index: ${({ $zIndex }) => $zIndex};
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  padding: 0 8px;
  background-color: ${colorOffWhite};
  border: 1px solid ${colorBlueLightestBorder};
  border-radius: ${lgBorderRadius};
  color: ${colorText};

  ${({ $pill, $width }) => $pill && css`
    width: fit-content;
    max-width: ${$width}px;
    padding: 0 4px;
  `}

  ${({ $alignEnd }) => $alignEnd && css`
    transform: translateX(-100%);
  `}
`;

// The picture gets its own rectangle above the band, and the band is never drawn over it.
const ContentFrame = styled.div<RectProps>`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: ${({ $width }) => $width}px;
  height: ${({ $height }) => $height}px;
  z-index: ${({ $zIndex }) => $zIndex};
  overflow: hidden;
  background-color: #000;
  border-radius: ${lgBorderRadius};
`;

const Video = styled.video`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

// An audio file has no picture, so the element only exists to carry the sound.
const AudioMedia = styled.audio`
  display: none;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-grow: 1;
  min-width: 0;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 9999px;
  background-color: transparent;
  color: ${colorText};
  cursor: pointer;

  svg {
    font-size: 22px;
  }

  &:hover {
    background-color: rgba(0, 0, 0, 0.08);
  }

  &:disabled {
    opacity: 0.38;
    cursor: default;
    background-color: transparent;
  }
`;

// The menu trigger is a button of its own so the icon button styles are repeated rather than
// composed through `as`, which does not carry transient props.
const MenuTrigger = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 9999px;
  background-color: transparent;
  color: ${colorText};
  cursor: pointer;

  svg {
    font-size: 22px;
  }

  &:hover {
    background-color: rgba(0, 0, 0, 0.08);
  }
`;

const TimeLabel = styled.span`
  flex: 0 0 auto;
  color: ${colorText};
  font-size: ${fontSizeSmaller};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const MediaKind = styled.span`
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
  color: ${colorText};
  font-size: ${fontSizeSmaller};

  @media ${smallOnly} {
    display: none;
  }
`;

interface SliderProps {
  $progress: number;
  $compact?: boolean;
}

// M3 slider geometry is a 16dp track with a 4dp by 44dp handle, which is a full-size slider.
// Inside a 56px band the track drops to 6px and the handle to 16px so the controls keep the
// weight of a strip instead of the weight of a hero control.
const Slider = styled.input<SliderProps>`
  flex: ${({ $compact }) => ($compact ? '0 0 96px' : '1 1 auto')};
  min-width: 60px;
  height: 32px;
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;

  &:disabled {
    opacity: 0.38;
    cursor: default;
  }

  &::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 9999px;
    background: linear-gradient(
      to right,
      ${colorPrimary} 0%,
      ${colorPrimary} ${({ $progress }) => $progress}%,
      ${colorGrayLight} ${({ $progress }) => $progress}%,
      ${colorGrayLight} 100%
    );
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -5px;
    border: none;
    border-radius: 9999px;
    background: ${colorPrimary};
  }

  &::-moz-range-track {
    height: 6px;
    border-radius: 9999px;
    background: ${colorGrayLight};
  }

  &::-moz-range-progress {
    height: 6px;
    border-radius: 9999px;
    background: ${colorPrimary};
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 9999px;
    background: ${colorPrimary};
  }
`;

const VolumeControl = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StopItem = styled.span`
  color: ${colorDanger};
  font-weight: ${textFontWeight};
`;

// Shown when the browser refused to start playback without a user gesture.
const StartOverlay = styled.button`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  cursor: pointer;
  background-color: rgba(0, 0, 0, 0.55);
  color: white;
  font-size: ${fontSizeBase};
  font-weight: ${textFontWeight};
  border-radius: inherit;
`;

const Notice = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${colorText};
  font-size: ${fontSizeSmaller};
`;

export default {
  Band,
  ContentFrame,
  Video,
  AudioMedia,
  Row,
  IconButton,
  MenuTrigger,
  TimeLabel,
  MediaKind,
  Slider,
  VolumeControl,
  StopItem,
  StartOverlay,
  Notice,
};
