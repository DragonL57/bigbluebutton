package org.bigbluebutton.core.db

import org.bigbluebutton.core.util.RandomStringGenerator
import slick.jdbc.PostgresProfile.api._

/**
 * Playback sessions for an uploaded media file. Mirrors ExternalVideoDAO: one row
 * per playback, `stoppedSharingAt IS NULL` marks the row the room is playing, and
 * the client reads the state through the `v_mediaPlayer` view.
 */
object MediaPlayerDAO {

  def insert(meetingId: String, mediaFileId: String): Unit = {
    DatabaseConnection.enqueue(
      sqlu"""
          insert into "mediaPlayer"("mediaPlayerId","meetingId","mediaFileId","startedSharingAt","updatedAt",
          "playerPlaybackRate","playerCurrentTime","playerPlaying","playerCompact")
           values (
             ${System.currentTimeMillis() + "-" + RandomStringGenerator.randomAlphanumericString(8)},
             ${meetingId},
             ${mediaFileId},
             now(),
             now(),
             1,
             0,
             true,
             false
           )
          """
    )
  }

  def update(meetingId: String, status: String, rate: Double, time: Double, state: Int, compact: Boolean): Unit = {
    DatabaseConnection.enqueue(
      sqlu"""
          update "mediaPlayer"
          set "playerPlaybackRate" = ${rate},
              "playerCurrentTime" = ${time},
              "playerPlaying" = ${playingFrom(status, state)},
              "playerCompact" = ${compact},
              "updatedAt" = now()
          where "meetingId" = ${meetingId}
          and "stoppedSharingAt" is null
          """
    )
  }

  def updateStoppedSharing(meetingId: String): Unit = {
    DatabaseConnection.enqueue(
      sqlu"""
          update "mediaPlayer"
          set "stoppedSharingAt" = now(),
              "playerPlaying" = false,
              "updatedAt" = now()
          where "meetingId" = ${meetingId}
          and "stoppedSharingAt" is null
          """
    )
  }

  def updateStoppedSharingByMediaFileId(meetingId: String, mediaFileId: String): Unit = {
    DatabaseConnection.enqueue(
      sqlu"""
          update "mediaPlayer"
          set "stoppedSharingAt" = now(),
              "playerPlaying" = false,
              "updatedAt" = now()
          where "meetingId" = ${meetingId}
          and "mediaFileId" = ${mediaFileId}
          and "stoppedSharingAt" is null
          """
    )
  }

  /**
   * The client sends both a status word and a numeric state, and the two disagree in
   * practice (a paused player reports status "pause" with state 0, a seek reports
   * "stop" while still playing). The status word wins, the numeric state is the
   * fallback, which is what ExternalVideoDAO.update does.
   */
  private def playingFrom(status: String, state: Int): Boolean = status match {
    case "play"  => true
    case "start" => true
    case "stop"  => false
    case _ => state match {
      case 1 => true
      case 0 => false
    }
  }
}
