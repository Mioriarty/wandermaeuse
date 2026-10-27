import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { LibraryImage } from '@/types';

type Library = {
    images: LibraryImage[];
    /** Puts freshly uploaded pictures at the front, newest first. */
    add: (images: LibraryImage[]) => void;
};

const LibraryContext = createContext<Library | null>(null);

/**
 * The pictures every picker on the page chooses from. One shared list, so a
 * picture uploaded through one picker turns up in all the others at once.
 *
 * The page's own prop stays the source: after the next save it carries the
 * uploads anyway, and anything uploaded since is kept in front of it.
 */
export function MediaLibraryProvider({ initial, children }: { initial: LibraryImage[]; children: ReactNode }) {
    const [added, setAdded] = useState<LibraryImage[]>([]);

    const images = useMemo(() => {
        const known = new Set(initial.map((image) => image.id));
        return [...added.filter((image) => !known.has(image.id)), ...initial];
    }, [added, initial]);

    const add = useCallback((fresh: LibraryImage[]) => {
        setAdded((current) => [...fresh, ...current.filter((image) => !fresh.some((f) => f.id === image.id))]);
    }, []);

    const value = useMemo(() => ({ images, add }), [images, add]);

    return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useMediaLibrary(): Library {
    const library = useContext(LibraryContext);
    if (!library) throw new Error('useMediaLibrary needs a MediaLibraryProvider around it.');
    return library;
}

/**
 * Uploads one picture and hands it back. Plain XHR rather than an Inertia
 * visit: a visit would re-render the editor, and XHR is what reports progress.
 * One file per request also keeps each one well inside the host's time limit,
 * since the variants are made while the request waits.
 */
export function uploadImage(file: File, onProgress: (fraction: number) => void): Promise<LibraryImage> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/admin/bilder');
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        const token = xsrfToken();
        if (token) xhr.setRequestHeader('X-XSRF-TOKEN', token);

        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
        xhr.onerror = () => reject(new Error('Keine Verbindung zum Server.'));
        xhr.onload = () => {
            const body = parse(xhr.responseText);
            if (xhr.status === 201 && body?.media?.[0]) {
                resolve(body.media[0]);
            } else if (xhr.status === 413) {
                reject(new Error('Die Datei ist zu groß für den Server.'));
            } else if (xhr.status === 419) {
                reject(new Error('Die Sitzung ist abgelaufen. Lade die Seite neu.'));
            } else {
                const first = body?.errors ? Object.values(body.errors)[0]?.[0] : null;
                reject(new Error(first ?? 'Hochladen fehlgeschlagen.'));
            }
        };

        const data = new FormData();
        data.append('files[]', file);
        xhr.send(data);
    });
}

/** Laravel leaves the CSRF token in this cookie for exactly this purpose. */
function xsrfToken(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

type UploadResponse = { media?: LibraryImage[]; errors?: Record<string, string[]> };

function parse(text: string): UploadResponse | null {
    try {
        return JSON.parse(text) as UploadResponse;
    } catch {
        return null;
    }
}
