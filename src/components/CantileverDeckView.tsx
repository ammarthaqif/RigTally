import React, { useMemo, useState } from 'react';
import {
  Layers,
  Plus,
  Ban,
  RotateCcw,
  Trash2,
  ClipboardPaste,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type {
  DeckJointItem,
  LayerPickupOrder,
  TallyConfig,
  TallyRowInput,
} from '../types/tally';
import {
  COMMON_CONNECTIONS,
  autoPopulateTallyFromDeck,
  createId,
  formatNum,
  getTargetShoeDepth,
} from '../utils/tallyEngine';
import { NumericInput } from './NumericInput';

interface CantileverDeckViewProps {
  config: TallyConfig;
  deckJoints: DeckJointItem[];
  onChangeDeckJoints: (joints: DeckJointItem[]) => void;
  onUpdateConfig: (patch: Partial<TallyConfig>) => void;
  onApplyAutoTally: (rows: TallyRowInput[]) => void;
}

export const CantileverDeckView: React.FC<CantileverDeckViewProps> = ({
  config,
  deckJoints,
  onChangeDeckJoints,
  onUpdateConfig,
  onApplyAutoTally,
}) => {
  const unit = config.lengthUnit;

  // Quick layer entry state
  const [entryLayer, setEntryLayer] = useState<number>(() => {
    const maxLayer = deckJoints.reduce((m, j) => Math.max(m, j.layer), 1);
    return maxLayer;
  });
  const [entryLength, setEntryLength] = useState('');
  const [entryTopConn, setEntryTopConn] = useState('');
  const [entryBotConn, setEntryBotConn] = useState('');
  const [entrySerial, setEntrySerial] = useState('');
  const [pasteBoxOpen, setPasteBoxOpen] = useState(false);
  const [pasteLayer, setPasteLayer] = useState(1);
  const [pasteText, setPasteText] = useState('');

  // Auto-populate configuration
  const [pickupOrder, setPickupOrder] = useState<LayerPickupOrder>('top-layer-first');
  const [shoeLength, setShoeLength] = useState(unit === 'm' ? 0.65 : 2.1);
  const [collarLength, setCollarLength] = useState(unit === 'm' ? 0.58 : 1.9);
  const [shoeTrackJointCount, setShoeTrackJointCount] = useState(1);
  const [hangerLength, setHangerLength] = useState(unit === 'm' ? 2.15 : 7.0);
  const [pupListStr, setPupListStr] = useState(unit === 'm' ? '6.10, 3.05, 1.52' : '20, 10, 5');
  const [useRemainingDeckForLanding, setUseRemainingDeckForLanding] = useState(true);
  const [landingJointMeasuredLength, setLandingJointMeasuredLength] = useState(
    unit === 'm' ? 12.15 : 40.0
  );

  const nextDeckJointNo = useMemo(() => {
    return deckJoints.reduce((max, j) => Math.max(max, j.jointNo), 0) + 1;
  }, [deckJoints]);

  const parsedPups = useMemo(() => {
    return pupListStr
      .split(/[,;\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }, [pupListStr]);

  const planPreview = useMemo(() => {
    return autoPopulateTallyFromDeck({
      config,
      deckJoints,
      pickupOrder,
      shoeLength,
      collarLength,
      shoeTrackJointCount,
      hangerLength,
      availablePupLengths: parsedPups,
      useRemainingDeckForLanding,
      landingJointMeasuredLength,
    });
  }, [
    config,
    deckJoints,
    pickupOrder,
    shoeLength,
    collarLength,
    shoeTrackJointCount,
    hangerLength,
    parsedPups,
    useRemainingDeckForLanding,
    landingJointMeasuredLength,
  ]);

  const layers = useMemo(() => {
    const map = new Map<number, DeckJointItem[]>();
    for (const j of deckJoints) {
      const arr = map.get(j.layer) ?? [];
      arr.push(j);
      map.set(j.layer, arr);
    }
    const entries = Array.from(map.entries()).sort((a, b) =>
      pickupOrder === 'top-layer-first' ? b[0] - a[0] : a[0] - b[0]
    );
    for (const [, list] of entries) {
      list.sort((a, b) => a.jointNo - b.jointNo);
    }
    return entries;
  }, [deckJoints, pickupOrder]);

  const activeCount = deckJoints.filter((j) => !j.discarded).length;
  const discardedCount = deckJoints.filter((j) => j.discarded).length;
  const targetShoeDepth = getTargetShoeDepth(config);

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const len = Number(entryLength);
    if (!Number.isFinite(len) || len <= 0) return;
    const item: DeckJointItem = {
      id: createId(),
      jointNo: nextDeckJointNo,
      layer: Math.max(1, Math.floor(entryLayer)),
      measuredLength: len,
      topConnection: entryTopConn.trim(),
      bottomConnection: entryBotConn.trim(),
      serialNo: entrySerial.trim(),
      remarks: '',
      discarded: false,
      discardReason: '',
    };
    onChangeDeckJoints([...deckJoints, item]);
    setEntryLength('');
    setEntrySerial('');
  };

  const handlePasteLayer = () => {
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    let nextNo = nextDeckJointNo;
    const additions: DeckJointItem[] = [];

    for (const line of lines) {
      const cells = line.split(/[\t,;]+|\s+/).map((c) => c.trim());
      const nums = cells.map((c) => Number(c)).filter((n) => Number.isFinite(n) && n > 0);
      if (nums.length === 0) continue;

      let jNo = nextNo;
      let len = nums[0];
      let serial = '';

      if (cells.length >= 2 && Number.isInteger(Number(cells[0])) && Number(cells[1]) > 0) {
        jNo = Number(cells[0]);
        len = Number(cells[1]);
        serial = cells[2] ?? '';
      } else if (cells.length >= 2 && Number(cells[0]) > 0 && !Number.isFinite(Number(cells[1]))) {
        len = Number(cells[0]);
        serial = cells[1];
      }

      additions.push({
        id: createId(),
        jointNo: jNo,
        layer: Math.max(1, Math.floor(pasteLayer)),
        measuredLength: len,
        topConnection: entryTopConn.trim(),
        bottomConnection: entryBotConn.trim(),
        serialNo: serial,
        remarks: '',
        discarded: false,
        discardReason: '',
      });
      nextNo = Math.max(nextNo + 1, jNo + 1);
    }

    if (additions.length > 0) {
      onChangeDeckJoints([...deckJoints, ...additions]);
      setPasteText('');
      setPasteBoxOpen(false);
    }
  };

  const toggleDiscard = (id: string) => {
    onChangeDeckJoints(
      deckJoints.map((j) =>
        j.id === id
          ? {
              ...j,
              discarded: !j.discarded,
              discardReason:
                !j.discarded && !j.discardReason ? 'Rejected on deck inspection' : j.discardReason,
            }
          : j
      )
    );
  };

  const updateDeckItem = (id: string, patch: Partial<DeckJointItem>) => {
    onChangeDeckJoints(deckJoints.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  };

  const deleteDeckItem = (id: string) => {
    onChangeDeckJoints(deckJoints.filter((j) => j.id === id));
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Left 7 cols: Cantilever Deck Layer-by-Layer Pipe Rack */}
      <div className="space-y-4 lg:col-span-7">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Cantilever Deck Layer-by-Layer Rack
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Active: <strong className="font-mono text-slate-900">{activeCount}</strong> jts ·
                Rejected: <strong className="font-mono text-red-700">{discardedCount}</strong> jts
                (joint numbering preserved)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPasteBoxOpen((v) => !v)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Paste Layer
              </button>
              <select
                value={pickupOrder}
                onChange={(e) => setPickupOrder(e.target.value as LayerPickupOrder)}
                aria-label="Deck pickup order"
                className="min-h-[36px] rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-sky-600 focus:outline-none"
              >
                <option value="top-layer-first">Pick Up: Top Layer → Bottom</option>
                <option value="bottom-layer-first">Pick Up: Bottom Layer → Top</option>
              </select>
            </div>
          </div>

          {/* Add Single Joint to Layer */}
          <form onSubmit={handleAddSingle} className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="sm:w-20">
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Layer</label>
              <NumericInput
                integer
                min={1}
                fallbackValue={1}
                aria-label="Deck entry layer"
                value={entryLayer}
                onChangeValue={(val) => {
                  if (val !== null) setEntryLayer(val);
                }}
                className="h-10 w-full rounded-md border border-slate-300 px-2.5 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
            <div className="sm:w-36">
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                Jt #{nextDeckJointNo} Length ({unit})
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0.1"
                value={entryLength}
                onChange={(e) => setEntryLength(e.target.value)}
                placeholder={`e.g. ${unit === 'm' ? '12.18' : '40.10'}`}
                className="h-10 w-full rounded-md border border-sky-300 px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
            <div className="sm:w-28">
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                Top Conn
              </label>
              <input
                type="text"
                value={entryTopConn}
                onChange={(e) => setEntryTopConn(e.target.value)}
                list="deck-conn-list"
                placeholder={config.topConnection || config.connection || 'Top'}
                className="h-10 w-full rounded-md border border-slate-300 px-2.5 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
            <div className="sm:w-28">
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                Btm Conn
              </label>
              <input
                type="text"
                value={entryBotConn}
                onChange={(e) => setEntryBotConn(e.target.value)}
                list="deck-conn-list"
                placeholder={config.bottomConnection || config.connection || 'Btm'}
                className="h-10 w-full rounded-md border border-slate-300 px-2.5 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
              <datalist id="deck-conn-list">
                {COMMON_CONNECTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="col-span-2 sm:flex-1">
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                Serial / Heat # (Optional)
              </label>
              <input
                type="text"
                value={entrySerial}
                onChange={(e) => setEntrySerial(e.target.value)}
                placeholder="Serial #"
                className="h-10 w-full rounded-md border border-slate-300 px-2.5 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
            <div className="col-span-2 sm:self-end">
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-sky-700 px-4 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Add to Layer {entryLayer}
              </button>
            </div>
          </form>

          {/* Multi-joint Layer Paste Drawer */}
          {pasteBoxOpen && (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700">
                  Paste measurements into Layer:
                </span>
                <NumericInput
                  integer
                  min={1}
                  fallbackValue={1}
                  aria-label="Paste target layer"
                  value={pasteLayer}
                  onChangeValue={(val) => {
                    if (val !== null) setPasteLayer(val);
                  }}
                  className="h-8 w-20 rounded border border-slate-300 bg-white px-2 font-mono text-xs"
                />
              </div>
              <textarea
                rows={4}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste 1 length per line (e.g. 12.18) or JointNo[tab]Length"
                className="w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs focus:border-sky-600 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasteBoxOpen(false)}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePasteLayer}
                  className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800"
                >
                  Add to Layer {pasteLayer}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stacked Layer Cards */}
        {layers.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No joints stacked on the cantilever deck yet. Add or paste joints above.
          </div>
        ) : (
          <div className="space-y-3">
            {layers.map(([layerNum, items], idx) => {
              const activeInLayer = items.filter((i) => !i.discarded);
              const layerSum = activeInLayer.reduce((s, i) => s + i.measuredLength, 0);
              return (
                <div
                  key={layerNum}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-sky-700" />
                      <span className="font-display text-xs font-semibold text-slate-900">
                        Layer {layerNum}
                      </span>
                      <span className="text-xs text-slate-500">
                        {idx === 0
                          ? `(${pickupOrder === 'top-layer-first' ? 'Next to Pick Up' : 'First to Pick Up'})`
                          : ''}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-slate-600 tabular-nums">
                      {activeInLayer.length}/{items.length} active · {layerSum.toFixed(2)} {unit}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const picked = planPreview.pickedDeckJointIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs ${
                            item.discarded ? 'bg-red-50/50' : 'bg-white'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`w-12 font-mono font-semibold tabular-nums ${
                                item.discarded ? 'text-red-700 line-through' : 'text-slate-900'
                              }`}
                            >
                              Jt #{item.jointNo}
                            </span>
                            <NumericInput
                              step="0.001"
                              min={0.1}
                              fallbackValue={item.measuredLength}
                              value={item.measuredLength}
                              onChangeValue={(val) => {
                                if (val !== null) updateDeckItem(item.id, { measuredLength: val });
                              }}
                              aria-label={`Deck joint ${item.jointNo} length`}
                              className={`w-22 rounded border border-slate-200 px-2 py-1 text-right font-mono font-medium tabular-nums focus:border-sky-600 focus:outline-none ${
                                item.discarded ? 'text-slate-400 line-through' : 'text-slate-900'
                              }`}
                            />
                            <span className="font-mono text-slate-500">{unit}</span>
                            <input
                              type="text"
                              value={item.topConnection ?? item.connection ?? ''}
                              placeholder={config.topConnection || config.connection || 'Top'}
                              onChange={(e) =>
                                updateDeckItem(item.id, { topConnection: e.target.value })
                              }
                              list="deck-conn-list"
                              aria-label={`Deck joint ${item.jointNo} top connection`}
                              title="Top Connection"
                              className="w-20 rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={item.bottomConnection ?? item.connection ?? ''}
                              placeholder={config.bottomConnection || config.connection || 'Btm'}
                              onChange={(e) =>
                                updateDeckItem(item.id, { bottomConnection: e.target.value })
                              }
                              list="deck-conn-list"
                              aria-label={`Deck joint ${item.jointNo} bottom connection`}
                              title="Bottom Connection"
                              className="w-20 rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                            />
                            {item.serialNo && (
                              <span className="hidden font-mono text-slate-500 sm:inline">
                                · {item.serialNo}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {item.discarded ? (
                              <input
                                type="text"
                                value={item.discardReason}
                                onChange={(e) =>
                                  updateDeckItem(item.id, { discardReason: e.target.value })
                                }
                                placeholder="Reject reason..."
                                className="w-36 rounded border border-red-200 bg-white px-2 py-1 text-[11px] text-red-800 focus:border-red-500 focus:outline-none"
                              />
                            ) : (
                              <span className="text-[11px] font-medium text-slate-500">
                                {picked ? 'In Tally' : 'Spare'}
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => toggleDiscard(item.id)}
                              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                                item.discarded
                                  ? 'border-red-300 bg-red-100 text-red-800 hover:bg-red-200'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800'
                              }`}
                            >
                              {item.discarded ? (
                                <>
                                  <RotateCcw className="h-3 w-3" />
                                  Restore
                                </>
                              ) : (
                                <>
                                  <Ban className="h-3 w-3" />
                                  Reject
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteDeckItem(item.id)}
                              title="Remove joint from deck"
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right 5 cols: Target TD, Hanger/Landing & Auto-Populate Running Tally */}
      <div className="space-y-4 lg:col-span-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Auto-Populate Running Tally
          </h2>

          {/* Section TD & Shoe Off-TD */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Section TD ({unit})
              </label>
              <NumericInput
                step="0.1"
                min={0}
                fallbackValue={0}
                value={config.sectionTd}
                onChangeValue={(val) => {
                  if (val !== null) {
                    onUpdateConfig({
                      sectionTd: val,
                      targetDepth: Math.max(0, val - (config.shoeOffTd || 0)),
                    });
                  }
                }}
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Off TD ({unit})
              </label>
              <NumericInput
                step="0.1"
                min={0}
                fallbackValue={0}
                value={config.shoeOffTd}
                onChangeValue={(val) => {
                  if (val !== null) {
                    onUpdateConfig({
                      shoeOffTd: val,
                      targetDepth: Math.max(0, (config.sectionTd || 0) - val),
                    });
                  }
                }}
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">Shoe Target</div>
              <div className="flex h-[34px] items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                {targetShoeDepth.toFixed(2)} {unit}
              </div>
            </div>
          </div>

          {/* Shoe Track Assembly */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Shoe Len ({unit})
              </label>
              <NumericInput
                step="0.01"
                min={0}
                fallbackValue={0}
                value={shoeLength}
                onChangeValue={(val) => {
                  if (val !== null) setShoeLength(val);
                }}
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Collar Len ({unit})
              </label>
              <NumericInput
                step="0.01"
                min={0}
                fallbackValue={0}
                value={collarLength}
                onChangeValue={(val) => {
                  if (val !== null) setCollarLength(val);
                }}
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Shoe Track Jts
              </label>
              <NumericInput
                integer
                min={0}
                max={5}
                fallbackValue={1}
                value={shoeTrackJointCount}
                onChangeValue={(val) => {
                  if (val !== null) setShoeTrackJointCount(val);
                }}
                className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Available Pup Joints */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Available Pup Joints on Deck ({unit}, comma-separated)
            </label>
            <input
              type="text"
              value={pupListStr}
              onChange={(e) => setPupListStr(e.target.value)}
              placeholder="6.10, 3.05, 1.52"
              className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>

          {/* Hanger & Landing String Section */}
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3.5">
            <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold text-slate-800">
              <span>Include Hanger &amp; Landing String</span>
              <input
                type="checkbox"
                checked={config.hasHanger}
                onChange={(e) => onUpdateConfig({ hasHanger: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
              />
            </label>

            {config.hasHanger && (
              <div className="space-y-3 border-t border-slate-200 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Hanger Depth ({unit})
                    </label>
                    <NumericInput
                      step="0.01"
                      min={0}
                      fallbackValue={0}
                      value={config.hangerDepth}
                      onChangeValue={(val) => {
                        if (val !== null) onUpdateConfig({ hangerDepth: val });
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Hanger Len ({unit})
                    </label>
                    <NumericInput
                      step="0.01"
                      min={0}
                      fallbackValue={0}
                      value={hangerLength}
                      onChangeValue={(val) => {
                        if (val !== null) setHangerLength(val);
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Cmt Stickup ({unit})
                    </label>
                    <NumericInput
                      step="0.05"
                      min={0}
                      fallbackValue={0}
                      value={config.hangerStickupTarget}
                      onChangeValue={(val) => {
                        if (val !== null) onUpdateConfig({ hangerStickupTarget: val });
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={useRemainingDeckForLanding}
                      onChange={(e) => setUseRemainingDeckForLanding(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700"
                    />
                    <span>Use remaining deck joints as Landing Joints</span>
                  </label>

                  {!useRemainingDeckForLanding && (
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-600">
                        Dedicated Landing Joint Len ({unit}):
                      </label>
                      <NumericInput
                        step="0.01"
                        min={1}
                        fallbackValue={12}
                        value={landingJointMeasuredLength}
                        onChangeValue={(val) => {
                          if (val !== null) setLandingJointMeasuredLength(val);
                        }}
                        className="w-24 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Live Space-Out Forecast */}
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Generated Tally Pieces</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {planPreview.rows.length} pcs ({planPreview.unusedDeckJointCount} deck jts spare)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Projected Shoe Depth</span>
              <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums">
                {Math.abs(planPreview.belowHangerDelta) <= 0.5 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                )}
                <span className="text-slate-900">
                  {formatNum(planPreview.projectedShoeDepth, 2)} {unit}
                </span>
                <span className="text-slate-500">
                  (Δ {planPreview.belowHangerDelta >= 0 ? '+' : ''}
                  {planPreview.belowHangerDelta.toFixed(2)})
                </span>
              </span>
            </div>
            {config.hasHanger && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Rig Floor Stick-Up (Cmt Head)</span>
                <span className="font-mono font-semibold text-sky-800 tabular-nums">
                  {planPreview.projectedStickup >= 0 ? '+' : ''}
                  {planPreview.projectedStickup.toFixed(2)} {unit}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={planPreview.rows.length === 0}
            onClick={() => onApplyAutoTally(planPreview.rows)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-50"
          >
            Auto-Populate Running Tally
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
