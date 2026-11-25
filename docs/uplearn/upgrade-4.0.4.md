# Moving to 4.0.4, with what production is today

Production is on the fork's 4.0.2 (`bbb.uplearn.vn`, read on 2026-11-20). Upstream tagged `v4.0.4` on
2026-11-24, one release after `v4.0.3` (2026-11-19); 4.0.4 carries every 4.0.3 change and adds a
hardening pass on the GraphQL middleware, so the move skips 4.0.3 and installs 4.0.4. This page is
the spec for that move: the state it starts from, what 4.0.3 and 4.0.4 change that touches this
server, two media defects the audit found, the PDF-and-image upload restriction reviewed, and the
check that ends the work.

## (1) The state this starts from

Measured on `uplearn-prod` on 2026-11-20, 09:44 UTC.

| Item | Value |
|---|---|
| Fork base | `f31e684f6e`, which is the `v4.0.2` tag itself; `local-dev-40` carries the fork's commits on top |
| Upstream 4.0.4 | tag `v4.0.4` at `bf6fc47b1f`, tagged 2026-11-24; release tip is that same commit on `upstream/v4.0.x-release` |
| Commits from the base | 27 (`v4.0.2..v4.0.4`); 2 of them after `v4.0.3` at `f72d451ebf` |
| Rebased fork | `37f7485c1c`, 34 commits on top of `v4.0.4`; the rebase applied without a conflict |
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
| `/etc/bigbluebutton/bbb-web.properties` | `bigbluebutton.web.serverURL`, `securitySalt=RNhCKjK…`, `useDefaultLogo=true`, `useDefaultDarkLogo=true`, `defaultKeepEvents=true`, `officeToPdfConversionTimeout=120` |
| `/etc/bigbluebutton/bbb-apps-akka.conf` | `include` of the packaged `application.conf` (fixed 2026-11-07), `bbbWebAPI`, the same shared secret |
| `bbb-config` conffiles | nginx, and the four branding files: `favicon.ico`, `images/logo.png`, `images/darklogo.png` in `/var/www/bigbluebutton-default/assets`, and the playback app's `favicon.ico`. The copies in `/root/prod-rebrand` restore them |

## (2) What 4.0.3 and 4.0.4 change against this server

### Two changes that block the install

1. `pageTokenSecret` has no fallback. `bigbluebutton.properties` in 4.0.3 sets
   `pageTokenSecret=CHANGE_ME_PAGE_TOKEN_SECRET` and no longer derives it from `securitySalt`.
   `BootStrap.groovy` throws `IllegalStateException` when `securitySalt` or `pageTokenSecret` is
   empty, carries a `CHANGE_ME_` sentinel, or hashes to the retired default
   `f85c8c2934b5a89cea99f26c887ecef1216d900e8652bba4ac9a7982d68ec96a` (that is the sha256 of
   `330a8b08c3b4c61533e1d0c5ce1ac88f`). Production has no `pageTokenSecret` line today and runs on
   `${securitySalt}`; add one before the install.
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
| Cursor compare | `reader.go` and `StreamCursorUtils.go` compare cursor values with `DeepEqual` instead of `==`/`!=`, which cannot compare a list or object decoded from JSON | Streaming subscriptions whose cursor is a list or object compare by value; the media views use an `Int` cursor, so nothing changes for them |

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
- A `bbb-html5` install replaces `/usr/share/bigbluebutton/html5-client/private/config/settings.yml`,
  which carries the PDF-and-image upload restriction in (5). Put it back with
  `/root/pdfonly-20261118.sh` after `/root/rebuild_gz_client.sh`.

## (4) Media defects found on 2026-11-20

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

### Defect M1: an empty media result 404s the player

`bbb-playback` asks for `media_files.json` on every recording and renders an error when the answer is
404. Publish writes the file only when it found media, so most recordings have no such file.

Spec:

- When `media_files.json` answers 404, the player renders the recording without a media section.
- When it answers 200 with an empty array, it does the same.
- Do not create an empty `media_files.json` at publish time to hide the 404; the player is the side
  that decides what a missing file means.
- Add a check: a published recording with no media opens the player with no console error.

### Defect M2: a room's media events can go missing

Unknown cause. What is ruled out so far: the fork's archive and publish changes (the 2026-11-11
recording ran through both), the upload endpoint (the 11:22 upload succeeded), and the recording
switch (both failing sessions recorded normally, audio and whiteboard events are present).

Spec: find where a `MediaFileUploadedSysPubMsg` the akka app receives stops producing
`MediaPlayerStartRecordEvent` into the event recorder, and fix that layer. Until it is found, check
each recorded meeting in `operations.md` after a session that played a file.

## (5) The upload type restriction, and what review found

### What production enforces today

Presentations are limited to PDF and images by editing the served client settings. No package changes;
the edit is a hand copy on 2026-11-18 that keeps the original beside it.

| Layer | Rule today | Source |
|---|---|---|
| Client, upload picker | `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`; the picker's `accept` and the pre-read check both use `public.presentation.uploadValidMimeTypes` | `/usr/share/bigbluebutton/html5-client/private/config/settings.yml`, lines 1246-1256 |
| Client, original kept | `settings.yml.pre-pdfonly-20261118-091255`, dated 2026-11-07 04:03:57 | same directory |
| Client, media area | audio and video list unchanged at lines 401-415: mp3, m4a, aac, ogg, wav, webm, mp4 | same file |
| Server, create path | `MimeTypeUtils.getValidMimeTypes` accepts office, PDF and images; the client list never reaches it | `bbb-common-web/.../MimeTypeUtils.java:77` |
| Server, in-room upload | `SupportedFileTypes.isPresentationMimeTypeValid` via `PresentationController.groovy:367` | same class, line 100 |

