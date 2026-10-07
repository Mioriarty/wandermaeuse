<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SendCampaignChunk;
use App\Models\Campaign;
use App\Models\CampaignSend;
use App\Models\Post;
use App\Models\Subscriber;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NewsletterController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Newsletter', [
            'subscribers' => Subscriber::latest()->get()->map(fn (Subscriber $s) => [
                'id' => $s->id,
                'email' => $s->email,
                'confirmedAt' => $s->confirmed_at?->toIso8601String(),
                'unsubscribedAt' => $s->unsubscribed_at?->toIso8601String(),
                'createdAt' => $s->created_at?->toIso8601String(),
            ])->all(),
            'campaigns' => Campaign::with('post')->latest()->get()->map(fn (Campaign $c) => [
                'id' => $c->id,
                'subject' => $c->subject,
                'intro' => $c->intro,
                'status' => $c->status,
                'postTitle' => $c->post?->title,
                'postExcerpt' => $c->post?->excerpt,
                'recipientCount' => $c->recipient_count,
                'sentCount' => $c->sent_count,
                'sentAt' => $c->sent_at?->toIso8601String(),
            ])->all(),
            'posts' => Post::published()->with('stop')->latest('published_at')->get()->map(fn (Post $p) => [
                'id' => $p->id,
                'title' => $p->title,
                'excerpt' => $p->excerpt,
                'stop' => $p->stop ? ['name' => $p->stop->name, 'country' => $p->stop->country] : null,
            ])->all(),
            'mailableCount' => Subscriber::mailable()->count(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:180'],
            'intro' => ['nullable', 'string', 'max:4000'],
            'post_id' => ['nullable', 'exists:posts,id'],
        ]);

        Campaign::create([...$validated, 'status' => 'draft']);

        return back()->with('success', 'Newsletter als Entwurf gespeichert.');
    }

    public function update(Request $request, Campaign $campaign): RedirectResponse
    {
        if ($campaign->status !== 'draft') {
            return back()->with('error', 'Ein bereits versendeter Newsletter kann nicht geändert werden.');
        }

        $campaign->update($request->validate([
            'subject' => ['required', 'string', 'max:180'],
            'intro' => ['nullable', 'string', 'max:4000'],
            'post_id' => ['nullable', 'exists:posts,id'],
        ]));

        return back()->with('success', 'Entwurf gespeichert.');
    }

    /**
     * Queue the campaign.
     *
     * The recipient list is frozen into campaign_sends right now, so the job
     * that runs a minute later from cron mails exactly these people once -
     * even if it is retried or someone subscribes in the meantime.
     */
    public function send(Campaign $campaign): RedirectResponse
    {
        if ($campaign->status !== 'draft') {
            return back()->with('error', 'Dieser Newsletter wurde bereits versendet.');
        }

        $subscribers = Subscriber::mailable()->get();

        if ($subscribers->isEmpty()) {
            return back()->with('error', 'Es gibt noch keine bestätigten Empfänger.');
        }

        $rows = $subscribers->map(fn (Subscriber $s) => [
            'campaign_id' => $campaign->id,
            'subscriber_id' => $s->id,
        ])->all();

        CampaignSend::upsert($rows, ['campaign_id', 'subscriber_id'], []);

        $campaign->update([
            'status' => 'sending',
            'recipient_count' => $subscribers->count(),
        ]);

        SendCampaignChunk::dispatch($campaign->id);

        return back()->with('success', 'Der Newsletter wird nun nach und nach verschickt.');
    }

    public function destroy(Campaign $campaign): RedirectResponse
    {
        $campaign->delete();

        return back()->with('success', 'Newsletter gelöscht.');
    }

    public function destroySubscriber(Subscriber $subscriber): RedirectResponse
    {
        $subscriber->delete();

        return back()->with('success', 'Empfänger gelöscht.');
    }
}
