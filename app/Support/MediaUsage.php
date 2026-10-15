<?php

namespace App\Support;

use App\Models\Post;

/**
 * Wo ein Bild vorkommt: als Aufmacher oder in einem Abschnitt eines Eintrags,
 * oder als Titelbild der Startseite. Die Bilderverwaltung zeigt damit, was in
 * Gebrauch ist, bevor jemand etwas loescht.
 *
 * Bilder in Abschnitten stehen im JSON der Bloecke, nicht in einer
 * Fremdschluesselspalte - deshalb wird hier ueber die Bloecke gelaufen statt
 * per Query gesucht. Bei einem Reiseblog sind das wenige hundert Zeilen.
 */
class MediaUsage
{
    /**
     * @param  list<int>  $ids
     * @return array<int, list<array{label: string, url: string}>> Nur Bilder, die vorkommen.
     */
    public static function of(array $ids): array
    {
        $wanted = array_flip($ids);
        $usage = [];

        $add = function (?int $id, string $label, string $url) use (&$usage, $wanted) {
            if ($id !== null && isset($wanted[$id])) {
                // Nach URL geschluesselt: ein Bild, das in einem Eintrag
                // zweimal vorkommt, steht dort trotzdem nur einmal.
                $usage[$id][$url] = ['label' => $label, 'url' => $url];
            }
        };

        $add(HomeHero::chosen()?->id, 'Startseite', '/admin/startseite');

        Post::query()
            ->select(['id', 'title', 'cover_media_id'])
            ->with('blocks:id,post_id,type,data,position')
            ->orderBy('title')
            ->get()
            ->each(function (Post $post) use ($add) {
                $url = "/admin/eintraege/{$post->id}";
                $add($post->cover_media_id, $post->title, $url);

                foreach ($post->blocks as $block) {
                    foreach ($block->mediaIds() as $id) {
                        $add($id, $post->title, $url);
                    }
                }
            });

        return array_map(array_values(...), $usage);
    }
}
