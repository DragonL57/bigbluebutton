# Running the fork in production

Problems met while running the 4.1 build on `bbb.uplearn.vn`, what the evidence shows, and what is
still open. Each section states what was measured, not what was suspected.

Server: `36.50.176.205`. It ran 4.1.0-alpha.1, build `cb38d7e30e`, client bundle
`bundle.47bec0e5e8cc7dacfaaf.js`, until 2026-11-07, when it was moved back to the 4.0 line at build
`72d686d384` (`in-place-upgrade.md`). Moodle runs in Docker beside it (`uplearn-prod-app-1`, docroot
`/var/www/html/public`, dataroot `/var/www/moodledata`).

## Playback links point at the placeholder host after an upgrade

`bbb-record-core` owns `/usr/local/bigbluebutton/core/scripts/bigbluebutton.yml` and ships it as a
plain file, not a conffile (`dpkg-query -W -f='${Conffiles}' bbb-record-core` lists no entry for it).
Upgrading `bbb-record-core` therefore writes the stock `playback_host: bigbluebutton.example.com`
back, and recordings published before anyone notices bake that host into their `metadata.xml`.

Moodle does not store the URL: `m_bigbluebuttonbn_recordings` keeps only the recording id and asks
`getRecordings` each time. Its cache holds the stale answer, so correcting the server config alone
does not move an already published recording.

Repair, in this order:

```bash
sed -i 's/^playback_host:.*/playback_host: bbb.uplearn.vn/' \
  /usr/local/bigbluebutton/core/scripts/bigbluebutton.yml
systemctl restart bbb-rap-starter bbb-rap-resque-worker bbb-web
# then each recording published while the placeholder was live
python3 - <<'PY'
import glob, pathlib, time
for p in glob.glob('/var/bigbluebutton/published/presentation/*/metadata.xml'):
    f = pathlib.Path(p)
    s = f.read_text()
    if 'bigbluebutton.example.com' in s:
        f.with_suffix('.xml.bak-%d' % int(time.time())).write_text(s)
        f.write_text(s.replace('bigbluebutton.example.com', 'bbb.uplearn.vn'))
PY
docker exec -u www-data uplearn-prod-app-1 php /var/www/html/admin/cli/purge_caches.php
```

`bbb-record --rebuild <id>` also works but re-runs media processing, so editing the metadata is the
cheaper repair. State after the fix on 2026-11-03: `playback_host: bbb.uplearn.vn`, three
`metadata.xml.bak-*` files carrying the placeholder, no live `metadata.xml` carrying it,
`getRecordings` returning 52 playback URLs all on `https://bbb.uplearn.vn`, and the Moodle cache
directory rebuilt after the purge.

Check it after every upgrade, not only when someone reports a broken recording.

## The client is served without Cache-Control

Measured on the production origin:

| Request | Headers present | Headers absent |
|---|---|---|
| `GET /html5client/` | `ETag`, `Last-Modified` | `Cache-Control`, `Expires` |
| `GET /html5client/bundle.47bec0e5e8cc7dacfaaf.js` | `ETag`, `Last-Modified` | `Cache-Control`, `Expires` |

Asset references in the entry document carry a build stamp for some files (`compatibility/tflite.js?v=20261031T044222`)
and none for others (`stylesheets/normalize.css`), and the entry document itself is unversioned. A
tab can therefore keep running a pre-upgrade bundle until the browser revalidates.

The fix belongs in nginx, and it has not been applied: `no-cache` on the entry document so the bundle
hash is re-read, and `public, max-age=31536000, immutable` on the hashed `*.js` files, which never
change under the same name.

## Whiteboard ink colour, open

A user reported black text drawn on the whiteboard rendering as near-white for him only, invisible on
a light board, while everyone else saw black. This section records what the code and the running build
actually do, because the first explanation offered was wrong.

Facts from the deployed build:

| Observation | Value |
|---|---|
| tldraw palette in use | `tl-container tl-theme__dark` |
| Canvas background | `.tl-background` computes to `rgb(249, 250, 251)` |
| Default swatch ink on a text shape | `color: rgb(29, 29, 29)` |
| Contrast of that ink on that canvas | about 16:1 |
| Palette override in the bundle | `darkMode=JSON.parse(JSON.stringify(lightMode))` at offset 6192771 of `bundle.47bec0e5e8cc7dacfaaf.js` |

