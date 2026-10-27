import { Head, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import MediaPicker from '@/Components/Admin/MediaPicker';
import { MediaLibraryProvider, useMediaLibrary } from '@/Components/Admin/MediaLibrary';
import { Button, Panel } from '@/Components/Admin/Ui';
import type { ImageProps, LibraryImage } from '@/types';

type Props = {
    mediaId: number | null;
    /** Was ohne eigene Wahl zu sehen wäre: das neueste Aufmacherfoto. */
    fallback: ImageProps | null;
    mediaLibrary: LibraryImage[];
};

export default function AdminHome({ mediaLibrary, ...props }: Props) {
    return (
        <MediaLibraryProvider initial={mediaLibrary}>
            <HomeSettings {...props} />
        </MediaLibraryProvider>
    );
}

function HomeSettings({ mediaId, fallback }: Omit<Props, 'mediaLibrary'>) {
    const { data, setData, put, processing, isDirty } = useForm({ media_id: mediaId });
    // From the shared library, so a picture just uploaded in the picker shows.
    const { images } = useMediaLibrary();

    const chosen = images.find((m) => m.id === data.media_id) ?? null;
    // Die gleiche Regel wie auf der Startseite: eigene Wahl, sonst Aufmacher.
    const shown = chosen ?? fallback;

    return (
        <AdminLayout title="Startseite">
            <Head title="Startseite" />

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    put('/admin/startseite', { preserveScroll: true });
                }}
                className="grid gap-6 lg:grid-cols-2"
            >
                <Panel
                    title="Titelbild"
                    footer={
                        <div className="flex items-center gap-4">
                            <Button type="submit" disabled={processing || !isDirty}>
                                {processing ? 'Speichert …' : 'Speichern'}
                            </Button>
                            {isDirty && (
                                <span className="text-xs text-graphite">Noch nicht gespeichert.</span>
                            )}
                        </div>
                    }
                >
                    <p className="mb-5 text-sm leading-relaxed text-graphite">
                        Das Foto über die volle Höhe, mit dem die Seite öffnet. Ohne eigene Wahl zeigt sie
                        das Aufmacherfoto des neuesten Eintrags – dann wechselt das Titelbild von selbst
                        mit jedem neuen Eintrag mit.
                    </p>

                    <MediaPicker
                        selected={data.media_id}
                        onSelect={(id) => setData('media_id', id)}
                        label="Eigenes Titelbild"
                    />

                    {data.media_id === null && (
                        <p className="mt-4 text-xs leading-relaxed text-graphite">
                            {fallback
                                ? 'Kein eigenes Bild gewählt – die Startseite nimmt das Aufmacherfoto des neuesten Eintrags.'
                                : 'Kein eigenes Bild gewählt, und es gibt noch keinen Eintrag mit Aufmacherfoto. Die Startseite öffnet solange mit einer leeren Fläche.'}
                        </p>
                    )}
                </Panel>

                <Panel title="Vorschau">
                    {/*
                      Grob der Ausschnitt der Startseite: das Bild füllt dort die
                      Höhe des Fensters, der Titel steht links darauf. Genau
                      lässt es sich nur auf der Seite selbst beurteilen, aber der
                      Bildausschnitt ist hier schon zu sehen.
                    */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-paper-deep">
                        {shown && (
                            <img src={shown.src} alt={shown.alt} className="h-full w-full object-cover" />
                        )}
                        <div
                            aria-hidden
                            className="absolute inset-0"
                            style={{
                                backgroundImage:
                                    'linear-gradient(to right, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.28) 30%,' +
                                    ' rgba(0,0,0,0.08) 55%, rgba(0,0,0,0) 75%),' +
                                    ' linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 30%,' +
                                    ' rgba(0,0,0,0.1) 65%, rgba(0,0,0,0.45) 100%)',
                            }}
                        />
                        <div className="absolute inset-0 flex flex-col justify-center px-5">
                            <p className="font-display text-4xl leading-none text-white">Wandermäuse</p>
                            <p className="label-xs mt-3 text-white/85">
                                Ein Reisetagebuch aus Süd- und Mittelamerika
                            </p>
                        </div>
                    </div>

                    <p className="mt-4 text-xs text-graphite">
                        {chosen
                            ? 'Eigenes Titelbild.'
                            : fallback
                              ? 'Aufmacherfoto des neuesten Eintrags.'
                              : 'Noch kein Bild.'}
                    </p>
                </Panel>
            </form>
        </AdminLayout>
    );
}
