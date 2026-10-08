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

export type StopProps = {
    id: number;
    name: string;
    slug: string;
    country: string;
    lat: number;
    lng: number;
    arrivedOn: string | null;
    position: number;
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

export type PostCard = {
    id: number;
    title: string;
    slug: string;
    excerpt: string | null;
    publishedAt: string | null;
    readingMinutes: number;
    stop: { name: string; country: string } | null;
    cover: ImageProps | null;
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
