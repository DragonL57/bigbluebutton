package org.bigbluebutton.core.apps.mediafile

import org.bigbluebutton.common2.msgs._
import org.bigbluebutton.core.apps.{ PermissionCheck, RightsManagementTrait }
import org.bigbluebutton.core.bus.MessageBus
import org.bigbluebutton.core.db.MediaPlayerDAO
import org.bigbluebutton.core.running.LiveMeeting

/**
 * Carries the presenter's player state to the room: play, pause, seek and rate.
 * `time` is the position in seconds at the moment the message was sent, which is
 * what every other client seeks to before applying the rate and the playing flag.
 */
trait UpdateMediaPlayerPubMsgHdlr extends RightsManagementTrait {
  this: MediaFileApp2x =>

  def handle(msg: UpdateMediaPlayerPubMsg, liveMeeting: LiveMeeting, bus: MessageBus): Unit = {
    if (permissionFailed(PermissionCheck.GUEST_LEVEL, PermissionCheck.PRESENTER_LEVEL, liveMeeting.users2x, msg.header.userId)) {
      val meetingId = liveMeeting.props.meetingProp.intId
      val reason = "You need to be the presenter to control the media player"
      PermissionCheck.ejectUserForFailedPermission(meetingId, msg.header.userId, reason, bus.outGW, liveMeeting)
    } else {
      MediaPlayerDAO.update(liveMeeting.props.meetingProp.intId, msg.body.status, msg.body.rate, msg.body.time, msg.body.state, msg.body.compact)

      val routing = Routing.addMsgToClientRouting(
        MessageTypes.BROADCAST_TO_MEETING,
        liveMeeting.props.meetingProp.intId, msg.header.userId
      )
      val envelope = BbbCoreEnvelope(UpdateMediaPlayerEvtMsg.NAME, routing)
      val header = BbbClientMsgHeader(UpdateMediaPlayerEvtMsg.NAME, liveMeeting.props.meetingProp.intId, msg.header.userId)
      val body = UpdateMediaPlayerEvtMsgBody(msg.body.status, msg.body.rate, msg.body.time, msg.body.state, msg.body.compact)
      bus.outGW.send(BbbCommonEnvCoreMsg(envelope, UpdateMediaPlayerEvtMsg(header, body)))
    }
  }
}
