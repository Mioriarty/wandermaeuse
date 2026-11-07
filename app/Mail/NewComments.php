<?php

namespace App\Mail;

use App\Models\Comment;
use App\Support\NightCoverage;
use Illuminate\Bus\Queueable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NewComments extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  Collection<int, Comment>  $comments
     */
    public function __construct(public Collection $comments) {}

    public function envelope(): Envelope
    {
        $count = $this->comments->count();

        return new Envelope(
            subject: $count === 1
                ? 'Neuer Kommentar von '.$this->comments->first()->author_name
                : $count.' neue Kommentare',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.new-comments',
            with: [
                'entries' => $this->comments->map(fn (Comment $c) => [
                    'authorName' => $c->author_name,
                    'authorEmail' => $c->author_email,
                    // Our own clock on the road, the same one the booking
                    // calendar counts nights in.
                    'createdAt' => $c->created_at
                        ?->copy()->setTimezone(NightCoverage::TIMEZONE)
                        ->locale('de')->isoFormat('dd., D. MMMM YYYY, HH:mm [Uhr]'),
                    'replyToName' => $c->replyTo?->author_name,
                    'imageCount' => $c->images->count(),
                    // One line of escaped HTML: CommonMark leaves an HTML block
                    // alone, so a reader cannot slip links or headings into
                    // the mail through Markdown.
                    'bodyHtml' => str_replace(["\r\n", "\r", "\n"], '<br>', e($c->body)),
                    'postTitle' => $c->post?->title,
                    'postUrl' => $c->post ? url('/blog/'.$c->post->slug) : null,
                ])->all(),
                'adminUrl' => route('admin.comments.index'),
            ],
        );
    }
}
