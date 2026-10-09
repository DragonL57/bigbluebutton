package org.bigbluebutton.presentation;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;

import org.apache.tika.Tika;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Mime whitelist for media file upload (fork feature), the counterpart of
 * SupportedFileTypes and MimeTypeUtils for presentations.
 *
 * The same list is advertised to the client in
 * bigbluebutton-html5/private/config/settings.yml under public.mediaFile and
 * documented in docs/docs/development/api.md. All three change together.
 *
 * Only formats a browser decodes without a plugin are listed. m4v and mov are left
 * out on purpose: browsers refuse video/x-m4v and video/quicktime even when the
 * codecs inside are supported.
 */
public class MediaFileTypes {
  private static Logger log = LoggerFactory.getLogger(MediaFileTypes.class);

  /**
   * Measured with the Tika 3.3.2 that this build ships, against one generated sample per
   * format: mp3 audio/mpeg, m4a audio/mp4, aac audio/x-aac, ogg audio/vorbis or
   * application/ogg, wav audio/vnd.wave, webm video/webm, mp4 video/mp4 or
   * video/quicktime depending on the container brand.
   *
   * The registered type of each container is listed beside the measured one because the
   * detector reports a brand, not an extension: the same mp4 comes back as video/mp4 when
   * the brand is mp42 and as video/quicktime when it is isom. A mov renamed to mp4 passes
   * for the same reason; the extension gate is what keeps the upload to media, and a
   * QuickTime file is still a media file a browser may play.
   */
  private static final String MP3 = "audio/mpeg";
  private static final String M4A = "audio/mp4";
  private static final String AAC = "audio/aac";
  private static final String AAC_ALT = "audio/x-aac";
  private static final String OGG = "audio/ogg";
  private static final String OGG_VORBIS = "audio/vorbis";
  private static final String OGG_APPLICATION = "application/ogg";
  private static final String WAV = "audio/wav";
  private static final String WAV_VND = "audio/vnd.wave";
  private static final String WEBM = "video/webm";
  private static final String WEBM_AUDIO = "audio/webm";
  private static final String MP4 = "video/mp4";
  private static final String QUICKTIME = "video/quicktime";

  /**
   * One extension may be reported by the mime detector in more than one way, so the
   * value is a list. A detected type is accepted when the extension maps to it.
   */
  private static final HashMap<String, List<String>> EXTENSIONS_MIME = new HashMap<String, List<String>>(8) {
    {
      put("mp3", Arrays.asList(MP3));
      put("m4a", Arrays.asList(M4A, MP4, QUICKTIME));
      put("aac", Arrays.asList(AAC, AAC_ALT));
      put("ogg", Arrays.asList(OGG, OGG_VORBIS, OGG_APPLICATION));
      put("wav", Arrays.asList(WAV, WAV_VND));
      put("webm", Arrays.asList(WEBM, WEBM_AUDIO));
      put("mp4", Arrays.asList(MP4, M4A, QUICKTIME));
    }
  };

  public static boolean isSupportedExtension(String fileExtension) {
    if (fileExtension == null) {
      return false;
    }
    return EXTENSIONS_MIME.containsKey(fileExtension.toLowerCase());
  }

  /** Every mime type the whitelist accepts, for logging and error messages. */
  public static List<String> getValidMimeTypes() {
    List<String> validMimeTypes = new ArrayList<String>();
    for (List<String> mimeTypes : EXTENSIONS_MIME.values()) {
      for (String mimeType : mimeTypes) {
        if (!validMimeTypes.contains(mimeType)) {
          validMimeTypes.add(mimeType);
        }
      }
    }
    return validMimeTypes;
  }

  public static String detectMimeType(File media) {
    if (media == null || !media.isFile()) {
      log.error("Media file is not a file");
      return "";
    }

    try (InputStream mediaStream = new FileInputStream(media)) {
      return (new Tika()).detect(mediaStream);
    } catch (IOException e) {
      log.error("Error while executing detectMimeType: {}", e.getMessage());
    }

    return "";
  }

  public static Boolean isMediaFileMimeTypeValid(String detectedMimeType, String fileExtension) {
    if (detectedMimeType == null || detectedMimeType.isEmpty()) {
      log.error("Not able to detect mimeType.");
      return false;
    }

    if (!isSupportedExtension(fileExtension)) {
      log.error("Extension [{}] is not in the media whitelist.", fileExtension);
      return false;
    }

    List<String> validMimeTypes = EXTENSIONS_MIME.get(fileExtension.toLowerCase());
    for (String validMimeType : validMimeTypes) {
      if (validMimeType.equalsIgnoreCase(detectedMimeType)) {
        return true;
      }
    }

    log.error("File with extension [{}] doesn't match with mimeType [{}].", fileExtension, detectedMimeType);
    return false;
  }
}
