# Moving to 4.0.4, with what production is today

Production is on the fork's 4.0.2 (`bbb.uplearn.vn`, read on 2026-11-20). Upstream tagged `v4.0.4` on
2026-11-24, one release after `v4.0.3` (2026-11-19); 4.0.4 carries every 4.0.3 change and adds a
hardening pass on the GraphQL middleware, so the move skips 4.0.3 and installs 4.0.4. This page is
the procedure for that move: the state it starts from, what 4.0.3 and 4.0.4 change that touches this
server, the media behaviour and the one open defect, the PDF-and-image upload restriction reviewed, and
the check that ends the work. The contract is `backlog/docs/specs/doc-2 - BBB 4.0.4 delivery.md` in the
home repo; where this page disagrees, the contract wins.

## (1) The state this starts from

Measured on `uplearn-prod` on 2026-11-20, 09:44 UTC.

| Item | Value |
|---|---|
| Fork base | `f31e684f6e`, which is the `v4.0.2` tag itself; `local-dev-40` carries the fork's commits on top |
| Upstream 4.0.4 | tag `v4.0.4` at `bf6fc47b1f`, tagged 2026-11-24; release tip is that same commit on `upstream/v4.0.x-release` |
| Commits from the base | 27 (`v4.0.2..v4.0.4`); 2 of them after `v4.0.3` at `f72d451ebf` |
| Rebased fork | `2c3c57d138`, 38 commits on top of `v4.0.4`; the rebase applied without a conflict |
| Production packages | bundle `72d686d384` built 2026-11-06, then `bbb-apps-akka` `a754e25da6` and `bbb-html5` `c22ad90c26` as single debs |
| Release file | `4.0.2` |
| Held | 25 `bbb-*` packages by `apt-mark hold`; `bbb-presentation-video 5.1.0~rc4` stays off the line |
| Units | every `bbb-*` unit active, none failed; `bbb-transcription-controller` disabled |
| Last restart | most units 2026-11-12, `bbb-apps-akka` 2026-11-18 |

Machine: 4 cores, 7.8 GiB RAM with 4.7 available and 964 MiB swap in use, 79 G disk at 65% (27 G
free), TLS certificate for `bbb.uplearn.vn` valid to 2027-02-14.

Custom config, all of it outside the packages:

| Path | What it holds |
|---|---|
| `/etc/haproxy/haproxy.cfg` | TLS and `stun.turn` termination on 443, `send-proxy` to nginx on 81 and 82 |
| `/etc/nginx/conf.d/bbb-graphql-client-settings-cache.conf`, `bbb-upstreams.conf` | The GraphQL settings cache and the upstream names |
| `/etc/bigbluebutton/bbb-web.properties` | `bigbluebutton.web.serverURL`, `securitySalt=RNhCKjK…`, `useDefaultLogo=true`, `useDefaultDarkLogo=true`, `defaultKeepEvents=true`, `officeToPdfConversionTimeout=120`; no `pageTokenSecret` (checked 2026-11-25) |
| `/etc/bigbluebutton/bbb-html5.yml` | Title, copyright, theme CSS URL, dark theme forced off, notification defaults, English pinned, PDF-and-image upload list. Not owned by any package. Details under (1) |
| `/etc/bigbluebutton/bbb-apps-akka.conf` | `include` of the packaged `application.conf` (fixed 2026-11-07), `bbbWebAPI`, the same shared secret |
| `bbb-config` conffiles | nginx, and the four branding files: `favicon.ico`, `images/logo.png`, `images/darklogo.png` in `/var/www/bigbluebutton-default/assets`, and the playback app's `favicon.ico`. The copies in `/root/prod-rebrand` restore them |

### The client override, read again on 2026-11-25

`/etc/bigbluebutton/bbb-html5.yml` (2,403 B, 2026-11-18 09:22) carries every client change. No package
owns the path (`dpkg -S` finds nothing), and `bbb-html5`'s `after-install.sh` only deletes
`public.pads` from it, so a `bbb-html5` install leaves it in place. `bbb-apps-akka` reads it
(`clientSettingsOverrideFilePath` in `application.conf`) and deep-merges it over
`/usr/share/bigbluebutton/html5-client/private/config/settings.yml`; the client then takes the merged
result from GraphQL (`imports/ui/components/settings-loader/component.tsx:100` assigns
`window.meetingClientSettings`). The static `settings.yml` that nginx serves is not the live path.

