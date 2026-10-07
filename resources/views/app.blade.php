<!DOCTYPE html>
<html lang="de" class="antialiased">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#fcfcfb">

    @php($seo = \App\Support\Seo::get())
    @php($title = $seo['title'] ?? 'Wandermäuse')
    @php($description = $seo['description'] ?? 'Ein Reiseblog über unsere Reise durch Süd- und Mittelamerika – mit Karte und Bildern.')

    <title>{{ $title === 'Wandermäuse' ? $title : $title.' – Wandermäuse' }}</title>
    <meta name="description" content="{{ $description }}">
    <link rel="canonical" href="{{ $seo['url'] ?? url()->current() }}">
    @if($seo['noindex'] ?? false)
        {{-- Vorschau eines unveroeffentlichten Eintrags: darf nie in einen
             Index geraten, auch wenn der Link einmal geteilt wird. --}}
        <meta name="robots" content="noindex, nofollow">
    @endif

    {{-- Server-rendered so link previews work without SSR. --}}
    <meta property="og:site_name" content="Wandermäuse">
    <meta property="og:locale" content="de_DE">
    <meta property="og:type" content="{{ $seo['type'] ?? 'website' }}">
    <meta property="og:title" content="{{ $title }}">
    <meta property="og:description" content="{{ $description }}">
    <meta property="og:url" content="{{ $seo['url'] ?? url()->current() }}">
    @isset($seo['image'])
        <meta property="og:image" content="{{ $seo['image'] }}">
        <meta name="twitter:card" content="summary_large_image">
    @else
        <meta name="twitter:card" content="summary">
    @endisset
    @isset($seo['publishedAt'])
        <meta property="article:published_time" content="{{ $seo['publishedAt'] }}">
    @endisset

    <link rel="alternate" type="application/rss+xml" title="Wandermäuse" href="{{ route('feed') }}">

    @routes
    {{-- Die @font-face-Regeln der selbst gehosteten Schriften. Ohne diese Zeile
         baut Vite die Schriftdateien zwar, verlinkt sie aber nirgends: die
         Seite faellt dann still auf ui-serif zurueck, und das sieht auf jedem
         Geraet anders aus. Steht vor @vite, damit die Preloads frueh kommen. --}}
    {{ Illuminate\Support\Facades\Vite::fonts() }}

    {{-- Muss vor @vite stehen: sonst findet @vitejs/plugin-react im Dev-Modus
         seine Preamble nicht und die Seite hydratisiert nie. --}}
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="min-h-screen bg-paper text-ink">
    @inertia
</body>
</html>
