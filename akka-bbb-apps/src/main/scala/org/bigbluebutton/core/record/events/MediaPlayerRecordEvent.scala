package org.bigbluebutton.core.record.events

trait AbstractMediaPlayerRecordEvent extends RecordEvent {
  setModule("MEDIA-FILE")
}

class StartMediaPlayerRecordEvent extends AbstractMediaPlayerRecordEvent {
  import StartMediaPlayerRecordEvent._

  setEvent("StartMediaPlayerRecordEvent")

  def setMediaFileId(mediaFileId: String) {
    eventMap.put(MEDIA_FILE_ID, mediaFileId)
  }
}

object StartMediaPlayerRecordEvent {
  protected final val MEDIA_FILE_ID = "mediaFileId"
}

class UpdateMediaPlayerRecordEvent extends AbstractMediaPlayerRecordEvent {
  import UpdateMediaPlayerRecordEvent._

  setEvent("UpdateMediaPlayerRecordEvent")

  def setStatus(status: String) {
    eventMap.put(STATUS, status)
  }

  def setRate(rate: Double) {
    eventMap.put(RATE, rate.toString)
  }

  def setTime(time: Double) {
    eventMap.put(TIME, time.toString)
  }

  def setState(state: Int) {
    eventMap.put(STATE, state.toString)
  }
}

object UpdateMediaPlayerRecordEvent {
  protected final val STATUS = "status"
  protected final val RATE = "rate"
  protected final val TIME = "time"
  protected final val STATE = "state"
}

class StopMediaPlayerRecordEvent extends AbstractMediaPlayerRecordEvent {
  setEvent("StopMediaPlayerRecordEvent")
}
