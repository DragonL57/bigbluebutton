package org.bigbluebutton.core.apps.mediafile

import org.bigbluebutton.common2.msgs._
import org.bigbluebutton.core.apps.{ PermissionCheck, RightsManagementTrait }
import org.bigbluebutton.core.bus.MessageBus
import org.bigbluebutton.core.db.MediaFileDAO
import org.bigbluebutton.core.running.LiveMeeting
import org.bigbluebutton.core.util.RandomStringGenerator

/**
 * Hands the presenter a single use token for the upload POST, mirrors
 * PresentationUploadTokenReqMsgHdlr. The token is registered with bbb-web through
 * MediaFileUploadTokenSysPubMsg, and the row inserted here is what the uploader
 * polls through the v_mediaFile_uploadToken view, because the direct response can
 * reach the client before its subscription is ready.
 */
trait MediaFileUploadTokenReqMsgHdlr extends RightsManagementTrait {
  this: MediaFileApp2x =>

  def handle(msg: MediaFileUploadTokenReqMsg, liveMeeting: LiveMeeting, bus: MessageBus): Unit = {
    log.info(
      "handleMediaFileUploadTokenReqMsg meetingId={} userId={} filename={}",
      liveMeeting.props.meetingProp.intId, msg.header.userId, msg.body.filename
    )

    val meetingId = liveMeeting.props.meetingProp.intId

    def sendPassResp(mediaFileId: String, token: String): Unit = {
      val routing = Routing.addMsgToClientRouting(MessageTypes.DIRECT, meetingId, msg.header.userId)
      val envelope = BbbCoreEnvelope(MediaFileUploadTokenPassRespMsg.NAME, routing)
      val header = BbbClientMsgHeader(MediaFileUploadTokenPassRespMsg.NAME, meetingId, msg.header.userId)
      val body = MediaFileUploadTokenPassRespMsgBody(mediaFileId, token, msg.body.filename, msg.body.uploadTemporaryId)
      bus.outGW.send(BbbCommonEnvCoreMsg(envelope, MediaFileUploadTokenPassRespMsg(header, body)))
    }

    def sendFailResp(): Unit = {
      val routing = Routing.addMsgToClientRouting(MessageTypes.DIRECT, meetingId, msg.header.userId)
      val envelope = BbbCoreEnvelope(MediaFileUploadTokenFailRespMsg.NAME, routing)
      val header = BbbClientMsgHeader(MediaFileUploadTokenFailRespMsg.NAME, meetingId, msg.header.userId)
      val body = MediaFileUploadTokenFailRespMsgBody(msg.body.filename)
      bus.outGW.send(BbbCommonEnvCoreMsg(envelope, MediaFileUploadTokenFailRespMsg(header, body)))
    }

    def sendSysPubMsg(mediaFileId: String, token: String): Unit = {
      val routing = collection.immutable.HashMap("sender" -> "bbb-apps-akka")
      val envelope = BbbCoreEnvelope(MediaFileUploadTokenSysPubMsg.NAME, routing)
      val header = BbbClientMsgHeader(MediaFileUploadTokenSysPubMsg.NAME, meetingId, msg.header.userId)
      val body = MediaFileUploadTokenSysPubMsgBody(token, msg.body.filename, meetingId, mediaFileId)
      bus.outGW.send(BbbCommonEnvCoreMsg(envelope, MediaFileUploadTokenSysPubMsg(header, body)))
    }

    if (liveMeeting.props.meetingProp.disabledFeatures.contains(MediaFileApp2x.DISABLED_FEATURE)) {
      sendFailResp()
      val reason = "Uploading media files is disabled for this meeting"
      PermissionCheck.ejectUserForFailedPermission(meetingId, msg.header.userId, reason, bus.outGW, liveMeeting)
    } else if (permissionFailed(PermissionCheck.GUEST_LEVEL, PermissionCheck.PRESENTER_LEVEL, liveMeeting.users2x, msg.header.userId)) {
      sendFailResp()
      val reason = "You need to be the presenter to upload a media file"
      PermissionCheck.ejectUserForFailedPermission(meetingId, msg.header.userId, reason, bus.outGW, liveMeeting)
    } else {
      val mediaFileId = System.currentTimeMillis() + "-" + RandomStringGenerator.randomAlphanumericString(12)
      val token = RandomStringGenerator.randomAlphanumericString(40)

      MediaFileDAO.insertUploadToken(
        meetingId,
        msg.header.userId,
        msg.body.uploadTemporaryId,
        mediaFileId,
        token,
        msg.body.filename
      )

      sendPassResp(mediaFileId, token)
      sendSysPubMsg(mediaFileId, token)
    }
  }
}

