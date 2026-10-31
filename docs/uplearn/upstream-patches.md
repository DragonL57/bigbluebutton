# Upstream files this fork patches

Every file below exists upstream and is edited by this fork. This is the conflict surface of a
rebase or of an upstream upgrade, so read it before either. Files the fork adds are not listed here
because they cannot conflict; the added media file code is described in `media-file-api.md` and
`media-file-ui.md`.

## Base

| Item | Value |
|---|---|
| Fork | `github.com/DragonL57/bigbluebutton` |
| Integration branch | `local-dev`, tracks `upstream/v4.1.x-develop` |
| Base commit | `a1991b9c01` (2026-10-30); rebased 2026-10-31, was `9fffe59753` (2026-10-26), before that `1f354dacfd` (2026-10-06) |
| Last rebase | 18 upstream commits, all in `docker/`, `.github/workflows/`, the Dockerfiles and the graphql middleware nginx template; none of them touch a path below, so the rebase applied without a conflict |
| 4.0 line | `local-dev-40`, tracks `upstream/v4.0.x-release` at `0a2ccd43` (tag `v4.0.0-rc.5`) |
| Local clone | `/home/thelong/coding/bigbluebutton` |

After a rebase, `git diff upstream/v4.1.x-develop --stat` must still list these paths. A path that
disappears was dropped by a conflict resolution.

## Media file upload

| Upstream file | Change |
|---|---|
| `akka-bbb-apps/src/main/scala/org/bigbluebutton/core/pubsub/senders/ReceivedJsonMsgHandlerActor.scala` | Six JSON routes for the media file messages |
| `akka-bbb-apps/src/main/scala/org/bigbluebutton/core/running/MeetingActor.scala` | Mounts `MediaFileApp2x`, six message cases |
| `akka-bbb-apps/src/main/scala/org/bigbluebutton/endpoint/redis/RedisRecorderActor.scala` | Media player start, update and stop record events |
| `bbb-common-web/src/main/java/org/bigbluebutton/api/MeetingService.java` | `mediaUploadAuthzTokens` map, get and consume, expiry, `processMediaUploadToken`, the `instanceof` dispatch branch, `mediaDir`, `setMediaDir` and `processMediaFileRemove` |
| `bbb-common-web/src/main/java/org/bigbluebutton/api/Util.java` | `createMediaDir` and `getMediaFileDir` |
| `bbb-common-web/src/main/java/org/bigbluebutton/api2/IBbbWebApiGWApp.java` | `sendMediaFileUploaded` |
| `bbb-common-web/src/main/scala/org/bigbluebutton/api2/BbbWebApiGWApp.scala` | `sendMediaFileUploaded` |
| `bbb-common-web/src/main/scala/org/bigbluebutton/api2/MsgBuilder.scala` | `buildMediaFileUploadedSysMsg` |
| `bbb-common-web/src/main/scala/org/bigbluebutton/api2/bus/ReceivedJsonMsgHdlrActor.scala` | Routes `MediaFileUploadTokenSysPubMsg` |
| `bbb-common-web/src/main/scala/org/bigbluebutton/api2/meeting/OldMeetingMsgHdlrActor.scala` | Same route for an already running meeting |
| `bbb-graphql-server/bbb_schema.sql` | `mediaFile` and `mediaPlayer` tables with the `playerCompact` column, `v_mediaFile`, `v_mediaFile_uploadToken`, `v_mediaPlayer`, section wrapped in `media-file feature begin` and `end` markers |
| `bbb-graphql-server/metadata/actions.graphql` | Five media file actions, `mediaFileUpdate` also carrying the presenter's `compact` |
| `bbb-graphql-server/metadata/actions.yaml` | Same five actions |
| `bbb-graphql-server/metadata/databases/BigBlueButton/tables/tables.yaml` | Registers the three media table metadata files |
| `bigbluebutton-html5/imports/ui/Types/meetingClientSettings.ts` | `MediaFile` and `MediaFileMirroredFromBbbcore` interfaces on `Public` |
| `bigbluebutton-html5/imports/ui/core/initial-values/meetingClientSettings.ts` | `mediaFile` client defaults |
| `bigbluebutton-html5/imports/ui/components/actions-bar/media-area/component.tsx` | Media area button behind the presenter and enabled checks |
| `bigbluebutton-html5/imports/ui/components/actions-bar/media-area/container.tsx` | Reads `isMediaFileEnabled` |
| `bigbluebutton-html5/imports/ui/components/actions-bar/media-area/media-sharing/component.tsx` | Media file entry in the sharing modal |
| `bigbluebutton-html5/imports/ui/components/actions-bar/media-area/media-sharing/presentation/component.jsx` | Share button stays enabled for the presented file while a video plays, and pressing it stops that video first |
| `bigbluebutton-html5/imports/ui/components/actions-bar/media-area/media-sharing/presentation/container.jsx` | Reads the generic content id and passes the stop callback |
| `bigbluebutton-html5/imports/ui/components/actions-bar/media-area/types.ts` | `MediaFileView` |
| `bigbluebutton-html5/imports/ui/components/app/component.tsx` | Mounts `MediaFilePlayerContainer` beside the external video player |
| `bigbluebutton-html5/imports/ui/components/app/container.tsx` | Reads the generic content id and takes the presentation out of the media area while a video plays |
| `bigbluebutton-html5/imports/ui/components/layout/context.jsx` | Reducer cases for the media player band input and output |
| `bigbluebutton-html5/imports/ui/components/layout/enums.js` | `SET_MEDIA_PLAYER_INPUT`, `SET_MEDIA_PLAYER_OUTPUT` |
| `bigbluebutton-html5/imports/ui/components/layout/initState.ts` | Band input and output defaults |
| `bigbluebutton-html5/imports/ui/components/layout/layoutTypes.ts` | `MediaPlayer` band input and output types |
| `bigbluebutton-html5/imports/ui/components/layout/layout-manager/unifiedLayout.jsx` | `calculatesMediaPlayerBand`, and the area it hands the camera dock and the media content |
| `bigbluebutton-html5/jsconfig.json` | `baseUrl` dropped, `/*` made relative, bare `imports/*` and `client/*` entries added |
| `bigbluebutton-html5/tsconfig.json` | `baseUrl` dropped, `/*` made relative, and an entry per bare prefix (`imports/*`, `client/*`) so a specifier without a leading slash still resolves |
| `bigbluebutton-html5/private/config/settings.yml` | `public.mediaFile` block |
| `bigbluebutton-html5/public/locales/en.json` | `app.mediaFile.*` keys |
| `bigbluebutton-html5/public/locales/vi_VN.json` | Same keys, Vietnamese |
| `bigbluebutton-web/bbb-web.nginx` | Media upload, playback and `auth_request` locations |
| `bigbluebutton-web/grails-app/conf/bigbluebutton.properties` | `mediaDir`, `maxMediaFileUpload`, `mediaBaseURL` |
| `bigbluebutton-web/grails-app/controllers/org/bigbluebutton/web/UrlMappings.groovy` | Media upload and check routes |
| `bigbluebutton-web/grails-app/conf/spring/resources.xml` | `mediaDir` on the `meetingService` bean, so the shared meeting service can delete a removed file |