So on this build, in a dark client theme with a dark operating system, the default black swatch draws
near-black ink. `tldraw`'s own dark palette would put `#e1e1e1` there, and that value is still in the
bundle, but the override replaces the palette at module load before anything renders. The pin on
`.tl-background` comes from upstream too, so both halves of the reported mechanism are already
reconciled upstream and neither produces white ink on a light canvas here.

Two client-side explanations remain, and the reporting machine decides between them:

1. An older bundle. `4.0.x-release` carries `setupColorThemePaletteOverrides` without the
   `darkMode = lightMode` clone, so a tab still running 4.0 code paints the dark palette. Check the
   JavaScript file name in the Network panel against `bundle.47bec0e5e8cc7dacfaaf.js`.
2. A dark-mode browser extension. Upstream issue #11218 describes this symptom from Dark Reader
   before native dark mode existed: extension-inverted text on a presentation canvas that the
   extension leaves light. Upstream PR #21074 later adjusted Dark Reader selectors for the tldraw
   color picker and text shape colour, and our own `theme-dark.css` carries a comment about Dark
   Reader's image analysis. Test in a private window with extensions disabled.

To settle it on the affected machine, with the whiteboard open, read the computed colours:

```js
const t = document.querySelector('.tl-text');
const bg = document.querySelector('.tl-background');
[t && getComputedStyle(t).color, bg && getComputedStyle(bg).backgroundColor]
```

`rgb(29, 29, 29)` against `rgb(249, 250, 251)` means the client is behaving like the build above and
the difference is a stale bundle or an extension. A light value there means the tab is running other
code, and the bundle name in the Network panel says which.

Upstream background, for the record: dark mode arrived in PR #14783 with a note that whiteboard
palette problems should be reviewed later; the infinite whiteboard background was pinned to
`colorTldrawBackground` in PR #24580 (`bbb-playback` PR #339); the palettes were unified in commit
`239f6e1f6b`, "fix(dark-theme): address the review of the native dark theme", which is an ancestor of
the build running here; and automatic dark mode from `prefers-color-scheme` landed in PR #25490,
gated by `public.app.darkTheme.autoDetectFromSystem` (default `true`), so members of the same class
can legitimately be in different themes.

## Forcing the light theme on a running client

A class reported one member seeing a black whiteboard toolbar inside an otherwise light room, and
another reported black ink rendering white. Both turned out to sit outside the palette, but they
shared a cause worth writing down: on this build the client theme is per viewer, and the whiteboard
now follows it.

What production serves, read from a live client:

| Setting | Value |
|---|---|
| `public.app.darkTheme.enabled` | `false` |
| `public.app.darkTheme.autoDetectFromSystem` | `false` |
| `defaultSettings.application.darkTheme` | `false` |
| `public.app.userSettingsStorage` | `session` |

With those values a dark client is only reachable through `userdata-bbb_prefer_dark_theme` in a join
URL, read at `bigbluebutton-html5/imports/ui/services/settings/index.js:79-83`, where the parameter
beats the configured default whether or not the feature is enabled. A stored preference cannot
survive, because `session` storage dies with the tab.

Two upstream changes explain why a dark viewer looks worse on 4.1 than on 4.0:

- 4.0 shipped `darkreader` (`^4.9.117`) and inverted the whole page at runtime, so nothing could stay
  accidentally light. 4.1 removed the dependency and repaints with hand written tokens, leaving any
  surface it has not tokenised in its light value. That is the bleeding.
- 4.0 never told tldraw the client theme; 4.1 does, at `component.jsx:222` on change and
  `component.jsx:1371` on mount. Measured in a dark client: `tl-container tl-theme__dark`, tldraw UI
  dark, canvas pinned light at `rgb(249, 250, 251)` by `public/stylesheets/theme-dark.css:352`, ink
  `rgb(29, 29, 29)`. A dark toolbar around a white slide is exactly this state.

### The byte patch that bridged the night, now removed

Applied 2026-11-04 while a class was due, without a rebuild, and superseded by the package build below
on 2026-11-05. Kept here because the gzip trap will catch the next person who edits a served asset:

1. `bundle.47bec0e5e8cc7dacfaaf.js` and `bundle.47bec0e5e8cc7dacfaaf.safari.js`: the literal
   `bbb_prefer_dark_theme` renamed to `bbb_dark_theme_ignored`, two occurrences and five. The lookup
   misses, so the configured default applies to every join.
