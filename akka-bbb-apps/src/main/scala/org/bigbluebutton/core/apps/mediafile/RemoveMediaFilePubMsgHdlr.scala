package org.bigbluebutton.core.apps.mediafile

import org.bigbluebutton.common2.msgs._
import org.bigbluebutton.core.apps.{ PermissionCheck, RightsManagementTrait }
import org.bigbluebutton.core.bus.MessageBus
import org.bigbluebutton.core.db.MediaFileDAO
import org.bigbluebutton.core.running.LiveMeeting

/**
 * Removes one uploaded file, the mirror of the upload handshake: akka-apps owns the row and
 * bbb-web owns the bytes, so the delete is two messages. The row goes first, which also drops
 * a running player through the mediaPlayer foreign key cascade, and the file second.
 *
 * A file left behind by a failed bbb-web delete is an orphan under mediaDir. The upgrade path
 * is a sweep of directories with no row, which needs a read API DatabaseConnection does not
 * expose (it only enqueues).
 */
trait RemoveMediaFilePubMsgHdlr extends RightsManagementTrait {
  this: MediaFileApp2x =>

  def handle(msg: RemoveMediaFilePubMsg, liveMeeting: LiveMeeting, bus: MessageBus): Unit = {
    val meetingId = liveMeeting.props.meetingProp.intId

    log.info(
      "Received RemoveMediaFilePubMsg meetingId={} mediaFileId={}",
      meetingId, msg.body.mediaFileId
    )

    // Removing is how a presenter takes a file out of the room, so it needs the same gate as
    // uploading and playing it.
    if (liveMeeting.props.meetingProp.disabledFeatures.contains(MediaFileApp2x.DISABLED_FEATURE)) {
      val reason = "Uploading media files is disabled for this meeting"
      PermissionCheck.ejectUserForFailedPermission(meetingId, msg.header.userId, reason, bus.outGW, liveMeeting)
    } else if (permissionFailed(PermissionCheck.GUEST_LEVEL, PermissionCheck.PRESENTER_LEVEL, liveMeeting.users2x, msg.header.userId)) {
      val reason = "You need to be the presenter to remove a media file"
      PermissionCheck.ejectUserForFailedPermission(meetingId, msg.header.userId, reason, bus.outGW, liveMeeting)
    } else {
      MediaFileDAO.delete(meetingId, msg.body.mediaFileId)

      def broadcastRemovedEvtMsg(): Unit = {
        val routing = Routing.addMsgToClientRouting(
          MessageTypes.BROADCAST_TO_MEETING,
          meetingId, msg.header.userId
        )
        val envelope = BbbCoreEnvelope(MediaFileRemovedEvtMsg.NAME, routing)
        val header = BbbClientMsgHeader(MediaFileRemovedEvtMsg.NAME, meetingId, msg.header.userId)
        val body = MediaFileRemovedEvtMsgBody(msg.body.mediaFileId)
        bus.outGW.send(BbbCommonEnvCoreMsg(envelope, MediaFileRemovedEvtMsg(header, body)))
      }

      def sendSysPubMsg(): Unit = {
        val routing = collection.immutable.HashMap("sender" -> "bbb-apps-akka")
        val envelope = BbbCoreEnvelope(MediaFileRemoveSysPubMsg.NAME, routing)
        val header = BbbClientMsgHeader(MediaFileRemoveSysPubMsg.NAME, meetingId, msg.header.userId)
        val body = MediaFileRemoveSysPubMsgBody(meetingId, msg.body.mediaFileId)
        bus.outGW.send(BbbCommonEnvCoreMsg(envelope, MediaFileRemoveSysPubMsg(header, body)))
      }

      broadcastRemovedEvtMsg()
      sendSysPubMsg()
    }
  }
}
