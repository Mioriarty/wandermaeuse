<?php

use App\Models\Comment;
use App\Models\Post;
use Illuminate\Support\Facades\Schedule;

/*
 * Everything recurring runs from a single netcup scheduled task. The contract
 * only allows an HOURLY invocation, and netcup gives no guarantee about which
 * minute of the hour it lands on:
 *
 *     <unknown minute> * * * *  cd ~/httpdocs && php artisan schedule:run
 *
 * schedule:run fires a task only when the current minute matches its cron
 * expression. Anything narrower than `* * * * *` - hourly(), daily(),
 * dailyAt(), even everyTenMinutes() - can therefore miss that single tick
 * forever: dailyAt('03:30') never ran once, because the cron does not happen
 * to fall on minute 30 of hour 3.
 *
 * So every task below uses everyMinute() and is written to be idempotent. The
 * real cadence comes from the cron, not from the expression. A test in
 * tests/Feature/ScheduleTest.php keeps it that way.
 *
 * Shared hosting has no daemons, so there is no queue worker running in the
 * background - the scheduler drains the queue on each tick instead.
 */

// Newsletter sending and anything else queued. --stop-when-empty keeps the
// process short-lived; --max-time caps how long one tick may send for.
Schedule::command('queue:work --stop-when-empty --max-time=50 --tries=3')
    ->everyMinute()
    ->withoutOverlapping();

// A deploy self-heals on the next tick even when netcup's Git deploy actions
// silently do not run, which they sometimes do not. --if-changed makes this a
// no-op unless the checked-out commit actually moved.
Schedule::command('wandermaeuse:post-deploy --if-changed')
    ->everyMinute()
    ->withoutOverlapping();

// Scheduled entries go live on their own. Idempotent: once an entry is
// published the update simply matches nothing.
Schedule::call(function () {
    Post::where('status', Post::STATUS_SCHEDULED)
        ->whereNotNull('published_at')
        ->where('published_at', '<=', now())
        ->update(['status' => Post::STATUS_PUBLISHED]);
})->everyMinute()->name('publish-scheduled-posts');

// The IP hash exists only to rate-limit comments; after a week it is useless
// to us and the privacy policy promises it is gone. Idempotent, so running it
// on every tick costs one indexed update that usually matches nothing - far
// cheaper than the chance of missing the only tick of the day.
Schedule::call(function () {
    Comment::whereNotNull('ip_hash')
        ->where('created_at', '<', now()->subDays(7))
        ->update(['ip_hash' => null]);
})->everyMinute()->name('prune-comment-ip-hashes');

// New comments go to every admin in one mail per tick. Idempotent: a comment
// is marked once it has been mailed, so a tick without news sends nothing.
Schedule::command('wandermaeuse:notify-comments')
    ->everyMinute()
    ->withoutOverlapping();

// Same reasoning: weekly() would hang on a single minute per week.
Schedule::command('queue:prune-failed --hours=336')->everyMinute();
