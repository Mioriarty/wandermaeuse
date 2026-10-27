import { useState } from 'react';
import { inputClass } from '@/Components/Admin/Ui';
import MediaPicker, { MultiMediaPicker } from '@/Components/Admin/MediaPicker';
import RichText from '@/Components/Admin/RichText';
import BlockTypeDialog from '@/Components/Admin/BlockTypeDialog';
import { convertBlock } from '@/Components/Admin/blockConversion';
import type { BlockType } from '@/types';

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
};

export default function BlockEditor({ blocks, onChange, blockTypes }: Props) {
    // Which dialog is open: adding a section before `index`, or converting
    // the section at `index` into another pattern.
    const [dialog, setDialog] = useState<{ mode: 'add' | 'convert'; index: number } | null>(null);

    const blankFor = (type: BlockType) => blockTypes.find((t) => t.value === type)?.blank ?? {};

    const insert = (index: number, type: BlockType) => {
        const next = [...blocks];
        next.splice(index, 0, {
            key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type,
            // Structured clone so two blocks of the same type never end up
            // sharing one data object.
            data: structuredClone(blankFor(type)),
        });
        onChange(next);
    };

    const convert = (index: number, type: BlockType) => {
        const block = blocks[index];
        const next = [...blocks];
        next[index] = { ...block, type, data: convertBlock(block.type, block.data, type, blankFor(type)).data };
        onChange(next);
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

    const converting = dialog?.mode === 'convert' ? blocks[dialog.index] : null;

    return (
        <div>
            <ol>
                {blocks.map((block, index) => {
                    const label = blockTypes.find((t) => t.value === block.type)?.label ?? block.type;

                    return (
                        <li key={block.key}>
                            <Inserter onClick={() => setDialog({ mode: 'add', index })} />

                            <div className="border border-hairline bg-paper">
                                <div className="hairline-b flex items-center justify-between gap-3 bg-paper-dim px-4 py-2">
                                    <span className="label-xs text-graphite">
                                        {String(index + 1).padStart(2, '0')} · {label}
                                    </span>
                                    <div className="flex gap-2">
                                        <IconButton label="Typ ändern" onClick={() => setDialog({ mode: 'convert', index })}>
                                            ⇄
                                        </IconButton>
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
                                    <BlockFields block={block} patch={(data) => patch(index, data)} />
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>

            <Inserter
                onClick={() => setDialog({ mode: 'add', index: blocks.length })}
                text={blocks.length === 0 ? 'Ersten Abschnitt hinzufügen' : undefined}
            />

            {dialog?.mode === 'add' && (
                <BlockTypeDialog
                    title="Abschnitt hinzufügen"
                    options={blockTypes}
                    onPick={(type) => insert(dialog.index, type)}
                    onClose={() => setDialog(null)}
                />
            )}

            {dialog?.mode === 'convert' && converting && (
                <BlockTypeDialog
                    title="Abschnitt umwandeln"
                    options={blockTypes}
                    current={converting.type}
                    lossesFor={(type) =>
                        convertBlock(converting.type, converting.data, type, blankFor(type)).losses
                    }
                    onPick={(type) => convert(dialog.index, type)}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    );
}

/** The small plus between sections; opens the dialog to add one right here. */
function Inserter({ onClick, text }: { onClick: () => void; text?: string }) {
    return (
        <div className="group relative flex justify-center py-1.5">
            <span
                aria-hidden
                className="absolute inset-x-0 top-1/2 border-t border-dashed border-ink/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            />
            <button
                type="button"
                onClick={onClick}
                aria-label={text ?? 'Abschnitt hier einfügen'}
                title={text ?? 'Abschnitt hier einfügen'}
                className="relative flex h-7 min-w-7 items-center justify-center gap-2 border border-hairline bg-paper px-1.5 text-graphite transition-colors hover:border-ink hover:bg-ink hover:text-paper"
            >
                <span aria-hidden className="text-base leading-none">
                    +
                </span>
                {text && <span className="label-xs pr-1">{text}</span>}
            </button>
        </div>
    );
}

function BlockFields({
    block,
    patch,
}: {
    block: EditorBlock;
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
                    <MediaPicker selected={num('media_id')} onSelect={(id) => patch({ media_id: id })} />
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
                    <MultiMediaPicker
                        title="Bilder neben dem Text"
                        selected={(block.data.media_ids as number[]) ?? []}
                        onChange={(media_ids) => patch({ media_ids })}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <span className="label-xs block text-graphite">Bilder stehen</span>
                            <select
                                className={`${inputClass} mt-2`}
                                value={str('variant') || 'left'}
                                onChange={(e) => patch({ variant: e.target.value })}
                            >
                                <option value="left">links, Text rechts</option>
                                <option value="right">rechts, Text links</option>
                            </select>
                        </div>
                        <div>
                            <span className="label-xs block text-graphite">Bildgröße</span>
                            <select
                                className={`${inputClass} mt-2`}
                                value={str('size') || 'medium'}
                                onChange={(e) => patch({ size: e.target.value })}
                            >
                                <option value="small">klein (ein Drittel)</option>
                                <option value="medium">mittel</option>
                                <option value="large">groß (gut die Hälfte)</option>
                            </select>
                        </div>
                    </div>
                    <input
                        className={inputClass}
                        placeholder="Bildunterschrift unter allen Bildern (optional)"
                        value={str('caption')}
                        onChange={(e) => patch({ caption: e.target.value })}
                    />
                    <RichText value={str('html')} onChange={(html) => patch({ html })} />
                </div>
            );

        case 'image_pair':
            return (
                <div className="grid gap-4">
                    <MultiMediaPicker
                        title="Bildpaar wählen"
                        max={2}
                        slotLabels={['Links', 'Rechts']}
                        selected={[num('left_media_id'), num('right_media_id')].filter((id) => id !== null)}
                        onChange={(ids) => patch({ left_media_id: ids[0] ?? null, right_media_id: ids[1] ?? null })}
                    />
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
                        title="Bilder für die Galerie"
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
            title={label}
            onClick={onClick}
            disabled={disabled}
            className="flex h-8 w-8 items-center justify-center border border-hairline bg-paper text-sm hover:bg-ink hover:text-paper disabled:opacity-30 disabled:hover:bg-paper disabled:hover:text-ink"
        >
            {children}
        </button>
    );
}
