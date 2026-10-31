# Media file UI and layout

Complete UI specification for phase 2: the presenter uploads a media file in the room, the room plays
it in sync, and the presentation stays visible while it plays. Phase 3 (recording) does not change
this screen.

## Design system

The in-room client uses BigBlueButton's own system, not UpLearn's Material 3 tokens:

| Element | Source |
|---|---|
| Colour roles | `bigbluebutton-html5/imports/ui/stylesheets/styled-components/palette.js` (`colorPrimary`, `colorWhite`, `btnDefaultColor`) |
| Buttons | `@bigbluebutton/bbb-ui-components-react` (`BBButton`, variants `primary`, `danger`, sizes `sm`, `md`) |
| Icon font | `bigbluebutton-html5/public/stylesheets/bbb-icons.css`, rendered through `imports/ui/components/common/icon/component.jsx` as `icon-bbb-<name>` |
| Material icons | `@mui/icons-material`, already used in `actions-bar/media-area/media-sharing/component.tsx` |
| Existing player chrome | `external-video-player/external-video-player-graphql/toolbar/` (`progress-bar/component.tsx`, `volume-slide/component.tsx`) |

Icon names available in the font include `audio`, `upload`, `file`, `external-video`, `video`,
`media-area`, `pause`, `volume`. There is no `play` glyph, so player transport icons come from
`@mui/icons-material` (`PlayArrow`, `Pause`, `Stop`, `VolumeUp`, `VolumeOff`, `Fullscreen`,
`FullscreenExit`), which the media area already depends on.

## Entry point

The media area button opens a modal whose main view is a grid of `MediaButton` items
(`actions-bar/media-area/media-sharing/component.tsx`, `Styled.MediaGrid`). Today the grid holds
screen share, manage presentations, video link, camera as content, then plugin items.

Add one `MediaButton` after the video link item and before the camera as content item:

| Property | Value |
|---|---|
| `dataTest` | `mediaFileUpload` |
| `text` | `app.mediaFile.modal.uploadFile` |
| `icon` | `<Icon iconName="audio" />` |
| `color` | `default`, or `active` while a media session is running |
| `tooltip` | `app.mediaFile.modal.uploadFileTooltip` |
| visibility | presenter only, and only when `public.mediaFile.enabled` is true |
| click | sets the modal sub-view to `mediaFile`, following `handleExternalVideoClick` |

Participants see no entry, matching how the presentation and video link items are gated on
`amIPresenter`. A participant who is not the presenter sees the existing take-presenter panel with no
change.

The sub-view reuses the modal shell already in place: `Styled.SubViewWrapper` with a back button, a
title and an icon in `Styled.SubHeader`, and content in `Styled.SubViewContent`. The media file view
title is `app.mediaFile.modal.title` with `<Icon iconName="audio" />`.

## Upload sub-view

Layout, top to bottom:

```
+----------------------------------------------------------+
| <  Upload media file                            [ audio ] |
+----------------------------------------------------------+
|  [ Choose a file ]   or drop a file here                  |
|  mp3, m4a, aac, ogg, wav, webm, mp4                      |
|  up to 50 MB                                              |
+----------------------------------------------------------+
|  Files in this meeting                                    |
|  * lesson-02.mp3        3.4 MB        [ play ] [ trash ]   |
|  * warmup.mp4          48.1 MB        [ play ] [ trash ]   |
+----------------------------------------------------------+
|  [ Upload and play ]                     [ Cancel ]       |
+----------------------------------------------------------+
```

The file list is the presenter's view of `mediaFile` for the meeting, newest first, and it is also where
a file is removed: each row keeps Play and adds a trash button, which deletes the file for the room. A
file name wraps at most twice and ends in an ellipsis, so a long name never pushes the size and the
buttons out of the row. Playing starts a session that reaches the room; removing ends one, because a
file that is playing stops and its row goes for everyone.

The list is a subscription on `v_mediaFile`, not a one-shot query. That view exposes an upload only after
the server marks it complete, a flag that flips once the upload finishes, so a query taken at upload time
returns nothing and the list would stay empty for the rest of the meeting. A subscription fills the row in
when the flag flips, and it follows removals the same way. The subscription carries the same meeting and
The list and the subscription behind it are scoped to the meeting, so every presenter sees every file
shared in the room. The token view stays scoped to the uploader, because it carries the upload credential.

