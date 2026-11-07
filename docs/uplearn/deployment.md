# Shipping the fork to a server

## Builds happen on the workstation only

Every package is built on the development machine. A server never runs `build/setup.sh`, never runs
gradle, maven, npm, or webpack, and never clones a source tree. It receives the built `.deb` files,
installs them, and starts the services.

Two consequences follow. The bundle has to be complete for the version line it installs onto, since
nothing is compiled on the target. And the only thing the target fetches from the network is the
Ubuntu packages the debs declare as dependencies, plus whatever upstream packages the base install
needed before the fork's debs arrive.

`bbb-playback` is the awkward one: the build clones the fork branch and compiles it here
(`bbb-playback.placeholder.sh`), and the resulting deb carries the built app. On the server that
package is just files.

## The bundle

Build every package at one commit, using the names in `build/package-names.inc.sh` (31 of them,
including `bigbluebutton`, the meta package). The meta package pins each dependency to the exact
version it finds in `artifacts/` (`build/packages-template/bigbluebutton/build.sh:73`), so a full
build produces a self-consistent set where every package carries the same
`...-git.local-build-<sha>` stamp. Its dependency list covers 18 of the 31 packages, so installing
the whole server is still `dpkg -i artifacts/*.deb`; the meta package is a convenience for the
subset it names, not a complete install.

That pinning is also why the meta package is unusable with a partial `artifacts/` directory. When
only the changed packages were built, as on the test container, the unpinned packages fall back to
the global version and apt then wants debs that do not exist. In that case install the changed debs
by hand and hold them.

## Packages that carry the fork

Eight of the 31 differ from upstream at `local-dev`:

| Package | Source directories |
|---|---|
| `bbb-apps-akka` | `akka-bbb-apps`, `bbb-common-message` |
| `bbb-web` | `bigbluebutton-web`, `bbb-common-web` |
| `bbb-graphql-server` | `bbb-graphql-server` |
| `bbb-graphql-actions` | `bbb-graphql-actions` |
| `bbb-html5` | `bigbluebutton-html5` |
| `bbb-record-core` | `record-and-playback/core` |
| `bbb-playback-presentation` | `record-and-playback/presentation` |
| `bbb-playback` | the fork branch `uplearn-media-file` |

Everything else is upstream at the base commit. A server that installs only these eight over an
upstream install of the same line reproduces the test container `bbb41`.

## Build on the workstation

```bash
cd /home/thelong/coding/bigbluebutton
git switch local-dev
git pull --ff-only
git rev-parse HEAD            # the sha every deb must carry
```

Six of the packages build from separate repositories, which a fresh checkout does not contain:
`freeswitch`, `bbb-webhooks`, `bbb-webrtc-recorder`, `bbb-webrtc-sfu`, `bbb-transcription-controller`,
and `bbb-playback`. Fetch them first, or those builds fail in seconds with an empty source tree:

```bash
build/get_external_dependencies.sh
```

Each build needs the docker daemon, which asks for `pkexec` approval here:

```bash
for pkg in $(source build/package-names.inc.sh; printf '%s\n' "${!DEBNAME_TO_SOURCEDIR[@]}"); do
  build/setup.sh "$pkg"
done
```

A single package is the same call with one name. The output lands in `artifacts/`, and the same
package can be built twice under two stamps, so clean the directory before a release build.

One build can stall inside `npm install` and never return, so wrap each call in
`timeout -k 120 3600 build/setup.sh "$pkg"`. A stalled package then fails alone, and rerunning the
loop is safe: a package that already has a deb at the current sha is skipped.

## Ship

```bash
SHA=$(git rev-parse --short=10 HEAD)
tar czf /tmp/bbb-uplearn-$SHA.tgz artifacts/*.deb
scp /tmp/bbb-uplearn-$SHA.tgz <target>:/tmp/
```

The tarball is the release. Keep it next to the release notes, because it is also the rollback
material for the machine it installed onto.

## Install on the target

The bundle unpacks to `artifacts/`, so `install.sh` is called with the directory that holds the debs,
and the whole release directory is kept under `/root/bbb-uplearn-<sha>` on the target, next to the
revert kit, until a real class has run on the new build.

```bash
cd /tmp && tar xzf bbb-uplearn-<sha>.tgz
dpkg -i artifacts/*.deb            # one invocation, so inter-package dependencies resolve
for p in $(dpkg-query -W -f='${Package}\n' 'bbb-*'); do apt-mark hold "$p"; done
bbb-conf --restart
bbb-conf --check
```

The hold is part of the install, not an optional extra. Without it, any later `apt upgrade` against
the upstream repository replaces the fork's packages with upstream ones and the feature disappears
without any error.

### What the install does not do

Four things sit outside the deb postinst and were needed on both moves between the two lines:

- `bbb-apps-akka` keeps the old `application.conf`, and dpkg leaves the packaged one next to it as
  `.dpkg-dist`. The unit's `application.ini` passes
  `-Dconfig.file=/etc/bigbluebutton/bbb-apps-akka.conf`, that file `include`s
  `/usr/share/bbb-apps-akka/conf/application.conf` and then re-sets `bbbWebAPI` and `sharedSecret`,
  so the packaged file can be taken outright:
  `cd /usr/share/bbb-apps-akka/conf && mv application.conf.dpkg-dist application.conf`. Keeping the
  older one loses the settings that line added, for example `presentationUploadTokenMaxRequests`
  and `allowedAnnotationTypes` on 4.0.2.
