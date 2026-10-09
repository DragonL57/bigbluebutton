package org.bigbluebutton.api.messaging.messages;

/**
 * Single use authorization for a media file upload POST, the counterpart of
 * PresentationUploadToken. akka-apps mints it, bbb-web keeps it in memory until the
 * upload consumes it.
 */
public class MediaUploadToken implements IMessage {
    public final String mediaFileId;
    public final String authzToken;
    public final String filename;
    public final String meetingId;

    public MediaUploadToken(String mediaFileId, String authzToken, String filename, String meetingId) {
        this.mediaFileId = mediaFileId;
        this.authzToken = authzToken;
        this.filename = filename;
        this.meetingId = meetingId;
    }

    public boolean isValidFor(String requestedMeetingId) {
        return meetingId != null && meetingId.equals(requestedMeetingId);
    }
}
