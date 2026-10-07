<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Brings the app in line with whatever was just deployed.
 *
 * The GitHub Actions deploy runs this over SSH right after copying the files.
 * Should that step fail halfway, the scheduler also calls it every minute with
 * --if-changed: it compares the deployed commit against the one we last
 * finished, and only does work when they differ.
 */
class PostDeploy extends Command
{
    protected $signature = 'wandermaeuse:post-deploy
                            {--if-changed : Nur ausführen, wenn ein neuer Stand eingespielt wurde}';

    protected $description = 'Migrationen, Storage-Link und Caches nach einem Deploy';

    private const MARKER = 'deployed-sha';

    public function handle(): int
    {
        $sha = $this->currentSha();

        if ($this->option('if-changed')) {
            if ($sha === null) {
                return self::SUCCESS;
            }

            $previous = Storage::disk('local')->exists(self::MARKER)
                ? trim(Storage::disk('local')->get(self::MARKER))
                : null;

            if ($previous === $sha) {
                return self::SUCCESS;
            }
        }

        $this->info('Deploy wird abgeschlossen …');

        $this->call('migrate', ['--force' => true]);

        // A fresh checkout can wipe public/storage, so it is relinked every time.
        // --relative is not cosmetic: SSH and cron run inside a chroot where this
        // project is /wandermaeuse.de/httpdocs, while Apache sees the full path
        // under /var/www/vhosts/. An absolute link points nowhere for Apache and
        // it refuses to follow it (AH00037).
        $this->linkStorage();

        // Deliberately not `optimize`: config:cache freezes absolute paths, and
        // the chroot paths are wrong for Apache, which then dies on open_basedir
        // before it can render anything. Routes and events cache class names
        // rather than paths, so those two are safe here.
        $this->call('config:clear');
        $this->call('route:cache');
        $this->call('event:cache');

        if ($sha !== null) {
            Storage::disk('local')->put(self::MARKER, $sha);
        }

        $this->info('Fertig.');

        return self::SUCCESS;
    }

    /**
     * Links public/storage to storage/app/public with a *relative* target.
     *
     * storage:link --relative would need symfony/filesystem, which this project
     * does not ship; and its default absolute target is unusable here anyway.
     */
    private function linkStorage(): void
    {
        $link = public_path('storage');

        // A dangling link reports false for file_exists but true for is_link.
        if (file_exists($link) && ! is_link($link)) {
            return;
        }

        if (is_link($link)) {
            if (readlink($link) === '../storage/app/public') {
                return;
            }

            unlink($link);
        }

        symlink('../storage/app/public', $link);

        $this->info('public/storage neu verknuepft.');
    }

    private function currentSha(): ?string
    {
        // Written by the deploy workflow, which copies files without a .git.
        $revision = base_path('REVISION');

        if (is_readable($revision)) {
            return trim((string) file_get_contents($revision)) ?: null;
        }

        $head = base_path('.git/HEAD');

        if (! is_readable($head)) {
            return null;
        }

        $contents = trim((string) file_get_contents($head));

        if (str_starts_with($contents, 'ref: ')) {
            $ref = base_path('.git/'.substr($contents, 5));

            return is_readable($ref) ? trim((string) file_get_contents($ref)) : null;
        }

        return $contents ?: null;
    }
}
