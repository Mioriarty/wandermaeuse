<x-mail::message>
# {{ count($entries) === 1 ? 'Ein neuer Kommentar' : count($entries).' neue Kommentare' }}

@foreach ($entries as $entry)
**{{ $entry['authorName'] }}**@if ($entry['authorEmail']) ({{ $entry['authorEmail'] }})@endif
@if ($entry['replyToName']) antwortet {{ $entry['replyToName'] }}@endif
@if ($entry['postUrl']) zu [{{ $entry['postTitle'] }}]({{ $entry['postUrl'] }})@endif<br>
{{ $entry['createdAt'] }}@if ($entry['imageCount']) · {{ $entry['imageCount'] === 1 ? 'mit einem Foto' : 'mit '.$entry['imageCount'].' Fotos' }}@endif

<x-mail::panel>
<div>{!! $entry['bodyHtml'] !!}</div>
</x-mail::panel>

@endforeach
<x-mail::button :url="$adminUrl">
Alle Kommentare ansehen
</x-mail::button>
</x-mail::message>
