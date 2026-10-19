#!/bin/bash
# Builds web/index.html from web-src/ (see web-src/build.mjs).
exec node "$(cd "$(dirname "$0")" && pwd)/build.mjs" "$@"