States:

| State | Visible | Enabled |
|---|---|---|
| No file chosen | hint text and limits, empty list | Upload disabled |
| File chosen, not uploaded | file name, size, type; a warning when the extension is outside the whitelist or the size is over the cap | Upload and play enabled only when valid |
| Uploading | progress bar with percentage, cancel available | other buttons disabled |
| Uploaded | the file appears in the list and the session starts | |
| Error | one line naming the cause: unsupported type, over the size cap, upload refused, connection lost | retry enabled |

Upload mechanics come from the presentation uploader: request the token with the
`mediaRequestUploadToken` mutation, poll `v_mediaFile_uploadToken` with `fetchPolicy: 'network-only'`,
then POST the file with `XMLHttpRequest` because `fetch` cannot report progress
(`actions-bar/media-area/media-sharing/presentation/service.js` is the reference implementation,
including its token timeout). Cancel aborts the XHR and stops the poll.

A dropped file takes the same path as a chosen one: the area accepts the drop, validates it against
the same extension and size rules (the input's `accept` list does not filter a drop, so the file
itself is checked), fills the selection, and turns the border solid while the file is over the area.
The upload still starts from the button, so a drop never begins an upload on its own. A rejected file
shows the reason in an `role="alert"` line, which keeps the button disabled, and the drop hint
(`app.mediaFile.upload.dropHint`) only appears on a fine pointer.

## Playback surface

The presenter's own element follows the room's play and pause state like every other client, so
starting a file from the sharing list plays it in the presenter's browser too. Only the position
stays presenter-led: the sync to the stored position runs once per file, and a switch to the next
file syncs again.

The player is never drawn over another content and never covers one. An audio file is a band out of the
media area: the layout engine reserves it and everything else relayouts around it, the slides and the
camera dock included. A video is a media content of its own, so it claims the area the way a screenshare
does and the other content yields.

### Densities: bar and pill

