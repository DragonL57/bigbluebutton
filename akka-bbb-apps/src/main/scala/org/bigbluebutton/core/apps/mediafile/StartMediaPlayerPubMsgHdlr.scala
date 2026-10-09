package org.bigbluebutton.core.apps.mediafile

import org.bigbluebutton.common2.msgs._
import org.bigbluebutton.core.apps.{ PermissionCheck, RightsManagementTrait }
import org.bigbluebutton.core.bus.MessageBus
import org.bigbluebutton.core.db.MediaPlayerDAO
import org.bigbluebutton.core.running.LiveMeeting

/**
 * Starts playback of an already uploaded file. As with external video, starting a
 * file stops a running screenshare broadcast and unpins the shared notes, so the
 * room shows one piece of content at a time.
 *
 * The mediaFileId is not checked against the database here: the foreign key from
 * mediaPlayer.mediaFileId to mediaFile rejects an id the meeting does not own, and
 * the player view joins mediaFile, so a row pointing at nothing renders nothing.
 */
trait StartMediaPlayerPubMsgHdlr extends RightsManagementTrait {
  this: MediaFileApp2x =>

  def handle(msg: StartMediaPlayerPubMsg, liveMeeting: LiveMeeting, bus: MessageBus): Unit = {
    log.info(
      "Received StartMediaPlayerPubMsg meetingId={} mediaFileId={}",
      liveMeeting.props.meetingProp.intId, msg.body.mediaFileId
    )

    if (liveMeeting.props.meetingProp.disabledFeatures.contains(MediaFileApp2x.DISABLED_FEATURE)) {
      val meetingId = liveMeeting.props.meetingProp.intId
      val reason = "Playing media files is disabled for this meeting."
      PermissionCheck.ejectUserForFailedPermission(meetingId, msg.header.userId, reason, bus.outGW, liveMeeting)
    } else if (permissionFailed(PermissionCheck.GUEST_LEVEL, PermissionCheck.PRESENTER_LEVEL, liveMeeting.users2x, msg.header.userId)) {
      val meetingId = liveMeeting.props.meetingProp.intId
      val reason = "You need to be the presenter to play a media file"
      PermissionCheck.ejectUserForFailedPermission(meetingId, msg.header.userId, reason, bus.outGW, liveMeeting)
    } else {
      // One player at a time: close whatever is playing before starting the next file.
      MediaPlayerDAO.updateStoppedSharing(liveMeeting.props.meetingProp.intId)
      MediaPlayerDAO.insert(liveMeeting.props.meetingProp.intId, msg.body.mediaFileId)

      val routing = Routing.addMsgToClientRouting(
        MessageTypes.BROADCAST_TO_MEETING,
        liveMeeting.props.meetingProp.intId, msg.header.userId
      )
      val envelope = BbbCoreEnvelope(StartMediaPlayerEvtMsg.NAME, routing)
      val header = BbbClientMsgHeader(StartMediaPlayerEvtMsg.NAME, liveMeeting.props.meetingProp.intId, msg.header.userId)
      val body = StartMediaPlayerEvtMsgBody(msg.body.mediaFileId)
      bus.outGW.send(BbbCommonEnvCoreMsg(envelope, StartMediaPlayerEvtMsg(header, body)))
    }
  }
}
