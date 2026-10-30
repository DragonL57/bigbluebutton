#!/bin/bash

# Fork build: this plays the media files recorded by the UpLearn media file player. The branch is
# based on upstream v5.4.8 and carries one feature on top of it; see docs/uplearn/upstream-patches.md.
git clone --branch uplearn-media-file --depth 1 https://github.com/DragonL57/bbb-playback bbb-playback
