package org.bigbluebutton.core.db

import slick.jdbc.PostgresProfile.api._

/**
 * Media file rows for the fork feature where the presenter uploads an audio or
 * video file and the room plays it. Row layout is `mediaFile` in
 * bbb-graphql-server/bbb_schema.sql.
 *
 * Raw SQL is used instead of a table mapping because every column except the id and
 * the meeting id is nullable, and the two views filter on
 * `"uploadInProgress" IS FALSE AND "uploadCompleted" IS FALSE`, which is false for
 * NULL. The insert therefore has to write those flags explicitly.
 */
object MediaFileDAO {

  def insertUploadToken(meetingId: String, userId: String, temporaryId: String,
                        mediaFileId: String, uploadToken: String, filename: String): Unit = {
    DatabaseConnection.enqueue(
      sqlu"""
          insert into "mediaFile"("mediaFileId","meetingId","uploadUserId","uploadTemporaryId","uploadToken","filename",
          "uploadInProgress","uploadCompleted","createdAt")
           values (
             ${mediaFileId},
             ${meetingId},
             ${userId},
             ${temporaryId},
             ${uploadToken},
             ${filename},
             false,
             false,
             now()
           )
          """
    )
  }

  def updateUploadCompleted(mediaFileId: String, contentType: String, fileSize: Long): Unit = {
    DatabaseConnection.enqueue(
      sqlu"""
          update "mediaFile"
          set "contentType" = ${contentType},
              "fileSize" = ${fileSize},
              "uploadCompleted" = true,
              "uploadedAt" = now()
          where "mediaFileId" = ${mediaFileId}
          """
    )
  }

  def updateUploadFailed(mediaFileId: String, errorMsgKey: String): Unit = {
    DatabaseConnection.enqueue(
      sqlu"""
          update "mediaFile"
          set "uploadErrorMsgKey" = ${errorMsgKey},
              -- pres_presentation writes inProgress as !completed, so a failed upload leaves the
              -- uploadToken view (which only lists rows that are neither in progress nor done)
              "uploadInProgress" = true
          where "mediaFileId" = ${mediaFileId}
          """
    )
  }

  def deleteByMeetingId(meetingId: String): Unit = {
    DatabaseConnection.enqueue(
      sqlu"""delete from "mediaFile" where "meetingId" = ${meetingId}"""
    )
  }

  /**
   * Removes one file row. mediaPlayer.mediaFileId cascades, so a file that is playing stops
   * for the room with the same delete.
   */
  def delete(meetingId: String, mediaFileId: String): Unit = {
    DatabaseConnection.enqueue(
      sqlu"""delete from "mediaFile" where "meetingId" = ${meetingId} and "mediaFileId" = ${mediaFileId}"""
    )
  }
}
