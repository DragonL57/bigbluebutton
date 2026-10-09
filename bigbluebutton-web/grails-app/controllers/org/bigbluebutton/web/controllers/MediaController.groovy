package org.bigbluebutton.web.controllers

import org.apache.commons.io.FilenameUtils
import org.bigbluebutton.api.MeetingService
import org.bigbluebutton.api.Util
import org.bigbluebutton.api.domain.UserSession
import org.bigbluebutton.api.messaging.messages.MediaUploadToken
import org.bigbluebutton.api.util.ParamsUtil
import org.bigbluebutton.presentation.MediaFileTypes
import org.bigbluebutton.presentation.messages.MediaFileUploadedMessage
import org.bigbluebutton.web.services.MediaService

import java.util.regex.Pattern

/**
 * Media file upload and playback authorization (fork feature).
 *
 * The bytes do not travel through this controller. For an upload, bbb-web answers the
 * nginx auth_request sub-request (so an oversized body is refused before it is read)
 * and then accepts the POST. For playback it only answers the auth_request, and nginx
 * serves the file out of mediaDir with alias, which keeps Range requests (seeking) and
 * the 50 MB case inside nginx.
 */
class MediaController {
  MeetingService meetingService
  MediaService mediaService

  private static final Pattern MEDIA_URI_PATTERN = Pattern.compile(
    '/bigbluebutton/media/([a-z0-9\\-]+)/([a-z0-9\\-]+)/([^/]+)'
  )

  /**
   * Refuses an upload before nginx loads the body. Returns 403 with
   * x-file-too-large: 1 when the body is over the cap, which the nginx error_page
   * turns into 413.
   */
  def checkMediaBeforeUploading = {
    try {
      def maxUploadFileSize = mediaService.getMaxMediaFileUpload()
      def mediaToken = request.getHeader("x-media-token")
      def originalContentLengthString = request.getHeader("x-original-content-length")

      def originalContentLength = 0
      // x-original-content-length may be missing (for example in CORS OPTION requests)
      if (null != originalContentLengthString && originalContentLengthString.isNumber()) {
        originalContentLength = originalContentLengthString as int
      }

      if (request.getHeader("x-original-method") == 'OPTIONS') {
        if (meetingService.getMediaUploadToken(mediaToken) != null) {
          log.debug "OPTIONS SUCCESS \n"
          respondText(200, 'upload-success')
          return
        } else {
          log.debug "OPTIONS FAIL\n"
          respondText(403, 'upload-fail')
          return
        }
      }

      if (null != mediaToken
          && meetingService.getMediaUploadToken(mediaToken) != null // consumed in the upload handling
          && originalContentLength < maxUploadFileSize
          && 0 != originalContentLength) {
        log.debug "Media upload pre-check SUCCESS\n"
        respondText(200, 'upload-success')
      } else {
        log.debug "Media upload pre-check NO SUCCESS\n"
        response.setStatus(403)
        response.addHeader("Cache-Control", "no-cache")
        // Only an oversized body carries this header: nginx turns it into 413, and an
        // unknown token is not a size problem. The presentation endpoint sets it on every
        // refusal, which is why a bad token reads as 413 there.
        if (originalContentLength >= maxUploadFileSize) {
          response.addHeader("x-file-too-large", "1")
        }
        response.contentType = 'text/plain'
        response.outputStream << 'upload-refused'
      }
    } catch (IOException e) {
      log.error("Error in checkMediaBeforeUploading.\n" + e.getMessage())
    }
  }

  /**
   * nginx auth_request target for playback. Reads the original URI, resolves the
   * session token in its query string and refuses a request whose meeting in the path
   * is not the session's meeting.
   */
  def checkMediaAuthorization = {
    try {
      def uri = request.getHeader("x-original-uri")
      if (uri == null) {
        respondText(401, 'unauthorized')
        return
      }

      def sessionToken = ParamsUtil.getSessionToken(uri)
      UserSession userSession = meetingService.getUserSessionWithSessionToken(sessionToken)
      Boolean allowRequestsWithoutSession = meetingService.getAllowRequestsWithoutSession(sessionToken)
      Boolean isSessionTokenInvalid = !session[sessionToken] && !allowRequestsWithoutSession

      response.addHeader("Cache-Control", "no-cache")
      response.contentType = 'text/plain'

      if (userSession == null || isSessionTokenInvalid) {
        respondText(401, 'unauthorized')
        return
      }

      def uriPath = uri.split('\\?')[0]
      def mediaMatcher = MEDIA_URI_PATTERN.matcher(uriPath)
      if (!mediaMatcher.matches()) {
        respondText(403, 'forbidden')
        return
      }

      def meetingIdFromUri = mediaMatcher.group(1)
      if (meetingIdFromUri != userSession.meetingID) {
        respondText(403, 'forbidden')
        return
      }

      respondText(200, 'authorized')
    } catch (Exception e) {
      log.error("Error in checkMediaAuthorization.\n" + e.getMessage())
      respondText(401, 'unauthorized')
    }
  }

