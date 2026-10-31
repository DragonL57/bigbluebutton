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

## Ship

```bash
SHA=$(git rev-parse --short=10 HEAD)
tar czf /tmp/bbb-uplearn-$SHA.tgz artifacts/*.deb
scp /tmp/bbb-uplearn-$SHA.tgz <target>:/tmp/
```

The tarball is the release. Keep it next to the release notes, because it is also the rollback
material for the machine it installed onto.

## Install on the target

```bash
cd /tmp && tar xzf bbb-uplearn-<sha>.tgz
dpkg -i artifacts/*.deb            # one invocation, so inter-package dependencies resolve
apt-mark hold bbb-apps-akka bbb-web bbb-html5 bbb-graphql-server bbb-graphql-actions \
              bbb-record-core bbb-playback-presentation bbb-playback
bbb-conf --restart
bbb-conf --check
```

The hold is part of the install, not an optional extra. Without it, any later `apt upgrade` against
the upstream repository replaces the fork's packages with upstream ones and the feature disappears
without any error.

## Verify

```bash
dpkg -l | awk '/^ii  bbb-/ {print $2, $3}'     # every changed package on the built sha
```

Then a real meeting: create a room with recording on, upload a media file, play it, pause it, end the
meeting. The recording has to archive the file, publish `media_files.json`, and play it back at the
position the file was paused. That is the same sequence used on `bbb41`.

## Rollback

Install the previous tarball over the new one with `dpkg -i` and restart. When the new machine is not
the one being replaced, the cheaper rollback is to leave the old machine running and move the name
back, which is why a cutover by hostname is worth the extra machine.

## Version lines

Production runs BigBlueButton 4.0.0-rc.3 (`bbb.uplearn.vn`, native install on `36.50.176.205`, the
same VPS as the Moodle containers). The fork builds `4.1.0~alpha.1` from `v4.1.x-develop`.

Upstream supports moving forward inside one line by re-running the install script for that line, and
does not support an in-place jump between lines: the documented route is a clean server plus a
migration of the recordings (`docs.bigbluebutton.org/4.1/administration/install/`). Installing the
fork's debs onto the 4.0 machine is therefore not a supported upgrade, and the eight packages cannot
be dropped onto it one at a time.

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