## Recording pipeline

Upstream files the fork edits so a recorded meeting publishes its media files.

| Upstream file | Change |
|---|---|
| `record-and-playback/core/lib/recordandplayback/generators/events.rb` | `get_start_and_stop_media_file_events`, which turns the three media player record events into one segment per play, each with its updates |
| `record-and-playback/core/scripts/bigbluebutton.yml` | `raw_media_src`, the directory archiving copies from |
| `record-and-playback/core/scripts/archive/archive.rb` | Archives the meeting's media files into the raw archive and deletes the originals once that succeeds |
| `record-and-playback/presentation/scripts/publish/presentation.rb` | `media_file_duration` and `process_media_file_events`: copies the files into the published package and writes `media_files.json` |

## Build

| Upstream file | Change |
|---|---|
| `bbb-playback.placeholder.sh` | Clones the fork branch instead of the upstream tag, see below |

## Second repository: bbb-playback

The playback app is not part of this repository. `bbb-playback.placeholder.sh` clones a fork instead of
the upstream tag, so a build of `bbb-playback` here carries the media file player.

| Item | Value |
|---|---|
| Fork | `github.com/DragonL57/bbb-playback` |
| Branch | `uplearn-media-file`, based on upstream tag `v5.4.8` |
| Local clone | `/home/thelong/coding/bbb-playback` |

Upstream files the branch edits: `src/config.js` (the `mediaFiles` file entry), `src/utils/constants.js`
(`ID.MEDIA_FILES`), `src/utils/builder.js` (`buildMediaFiles`), `src/utils/data/index.js` (re-export),
`src/utils/data/storage.js` (accessor and `built` flag), `src/utils/data/validators.js`
(`getMostRecentEvent` export), `src/components/utils/hooks/index.js` (`useCurrentMediaFile`),
`src/components/webcams/index.js` (a clock tick on play and pause), `src/components/player/index.js`
(the overlay mount), `src/components/player/index.scss` (a positioning context), and the `en` and
`vi_VN` locale files. Files it adds: `src/components/media-file/index.js`, `index.scss`,
`src/utils/data/mediaFiles.js` and `mediaFiles.test.js`.

A rebase onto a newer tag re-runs `git apply` of the branch patch and then
`CI=true npx react-scripts test --watchAll=false src/utils/data/mediaFiles.test.js`, plus a build.

## Deliberately left as upstream

No file under `components/presentation` is edited by this fork. A toolbar width fix was measured,
shipped to the local container and reverted the same day.

The overlap on a portrait slide is upstream behaviour. The box is
`Math.min(svgWidth || presentationBounds.width, presentationBounds.width)`
(`presentation/component.jsx:737`), where `svgWidth` is the contain-fit slide width, and the wrapper is
a three equal column grid (`presentation-toolbar/styles.js`), so a 394 px wide slide gives each column
131 px while the zoom cluster needs about 220 px. Sizing the box by its content instead renders at the
width of the whole media area (about 788 px on the default controls), which is worse. Upstream rescues
this on phones only (`@media ${smallOnly}, ${hasPhoneDimentions}` scrolls the box). Recorded as a known
gap in `media-file-ui.md`.
