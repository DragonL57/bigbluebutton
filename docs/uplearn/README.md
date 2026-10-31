# UpLearn media file upload

Fork-local design notes for in-room media file playback in BigBlueButton. Nothing in this directory
comes from upstream; keep it here so `git merge upstream/v4.1.x-develop` stays a one-command
operation. `upstream-patches.md` lists the upstream files the fork edits.

## Base

| Item | Value |
|---|---|
| Fork | `github.com/DragonL57/bigbluebutton` |
| Upstream | `github.com/bigbluebutton/bigbluebutton` |
| Integration branch | `local-dev`, tracks `upstream/v4.1.x-develop` |
| Base commit | `a1991b9c01` (2026-10-30, `4.1.0-alpha.1`); rebased 2026-10-31, was `9fffe59753`, before that `1f354dacfd` (2026-10-06) |
| Ticket | `UPL-126`, every commit on the branch carries it |
| 4.0 line | `local-dev-40`, tracks `upstream/v4.0.x-release` at `0a2ccd43` (tag `v4.0.0-rc.5`, 2026-10-07) |
| Local clone | `/home/thelong/coding/bigbluebutton` (partial clone, full history) |

Development moved to the 4.1 line, so `local-dev` tracks `upstream/v4.1.x-develop` and takes upstream
work with `git rebase upstream/v4.1.x-develop`, then a `--force-with-lease` push pinned to the commit
the remote held. The 4.0 work is preserved on `local-dev-40`, which tracks `upstream/v4.0.x-release`.
Before each rebase, tag and branch the verified commit and push both, so the old history survives on
the remote: `backup-verified-2026-10-31` and `backup-verified-media-file` still carry the build that
was verified on 2026-10-31.

Reasons: upstream has published no 4.1 release tag, but the 4.1 delta inside this feature's target
areas is small (the media area, media sharing and app components, the layout engine and the external
video player differ in thirteen files), and 4.1 builds on the same Ubuntu base as 4.0, so a later move
to the 4.1 release tag is a merge rather than a port. Production still runs 4.0.0-rc.3 per the UpLearn
project notes, and the Moodle `mod_bigbluebuttonbn` plugin pairs with the 4.0 line.

## Documents

| File | Content |
|---|---|
| `media-file-api.md` | Data model, GraphQL actions, Redis messages, HTTP endpoints, nginx rules, config keys, recording data contract |
| `media-file-ui.md` | Media area entry point, upload sub-view, compact player layout, states, accessibility, i18n keys |
| `upstream-patches.md` | Every upstream file this fork edits, with the change and the reason, for rebase review |

## Phases

| Phase | Delivers | Touches |
|---|---|---|
| 1 | Playback only, by URL, no code | none |
| 2 | Upload from the room plus synchronized playback, not recorded | client, `bbb-graphql-actions`, `akka-bbb-apps`, `bbb-common-message`, `bbb-common-web`, `bigbluebutton-web`, nginx |
| 3 | Media appears in the recording | `akka-bbb-apps` record events, `record-and-playback`, `bbb-playback`, `build/packages-template` |

Phase 1 already works today: a presenter pastes a direct media URL into the external video dialog
and the room plays it in sync. It is not recorded, because record-and-playback writes only the URL
(`record-and-playback/presentation/scripts/publish/presentation.rb:1274` produces
`external_videos.json`, and the playback app turns those entries into chat system messages).

## Reuse survey

| Source | What transfers | What does not |
|---|---|---|
| Upstream PR #8753 "Generic upload manager" (closed 2021-08-03, unmerged, 63 files) | The akka server shape, file for file: `core/apps/upload/UploadApp2x.scala`, `UploadRequestReqMsgHdlr.scala`, `common2/msgs/UploadMsgs.scala`, the `RedisRecorderActor` and `AnalyticsActor` hooks, and `Meeting.java` plus `ParamsProcessorUtil.java` on the web side | Its client half, `bigbluebutton-html5/imports/api/upload/...`, is Meteor code from the 2.x client. The 4.0 client has no `imports/api` layer, so the GraphQL client side is new work |
| `hiroshisuga/bigbluebutton` genupload branches | Nothing directly: the newest is `dev2.6.9_genupload_qpoll_qlink` and every branch predates the 4.0 rewrite | Its UI choices are worth reading for the presenter flow, but no file is portable |
| `bigbluebutton/bigbluebutton-html-plugin-sdk` v1.0.0-beta.3 | `MediaAreaOption` lets a plugin add an item to the media area modal, and `GenericContentType.MAIN_AREA` lets a plugin render in the presentation area without a core patch | It cannot carry the upload itself. The upload endpoint, token and playback state must exist server side first |
| Upstream `v4.0.x-release` presentation upload | The whole token flow: single-use token, `auth_request` sub-request before the body is read, per-meeting upload directory, mime whitelist | Presentation files go through LibreOffice conversion. Media files play as uploaded, so the conversion pipeline and the uploader toast are not reused |

The reuse conclusion: the server-side shape comes from PR #8753, the token and serving mechanics
come from the presentation upload path, the player comes from the external video path, and the UI
placement comes from the plugin SDK extension points. No new subsystem is introduced.

## Design boundaries

The in-room client follows BigBlueButton's own design system (`@bigbluebutton/bbb-ui-components-react`,
MUI, and the styled-components palette under
`bigbluebutton-html5/imports/ui/stylesheets/styled-components/palette.js`). Do not apply the UpLearn
M3 tokens inside the meeting client. The M3 rules apply to the Moodle side: the join page, the
recording page, and any UpLearn surface that links into a room.

## Sources checked

Upstream trees for `v4.0.0-rc.5`, `v4.0.x-release`, `v4.1.x-develop` and `v3.0.x-develop`; the
`bbb-playback` tag `v5.4.7` that this release pins (`bbb-playback.placeholder.sh:3`); the
`bigbluebutton-html-plugin-sdk` tag `v1.0.0-beta.3`; issues #8276 and #25223; PR #8753.