`bar` is the default and the only form a video has. It is a 56 px row across the media area holding
the kind of media (`Audio` or `Video`, from the file's content type), play or pause, elapsed and total
time, the seek slider, volume, the collapse control (audio only) and the overflow menu. The file name
itself is not drawn; it stays as the hover title of the label and in the upload list.

`pill` is the compact form for audio: the same row shrinks into one corner of the media area, takes the
width of the controls it holds (320 px is the cap, 160 px the floor) and keeps play or pause, elapsed
time, mute, expand and the menu. The seek slider stays in the bar, because a row that narrow with a
usable slider leaves nothing for the rest.

Video has no compact form on purpose. The picture needs the rectangle, and a small video card in a
corner would cover the slides, which is the overlap this design removes. Video always uses `bar`.

Density is room state: the presenter picks the bar or the pill and every client renders that choice, so
the room watches one arrangement and a participant's control only says the choice is not theirs. The
corner stays with each viewer, because placement is a preference rather than part of the shared picture,
and the volume does too. The overflow menu's Move player section therefore still belongs to the viewer:
a bar offers the two edges, `Top` and `Bottom`, because a strip that spans the media width has nothing
horizontal to choose; a pill offers the four corners, and the corner is also what decides the left or
right end of the band it sits in.

### Controls

Only the presenter writes playback state, and it travels to everyone through the `mediaPlayer` row:
play, pause and seek. Stop sharing sits in the overflow menu rather than beside the slide controls,
which is where it used to overlap them. Participants get the same progress bar as a read-only
display and a play button that is disabled, with one exception: when the browser refused to start
audio without a gesture, that button becomes the gesture the browser is waiting for, and pressing it
starts local playback without touching room state. In the compact form a participant's volume button
mutes locally, since a slider would not fit.

Volume and mute belong to each client and never travel. The volume button opens a slider inline, in
the same row, so no panel ever floats over the slides. Raising the slider off zero unmutes and
pulling it to zero mutes, so the icon never contradicts the slider.
A client nobody has touched starts at full volume and unmuted, so a room hears the file at once; only a level
or a mute the person set themselves keeps it lower.

### Measured geometry

Material 3 supplies the numbers it publishes, and this player decides the rest.

**From M3:** the icon button is a 40 dp container at full corner with a 24 dp icon
(`references/component-tokens.md`, SmallIconButton), and the slider is a 16 dp track at full corner
with a 4 dp by 44 dp handle at full corner (same file, Slider).

**My decisions, not in M3:** M3 publishes no strip geometry, so the 56 px band, the 44 px compact
band, the 320 px cap on the compact width, the 22 px icons, and inside a band the 6 px slider track with a
16 px handle rather than the 16 dp track of a full-size slider.

**Borrowed from the rest of the room, not decided here:** the corner is the client's `lgBorderRadius`
(1 rem, 16 px), which is the corner the presentation, the screenshare and the shared notes already
use, and the band keeps the 10 px gap the media area already leaves between its other pieces
(`DEFAULT_VALUES.camerasMargin`, the same value that separates the camera dock from the content).
Both densities use that corner; the compact form is a smaller rectangle, not a different shape.

### Rectangle rules

```
media area
+------------------------------------------+
| content rectangle                        |  media area height - gap - band height
| slides, or the video picture             |
+------------------------------------------+
|                                          |  gap: 10 px
+------------------------------------------+
| control band                             |  band height: 56, or 44 when compact
+------------------------------------------+
```

`bar`: the band spans the rectangle the player was given at the chosen edge, top or bottom. `pill`: the
band takes the width of its controls, up to 320 px of that row, aligned to the chosen corner. For a
video the whole block is the player's
own rectangle, taken the way an external video takes it: the picture fills the content row and the
controls stay in the band on the other side of the gap, never over the picture. For an audio file the
content row is the slide, which the engine shortens by the band plus the gap. Both surfaces carry the
same corner and the same gap, so the band reads as one more card in the room rather than as an edge
glued to the slide.

## Layout engine contract

The player uses two mechanisms, one per kind of file, and both live in `unifiedLayout.jsx`:

| Piece | What it does |
|---|---|
| `ACTIONS.SET_MEDIA_PLAYER_INPUT` (input) | an audio file reports `{ hasMediaPlayer, height, position }`: the row height for the size in use and the edge the viewer picked. A video reports `false`, because it asks for no room of its own |
| `ACTIONS.SET_MEDIA_PLAYER_OUTPUT` (output) | the engine publishes the band, `{ display, width, height, top, left, right, zIndex }`, the rectangle the audio row fills |
| `MediaPlayer` in `layoutTypes.ts` | the shape of both, beside `ExternalVideo` |

`calculatesMediaPlayerBand` takes the band out of the media area before the camera dock and the media
content are measured. A bottom band shortens the media area, so the dock, the slides, a screenshare, an
external video and the pinned notes all end above it; a top band moves the media area down by the same
amount, so they all start below it. One `DEFAULT_VALUES.camerasMargin` is spent on the gap between the
band and what it shares the area with, the same gap the camera dock uses. The dock and the content are
measured in the area that is left, which is why neither ends up under the player.

A video uses none of this. It claims the media area through the pile with a `GENERIC_CONTENT` entry
carrying `genericContentId: mediaFilePlayer`, the same entry a plugin main area item uses, and draws in
the rectangle that slot publishes.
The media area holds one content at a time, and the pile already decides which one: a screenshare, the
pinned notes, an external video and a plugin main area item each claim it, and the presentation is what
is left when none of them does. The player joins that order below the external video and above the
presentation.

`AppContainer` takes the presentation out of the media area while a video is playing, so the video is the
one content in focus and the slides yield to it. An audio file never does that: the slides stay on screen
beside its band. Sharing a presentation is the way back to the slides, and while a video owns the area the
presentation list keeps its Share button enabled for the file that is already the room's presentation,
which the client otherwise disables; pressing it stops the video before asking for that presentation.

Sharing a presentation is the way back to the slides, and a video is the one thing that makes them yield.

A video yields to every claimant that comes after it: while a screenshare, an external video, the pinned
notes or a plugin main area item holds the pile, it draws nothing, and it comes back when that content
releases the area. An audio file yields to none of them, because the band it stands in is its own.
`AppContainer` mounts the player only outside the media-only and cameras-only layouts.

The camera dock needs nothing of its own, because the band is taken out of the media area before the dock
is measured: the cameras keep the dock they always had, one band shorter, and the player never sits on
them.

Known gap: with another element fullscreen the player sits behind that layer anyway. A video is handed
the fullscreen rectangle and an audio file keeps its strip-less path, so in both cases the player
carves the band out of the rectangle it stands in and the presenter exits fullscreen to reach the
controls.

Known gap: in a right-to-left locale the engine publishes the player rectangle with `right` instead of
`left`, and the player reads `left` only, so it would be drawn at the window's left edge. No RTL locale
is enabled on this instance, and the fix is to derive `left` from `right` and the window width when the
engine leaves `left` unset.

Slide toolbar width, upstream and still unfixed here. The toolbar box is
`Math.min(svgWidth || presentationBounds.width, presentationBounds.width)`
(`presentation/component.jsx:737`), where `svgWidth` is the contain-fit slide width, and the wrapper is
a three equal column grid. A portrait slide is sized by the media area height, so a 394 px wide slide
gives each column 131 px while the zoom cluster needs about 220 px: the controls overlap and the last
ones sit past the slide edge. Left as upstream, with the numbers in `upstream-patches.md`.

This feature touches that path only by shortening the media rectangle, which narrows a portrait slide
a little further while the player is on screen.
## Player states

| State | Surface | Notes |
|---|---|---|
| Playing | pause button, seek bar advancing | the state comes from the room row |
| Paused | play button, seek bar frozen | the presenter's pause reaches everyone |
| Blocked by the browser | play overlay across the player | the browser refused to start audio alone; a participant pressing it starts local playback only |
| Unavailable | `app.mediaFile.error.unavailable` replaces the controls | the element failed to load, which covers a deleted file, a refused token and an unsupported codec |
A failed element shows the unavailable notice and no retry control; retry is deferred.

## Accessibility

- The player is a `region` with `aria-label` from `app.mediaFile.player.regionLabel`, and its buttons
  carry the same labels as their tooltips.
- State changes are announced once through `ScreenReaderAlertContainer`, not on every position tick.
- Keyboard, documented as our decision because the BBB source sets no convention here: space toggles
  play and pause when the player has focus, `ArrowLeft` and `ArrowRight` seek by 5 seconds, `M` toggles
  mute locally, `Escape` leaves full mode.
- Focus order runs the player's controls left to right, after the presentation and before the action bar.
- Colour is never the only signal: the upload state carries text, and the disabled participant
  controls keep their tooltips.
- Minimum target size 32 px in the player, using the button sizes already in
  `@bigbluebutton/bbb-ui-components-react`.

## i18n keys

Add to `bigbluebutton-html5/public/locales/en.json` and to the fork's Vietnamese locale file.

The upload sub-view and error keys are unchanged from the earlier sections: `app.mediaFile.modal.uploadFile`,
`app.mediaFile.modal.uploadFileTooltip`, `app.mediaFile.modal.title`, `app.mediaFile.upload.chooseFile`,
`app.mediaFile.upload.dropHint`, `app.mediaFile.upload.limits`, `app.mediaFile.upload.button`,
`app.mediaFile.upload.uploading`, `app.mediaFile.upload.cancel`, `app.mediaFile.list.title`,
`app.mediaFile.list.play`, `app.mediaFile.error.tooLarge`, `app.mediaFile.error.wrongType` and
`app.mediaFile.error.unavailable`. Four more keys ship ahead of the surface that will read them:
`app.mediaFile.error.unsupported`, `app.mediaFile.error.forbidden`, `app.mediaFile.list.remove` and
`app.mediaFile.notRecorded`.

| Key | English |
|---|---|
| `app.mediaFile.player.regionLabel` | Media player |
| `app.mediaFile.player.play` | Play |
| `app.mediaFile.player.pause` | Pause |
| `app.mediaFile.player.stop` | Stop sharing media |
| `app.mediaFile.player.seek` | Seek |
| `app.mediaFile.player.volume` | Volume |
| `app.mediaFile.player.mute` | Mute |
| `app.mediaFile.player.unmute` | Unmute |
| `app.mediaFile.player.collapse` | Compact player |
| `app.mediaFile.player.expand` | Expand player |
| `app.mediaFile.player.move` | Move player |
| `app.mediaFile.player.moreOptions` | More options |
| `app.mediaFile.player.presenterOnly` | The presenter controls playback |
| `app.mediaFile.player.anchorTop` | Top |
| `app.mediaFile.player.anchorBottom` | Bottom |
| `app.mediaFile.player.anchorTopLeft` | Top left |
| `app.mediaFile.player.anchorTopRight` | Top right |
| `app.mediaFile.player.anchorBottomLeft` | Bottom left |
| `app.mediaFile.player.anchorBottomRight` | Bottom right |

## Edge cases

- A second presenter starts a session while one runs: the new session stops the old one, with a
  confirm prompt in the media area before it starts.
- A participant joins mid-playback: position comes from `playerCurrentTime` plus the time since
  `updatedAt`, so no extra state is transferred.
- The presenter uploads while a session is running: the upload finishes without interrupting playback,
  and the new file is offered in the list.
- Recording disabled for the meeting: the file plays normally; the presenter sees a note in the list
  that the media will not be in the recording, which is the same honesty the video link dialog already
  shows with `app.externalVideo.noteLabelWarning`.
- Density follows the presenter and the anchor follows the viewer: the room watches one arrangement,
  while each participant keeps their own corner and their own volume. A video has no compact form, so
  the presenter's choice does not reach it.

## Acceptance checks

| Check | How |
|---|---|
| Presenter uploads mp3 and mp4, both play | two clients, second client hears the same position |
| Pause, seek and stop work for the presenter and follow on participants | seek checks the `Range` path, see the API document |
| Slides stay interactive during audio playback | compact mode, change slide and draw while audio plays |
| Participant has no upload entry | join as viewer and open the media area |
| Wrong type and oversize are refused before the body is read | upload a `.txt` and a file over the cap |
| The pill survives a narrow media area | shrink the window until the rectangle is under 380 px wide and confirm the pill stays inside it and takes the width of its controls instead of a fixed 320 px |
| The pill has no empty tail | collapse to the pill and confirm the surface ends with the menu button, with no blank space at either end |
| Nothing blocks the presentation toolbar or the action bar | visual check at 1024x768, 1440x900, 390x844, with slides shared and with none |
| Volume and mute are per person | set a different level in each client, then reload and confirm the level persists |
| Compact player and its anchor work | collapse to the pill, move it to each corner, move a bar to the top edge, and confirm the player and the slides overlap nothing |
| The room follows the presenter's size | collapse on the presenter and confirm every other client shows the pill, expand and confirm they show the bar, with a participant's own control inert |
| The bar names the kind of media, not the file | play an mp3 and an mp4: the label reads `Audio` and `Video`, and the stored file name is that label's hover title |
| Video controls fade and return | play a video, leave the pointer still for 3 s, then move it |
| An audio file keeps its row beside another content | play an mp3, then start a screenshare, then an external video, then pin the shared notes: the row stays where it is, keeps playing, and each of them takes the area above it |
| A video owns the media area | play an mp4 with slides open: the slides leave the area and the video keeps its controls inside its own rectangle. Play an mp3 with the camera on: the camera keeps its dock and the row sits below it, nothing overlapping |
| The slides come back from the sharing modal | play a video, open Media sharing, and press Share on the presented file: the video stops and the slides return |
| A long file name wraps twice | upload a file with a long name: the row shows two lines and an ellipsis, with the size and the buttons still in place |
| A file can be removed | press the trash button: the row goes for everyone, and a file that was playing stops |

## Deferred

Plugin SDK parity (`MediaPlayerVolumeUiDataNames` and ui-commands to mirror the external video
volume API), playback rate control, captions for media files, two simultaneous media sessions, free
dragging of the pill (the edge and corner anchors are the shipped placement control), drag and drop upload, and
the player inside the alternative layouts.
