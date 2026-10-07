import { Button, inputClass } from '@/Components/Admin/Ui';
import MediaPicker, { MultiMediaPicker } from '@/Components/Admin/MediaPicker';
import RichText from '@/Components/Admin/RichText';
import type { BlockType, ImageProps } from '@/types';

export type EditorBlock = {
    key: string;
    type: BlockType;
    data: Record<string, unknown>;
};

export type BlockTypeOption = {
    value: BlockType;
    label: string;
    blank: Record<string, unknown>;
};

type Props = {
    blocks: EditorBlock[];
    onChange: (blocks: EditorBlock[]) => void;
    blockTypes: BlockTypeOption[];
    library: ImageProps[];
};

export default function BlockEditor({ blocks, onChange, blockTypes, library }: Props) {
    const add = (option: BlockTypeOption) => {
        onChange([
            ...blocks,
            {
                key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: option.value,
                // Structured clone so two blocks of the same type never end up
                // sharing one data object.
                data: structuredClone(option.blank),
            },
        ]);
    };

    const patch = (index: number, data: Record<string, unknown>) => {
        const next = [...blocks];
        next[index] = { ...next[index], data: { ...next[index].data, ...data } };
        onChange(next);
    };

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= blocks.length) return;
        const next = [...blocks];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const remove = (index: number) => {
        if (!window.confirm('Diesen Abschnitt wirklich entfernen?')) return;
        onChange(blocks.filter((_, i) => i !== index));
    };

    return (
        <div>
            <ol className="flex flex-col gap-4">
                {blocks.map((block, index) => {
                    const label = blockTypes.find((t) => t.value === block.type)?.label ?? block.type;

                    return (
                        <li key={block.key} className="border border-hairline bg-paper">
                            <div className="hairline-b flex items-center justify-between gap-3 bg-paper-dim px-4 py-2">
                                <span className="label-xs text-graphite">
                                    {String(index + 1).padStart(2, '0')} · {label}
                                </span>
                                <div className="flex gap-2">
                                    <IconButton label="Nach oben" onClick={() => move(index, -1)} disabled={index === 0}>
                                        ↑
                                    </IconButton>
                                    <IconButton
                                        label="Nach unten"
                                        onClick={() => move(index, 1)}
                                        disabled={index === blocks.length - 1}
                                    >
                                        ↓
                                    </IconButton>
                                    <IconButton label="Entfernen" onClick={() => remove(index)}>
                                        ✕
                                    </IconButton>
                                </div>
                            </div>

                            <div className="p-4">
                                <BlockFields
                                    block={block}
                                    library={library}
                                    patch={(data) => patch(index, data)}
                                />
                            </div>
                        </li>
                    );
                })}
            </ol>

            <div className="mt-6 border border-dashed border-hairline p-4">
                <p className="label-xs mb-3 text-graphite">Abschnitt hinzufügen</p>
                <div className="flex flex-wrap gap-2">
                    {blockTypes.map((option) => (
                        <Button key={option.value} variant="ghost" onClick={() => add(option)}>
                            {option.label}
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function BlockFields({
    block,
    library,
    patch,
}: {
    block: EditorBlock;
    library: ImageProps[];
    patch: (data: Record<string, unknown>) => void;
}) {
    const str = (key: string) => (block.data[key] as string) ?? '';
    const num = (key: string) => (block.data[key] as number | null) ?? null;

    switch (block.type) {
        case 'text':
            return <RichText value={str('html')} onChange={(html) => patch({ html })} />;

        case 'heading':
            return (
                <div className="grid gap-4 md:grid-cols-3">
                    <input
                        className={`${inputClass} md:col-span-2`}
                        placeholder="Überschrift"
                        value={str('text')}
                        onChange={(e) => patch({ text: e.target.value })}
                    />
                    <input
                        className={inputClass}
                        placeholder="Kleines Label (optional)"
                        value={str('label')}
                        onChange={(e) => patch({ label: e.target.value })}
                    />
                </div>
            );

        case 'image_full':
            return (
                <div className="grid gap-4">
                    <MediaPicker library={library} selected={num('media_id')} onSelect={(id) => patch({ media_id: id })} />
                    <input
                        className={inputClass}
                        placeholder="Bildunterschrift (optional)"
                        value={str('caption')}
                        onChange={(e) => patch({ caption: e.target.value })}
                    />
                    <label className="label-xs flex items-center gap-2 text-graphite">
                        <input
                            type="checkbox"
                            checked={block.data.bleed !== false}
                            onChange={(e) => patch({ bleed: e.target.checked })}
                        />
                        Randlos über die volle Breite
                    </label>
                </div>
            );

        case 'image_text':
            return (
                <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <MediaPicker library={library} selected={num('media_id')} onSelect={(id) => patch({ media_id: id })} />
                        <div>
                            <span className="label-xs block text-graphite">Bild steht</span>
                            <select
                                className={`${inputClass} mt-2`}
                                value={str('variant') || 'left'}
                                onChange={(e) => patch({ variant: e.target.value })}
                            >
                                <option value="left">links, Text rechts</option>
                                <option value="right">rechts, Text links</option>
                            </select>
                            <span className="label-xs mt-4 block text-graphite">Bildgröße</span>
                            <select
                                className={`${inputClass} mt-2`}
                                value={str('size') || 'medium'}
                                onChange={(e) => patch({ size: e.target.value })}
                            >
                                <option value="small">klein (ein Drittel)</option>
                                <option value="medium">mittel</option>
                                <option value="large">groß (gut die Hälfte)</option>
                            </select>
                            <input
                                className={`${inputClass} mt-4`}
                                placeholder="Bildunterschrift (optional)"
                                value={str('caption')}
                                onChange={(e) => patch({ caption: e.target.value })}
                            />
                        </div>
                    </div>
                    <RichText value={str('html')} onChange={(html) => patch({ html })} />
                </div>
            );

        case 'image_pair':
            return (
                <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <MediaPicker
                            label="Linkes Bild"
                            library={library}
                            selected={num('left_media_id')}
                            onSelect={(id) => patch({ left_media_id: id })}
                        />
                        <MediaPicker
                            label="Rechtes Bild"
                            library={library}
                            selected={num('right_media_id')}
                            onSelect={(id) => patch({ right_media_id: id })}
                        />
                    </div>
                    <input
                        className={inputClass}
                        placeholder="Bildunterschrift (optional)"
                        value={str('caption')}
                        onChange={(e) => patch({ caption: e.target.value })}
                    />
                </div>
            );

        case 'gallery':
            return (
                <div className="grid gap-4">
                    <MultiMediaPicker
                        library={library}
                        selected={(block.data.media_ids as number[]) ?? []}
                        onChange={(media_ids) => patch({ media_ids })}
                    />
                    <input
                        className={inputClass}
                        placeholder="Bildunterschrift (optional)"
                        value={str('caption')}
                        onChange={(e) => patch({ caption: e.target.value })}
                    />
                </div>
            );

        case 'quote':
            return (
                <div className="grid gap-4">
                    <textarea
                        className={inputClass}
                        rows={3}
                        placeholder="Zitat"
                        value={str('text')}
                        onChange={(e) => patch({ text: e.target.value })}
                    />
                    <input
                        className={inputClass}
                        placeholder="Wer hat das gesagt? (optional)"
                        value={str('attribution')}
                        onChange={(e) => patch({ attribution: e.target.value })}
                    />
                </div>
            );

        case 'divider':
            return (
                <input
                    className={inputClass}
                    placeholder="Zeichen in der Mitte, z. B. ✳ (optional)"
                    value={str('glyph')}
                    onChange={(e) => patch({ glyph: e.target.value })}
                />
            );

        default:
            return null;
    }
}

function IconButton({
    children,
    label,
    onClick,
    disabled = false,
}: {
    children: string;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className="flex h-8 w-8 items-center justify-center border border-hairline bg-paper text-sm hover:bg-ink hover:text-paper disabled:opacity-30 disabled:hover:bg-paper disabled:hover:text-ink"
        >
            {children}
        </button>
    );
}
