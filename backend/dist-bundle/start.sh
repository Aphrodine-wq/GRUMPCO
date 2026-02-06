#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
node "$DIR/server.mjs" "$@"
