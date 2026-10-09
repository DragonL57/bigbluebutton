package org.bigbluebutton.api.messaging.messages;

/**
 * Tells bbb-web to drop the bytes of a media file the room no longer has a row for. akka-apps
 * deletes the row and sends this in the same pass, so a stored file never outlives the file
 * the clients can see, and the presenter who removed it frees the space it took.
 */
public class MediaFileRemoveMessage implements IMessage {
    public final String meetingId;
    public final String mediaFileId;

    public MediaFileRemoveMessage(String meetingId, String mediaFileId) {
        this.meetingId = meetingId;
        this.mediaFileId = mediaFileId;
    }
}
