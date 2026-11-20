#!/bin/sh
# Thin wrapper: review sheets for the content packs. See tools/review-content.py.
exec python3 "$(dirname "$0")/review-content.py" "$@"
