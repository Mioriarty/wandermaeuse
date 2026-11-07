<?php

namespace App\Console\Commands;

use App\Mail\NewComments;
use App\Models\Comment;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class NotifyNewComments extends Command
{
    protected $signature = 'wandermaeuse:notify-comments';

    protected $description = 'Schickt allen Admins eine E-Mail mit den Kommentaren seit der letzten Benachrichtigung';

    public function handle(): int
    {
        $comments = Comment::whereNull('notified_at')
            ->with(['post', 'replyTo', 'images'])
            ->oldest()
            ->oldest('id')
            ->get();

        if ($comments->isEmpty()) {
            return self::SUCCESS;
        }

        $admins = User::pluck('email')->filter()->unique()->values();

        // Without anyone to tell, keep the comments pending for the first
        // admin account instead of marking them as read.
        if ($admins->isEmpty()) {
            $this->warn('Kein Admin-Konto, an das die Kommentare gehen könnten.');

            return self::SUCCESS;
        }

        // Sent right here, not queued: the queue only drains on the same
        // tick anyway, and a failure has to leave the comments pending so
        // the next tick tries again.
        Mail::to($admins->all())->send(new NewComments($comments));

        Comment::whereKey($comments->modelKeys())->update(['notified_at' => now()]);

        $this->info($comments->count().' Kommentar(e) gemeldet an '.$admins->implode(', '));

        return self::SUCCESS;
    }
}
