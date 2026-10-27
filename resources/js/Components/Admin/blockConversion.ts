import type { BlockType } from '@/types';

type Data = Record<string, unknown>;

/**
 * Everything a block can hold, independent of the pattern that lays it out.
 * A conversion reads the old block into this and writes the new one out of
 * it, so each pattern only has to be described once in each direction.
 */
type Content = {
    images: number[];
    html: string;
    heading: string;
    label: string;
    quote: string;
    attribution: string;
    caption: string;
    glyph: string;
};

/** What each pattern has room for. */
const room: Record<BlockType, { images: number; text: 'rich' | 'plain' | null; caption: boolean }> = {
    text: { images: 0, text: 'rich', caption: false },
    heading: { images: 0, text: 'plain', caption: false },
    image_full: { images: 1, text: null, caption: true },
    image_text: { images: Infinity, text: 'rich', caption: true },
    image_pair: { images: 2, text: null, caption: true },
    gallery: { images: Infinity, text: null, caption: true },
    quote: { images: 0, text: 'plain', caption: false },
    divider: { images: 0, text: null, caption: false },
};

/**
 * Turns a block into another pattern, keeping as much as the new pattern has
 * room for: a gallery becoming "Bildpaar" keeps its first two pictures,
 * a text becoming a quote keeps its words but not their formatting. `losses`
 * names what does not survive, so the editor can say so before it happens.
 */
export function convertBlock(
    type: BlockType,
    data: Data,
    target: BlockType,
    blank: Data,
): { data: Data; losses: string[] } {
    const content = read(type, data);

    return {
        data: { ...structuredClone(blank), ...write(target, content) },
        losses: losses(content, target),
    };
}

function read(type: BlockType, data: Data): Content {
    const str = (key: string) => (typeof data[key] === 'string' ? (data[key] as string).trim() : '');
    const ids = (values: unknown[]) =>
        values.map((value) => (value === null || value === '' ? NaN : Number(value))).filter(Number.isInteger);
    const html = str('html');

    return {
        images: Array.isArray(data.media_ids)
            ? ids(data.media_ids)
            : ids([data.media_id, data.left_media_id, data.right_media_id]),
        html: plain(html) === '' ? '' : html,
        heading: type === 'heading' ? str('text') : '',
        label: type === 'heading' ? str('label') : '',
        quote: type === 'quote' ? str('text') : '',
        attribution: type === 'quote' ? str('attribution') : '',
        caption: str('caption'),
        glyph: type === 'divider' ? str('glyph') : '',
    };
}

function write(target: BlockType, c: Content): Data {
    switch (target) {
        case 'text':
            return { html: richText(c) };
        case 'heading':
            return { text: c.heading || c.quote || plain(c.html), label: c.label };
        case 'image_full':
            return { media_id: c.images[0] ?? null, caption: c.caption };
        case 'image_text':
            return { media_ids: c.images, html: richText(c), caption: c.caption };
        case 'image_pair':
            return { left_media_id: c.images[0] ?? null, right_media_id: c.images[1] ?? null, caption: c.caption };
        case 'gallery':
            return { media_ids: c.images, caption: c.caption };
        case 'quote':
            return { text: c.quote || c.heading || plain(c.html), attribution: c.attribution };
        case 'divider':
            return { glyph: c.glyph };
    }
}

function losses(c: Content, target: BlockType): string[] {
    const fits = room[target];
    const lost: string[] = [];

    const kept = Math.min(c.images.length, fits.images);
    if (kept < c.images.length) {
        if (kept === 0) {
            lost.push(c.images.length === 1 ? 'Das Bild' : `Alle ${c.images.length} Bilder`);
        } else {
            const stays = kept === 1 ? 'nur das erste bleibt' : `nur die ersten ${kept === 2 ? 'beiden' : kept} bleiben`;
            lost.push(`${c.images.length - kept} der ${c.images.length} Bilder – ${stays}`);
        }
    }

    const body = c.html ? 'Der Text' : c.heading ? 'Die Überschrift' : c.quote ? 'Das Zitat' : null;
    if (body && fits.text === null) lost.push(body);
    if (c.html && fits.text === 'plain' && formatted(c.html)) lost.push('Absätze und Formatierung des Texts');

    if (c.label && target !== 'heading') lost.push('Das kleine Label');
    if (c.attribution && target !== 'quote' && fits.text !== 'rich') lost.push('Die Quellenangabe');
    if (c.caption && !fits.caption) lost.push('Die Bildunterschrift');
    if (c.glyph && target !== 'divider') lost.push('Das Zeichen des Trenners');

    return lost;
}

/** The text of a block as editor HTML; RichText knows no headings, so a heading becomes bold. */
function richText(c: Content): string {
    return [
        c.heading && `<p><strong>${escape(c.heading)}</strong></p>`,
        c.html,
        c.quote && `<p>${escape(c.quote)}</p>`,
        c.attribution && `<p>— ${escape(c.attribution)}</p>`,
    ]
        .filter(Boolean)
        .join('');
}

/** More than one paragraph, or any markup beyond paragraphs (bold, links, lists …). */
function formatted(html: string): boolean {
    return (html.match(/<p[\s>]/g) ?? []).length > 1 || /<(?!\/?p[\s>])[a-z/]/i.test(html);
}

function plain(html: string): string {
    return html
        .replace(/<\/(p|li)>|<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

function escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
