package org.bigbluebutton.common2.msgs

// Media file (fork feature): the presenter uploads an audio or video file from
// their device and the room plays it in sync. Message names match the clients of
// the five GraphQL actions in bbb-graphql-actions/src/actions/mediaFile*.ts, which
// are documented as a stable surface in docs/uplearn/media-file-api.md.

// ------------ client to apps ------------
object MediaFileUploadTokenReqMsg { val NAME = "MediaFileUploadTokenReqMsg" }
case class MediaFileUploadTokenReqMsg(header: BbbClientMsgHeader, body: MediaFileUploadTokenReqMsgBody) extends StandardMsg
case class MediaFileUploadTokenReqMsgBody(filename: String, uploadTemporaryId: String)

object StartMediaPlayerPubMsg { val NAME = "StartMediaPlayerPubMsg" }
case class StartMediaPlayerPubMsg(header: BbbClientMsgHeader, body: StartMediaPlayerPubMsgBody) extends StandardMsg
case class StartMediaPlayerPubMsgBody(mediaFileId: String)

object UpdateMediaPlayerPubMsg { val NAME = "UpdateMediaPlayerPubMsg" }
case class UpdateMediaPlayerPubMsg(header: BbbClientMsgHeader, body: UpdateMediaPlayerPubMsgBody) extends StandardMsg
case class UpdateMediaPlayerPubMsgBody(status: String, rate: Double, time: Double, state: Int, compact: Boolean)

object StopMediaPlayerPubMsg { val NAME = "StopMediaPlayerPubMsg" }
case class StopMediaPlayerPubMsg(header: BbbClientMsgHeader, body: StopMediaPlayerPubMsgBody) extends StandardMsg
case class StopMediaPlayerPubMsgBody()

object RemoveMediaFilePubMsg { val NAME = "RemoveMediaFilePubMsg" }
case class RemoveMediaFilePubMsg(header: BbbClientMsgHeader, body: RemoveMediaFilePubMsgBody) extends StandardMsg
case class RemoveMediaFilePubMsgBody(mediaFileId: String)

// ------------ apps to client ------------
object StartMediaPlayerEvtMsg { val NAME = "StartMediaPlayerEvtMsg" }
case class StartMediaPlayerEvtMsg(header: BbbClientMsgHeader, body: StartMediaPlayerEvtMsgBody) extends BbbCoreMsg
case class StartMediaPlayerEvtMsgBody(mediaFileId: String)

object UpdateMediaPlayerEvtMsg { val NAME = "UpdateMediaPlayerEvtMsg" }
case class UpdateMediaPlayerEvtMsg(header: BbbClientMsgHeader, body: UpdateMediaPlayerEvtMsgBody) extends BbbCoreMsg
case class UpdateMediaPlayerEvtMsgBody(status: String, rate: Double, time: Double, state: Int, compact: Boolean)

object StopMediaPlayerEvtMsg { val NAME = "StopMediaPlayerEvtMsg" }
case class StopMediaPlayerEvtMsg(header: BbbClientMsgHeader, body: StopMediaPlayerEvtMsgBody) extends BbbCoreMsg
case class StopMediaPlayerEvtMsgBody()

object MediaFileUploadedEvtMsg { val NAME = "MediaFileUploadedEvtMsg" }
case class MediaFileUploadedEvtMsg(header: BbbClientMsgHeader, body: MediaFileUploadedEvtMsgBody) extends BbbCoreMsg
case class MediaFileUploadedEvtMsgBody(mediaFileId: String, filename: String, contentType: String, fileSize: Long)

object MediaFileRemovedEvtMsg { val NAME = "MediaFileRemovedEvtMsg" }
case class MediaFileRemovedEvtMsg(header: BbbClientMsgHeader, body: MediaFileRemovedEvtMsgBody) extends BbbCoreMsg
case class MediaFileRemovedEvtMsgBody(mediaFileId: String)

object MediaFileUploadTokenPassRespMsg { val NAME = "MediaFileUploadTokenPassRespMsg" }
case class MediaFileUploadTokenPassRespMsg(header: BbbClientMsgHeader, body: MediaFileUploadTokenPassRespMsgBody) extends BbbCoreMsg
case class MediaFileUploadTokenPassRespMsgBody(mediaFileId: String, authzToken: String, filename: String, uploadTemporaryId: String)

object MediaFileUploadTokenFailRespMsg { val NAME = "MediaFileUploadTokenFailRespMsg" }
case class MediaFileUploadTokenFailRespMsg(header: BbbClientMsgHeader, body: MediaFileUploadTokenFailRespMsgBody) extends BbbCoreMsg
case class MediaFileUploadTokenFailRespMsgBody(filename: String)

// ------------ apps to bbb-common-web ------------
object MediaFileUploadTokenSysPubMsg { val NAME = "MediaFileUploadTokenSysPubMsg" }
case class MediaFileUploadTokenSysPubMsg(header: BbbClientMsgHeader, body: MediaFileUploadTokenSysPubMsgBody) extends BbbCoreMsg
case class MediaFileUploadTokenSysPubMsgBody(authzToken: String, filename: String, meetingId: String, mediaFileId: String)

object MediaFileUploadedSysPubMsg { val NAME = "MediaFileUploadedSysPubMsg" }
case class MediaFileUploadedSysPubMsg(header: BbbClientMsgHeader, body: MediaFileUploadedSysPubMsgBody) extends StandardMsg
case class MediaFileUploadedSysPubMsgBody(mediaFileId: String, filename: String, contentType: String, fileSize: Long, errorMsgKey: String)

object MediaFileRemoveSysPubMsg { val NAME = "MediaFileRemoveSysPubMsg" }
case class MediaFileRemoveSysPubMsg(header: BbbClientMsgHeader, body: MediaFileRemoveSysPubMsgBody) extends BbbCoreMsg
case class MediaFileRemoveSysPubMsgBody(meetingId: String, mediaFileId: String)