  /**
   * Consumes the single use token, stores the file under
   * mediaDir/meetingId/meetingId/mediaFileId/ and reports the stored file to
   * akka-apps, which is what moves the row out of the upload-in-progress state.
   */
  def upload = {
    MediaUploadToken mediaUploadToken = meetingService.consumeMediaUploadToken(params.authzToken)
    if (mediaUploadToken == null) {
      log.debug "Media upload authorization token was not valid for meetingId=" + params.conference
      respondText(403, 'invalid auth token')
      return
    }

    if (!mediaUploadToken.isValidFor(params.conference)) {
      log.warn "Media upload token scope mismatch for requested meetingId=" + params.conference
      respondText(403, 'upload token scope mismatch')
      return
    }

    def meetingId = mediaUploadToken.meetingId
    if (!Util.isMeetingIdValidFormat(meetingId)) {
      log.debug("Media upload failed. Invalid meeting id format " + meetingId)
      respondText(403, 'no-meeting')
      return
    }

    def meeting = meetingService.getNotEndedMeetingWithId(meetingId)
    if (meeting == null) {
      log.debug("Media upload failed. No meeting running " + meetingId)
      respondText(403, 'no-meeting')
      return
    }

    def file = request.getFile('fileUpload')
    if (file == null || file.empty) {
      reportUploadFailure(meetingId, mediaFileId, '', 'media.upload.emptyFile')
      log.warn "Media upload failed. File empty."
      respondText(400, 'file-empty')
      return
    }

    // The original name is kept for display only; the name on disk is derived from
    // mediaFileId, so nothing the client sends reaches the filesystem.
    def origFilename = ParamsUtil.stripTags(FilenameUtils.getName(file.getOriginalFilename()))
    def filenameExt = FilenameUtils.getExtension(origFilename).toLowerCase()

    if (origFilename == "" || filenameExt == "") {
      reportUploadFailure(meetingId, mediaFileId, origFilename, 'media.upload.invalidName')
      log.debug("Media upload failed. Invalid filename.")
      respondText(400, 'invalid_filename')
      return
    }

    if (!MediaFileTypes.isSupportedExtension(filenameExt)) {
      reportUploadFailure(meetingId, mediaFileId, origFilename, 'media.upload.unsupportedFormat')
      log.warn "Media upload failed. Extension not in the whitelist: " + filenameExt
      respondText(415, 'unsupported-extension')
      return
    }

    def mediaFileId = mediaUploadToken.mediaFileId
    File uploadDir = Util.createMediaDir(meetingId, mediaService.getMediaDir(), mediaFileId)
    if (uploadDir == null) {
      log.error("Media upload failed. Could not create the upload directory for " + mediaFileId)
      reportUploadFailure(meetingId, mediaFileId, '', 'media.upload.failed')
      respondText(500, 'upload-failed')
      return
    }

    File storedFile = new File(uploadDir.absolutePath + File.separatorChar + mediaFileId + '.' + filenameExt)
    file.transferTo(storedFile)

    // The pre-check only knows what the client declared, so the bytes that landed are the real
    // measure. nginx caps the body at maxMediaFileUpload too; this covers a deployment where the
    // two drift apart.
    if (storedFile.length() > mediaService.getMaxMediaFileUpload()) {
      if (!storedFile.delete()) {
        log.warn "Could not delete the oversized media file " + storedFile.absolutePath
      }
      log.warn "Media upload failed. Stored file is larger than maxMediaFileUpload: " + storedFile.length()
      reportUploadFailure(meetingId, mediaFileId, origFilename, 'media.upload.tooLarge')
      respondText(413, 'upload-failed')
      return
    }

    String detectedMimeType = MediaFileTypes.detectMimeType(storedFile)
    if (!MediaFileTypes.isMediaFileMimeTypeValid(detectedMimeType, filenameExt)) {
      // The bytes are not playable by a browser, so they are not worth keeping.
      if (!storedFile.delete()) {
        log.warn "Could not delete the rejected media file " + storedFile.absolutePath
      }
      log.warn "Media upload failed. Mime type " + detectedMimeType + " does not match extension " + filenameExt
      reportUploadFailure(meetingId, mediaFileId, origFilename, 'media.upload.notPlayable')
      respondText(415, 'upload-failed')
      return
    }

    meetingService.sendMediaFileUploaded(new MediaFileUploadedMessage(
      mediaFileId, origFilename, detectedMimeType, storedFile.length(), meetingId
    ))
    log.debug("Media file upload success " + origFilename + " (mediaFileId: " + mediaFileId + ")")
    respondText(200, 'upload-success')
  }

  /**
   * Tells akka-apps that the POST was refused, so the row stops waiting for bytes that will
   * never arrive and carries the reason instead. The presentation flow reports a failed
   * conversion back to the apps the same way.
   */
  private void reportUploadFailure(String meetingId, String mediaFileId, String filename, String errorMsgKey) {
    try {
      meetingService.sendMediaFileUploaded(new MediaFileUploadedMessage(mediaFileId, filename, meetingId, errorMsgKey))
    } catch (Exception e) {
      log.error("Could not report the failed media upload of " + mediaFileId + ": " + e.getMessage())
    }
  }

  private void respondText(int status, String body) {
    response.setStatus(status)
    response.addHeader("Cache-Control", "no-cache")
    response.contentType = 'text/plain'
    response.outputStream << body
  }
}
