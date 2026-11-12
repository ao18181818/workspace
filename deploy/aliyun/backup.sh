#!/bin/sh
set -eu
umask 077
cd "$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="backups/nanxi-${stamp}.dump"
trap 'rm -f "$backup.partial"' EXIT HUP INT TERM
docker compose exec -T db pg_dump -U nanxi -d nanxi -Fc > "$backup.partial"
test -s "$backup.partial"
mv "$backup.partial" "$backup"
printf 'Backup ready: %s\n' "$backup"
