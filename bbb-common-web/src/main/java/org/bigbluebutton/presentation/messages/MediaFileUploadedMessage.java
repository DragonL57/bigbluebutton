package org.bigbluebutton.presentation.messages;

/**
 * bbb-web reports the outcome of an upload POST back to akka-apps, the way
 * PresentationController reports a conversion. On success the bytes are on disk, the mime
 * type was detected and the size is known, so the row leaves the upload-in-progress state.
 * On failure the row keeps the reason instead of waiting forever for a file that will
 * never arrive.
 */
public class MediaFileUploadedMessage {
  /** Empty on success. */
  public final String errorMsgKey;
  public final String mediaFileId;
  public final String filename;
  public final String contentType;
  public final Long fileSize;
  public final String meetingId;

  public MediaFileUploadedMessage(String mediaFileId, String filename, String contentType, Long fileSize, String meetingId) {
    this.errorMsgKey = "";
    this.mediaFileId = mediaFileId;
    this.filename = filename;
    this.contentType = contentType;
    this.fileSize = fileSize;
    this.meetingId = meetingId;
  }

  public MediaFileUploadedMessage(String mediaFileId, String filename, String meetingId, String errorMsgKey) {
    this.errorMsgKey = errorMsgKey;
    this.mediaFileId = mediaFileId;
    this.filename = filename;
    this.contentType = "";
    this.fileSize = 0L;
    this.meetingId = meetingId;
  }

  public boolean isFailed() {
    return !errorMsgKey.isEmpty();
  }
}
