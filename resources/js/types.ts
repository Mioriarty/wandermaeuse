export type ImageProps = {
    id: number;
    src: string;
    srcset: string;
    jpegSrcset: string;
    width: number;
    height: number;
    aspectRatio: number;
    dominantColor: string;
    alt: string;
    caption: string | null;
};

/** A picture as the admin's picker sees it: with the file name to search by. */
export type LibraryImage = ImageProps & { originalName: string | null };

export type StopProps = {
    id: number;
    name: string;
    slug: string;
    country: string;
    lat: number;
    lng: number;
    arrivedOn: string | null;
    /** Leer heisst: nur der Ankunftstag ist bekannt. */
    departedOn: string | null;
    position: number;
    /** Schon angekommen. Die oeffentliche Seite bekommt nur solche Stationen. */
    started: boolean;
    /** Hier sind wir heute. Hoechstens eine Station, unterwegs keine. */
    current: boolean;
};

export type CompositionProps = {
    id: number;
    title: string;
    description: string | null;
    audioUrl: string | null;
    durationSeconds: number;
    scoreUrl: string | null;
    scoreIsPdf: boolean;
};

export type BlockType =
    | 'text'
    | 'heading'
    | 'image_full'
    | 'image_text'
    | 'image_pair'
    | 'gallery'
    | 'quote'
    | 'divider';

export type BlockProps = {
    id: number;
    type: BlockType;
    data: Record<string, unknown>;
    images: ImageProps[];
};

/** Die Tage, von denen ein Eintrag erzaehlt, als Y-m-d. Ein einzelner Tag hat from === until. */
export type PostPeriod = { from: string; until: string };

export type PostCard = {
    id: number;
    title: string;
    slug: string;
    excerpt: string | null;
    publishedAt: string | null;
    period: PostPeriod | null;
    readingMinutes: number;
    stop: { name: string; country: string } | null;
    cover: ImageProps | null;
    /** "Entwurf" or "Geplant" - only ever set for someone logged in. */
    previewLabel: string | null;
};

export type CommentImageProps = {
    id: number;
    src: string;
    thumb: string;
    width: number;
    height: number;
};

export type CommentProps = {
    id: number;
    authorName: string;
    body: string;
    createdAt: string | null;
    /** Only set when a reply answers another reply, not the thread's first comment. */
    replyToName: string | null;
    images: CommentImageProps[];
    /** Always empty on a reply: threads are one level deep. */
    replies: CommentProps[];
};

export type SharedProps = {
    auth: { user: { id: number; name: string; email: string } | null };
    flash: { success: string | null; error: string | null };
    seo: Record<string, string>;
};

export type BookingKindOption = { value: string; label: string; transport: boolean };

/** Eine Unterkunft, ein Workaway oder eine Nachtfahrt. checkOut ist der Abreisetag, selbst keine Nacht mehr. */
export type BookingProps = {
    id: number;
    kind: string;
    title: string;
    location: string | null;
    stopId: number | null;
    stopName: string | null;
    url: string | null;
    checkIn: string;
    checkOut: string;
    nights: number;
    status: 'planned' | 'booked';
    paid: boolean;
    /** Wie bezahlt, als Dezimalzahl-String ("180.00"). */
    priceAmount: string | null;
    currency: string | null;
    priceEurCents: number | null;
    notes: string | null;
};

export type NightState = 'booked' | 'planned' | 'missing';

export type NightProps = {
    date: string;
    state: NightState;
    bookingIds: number[];
    doubleBooked: boolean;
};

/** Zusammenhaengende Naechte; until ist die letzte Nacht, nicht der Morgen danach. */
export type NightRun = { from: string; until: string; nights: number; state: string };

export type NightsAhead = {
    from: string;
    until: string;
    missing: number;
    planned: number;
    doubleBooked: number;
    gaps: NightRun[];
    conflicts: NightRun[];
};
