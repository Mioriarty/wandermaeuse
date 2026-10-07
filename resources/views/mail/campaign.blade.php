<x-mail::message>
@if ($intro)
{!! nl2br(e($intro)) !!}
@endif

@if ($post)
## {{ $post->title }}

{{-- A suggested intro already quotes the excerpt; do not print it twice. --}}
@if ($post->excerpt && ! str_contains((string) $intro, $post->excerpt))
{{ $post->excerpt }}
@endif

<x-mail::button :url="$postUrl">
Eintrag lesen
</x-mail::button>
@endif

Liebe Grüße
die Wandermäuse

<x-slot:subcopy>
Du bekommst diese E-Mail, weil du dich für unseren Reise-Newsletter angemeldet hast.
[Hier kannst du dich abmelden]({{ $unsubscribeUrl }}).
</x-slot:subcopy>
</x-mail::message>
