import { useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { formatShortDate } from '@/lib/format';
import type { CommentImageProps, CommentProps } from '@/types';

// Mirrors CommentController. The server checks again; this only saves the
// reader an upload that would be refused anyway.
const MAX_IMAGES = 3;
const MAX_BYTES = 10 * 1024 * 1024;
// Listing the types (rather than image/*) makes iOS hand over HEIC photos
// already converted to JPEG.
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type Props = {
    postSlug: string;
    comments: CommentProps[];
};

export default function CommentSection({ postSlug, comments }: Props) {
    const { data, setData, post, processing, progress, errors, clearErrors, reset, wasSuccessful } = useForm({
        author_name: '',
        author_email: '',
        body: '',
        reply_to: null as number | null,
        images: [] as File[],
        // Honeypot: a real person never fills this in, bots fill in everything.
        website: '',
    });
    const [replyTo, setReplyTo] = useState<CommentProps | null>(null);
    const [imageNotice, setImageNotice] = useState<string | null>(null);
    const [viewing, setViewing] = useState<CommentImageProps | null>(null);
    const formRef = useRef<HTMLFormElement | null>(null);
    const bodyFieldRef = useRef<HTMLDivElement | null>(null);
    const bodyRef = useRef<HTMLTextAreaElement | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);

    const total = comments.reduce((n, comment) => n + 1 + comment.replies.length, 0);

    // Errors for single files arrive as images.0, images.1 ...
    const imageErrors = [
        ...new Set(
            Object.entries(errors as Record<string, string | undefined>)
                .filter(([key]) => key === 'images' || key.startsWith('images.'))
                .map(([, message]) => message)
                .filter((message): message is string => !!message),
        ),
    ];

    const startReply = (comment: CommentProps) => {
        // Render the notice now, so the scroll below already counts its height.
        flushSync(() => setReplyTo(comment));
        setData('reply_to', comment.id);
        clearErrors('reply_to');

        // On a phone the whole form is taller than the screen; centring it
        // would hide its top under the header. Then the part that matters -
        // the notice and the text field - goes in the middle instead.
        const form = formRef.current;
        const target = form && form.offsetHeight <= window.innerHeight * 0.85 ? form : bodyFieldRef.current;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        bodyRef.current?.focus({ preventScroll: true });
    };

    const cancelReply = () => {
        setReplyTo(null);
        setData('reply_to', null);
        clearErrors('reply_to');
    };

    const addImages = (list: FileList | null) => {
        if (!list) return;
        const incoming = Array.from(list);
        const fitting = incoming.filter((f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_BYTES);
        const room = MAX_IMAGES - data.images.length;

        if (incoming.some((f) => f.size > MAX_BYTES)) {
            setImageNotice('Ein Bild ist größer als 10 MB und wurde weggelassen.');
        } else if (fitting.length < incoming.length) {
            setImageNotice('Bitte nur Fotos als JPEG, PNG oder WebP.');
        } else if (fitting.length > room) {
            setImageNotice(`Höchstens ${MAX_IMAGES} Bilder pro Kommentar.`);
        } else {
            setImageNotice(null);
        }

        setData('images', [...data.images, ...fitting.slice(0, Math.max(0, room))]);
        // Lets the same file be picked again after it was removed.
        if (fileRef.current) fileRef.current.value = '';
    };

    const removeImage = (index: number) => {
        setData(
            'images',
            data.images.filter((_, i) => i !== index),
        );
        setImageNotice(null);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/blog/${postSlug}/kommentare`, {
            preserveScroll: true,
            onSuccess: () => {
                reset('body', 'website', 'images', 'reply_to');
                setReplyTo(null);
                setImageNotice(null);
            },
        });
    };

    return (
        <section aria-label="Kommentare" className="mx-auto max-w-5xl px-5 sm:px-8">
            <h2 className="label-xs hairline-b pb-3 text-graphite">
                {total === 0 ? 'Kommentare' : `${total} ${total === 1 ? 'Kommentar' : 'Kommentare'}`}
            </h2>

            {comments.length > 0 && (
                <ul className="mt-8 flex flex-col gap-8">
                    {comments.map((comment) => (
                        <li key={comment.id} className="grid gap-2 sm:grid-cols-12 sm:gap-x-6">
                            <CommentMeta comment={comment} className="sm:col-span-3" />
                            <div className="sm:col-span-9">
                                <CommentContent comment={comment} onReply={startReply} onView={setViewing} />
                            </div>

                            {comment.replies.length > 0 && (
                                <ul
                                    aria-label={`Antworten auf ${comment.authorName}`}
                                    className="mt-2 flex flex-col gap-6 border-l border-hairline pl-5 sm:col-span-9 sm:col-start-4 sm:pl-6"
                                >
                                    {comment.replies.map((reply) => (
                                        <li key={reply.id} className="flex flex-col gap-2">
                                            <CommentMeta comment={reply} />
                                            <CommentContent comment={reply} onReply={startReply} onView={setViewing} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <form ref={formRef} onSubmit={submit} className="mt-12 border border-ink">
                <div className="hairline-b px-5 py-4 sm:px-6">
                    <h3 className="font-display text-2xl font-medium leading-none">Schreib uns etwas</h3>
                    <p className="mt-1 text-sm text-graphite">
                        Dein Kommentar erscheint sofort. Die E-Mail-Adresse ist freiwillig und wird nie
                        veröffentlicht.
                    </p>
                </div>

                <div className="grid gap-px bg-hairline sm:grid-cols-2">
                    <Field
                        label="Name"
                        value={data.author_name}
                        onChange={(v) => setData('author_name', v)}
                        error={errors.author_name}
                        required
                        autoComplete="name"
                    />
                    <Field
                        label="E-Mail (optional)"
                        type="email"
                        value={data.author_email}
                        onChange={(v) => setData('author_email', v)}
                        error={errors.author_email}
                        autoComplete="email"
                    />
                </div>

                <div ref={bodyFieldRef} className="hairline-t bg-paper px-5 py-4 sm:px-6">
                    <label className="label-xs block text-graphite" htmlFor="comment-body">
                        Kommentar
                    </label>

                    {replyTo && (
                        <div
                            id="comment-reply-to"
                            className="relative mt-2 border border-hairline bg-paper-dim py-3 pr-12 pl-4"
                        >
                            <p className="label-xs text-graphite">
                                Antwort an <span className="text-ink">{replyTo.authorName}</span>
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{replyTo.body}</p>
                            <button
                                type="button"
                                onClick={cancelReply}
                                aria-label="Doch nicht antworten"
                                className="absolute top-0 right-0 flex h-11 w-11 items-center justify-center text-graphite transition-colors hover:text-ink"
                            >
                                <CrossIcon />
                            </button>
                        </div>
                    )}
                    {errors.reply_to && <p className="mt-2 text-sm text-accent">{errors.reply_to}</p>}

                    <textarea
                        ref={bodyRef}
                        id="comment-body"
                        rows={5}
                        required
                        value={data.body}
                        onChange={(e) => setData('body', e.target.value)}
                        aria-describedby={replyTo ? 'comment-reply-to' : undefined}
                        className="mt-2 w-full resize-y border border-hairline bg-paper px-3 py-2 text-base focus:border-ink focus:outline-none"
                    />
                    {errors.body && <p className="mt-2 text-sm text-accent">{errors.body}</p>}
                </div>

                <div className="hairline-t bg-paper px-5 py-4 sm:px-6">
                    <p className="label-xs text-graphite">
                        Bilder (optional)
                    </p>
                    <p className="mt-1 text-sm text-graphite" id="comment-images-hint">
                        Bis zu {MAX_IMAGES} Fotos, je höchstens 10 MB. Ortsangaben und andere Metadaten
                        entfernen wir beim Hochladen.
                    </p>

                    {data.images.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Ausgewählte Bilder">
                            {data.images.map((file, i) => (
                                <Preview
                                    key={`${i}-${file.name}-${file.lastModified}`}
                                    file={file}
                                    onRemove={() => removeImage(i)}
                                />
                            ))}
                        </ul>
                    )}

                    {data.images.length < MAX_IMAGES && (
                        <label className="label-xs mt-3 inline-flex min-h-11 cursor-pointer items-center border border-hairline px-4 transition-colors hover:border-ink focus-within:border-ink">
                            Bild hinzufügen
                            <input
                                ref={fileRef}
                                type="file"
                                accept={ACCEPTED_TYPES.join(',')}
                                multiple
                                onChange={(e) => addImages(e.target.files)}
                                aria-describedby="comment-images-hint"
                                className="sr-only"
                            />
                        </label>
                    )}

                    {imageNotice && <p className="mt-2 text-sm text-accent">{imageNotice}</p>}
                    {imageErrors.map((message) => (
                        <p key={message} className="mt-2 text-sm text-accent">
                            {message}
                        </p>
                    ))}
                </div>

                {/* Hidden from people, visible to bots. */}
                <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                    <label htmlFor="website">Website</label>
                    <input
                        id="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={data.website}
                        onChange={(e) => setData('website', e.target.value)}
                    />
                </div>

                <div className="hairline-t flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                    {wasSuccessful ? (
                        <p role="status" className="text-sm text-graphite">
                            Danke, dein Kommentar steht oben.
                        </p>
                    ) : (
                        <span />
                    )}
                    <button
                        type="submit"
                        disabled={processing}
                        className="label-xs min-h-11 bg-ink px-6 text-paper transition-colors hover:bg-accent disabled:opacity-40"
                    >
                        {processing
                            ? progress?.percentage !== undefined && progress.percentage < 100
                                ? `Lädt hoch … ${progress.percentage} %`
                                : 'Wird gesendet …'
                            : 'Abschicken'}
                    </button>
                </div>
            </form>

            <ImageViewer image={viewing} onClose={() => setViewing(null)} />
        </section>
    );
}

function CommentMeta({ comment, className = '' }: { comment: CommentProps; className?: string }) {
    return (
        <div className={className}>
            <p className="text-sm font-semibold">{comment.authorName}</p>
            <p className="mt-0.5 text-xs text-graphite">
                {comment.replyToName && <>an {comment.replyToName} · </>}
                {formatShortDate(comment.createdAt)}
            </p>
        </div>
    );
}

function CommentContent({
    comment,
    onReply,
    onView,
}: {
    comment: CommentProps;
    onReply: (comment: CommentProps) => void;
    onView: (image: CommentImageProps) => void;
}) {
    return (
        <>
            <p className="text-[1.0625rem] leading-relaxed whitespace-pre-line text-ink-soft">{comment.body}</p>

            {comment.images.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                    {comment.images.map((image, i) => (
                        <li key={image.id}>
                            <button
                                type="button"
                                onClick={() => onView(image)}
                                aria-label={`Bild ${i + 1} von ${comment.authorName} vergrößern`}
                                className="block bg-paper-dim"
                            >
                                <img
                                    src={image.thumb}
                                    alt=""
                                    width={image.width}
                                    height={image.height}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-24 w-24 object-cover sm:h-32 sm:w-32"
                                />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <button
                type="button"
                onClick={() => onReply(comment)}
                className="label-xs mt-1 -ml-2 min-h-11 self-start px-2 text-graphite transition-colors hover:text-ink"
            >
                Antworten
            </button>
        </>
    );
}

function Preview({ file, onRemove }: { file: File; onRemove: () => void }) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    return (
        <li className="relative h-24 w-24 bg-paper-dim">
            {url && <img src={url} alt="" className="h-full w-full object-cover" />}
            <button
                type="button"
                onClick={onRemove}
                aria-label={`${file.name} entfernen`}
                className="absolute top-0 right-0 flex h-11 w-11 items-start justify-end p-1"
            >
                <span className="flex h-6 w-6 items-center justify-center bg-ink text-paper">
                    <CrossIcon />
                </span>
            </button>
        </li>
    );
}

/**
 * A photo from a comment at full size. Native <dialog>: Escape closes it and
 * focus stays inside while it is open.
 */
function ImageViewer({ image, onClose }: { image: CommentImageProps | null; onClose: () => void }) {
    const ref = useRef<HTMLDialogElement | null>(null);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (image && !dialog.open) dialog.showModal();
        if (!image && dialog.open) dialog.close();
    }, [image]);

    return (
        <dialog
            ref={ref}
            onClose={onClose}
            // A click outside the photo lands on the dialog itself.
            onClick={(e) => e.target === ref.current && ref.current.close()}
            aria-label="Bild"
            className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-ink/90"
        >
            {image && (
                <img
                    src={image.src}
                    alt=""
                    width={image.width}
                    height={image.height}
                    className="h-auto max-h-[90vh] w-auto max-w-[95vw] object-contain"
                />
            )}
            <button
                type="button"
                onClick={() => ref.current?.close()}
                aria-label="Schließen"
                className="fixed top-2 right-2 flex h-11 w-11 items-center justify-center text-paper"
            >
                <CrossIcon />
            </button>
        </dialog>
    );
}

function CrossIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 1l12 12M13 1L1 13" />
        </svg>
    );
}

function Field({
    label,
    value,
    onChange,
    error,
    type = 'text',
    required = false,
    autoComplete,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    required?: boolean;
    autoComplete?: string;
}) {
    const id = `field-${label.replace(/\W+/g, '-').toLowerCase()}`;

    return (
        <div className="bg-paper px-5 py-4 sm:px-6">
            <label className="label-xs block text-graphite" htmlFor={id}>
                {label}
            </label>
            <input
                id={id}
                type={type}
                required={required}
                autoComplete={autoComplete}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="mt-2 w-full border border-hairline bg-paper px-3 py-2 text-base focus:border-ink focus:outline-none"
            />
            {error && <p className="mt-2 text-sm text-accent">{error}</p>}
        </div>
    );
}
