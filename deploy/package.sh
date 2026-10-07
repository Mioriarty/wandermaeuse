#!/usr/bin/env bash
# Packt den gebauten Stand fuer den Webspace in ein tar-Archiv.
#
#   bash deploy/package.sh <archiv>
#
# Dazu kommt .deploy-manifest: die Liste aller Dateien im Archiv. Damit loescht
# deploy/install.php auf dem Webspace beim naechsten Mal genau das, was dieser
# Stand mitgebracht hat und der naechste nicht mehr - und sonst nichts.
set -euo pipefail

archive="${1:?Pfad zum Archiv fehlt}"

cd "$(dirname "$0")/.."

# Alles ausser dem, was nur der Entwicklung dient. Aus storage/ kommen nur die
# leeren Ordner mit ihren .gitignore-Dateien; was dort auf dem Webspace liegt
# (Uploads, Logs, Sessions), gehoert nicht dem Deploy.
{
    find . \( -path ./.git -o -path ./.github -o -path ./node_modules \
        -o -path ./tests -o -path ./storage -o -path ./public/storage \) -prune \
        -o -type f -print
    find ./storage -type f -name .gitignore
} | sed 's|^\./||' \
  | grep -v -E '^(phpunit\.xml|\.phpunit\.result\.cache|\.env|\.deploy-manifest|public/hot|public/fonts-manifest\.dev\.json|database/database\.sqlite)$' \
  | grep -v -E '(^|/)\.DS_Store$' \
  | LC_ALL=C sort > .deploy-manifest

# GNU-Format: Pfade in vendor/ sind laenger als die 100 Zeichen von ustar,
# und PHPs PharData liest die GNU-Langnamen.
tar --format=gnu -cf "$archive" -T .deploy-manifest .deploy-manifest

echo "$(wc -l < .deploy-manifest | tr -d ' ') Dateien, $(du -h "$archive" | cut -f1)"
