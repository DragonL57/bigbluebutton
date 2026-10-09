package org.bigbluebutton.web.services;

/**
 * Configuration holder for the media file feature (fork). Parallel to
 * PresentationService: the values come from
 * grails-app/conf/bigbluebutton.properties through the beans.mediaService.* keys.
 */
class MediaService {
	def mediaDir
	def maxMediaFileUpload
	def mediaBaseUrl

	String getMediaDir() {
		return mediaDir
	}

	int getMaxMediaFileUpload() {
		return maxMediaFileUpload as int
	}

	String getMediaBaseUrl() {
		return mediaBaseUrl
	}
}