- `hasura metadata apply`. The postinst runs it, but the catalog can end up tracking no table at
  all. Check before trusting the client:

  ```bash
  sudo -u postgres psql -d hasura_app -tAc \
    "select s->>'name', jsonb_array_length(s->'tables') from hdb_catalog.hdb_metadata, jsonb_array_elements(metadata::jsonb->'sources') s;"
  ```

  The `BigBlueButton` source should track the media views (85 tables on 4.0.2). If it does not, from
  `/usr/share/bbb-graphql-server` run
  `sudo -u bigbluebutton env HOME=/tmp /usr/bin/hasura metadata apply --skip-update-check`. The admin
  secret the CLI needs is in that directory's `config.yaml`.
- The four branding files. `bbb-config` and `bbb-playback` are package files, not conffiles, so an
  install puts BBB's stock icon and logos back; the copy commands are in `in-place-upgrade.md`.
- `bbb-transcription-controller` crash-loops on the FreeSWITCH ESL auth on this server, on either
  line. The unit is disabled there; transcription is not used.

## Verify

```bash
dpkg -l | awk '/^ii  bbb-/ {print $2, $3}'     # every changed package on the built sha
```

Then a real meeting: create a room with recording on, upload a media file, play it, pause it, end the
meeting. The recording has to archive the file, publish `media_files.json`, and play it back at the
position the file was paused. That is the same sequence used on `bbb41`.
## Replacing one package between releases

The full bundle is for a planned upgrade. A single package can be rebuilt and swapped without
touching a running class, which is how the client clamp from `operations.md` reached production on
2026-11-05.

```bash
# workstation
cd /home/thelong/coding/bigbluebutton
PATH=/tmp/nosudo:$PATH timeout -k 120 3600 build/setup.sh bbb-html5
ls -t artifacts/bbb-html5_*.deb | head -1
sha256sum artifacts/bbb-html5_*.deb
# target
dpkg -i --force-confdef --force-confold /root/bbb-html5_<stamp>.deb
nginx -t && systemctl reload nginx
```

`dpkg -i` alone is enough even with the package held; `apt-mark hold` blocks `apt`, not `dpkg`. The
client is static files, so installing `bbb-html5` drops no meeting, but the nginx reload is required
for a changed `bbb-html5.nginx.static` to take effect.

Verify from the target with compression on, because nginx serves `gzip_static on` and a plain `curl`
reads a different file than a browser does:

```bash
curl -sk --compressed -D- https://<host>/html5client/ -o /tmp/entry.html | grep -i cache-control
grep -m1 "var bundleHash" /tmp/entry.html   # must match the new build's bundle name
```

Then join a room and confirm the client actually runs that bundle, rather than trusting the served
file.


## Rollback

Install the previous tarball over the new one with `dpkg -i` and restart. When the new machine is not
the one being replaced, the cheaper rollback is to leave the old machine running and move the name
back, which is why a cutover by hostname is worth the extra machine.

On a server upgraded in place there is no previous tarball to go back to unless someone saved one.
Production cannot: upstream pruned every 4.0.0-rc.3 file, so its kit holds a downloaded 4.0.2 set
instead, plus the configuration tree and four database dumps. A disk snapshot from the hosting panel
is the only exact revert for that machine.

## Version lines

Until 2026-10-31 production ran BigBlueButton 4.0.0-rc.3 (`bbb.uplearn.vn`, native install on
`36.50.176.205`, the same VPS as the Moodle containers). The fork also builds `4.1.0~alpha.1` from
`v4.1.x-develop`, which the server ran from 2026-10-31 to 2026-11-07.

On 2026-11-07 the server was moved back to the 4.0 line: the bundle at `72d686d384`,
`2:4.0.2+20261106T203756-git.local-build-72d686d384`, installed over the 4.1 packages with the
command in "Install on the target". That is a cross-line downgrade, which upstream does not support;
`in-place-upgrade.md` records what the revert kit for the 4.1 install holds and the state that install
ended in. The revert kit for the downgrade is `/root/bbb-revert-4.1.0-alpha.1-20261107`, which also
keeps the 4.1 akka conffile as `application.conf.kept-4.1`.

Upstream supports moving forward inside one line by re-running the install script for that line, and
does not support an in-place jump between lines: the documented route is a clean server plus a
migration of the recordings (`docs.bigbluebutton.org/4.1/administration/install/`). Installing the
fork's debs onto the 4.0 machine is therefore not a supported upgrade, and the eight packages cannot
be dropped onto it one at a time.

Production took that route anyway, in both directions, as a whole set rather than in pieces:
`in-place-upgrade.md` records what a revert kit has to hold, the four failures that stop the
configure step, and the state the server ended in.

## What the target needs to provide

The upstream install page asks for 16 GB of memory, 8 CPU cores, 500 GB of disk for recordings, TCP
80 and 443, and UDP 16384 to 32768. The four core, eight gigabyte figure in the same page is the
local development allowance, which is what the test container runs under. The production VPS is
shared with Moodle, Postgres, and cloudflared, so a 4.1 server that replaces it wants its own
machine.

Cloudflare Tunnel carries HTTP and HTTPS only, so `bbb.uplearn.vn` keeps a direct public address with
the media ports open, unlike `uplearn.vn`, which rides the tunnel.

Recordings already published on the old machine are linked from Moodle by hostname. Copy
`/var/bigbluebutton/published` to the new machine before the old one is retired, and copy
`/var/bigbluebutton/recording/raw` as well if those recordings should stay re-processable.