### Findings

1. **The restriction is client-side only.** A `create` call or an in-room POST carrying a `.docx` passes
   the server check and is converted. Executive impact: the client hides the type, and anyone posting
   directly does not get refused. Fix: publish the list to bbb-web as a property
   (`allowedPresentationExtensions=pdf,jpg,jpeg,png,webp`, default all) and check it in
   `isPresentationMimeTypeValid`, so one value feeds both the client and the server.
2. **The gz copy is already stale.** `settings.yml.gz` still decodes to the 2026-11-07 file with 57,138
   bytes, while `settings.yml` holds 56,349. Clients that fetch the gz see the old list, so the
   restriction only reaches clients that fetch the plain file. Fix: run `/root/rebuild_gz_client.sh`
   after any edit, and make the gz part of the edit script rather than a separate step.
3. **The fork's own edit passes the list into the file-reader.**
   `bigbluebutton-html5/imports/ui/components/actions-bar/media-area/media-sharing/presentation/container.jsx`
   carries 12 lines the fork added (UPL-126), and the picker and the file-reader both use
   `uploadValidMimeTypes` from it. A rebase that touches the file, or a later change that routes media
   the same way, puts a PDF-only list in front of media uploads and blocks mp3 and mp4. Keep the media
   list in its own key (`public.mediaFile.uploadValidMimeTypes`, `settings.yml:401`) and check the
   picker's `accept` after every rebase.
4. **No script and no record.** `/root/force_light_client.sh`, `rebuild_gz_client.sh` and
   `revert_force_light.sh` do not touch the list, and no file on the server records the 2026-11-18
   edit. Fix: write `/root/pdfonly-20261118.sh` (copy, edit, rebuild gz), keep the `.pre-pdfonly`
   copy, and add the file to the revert kit list in `deployment.md`.
5. **A meeting created with a document default still converts it.** `defaultPresentation` is uploaded
   through `ApiController.groovy:1951`, which calls the same check, so a PDF gate on that function
   covers it once it is made configurable.
6. **A later install replaces the file.** The restriction lives in a path that ships inside the
   `bbb-html5` package; `(3)` carries the re-apply step.

## (6) The order of work

1. Fix M1 in `bbb-playback`; rebuild the playback package and ship it alone.
2. Find M2 with events from a test room on production or on the `bbb40` container.
3. Move the PDF-and-image list into `bbb-web.properties` and the server check from (5) finding 1;
   ship that with the 4.0.4 bundle.
4. Rebase `local-dev-40` onto `upstream/v4.0.x-release` at `bf6fc47b1f` (tag `v4.0.4`). Resolve
   nothing by hand: the four shared files merge as listed in (2). Run `git diff v4.0.4 HEAD --stat`
   and check every fork path in `upstream-patches.md` is still listed. Done 2026-11-25: no conflict,
   `37f7485c1c`.
5. Add `pageTokenSecret` to `/etc/bigbluebutton/bbb-web.properties` on production.
6. Build the full bundle, install on the `bbb40` container, then run the checks in (7).
7. Install on production; a revert kit first, as `in-place-upgrade.md` describes.

## (7) The check

After the install, each line must print the value in the right column.

| Check | Command | Expected |
|---|---|---|
| Version | `dpkg-query -W -f='${Version}\n' bbb-web` | `2:4.0.4+…` |
| Release | `cat /etc/bigbluebutton/bigbluebutton-release` | `BIGBLUEBUTTON_RELEASE=4.0.4` |
| bbb-web came up | `systemctl is-active bbb-web` | `active`, and `curl -s https://bbb.uplearn.vn/bigbluebutton/api` answers `SUCCESS` |
| Secrets | `curl -s https://bbb.uplearn.vn/bigbluebutton/api` | `SUCCESS`; a 500 or a refused start means the secret check failed |
| Playback host | `grep ^playback_host /usr/local/bigbluebutton/core/scripts/bigbluebutton.yml` | `playback_host: bbb.uplearn.vn` |
| Hasura | `sudo -u postgres psql -d bbb_graphql -tAc "select count(*) from information_schema.tables where table_schema='public'"` | 142 tables and 87 views in `bbb_graphql` before the install; the same after |
| GraphQL views | `sudo -u postgres psql -d bbb_graphql -tAc "select count(*) from \"v_mediaFile\""` | a row count, not an error: the media views survived the schema apply |
| Branding | `ls /var/www/bigbluebutton-default/images/` | `logo.png`, `darklogo.png` from `/root/prod-rebrand` |
| Media | open a 4.0.4 room, upload a file, play it | the file plays; the meeting's directory appears under `/var/bigbluebutton/media/<id>` |
| Recording | end the meeting, wait for the archive | `raw/<id>/media/` holds the file and `raw/<id>/events.xml` has `MEDIA-FILE` events |
| Player | open a recording with no media | no 404 in the browser console (M1) |
| Upload types, client | open the upload picker | `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp` offered |
| Upload types, server | `curl -X POST` a `.docx` to `create` | the response does not show a `file_too_large` or `invalid_filename` reason and bbb-web.log carries `Extension [docx] is not allowed` once (5) finding 1 ships |
| Upload types, gz | `zcat settings.yml.gz \| diff - settings.yml` | no difference |
| GraphQL endpoint | `curl -s -o /dev/null -w '%{http_code}' https://bbb.uplearn.vn/graphql` | `426` or another upgrade refusal on a plain GET, not `404`: 4.0.4's exact-match location is proxied |