| Key | Value | Packaged default |
|---|---|---|
| `public.kurento.wsUrl` | `wss://bbb.uplearn.vn/bbb-webrtc-sfu` | derived from the server URL |
| `public.app.clientTitle` | `UpLearn` | `BigBlueButton` |
| `public.app.copyright` | `©2026 UpLearn` | `©2026 BigBlueButton Inc.` |
| `public.app.customStyleUrl` | `https://bbb.uplearn.vn/uplearn-theme.css?v=1` | `null` |
| `public.app.branding.displayBrandingArea` | `true` | `true` |
| `public.app.darkTheme.enabled` | **`false`** | `true` |
| `public.app.darkTheme.autoDetectFromSystem` | **`false`** | `true` |
| `public.app.defaultSettings.application.darkTheme` | `false` | `false` |
| `public.app.defaultSettings.application` notifications | `chatAudioAlerts`, `chatPushAlerts`, `userJoinPushAlerts`, `userLeavePushAlerts`, `muteUnmuteAudioAlerts`, `guestWaitingAudioAlerts`, `guestWaitingPushAlerts`, `raiseHandAudioAlerts`, `raiseHandPushAlerts` all `true`; `userJoinAudioAlerts`, `userLeaveAudioAlerts` `false` | all `false` |
| `…application.animations`, `pushToTalkEnabled` | `true`, `true` | `false`, `true` |
| `…application.whiteboardToolbarAutoHide`, `autoCloseReactionsBar` | `false`, `true` | `false`, `true` |
| `…application.overrideLocale`, `fallbackLocale` | `en`, `en` | `null`, `null` |
| `public.presentation.uploadValidMimeTypes` | `.pdf .jpg .jpeg .png .webp` | office + PDF + images |

`public.pads.url` was in the file until 2026-09-27 and is gone; Etherpad left in 4.0 and the
after-install strips the key.

The packaged `settings.yml` still says `darkTheme.enabled: true` and carries the full office list. The
override is what sets the light default and the PDF-only picker, so both survive a package install and
neither depends on a re-apply script.

## (2) What 4.0.3 and 4.0.4 change against this server

### Two changes to check before the install

1. `pageTokenSecret` no longer falls back to `securitySalt`. The 4.0.4 `bbb-web` postinst replaces
   the classpath `pageTokenSecret=` line on every `configure`/`upgrade` (`after-install.sh:34-35`),
   and a value in `/etc/bigbluebutton/bbb-web.properties` overrides it. The service boots without a
   hand-set value; setting one in `/etc` is optional stable hardening, because otherwise the
   postinst rotates it on every upgrade. `BootStrap.groovy` still refuses an empty, `CHANGE_ME_` or
   retired-hash value, so verify the effective value is non-sentinel and not the retired
   `f85c8c2934b5a89cea99f26c887ecef1216d900e8652bba4ac9a7982d68ec96a` (the sha256 of
   `330a8b08c3b4c61533e1d0c5ce1ac88f`).
2. The secret it checks with comes from `/etc/bigbluebutton/bbb-web.properties`, which holds
   `securitySalt=RNhCKjK…`. That value is not the retired default, so the check passes. The copy in
   `/usr/share/bbb-web/WEB-INF/classes/bigbluebutton.properties` says `vdEiq7…`, which is stock;
   the package may restore it because the override wins.

### Changes that alter behaviour

