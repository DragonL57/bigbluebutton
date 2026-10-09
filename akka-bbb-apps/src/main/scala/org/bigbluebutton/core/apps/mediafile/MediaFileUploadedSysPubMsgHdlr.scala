package org.bigbluebutton.core.apps.mediafile

import org.bigbluebutton.common2.msgs._
import org.bigbluebutton.core.bus.MessageBus
import org.bigbluebutton.core.db.MediaFileDAO
import org.bigbluebutton.core.running.LiveMeeting

/**
 * bbb-web reports the outcome of an upload POST: either the stored file, with the mime type
 * it detected and the size it wrote, or the reason the bytes were refused. A refused upload
 * keeps its row, with the error key on it, so the room can tell a failed upload from one
 * that is still on its way. Mirrors how bbb-web reports a converted presentation back to
 * the apps.
 */
trait MediaFileUploadedSysPubMsgHdlr {
  this: MediaFileApp2x =>

  def handle(msg: MediaFileUploadedSysPubMsg, liveMeeting: LiveMeeting, bus: MessageBus): Unit = {
    log.info(
      "Received MediaFileUploadedSysPubMsg meetingId={} mediaFileId={} errorMsgKey={}",
      liveMeeting.props.meetingProp.intId, msg.body.mediaFileId, msg.body.errorMsgKey
    )

    if (msg.body.errorMsgKey.nonEmpty) {
      MediaFileDAO.updateUploadFailed(msg.body.mediaFileId, msg.body.errorMsgKey)
      return
    }

    MediaFileDAO.updateUploadCompleted(msg.body.mediaFileId, msg.body.contentType, msg.body.fileSize)

    val routing = Routing.addMsgToClientRouting(
      MessageTypes.BROADCAST_TO_MEETING,
      liveMeeting.props.meetingProp.intId, msg.header.userId
    )
    val envelope = BbbCoreEnvelope(MediaFileUploadedEvtMsg.NAME, routing)
    val header = BbbClientMsgHeader(MediaFileUploadedEvtMsg.NAME, liveMeeting.props.meetingProp.intId, msg.header.userId)
    val body = MediaFileUploadedEvtMsgBody(msg.body.mediaFileId, msg.body.filename, msg.body.contentType, msg.body.fileSize)
    bus.outGW.send(BbbCommonEnvCoreMsg(envelope, MediaFileUploadedEvtMsg(header, body)))
  }
}
