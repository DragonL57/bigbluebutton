package org.bigbluebutton.core.apps.mediafile

import org.bigbluebutton.common2.msgs._
import org.bigbluebutton.core.apps.{ PermissionCheck, RightsManagementTrait }
import org.bigbluebutton.core.bus.MessageBus
import org.bigbluebutton.core.db.MediaPlayerDAO
import org.bigbluebutton.core.running.LiveMeeting

/**
 * Ends playback for the room. Only the presenter may stop, and the row keeps its
 * history: stoppedSharingAt is set instead of deleting, which is what
 * ExternalVideoDAO.updateStoppedSharing does.
 */
trait StopMediaPlayerPubMsgHdlr extends RightsManagementTrait {
  this: MediaFileApp2x =>

  def handle(msg: StopMediaPlayerPubMsg, liveMeeting: LiveMeeting, bus: MessageBus): Unit = {
    log.info("Received StopMediaPlayerPubMsg meetingId={}", liveMeeting.props.meetingProp.intId)

    if (permissionFailed(PermissionCheck.GUEST_LEVEL, PermissionCheck.PRESENTER_LEVEL, liveMeeting.users2x, msg.header.userId)) {
      val meetingId = liveMeeting.props.meetingProp.intId
      val reason = "You need to be the presenter to stop the media player"
      PermissionCheck.ejectUserForFailedPermission(meetingId, msg.header.userId, reason, bus.outGW, liveMeeting)
    } else {
      MediaPlayerDAO.updateStoppedSharing(liveMeeting.props.meetingProp.intId)

      val routing = Routing.addMsgToClientRouting(
        MessageTypes.BROADCAST_TO_MEETING,
        liveMeeting.props.meetingProp.intId, msg.header.userId
      )
      val envelope = BbbCoreEnvelope(StopMediaPlayerEvtMsg.NAME, routing)
      val header = BbbClientMsgHeader(StopMediaPlayerEvtMsg.NAME, liveMeeting.props.meetingProp.intId, msg.header.userId)
      val body = StopMediaPlayerEvtMsgBody()
      bus.outGW.send(BbbCommonEnvCoreMsg(envelope, StopMediaPlayerEvtMsg(header, body)))
    }
  }
}
