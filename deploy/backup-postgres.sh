#!/usr/bin/env bash
set -euo pipefail

umask 077

backup_dir=/var/backups/telve
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
destination="$backup_dir/telve-$timestamp.dump"
temporary="$destination.tmp"

mkdir -p "$backup_dir"
trap 'rm -f "$temporary"' EXIT
pg_dump --dbname="$DATABASE_URL" --format=custom --file="$temporary"
mv "$temporary" "$destination"
trap - EXIT

find /var/backups/telve -maxdepth 1 -type f -name 'telve-*.dump' -mtime +7 -delete
