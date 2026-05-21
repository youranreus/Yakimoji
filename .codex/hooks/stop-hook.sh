#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK_BIN="$PROJECT_ROOT/.agents/skills/bmad-story-automator/scripts/story-automator"

exec "$HOOK_BIN" stop-hook