2. `index.html`: `bundleHash` bumped from `47bec0e5e8cc7dacfaaf` to `darkfix1`, with the patched
   bundles copied under that name. The old names stay so HTML from a cache still resolves.
3. Every touched file's `.gz` twin rebuilt.

Step 3 is the one that cost an hour. The client location is served by
`/usr/share/bigbluebutton/nginx/bbb-html5.nginx.static:299` with `gzip_static on`, so a browser is
handed `index.html.gz` and never sees the edited `index.html`. `curl` without `Accept-Encoding` shows
the fixed file and confirms nothing. Always verify with `curl -sk --compressed`, and rebuild the
gzip twin after any edit under `/usr/share/bigbluebutton/html5-client/`.

Verified on a join that carried `userdata-bbb_prefer_dark_theme=true`: `bundle.darkfix1.js`, no
`data-theme` attribute, `tl-theme__light`, black body text. It applies to any client that reloads the
page, since `/html5client/` has no `Cache-Control` and a reload revalidates. `Ctrl+Shift+R` settles a
tab that still holds the old document.

The patch edited package-owned bytes, so the `bbb-html5` upgrade erased it as expected. `/root/revert_force_light.sh`
would undo it by hand, and is harmless now.

### The fix that shipped: build `0d2f2ee01a`

Committed and installed on 2026-11-05 as `bbb-html5 2:4.1.0~alpha.1+20261104T101850-git.local-build-2b023e3aea`,
bundle `e1870b65b84973ae269b`.

`services/settings/index.js` now treats a disabled feature as authoritative, in both places the value can
arrive:

```js
const darkThemeOffered = window.meetingClientSettings.public.app.darkTheme?.enabled;
const showDarkThemeDefault = darkThemeOffered
  ? getFromUserSettings('bbb_prefer_dark_theme', darkThemeDefault)
  : false;
// ... setDefault, then loadChanged()
if (!darkThemeOffered && this.application?.darkTheme) {
  this.application = { ...this.application, darkTheme: false };
}
```

The second block matters as much as the first: `loadChanged()` merges the persisted "changed" blob over
the defaults after the parameter is resolved, so clamping only the default would let a stored selection
through.

`/usr/share/bigbluebutton/nginx/bbb-html5.nginx.static` gained `add_header Cache-Control "no-cache" always`
on the client location, so the entry document revalidates on every join instead of waiting out a
heuristic cache. The header sits on the whole location rather than a nested one on purpose: `alias`
does not resolve reliably inside a nested location, and a broken path there takes the room down.

Verified after install on a join carrying `userdata-bbb_prefer_dark_theme=true`: served entry
`bundleHash = 'e1870b65b84973ae269b'` with `Cache-Control: no-cache`, client `bundle.e1870b65b84973ae269b.js`,
no `data-theme` attribute, `tl-theme__light`, black body text. All 31 `bbb-*` packages are held with
`apt-mark hold`, and `systemctl --failed` is empty.

Remaining exposure, stated plainly: a tab that loaded the client before the install keeps its old
bundle until it reloads, and the mobile app runs its own theme beyond anything here.

### Reverted on 2026-11-07: outside the media feature, upstream only

The server moved back to the 4.0 line on 2026-11-07, and the clamp above came with it. It was then
reversed, because the 4.0 build is meant to carry the media feature and nothing else: the revert of
`96f24141e1` deletes both the `settings/index.js` clamp and the `Cache-Control` header, so those two
files match the base commit again.

The consequence is the one this section opened with: `darkTheme.enabled: false` still hides the
Settings toggle, but `userdata-bbb_prefer_dark_theme` in a join URL, and a dark choice kept in
`session` storage, work again. A class that cares about this should not send the parameter. The
client entry document is back to no `Cache-Control`, so after a client update a tab that stayed open
may keep the old bundle until it reloads.

## Joining a room from the API for a test

A `join` call with `redirect=false` returns a `sessionToken` that the client page rejects with 410
("session has ended") when opened directly: `bbb-web` logs the join as successful, then
`bbb-graphql-middleware` answers `Invalid sessionToken`. Requesting the join URL without
`redirect=false` and letting it redirect into `/html5client/` works. Use the redirect form when
driving a browser for a test.