| Area | Change | Effect here |
|---|---|---|
| Recording switch | `SetRecordingStatusCmdMsgHdlr.scala` refuses a start/stop recording command when the meeting was created with `record=false` | A room created without `record` can no longer be switched into recording from inside |
| Recording callbacks | New `record-and-playback/core/lib/recordandplayback/callback_destination.rb`; analytics and recording-ready callbacks refuse loopback, private, link-local, shared, multicast and documentation addresses, and follow `fetchUrlSupportedProtocols`, `fetchUrlBlockedExternalHosts` and `fetchUrlAllowedLocalHosts` | A callback target on a private address stops receiving; the packaged defaults for the three keys are `https`, empty, empty |
| Presentation paths | `PresentationService.groovy` rejects a path segment that is `.`, `..`, contains `/` or `\`, or is absolute; `PresentationController.groovy` checks `room` as well as `conference` | Nothing to do; the fork does not edit `PresentationController.groovy` or `PresentationService.groovy` |
| Page tokens | The HMAC input becomes `conference\|room\|presId\|page` | A page token issued before the install stops matching after it, so tabs open during the upgrade need a reload |
| Learning dashboard | `archive.rb` archives only the session's own dashboard data; `LearningDashboardService.java` waits for the archive instead of a fixed delay | The dashboard file is kept through the archive step, up to 24 h |
| GraphQL middleware | `writer.go` bounds query variables; `config.yml` gains a key | May touch the media views; check a room after the install |
| Freeswitch | 1.11.4, up from 1.11.3 | `bbb-freeswitch-core` rebuilt |
| `bbb-webrtc-recorder` | 0.18.1 | rebuilt |
| `recordStatusDir` | `spring/resources.xml` passes `${recordStatusDir}` to `learningDashboardService` | the bean needs the key, which 4.0.3's properties supply |

### What 4.0.4 adds on top of 4.0.3

Two commits, eight files: `bigbluebutton-release`, `build/packages-template/bbb-graphql-middleware/graphql.nginx`,
and six files under `bbb-graphql-middleware/`. Nothing the fork edits.

| Area | Change | Effect here |
|---|---|---|
| GraphQL location | `graphql.nginx` turns `location /graphql` into `location = /graphql` | Only the exact path is proxied. The client builds its socket URL from the page origin plus `/graphql` (`connection-manager/component.tsx`), so it still matches; a URL with a trailing slash or sub-path would not |
| Undecodable results | `reader.go` logs and drops a Hasura result it cannot decode instead of `Fatalf` | One malformed result no longer ends the process and every browser connection with it |
| Nesting bound | `writer.go` refuses a query with more than 5000 `{` and `[` before parsing, because the GraphQL parser recurses without a limit; the depth check keeps its own message | The media subscriptions are shallow (`v_mediaPlayer` and its relations), so they pass; a client query is refused rather than crashing the middleware |
| Connection init | `connhandler.go` closes a connection that sends no `connection_init` within 30 s (code 4408), and `websrv/reader.go` routes nothing but `connection_init` until the connection is authorized | A slow join retries instead of holding an unauthenticated socket; the media views load after init, as before |
| Idle close | The idle-timeout close runs in its own goroutine and cancels the connection context | An unresponsive peer no longer stalls the sweep |
| Cursor compare | `reader.go` and `StreamCursorUtils.go` compare cursor values with `DeepEqual` instead of `==`/`!=`, which cannot compare a list or object decoded from JSON | Streaming subscriptions whose cursor is a list or object compare by value; the media views have no stream cursor, so nothing changes for them |

### Files both sides touch

Four files are edited by the fork and by 4.0.3/4.0.4, in different lines, so the rebase applies
without a conflict. Read all four after it.

| File | Fork change | Upstream change |
|---|---|---|
| `bigbluebutton-web/grails-app/conf/bigbluebutton.properties` | `mediaDir`, `maxMediaFileUpload`, `mediaBaseURL`, three `beans.mediaService.*` lines | the two secret lines |
| `bigbluebutton-web/grails-app/conf/spring/resources.xml` | `mediaDir` on the `meetingService` bean | `recordStatusDir` on `learningDashboardService` |
| `record-and-playback/core/scripts/archive/archive.rb` | the `media` copy at line 250 and the `rm_rf` of the source (UPL-126) | the learning-dashboard match |
| `bbb-common-web/src/main/scala/org/bigbluebutton/api2/MsgBuilder.scala` | `buildMediaFileUploadedSysMsg` at line 402 | the page-token signature gains `conference` and `room` |

## (3) What the install must not miss

The debs do not do these; 4.0.2 needed the same set (downgrade memory of 2026-11-07).

- `/usr/local/bigbluebutton/core/scripts/bigbluebutton.yml` ships as a plain file, so the install
  writes `playback_host: bigbluebutton.example.com` back. Rewrite it to `bbb.uplearn.vn` and restart
  `bbb-rap-starter` and `bbb-rap-resque-worker` (`operations.md`).
- `/usr/share/bbb-web/WEB-INF/classes/bigbluebutton.properties` is not a conffile either: the install
  writes the stock file back. Keep it stock and carry the fork's and production's values in
  `/etc/bigbluebutton/bbb-web.properties`.
- `hasura metadata apply` leaves the catalog with zero tracked tables. Run
  `cd /usr/share/bbb-graphql-server && HOME=/tmp hasura metadata apply --skip-update-check` as
  `bigbluebutton`, then confirm 85 tracked tables including `v_mediaFile` and `v_mediaPlayer`.
- `/etc/bigbluebutton/bbb-apps-akka.conf` keeps its `include` of the packaged `application.conf`, so
  the 4.0.3 keys (`presentationUploadTokenMaxRequests`, `allowedAnnotationTypes`) come through.
- `bbb-presentation-video 5.1.0~rc4` stays installed and held.
- After the install, list `.dpkg-dist` and `.dpkg-new` under `/etc/bigbluebutton`, `/etc/nginx` and
  `/usr/share/bbb-web/WEB-INF/classes` and diff each against the live file. 4.0.3 edits
  `build/packages-template/bbb-web/after-install.sh`, so the configure step runs new code.
- Rebuild the whole bundle. 4.0.3 changes `bbb-web`, `bbb-record-core`, `bbb-graphql-middleware` and
  `bbb-learning-dashboard` as well as `bbb-apps-akka`, so the single-deb route used for `a754e25da6`
  and `c22ad90c26` does not apply.
- A `bbb-html5` install replaces `/usr/share/bigbluebutton/html5-client/private/config/settings.yml`
  and its `.gz`, and leaves `/etc/bigbluebutton/bbb-html5.yml` alone. The restriction in (5) and the
  light default live in the override, so they survive; the static `.yml` is then rewritten by the
  postinst with `public.kurento.wsUrl` and `public.app.bbbServerVersion`, and the `.gz` is not
  rebuilt. Expect those two keys to differ; do not chase byte equality. There is no
  `/root/pdfonly-20261118.sh` on the server (checked 2026-11-25), so nothing re-applies the static
  edit; either accept the two-key difference or stop editing the static files.

## (4) Media findings from 2026-11-20

Both recordings held a media file and neither published it.

| Recording | Session | Evidence |
|---|---|---|
| `76f101e9…-1795094869401` | 2026-11-19, archived 15:33 | archive log: `rsync … /var/bigbluebutton/media/<id>/<id> failed: No such file or directory`, then `No media files found`; `raw/<id>/events.xml` has no `MediaFile` event |
| `76f101e9…-1795155254393` | 2026-11-20, archived 08:33 | same, and the player requested `published/presentation/<id>/media_files.json` twice and got 404 (nginx `error.log`, 01:50 and 09:30 UTC) |

The last recording that carried media is `76f101e9…-1794377556293` (2026-11-11), with 15 `MEDIA-FILE`
events, `media_files.json` and the file under `media/`. An upload to
`60b78418…-1795087298906` at 2026-11-19 11:22 succeeded (`sample-15s.wav`, upload token issued,
`MediaFileUploadedSysPubMsg` received by `MediaFileApp2x`), so the upload path works. The two failing
sessions produced no upload log line in `bbb-web.log` at all.

### M1 is not a defect: the player already handles a missing media result

`bbb-playback` asks for `media_files.json` on every recording. A 404 is treated as no data and the
recording renders without a media section; there is no error state. Publish writes the file only
when it found media, so most recordings have no such file. The browser still logs one expected 404
for `media_files.json`; that network entry is not an application error.

The check is: a published recording with no media opens the player with no error state, and exactly
one expected 404 for `media_files.json`. Do not create an empty `media_files.json` at publish time
to hide the 404.

### Defect M2: a room's media events can go missing

Unknown cause. What is ruled out so far: the fork's archive and publish changes (the 2026-11-11
recording ran through both), the upload endpoint (the 11:22 upload succeeded), and the recording
switch (both failing sessions recorded normally, audio and whiteboard events are present). The
evidence also shows no upload for the two failing sessions, so the upload path is not established
as the cause.

Required behavior: find where a `MediaFileUploadedSysPubMsg` the akka app receives stops producing
`MediaPlayerStartRecordEvent` into the event recorder, and fix that layer. Include the cleanup
path: `MeetingService.processMediaFileCleanup` skips only when `m.isRecord()`, and 4.0.2 allowed an
in-room recording start on a `record=false` room, so a later archive can find no media. Until the
cause is found, check each recorded meeting in `operations.md` after a session that played a file.

## (5) The upload type restriction, and what review found

### What production enforces today

Presentations are limited to PDF and images in two places, both dated 2026-11-18 09:12-09:22, and
the durable one is the client override, which no package owns.

| Layer | Rule today | Source |
|---|---|---|
| Client, live | `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`, from the override that akka merges and the client loads over GraphQL | `/etc/bigbluebutton/bbb-html5.yml`, `public.presentation.uploadValidMimeTypes` |
| Client, static copy | the same five types in the file nginx serves | `/usr/share/bigbluebutton/html5-client/private/config/settings.yml`, lines 1246-1256 |
| Client, originals kept | two identical 57,300 B copies of the 2026-11-07 04:03 file, the full office list | `settings.yml.pre-pdfonly-20261118-091255` and `-091258`, and `/etc/bigbluebutton/bbb-html5.yml.pre-pdfonly-20261118-092246` |
| Client, static gz | **the full office list**: `.gz` is the 2026-11-07 file (18,834 B, 57,138 B decoded), so `curl --compressed` against the static path gets no restriction (checked 2026-11-25) | `settings.yml.gz` |
| Client, media area | audio and video list unchanged at lines 401-415: mp3, m4a, aac, ogg, wav, webm, mp4 | same file |
| Server, create path | `MimeTypeUtils.getValidMimeTypes` accepts office, PDF and images; the client list never reaches it | `bbb-common-web/.../MimeTypeUtils.java:77` |
| Server, in-room upload | `SupportedFileTypes.isPresentationMimeTypeValid` via `PresentationController.groovy:380` | same class, line 100 |

### Findings

1. **The restriction is client-side only.** A `create` call or an in-room POST carrying a `.docx` passes
   the server check and is converted. Executive impact: the client hides the type, and anyone posting
   directly does not get refused. Decided 2026-11-25 (D5, doc-2 §4): the move keeps the client check and
   adds no server gate; upstream's `MimeTypeUtils` and upload path stay as upstream ships them. A server
   gate is a separate task if the risk warrants it; until then, the client is the only enforcement.
2. **The static pair disagrees with itself.** `settings.yml.gz` still decodes to the 2026-11-07 file
   (57,138 B) with the full office list, while `settings.yml` holds 56,349 B with the five types; a
   `curl --compressed` against the static path returns the unrestricted list (checked 2026-11-25).
   The room client does not read that path, so the ban stands, but `bbb-conf --check` and any direct
   fetch see the wrong list. After an install the postinst rewrites `settings.yml` with
   `public.kurento.wsUrl` and `public.app.bbbServerVersion` and leaves the `.gz` stock, so the two
   files cannot match; expect those two keys to differ and do not chase byte equality. Let the
   override carry the rule.
3. **The fork's container edit is not the media list.** The 12 fork lines in
   `bigbluebutton-html5/imports/ui/components/actions-bar/media-area/media-sharing/presentation/container.jsx`
   are stop/generic-content wiring (UPL-126). The media picker reads
   `public.mediaFile.uploadValidMimeTypes` from `window.meetingClientSettings.public.mediaFile`
   (`media-file/component.tsx:35,99`), so it is not exposed to the presentation list. A rebase that
   moves the presentation list into the media picker would block audio and video; check the media
   picker's `accept` after every rebase.
4. **No script and no record.** `/root/force_light_client.sh`, `rebuild_gz_client.sh` and
   `revert_force_light.sh` do not touch the list, and `/root/pdfonly-20261118.sh` does not exist
   (checked 2026-11-25). The three `.pre-pdfonly-20261118-*` copies are the only record. Fix: add the
   override path and the three copies to the revert kit list in `deployment.md`, and drop the step
   that expected a script.
5. **A meeting created with a document default still converts it.** `defaultPresentation` is uploaded
   through `ApiController.groovy:1951`, which calls the same check, so a PDF gate on that function
   covers it once it is made configurable.
6. **A later install replaces the file.** The restriction lives in a path that ships inside the
   `bbb-html5` package; `(3)` carries the re-apply step.

## (6) The order of work

1. The §6 corrections are applied to this page, `decisions.md` and `upstream-patches.md`; verify them before the build.
2. Server gate — decided 2026-11-25: deferred (D5, doc-2 §4). The client check stays; upstream's
   upload path is kept; drop the server check from (7).
3. M2 — decided 2026-11-25: the move proceeds now; the Media gate stays open. Collect the evidence
   with events from a test room on production or on the `bbb40` container as a follow-up.
4. Confirm the callback target and `record=false` use in Moodle (doc-2 §4).
5. Rebase `local-dev-40` onto `upstream/v4.0.x-release` at `bf6fc47b1f` (tag `v4.0.4`). Resolve
   nothing by hand: the four shared files merge as listed in (2). Run `git diff v4.0.4 HEAD --stat`
   and check every fork path in `upstream-patches.md` is still listed. Done 2026-11-25: no conflict,
   `2c3c57d138`, 38 commits.
6. Optionally set `pageTokenSecret` in `/etc/bigbluebutton/bbb-web.properties` for a stable value;
   otherwise the postinst generates one. Build the full bundle, install on the `bbb40` container,
   then run the checks in (7).
7. Prove the revert on `bbb40`; install on production; a revert kit first, as `in-place-upgrade.md`
   describes.

## (7) The check

After the install, each line must print the value in the right column. The Move and Rollback lines are
the gate; the Media lines stay open until M2.

| Check | Command | Expected |
|---|---|---|
| Version | `dpkg-query -W -f='${Package} ${Version}\n' bbb-web bbb-apps-akka bbb-html5 bbb-record-core bbb-graphql-middleware bbb-learning-dashboard` | each package `2:4.0.4+…`; the build stamp names the release commit |
| Release | `cat /etc/bigbluebutton/bigbluebutton-release` | `BIGBLUEBUTTON_RELEASE=4.0.4` |
| bbb-web came up | `systemctl is-active bbb-web` | `active` |
| API | `curl -s https://bbb.uplearn.vn/bigbluebutton/api` | `SUCCESS`; a Moodle join succeeds |
| API secret | `curl -s https://bbb.uplearn.vn/bigbluebutton/api` | `SUCCESS`; a 500 or a refused start means the secret check failed |
| Page token secret | read the effective `pageTokenSecret` (`/etc/bigbluebutton/bbb-web.properties` if present, else `/usr/share/bbb-web/WEB-INF/classes/bigbluebutton.properties`); `journalctl -u bbb-web -b \| grep IllegalStateException` | non-empty, not `CHANGE_ME_PAGE_TOKEN_SECRET`, not the retired hash, different from `securitySalt`; no `IllegalStateException` |
| Units | `systemctl list-units 'bbb-*' --state=active --no-legend`; `systemctl is-enabled bbb-transcription-controller` | every `bbb-*` active, none failed; transcription disabled |
| Playback host | `grep ^playback_host /usr/local/bigbluebutton/core/scripts/bigbluebutton.yml` | `playback_host: bbb.uplearn.vn` |
| Hasura | `sudo -u postgres psql -d bbb_graphql -tAc "select count(*) from information_schema.tables where table_schema='public'"` | 142 public relations (55 tables + 87 views) before and after; 85 tracked after the metadata apply, including `v_mediaFile` and `v_mediaPlayer` |
| GraphQL views | `sudo -u postgres psql -d bbb_graphql -tAc "select count(*) from \"v_mediaFile\""` | a row count, not an error: the media views survived the schema apply |
| Branding | the four files from `/root/prod-rebrand` in the `bbb-config` paths in (1) | both favicons, `logo.png`, `darklogo.png` match the kit |
| Static pair | `diff <(zcat /usr/share/bigbluebutton/html5-client/private/config/settings.yml.gz) /usr/share/bigbluebutton/html5-client/private/config/settings.yml` | only `public.kurento.wsUrl` and `public.app.bbbServerVersion` differ |
| Client default | open a new room; then a join URL with `bbb_prefer_dark_theme=true` | light by default; the join parameter still opens dark |
| GraphQL endpoint | `curl -s -o /dev/null -w '%{http_code}' https://bbb.uplearn.vn/graphql` | `426` (or the upgrade refusal), not `404`: 4.0.4's exact-match location is proxied |
| Media | open a 4.0.4 room, upload a file, play it | the file plays; the meeting's directory appears under `/var/bigbluebutton/media/<id>` |
| Recording | end the meeting, wait for the archive | `raw/<id>/media/` holds the file, `raw/<id>/events.xml` has `MEDIA-FILE`, and `published/.../media_files.json` exists |
| Player | open a recording with no media | exactly one expected 404 for `media_files.json`; no error state (M1 is not a defect) |
| Playback app | open a published recording that has media in `bbb-playback`; check the installed build record | the file plays; the installed build is at least `4fce271` and contains `980d0ba` |
| Dashboard | archive a recorded meeting with a dashboard | the dashboard is produced; no missing-dashboard error in the archive log |
| Upload types, client | open the presentation upload picker | `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp` offered |
| Upload types, live | `/etc/bigbluebutton/bbb-html5.yml` still holds the five types, and a room's picker offers no office type | the override survived the install; this is the path the client reads |
| Upload types, media | open the media picker | audio and video still offered (its own `public.mediaFile` key) |
| Holds | `apt-mark showhold \| grep '^bbb-'` | every `bbb-*` held; `bbb-presentation-video` unchanged |
| Rollback | the `bbb40` proof record | install 4.0.4, run the Move checks, restore the kit, then the API and a media play pass |
