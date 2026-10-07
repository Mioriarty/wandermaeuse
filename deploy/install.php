<?php

/*
 * Spielt ein Archiv aus deploy/package.sh auf dem Webspace ein.
 *
 *   php -- <archiv> <zielordner> < deploy/install.php
 *
 * Das Skript kommt ueber stdin, damit es nicht vorher hochgeladen werden muss.
 * Es braucht nur PHP: auf dem Webspace gibt es kein rsync, und auf tar und
 * Co. ist kein Verlass.
 *
 * Ablauf:
 *  1. Das Archiv wird in einen Zwischenordner im Ziel entpackt.
 *  2. Jede Datei wird von dort an ihren Platz umbenannt. Umbenennen ist
 *     sofort fertig, die Seite sieht also nur fuer einen Augenblick einen
 *     Mischstand aus alt und neu.
 *  3. Was der vorige Deploy mitgebracht hat und dieser nicht mehr, wird
 *     geloescht. Nur das - .env, Uploads und Logs standen nie in einer
 *     Dateiliste und bleiben deshalb immer unangetastet.
 */

declare(strict_types=1);

const MANIFEST = '.deploy-manifest';
const STAGING = '.deploy-staging';

[, $archive, $target] = $argv + [null, null, null];

if (! $archive || ! $target) {
    fail('Aufruf: php -- <archiv> <zielordner>');
}

$target = rtrim($target, '/');

if (! is_dir($target)) {
    fail("Zielordner {$target} gibt es nicht.");
}

if (! is_file($archive)) {
    fail("Archiv {$archive} gibt es nicht.");
}

if (! class_exists(PharData::class)) {
    fail('Die PHP-Erweiterung phar fehlt, ohne sie laesst sich das Archiv nicht entpacken.');
}

$staging = "{$target}/".STAGING;
removeTree($staging);
mkdir($staging, 0755);

(new PharData($archive))->extractTo($staging, null, true);

$new = readManifest("{$staging}/".MANIFEST);
$old = is_file("{$target}/".MANIFEST) ? readManifest("{$target}/".MANIFEST) : [];

foreach ($new as $path) {
    $destination = "{$target}/{$path}";

    if (is_dir($destination) && ! is_link($destination)) {
        fail("{$path} ist auf dem Webspace ein Ordner, im neuen Stand eine Datei.");
    }

    $directory = dirname($destination);
    if (! is_dir($directory)) {
        mkdir($directory, 0755, true);
    }

    if (! rename("{$staging}/{$path}", $destination)) {
        fail("{$path} liess sich nicht an seinen Platz legen.");
    }
}

// Erst jetzt: scheitert oben etwas, gilt beim naechsten Versuch noch die alte
// Liste, und es wird nichts geloescht, was noch gebraucht wird.
rename("{$staging}/".MANIFEST, "{$target}/".MANIFEST);

$removed = 0;
foreach (array_diff($old, $new) as $path) {
    $file = "{$target}/{$path}";

    if (is_file($file) || is_link($file)) {
        unlink($file);
        $removed++;
    }

    removeEmptyParents($target, dirname($path));
}

removeTree($staging);
unlink($archive);

echo count($new)." Dateien eingespielt, {$removed} alte entfernt.\n";

/** @return list<string> */
function readManifest(string $file): array
{
    $paths = array_values(array_filter(array_map('trim', file($file))));

    foreach ($paths as $path) {
        // Die Liste stammt aus dem eigenen Build, aber sie entscheidet ueber
        // Loeschen - ein Pfad ausserhalb des Ziels darf darin nie stehen.
        if ($path[0] === '/' || preg_match('#(^|/)\.\.?(/|$)#', $path)) {
            fail("Ungueltiger Pfad in der Dateiliste: {$path}");
        }

        $inStorage = str_starts_with($path, 'storage/') && basename($path) !== '.gitignore';

        if ($path === '.env' || $path === 'public/storage' || $inStorage) {
            fail("{$path} gehoert nicht in einen Deploy.");
        }
    }

    return $paths;
}

function removeEmptyParents(string $root, string $directory): void
{
    while ($directory !== '.' && $directory !== '') {
        $path = "{$root}/{$directory}";

        if (! is_dir($path) || count(scandir($path)) > 2) {
            return;
        }

        rmdir($path);
        $directory = dirname($directory);
    }
}

function removeTree(string $path): void
{
    if (is_link($path) || is_file($path)) {
        unlink($path);

        return;
    }

    if (! is_dir($path)) {
        return;
    }

    foreach (array_diff(scandir($path), ['.', '..']) as $entry) {
        removeTree("{$path}/{$entry}");
    }

    rmdir($path);
}

function fail(string $message): never
{
    fwrite(STDERR, "::error::{$message}\n");
    exit(1);
}
