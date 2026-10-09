package org.bigbluebutton.core.apps.mediafile

import org.apache.pekko.actor.ActorContext
import org.apache.pekko.event.Logging

/**
 * Media file upload and playback. Split out of the external video app because the
 * upload flow has its own token handshake with bbb-web, and because the player
 * state points at a stored file rather than at a URL the room fetches itself.
 */
class MediaFileApp2x(implicit val context: ActorContext)
  extends MediaFileUploadTokenReqMsgHdlr
  with MediaFileUploadedSysPubMsgHdlr
  with StartMediaPlayerPubMsgHdlr
  with UpdateMediaPlayerPubMsgHdlr
  with StopMediaPlayerPubMsgHdlr
  with RemoveMediaFilePubMsgHdlr {

  val log = Logging(context.system, getClass)

}

object MediaFileApp2x {
  // Feature flag key, the counterpart of "externalVideos" and "presentation".
  val DISABLED_FEATURE = "mediaFiles"
}
