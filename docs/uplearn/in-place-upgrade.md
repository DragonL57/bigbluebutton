# Upgrading a running 4.0 server in place

This is what production did on 2026-10-31: `bbb.uplearn.vn`, a 4.0.0-rc.3 install, replaced by the
bundle at `cb38d7e30e`. The version line rule still says a clean server is the supported route; this
page records the in-place path because that is the route that was chosen, including the four things
that broke on the way.

## Before touching the packages

`bbb-revert-4.0.0-rc.3` on the server holds what a rollback needs: `/etc/bigbluebutton`,
`/etc/nginx`, `/usr/share/bigbluebutton/nginx`, the systemd units, the apt sources, `dpkg -l`,
`--get-selections`, and dumps of `hasura_app`, `bbb_graphql`, `blocknote_app` and `postgres`.

The exact 4.0.0-rc.3 debs cannot be re-downloaded. Upstream pruned them: the `noble-400` index still
lists `2:4.0.0~rc.3+...` while every file behind it answers 404. A software rollback therefore lands
on the newest 4.0 line that still has files (4.0.2 from `noble-40-dev`), restored configs, and the
dumps. The kit keeps that 4.0.2 set downloaded for exactly this reason.

## Four things that stop the install

1. Node.js 24. The 4.1 debs depend on `nodejs (>= 24)`; a 4.0 box runs 22 from NodeSource. Switch
   `node_22.x` to `node_24.x` in `/etc/apt/sources.list.d/nodesource.list`, `apt-get update`, install
   `nodejs`, then configure the rest.
2. `dpkg -i` leaves every package unpacked. Run
   `dpkg --configure -a --force-confdef --force-confold`; the flags are dpkg's, not apt's, and a
   conffile prompt with no stdin ends the run with `end of file on stdin`.
3. `bbb-upstreams.conf`. 4.1 adds `/etc/nginx/conf.d/bbb-upstreams.conf`, the file that defines the
   upstream names the new nginx locations proxy to. Configuration runs `systemctl reload nginx`
   before that conffile is finalized, nginx fails with `host not found in upstream`, and the postinst
   aborts the whole configure step. Copy `bbb-upstreams.conf.dpkg-new` into place before retrying.
4. `application.conf`. The 4.1 version ships `changeme` and `${?SHARED_SECRET}` placeholders; the 4.0
   file carries the real salt and API URL. Take the new file, then write the production values into
   the two literals, or akka cannot authenticate to bbb-web.

The salt in `/etc/bigbluebutton/bbb-web.properties` survives the upgrade, which is what keeps Moodle
working without a config change.

## After the install

```bash
apt-mark hold bbb-apps-akka bbb-web bbb-html5 bbb-graphql-server bbb-graphql-actions \
              bbb-record-core bbb-playback-presentation bbb-playback
bbb-conf --restart
bbb-conf --check
```

Two `bbb-conf --check` warnings are expected on this setup and harmless: the webhooks port warning
compares the nginx upstream name against a config key that no longer means what the check assumes,
and the STUN check fails whenever the server cannot reach `stun.l.google.com`.
