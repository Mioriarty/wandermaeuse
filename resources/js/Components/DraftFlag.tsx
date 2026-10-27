/**
 * Marks an entry readers cannot see yet. Only someone logged in ever gets one
 * listed, so the flag is what keeps a draft from passing for a live entry.
 */
export default function DraftFlag({ label }: { label: string | null }) {
    if (!label) return null;

    return <span className="label-xs bg-accent px-2 py-1 text-paper">{label}</span>;
}
