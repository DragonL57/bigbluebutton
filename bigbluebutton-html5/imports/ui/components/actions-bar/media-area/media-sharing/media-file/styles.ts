import styled from 'styled-components';
import { borderRadius } from '/imports/ui/stylesheets/styled-components/general';
import { fontSizeSmaller, textFontWeight } from '/imports/ui/stylesheets/styled-components/typography';
import {
  colorDanger,
  colorGrayLight,
  colorPrimary,
  colorOffWhite,
  colorText,
  appsPanelTextColor,
} from '/imports/ui/stylesheets/styled-components/palette';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0 1.5rem 1rem;
  width: 100%;
  box-sizing: border-box;
`;

const UploadArea = styled.label`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  border: 1px dashed ${colorPrimary};
  border-radius: ${borderRadius};
  cursor: pointer;
  text-align: center;

  &[aria-disabled="true"] {
    cursor: not-allowed;
    opacity: 0.5;
    pointer-events: none;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const FileName = styled.span`
  color: ${colorText};
  font-weight: ${textFontWeight};
  word-break: break-all;
`;

const LimitsText = styled.span`
  color: ${appsPanelTextColor};
  font-size: ${fontSizeSmaller};
`;

const ProgressWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ProgressTrack = styled.div`
  flex: 1;
  height: 0.5rem;
  background-color: ${colorGrayLight};
  border-radius: ${borderRadius};
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${({ $percent }) => `${$percent}%`};
  background-color: ${colorPrimary};
`;

const ErrorText = styled.span`
  color: ${colorDanger};
  font-weight: ${textFontWeight};
`;

const FileList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
`;

const FileRow = styled.li`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background-color: ${colorOffWhite};
  border-radius: ${borderRadius};
`;

const FileRowName = styled.span`
  flex: 1;
  color: ${colorText};
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const FileRowMeta = styled.span`
  color: ${appsPanelTextColor};
  font-size: ${fontSizeSmaller};
  white-space: nowrap;
`;

const ListTitle = styled.span`
  color: ${colorText};
  font-weight: ${textFontWeight};
`;

export default {
  Container,
  UploadArea,
  FileInput,
  FileName,
  LimitsText,
  ProgressWrapper,
  ProgressTrack,
  ProgressFill,
  ErrorText,
  FileList,
  FileRow,
  FileRowName,
  FileRowMeta,
  ListTitle,
};
