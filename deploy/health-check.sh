#!/usr/bin/env bash
set -euo pipefail

response=$(curl --fail --silent --show-error --max-time 10 https://api.telve.app/health)
grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' <<<"$response"
