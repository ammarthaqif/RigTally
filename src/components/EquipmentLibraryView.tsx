import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  ScanText,
} from 'lucide-react';
import type {
  ComponentType,
  LengthUnit,
  LibraryItem,
  TallyConfig,
  TallyRecommendation,
} from '../types/tally';
import { COMMON_CONNECTIONS, convertLength, createId, formatNum } from '../utils/tallyEngine';
import { NumericInput } from './NumericInput';

interface EquipmentLibraryViewProps {
  config: TallyConfig;
  library: LibraryItem[];
  recommendations: TallyRecommendation[];
  onChangeLibrary: (next: LibraryItem[]) => void;
  onResetLibrary: () => void;
  onAddLibraryItemToTally: (item: LibraryItem, count?: number, insertAfterRowId?: string) => void;
  onApplyRecommendation: (rec: TallyRecommendation) => void;
  onOpenInspectionModal: () => void;
}

type CategoryFilter = 'all' | 'joint' | 'pup' | 'xo' | 'float' | 'inspection';

const CATEGORY_LABELS: Record<ComponentType, string> = {
  joint: 'Joint',
  pup: 'Pup Joint',
  xo: 'XO Sub',
  shoe: 'Float Shoe',
  collar: 'Float Collar',
  hanger: 'Hanger',
  landing: 'Landing Jt',
  bha: 'BHA',
};

export const EquipmentLibraryView: React.FC<EquipmentLibraryViewProps> = ({
  config,
  library,
  recommendations,
  onChangeLibrary,
  onResetLibrary,
  onAddLibraryItemToTally,
  onApplyRecommendation,
  onOpenInspectionModal,
}) => {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Add item form state
  const [newCategory, setNewCategory] = useState<ComponentType>('pup');
  const [newCode, setNewCode] = useState('');
  const [newSizeLabel, setNewSizeLabel] = useState(config.pipeSizeLabel);
  const [newSizeIn, setNewSizeIn] = useState<number>(config.pipeSizeIn);
  const [newWeight, setNewWeight] = useState<number>(config.weightLbFt);
  const [newGrade, setNewGrade] = useState(config.grade);
  const [newTopConn, setNewTopConn] = useState(config.topConnection || config.connection);
  const [newBotConn, setNewBotConn] = useState(config.bottomConnection || config.connection);
  const [newLen, setNewLen] = useState<number>(config.lengthUnit === 'm' ? 3.0 : 10.0);
  const [newUnit, setNewUnit] = useState<LengthUnit>(config.lengthUnit);
  const [newQty, setNewQty] = useState<number>(2);
  const [newSerial, setNewSerial] = useState('');
  const [newRemarks, setNewRemarks] = useState('');

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return library.filter((item) => {
      if (filter === 'joint' && item.category !== 'joint') return false;
      if (filter === 'pup' && item.category !== 'pup') return false;
      if (filter === 'xo' && item.category !== 'xo') return false;
      if (
        filter === 'float' &&
        !['shoe', 'collar', 'hanger', 'landing', 'bha'].includes(item.category)
      ) {
        return false;
      }
      if (filter === 'inspection' && item.source !== 'inspection') return false;

      if (!q) return true;
      return (
        item.itemCode.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.sizeLabel.toLowerCase().includes(q) ||
        item.grade.toLowerCase().includes(q) ||
        item.topConnection.toLowerCase().includes(q) ||
        item.bottomConnection.toLowerCase().includes(q) ||
        item.serialNo.toLowerCase().includes(q) ||
        item.remarks.toLowerCase().includes(q)
      );
    });
  }, [library, filter, search]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(newLen) || newLen <= 0) return;
    const code =
      newCode.trim() ||
      `${newCategory.toUpperCase()}-${newSizeLabel.replace(/[^0-9]/g, '')}-${Math.round(newLen * 100)}`;

    const connDisplay =
      newTopConn === newBotConn ? newTopConn : `${newBotConn} × ${newTopConn}`;

    const item: LibraryItem = {
      id: createId(),
      category: newCategory,
      itemCode: code,
      description: `${newSizeLabel}" ${newWeight}# ${newGrade} ${connDisplay} ${CATEGORY_LABELS[newCategory]} (${newLen.toFixed(2)} ${newUnit})`,
      sizeLabel: newSizeLabel.trim() || config.pipeSizeLabel,
      sizeIn: newSizeIn > 0 ? newSizeIn : config.pipeSizeIn,
      weightLbFt: newWeight > 0 ? newWeight : config.weightLbFt,
      grade: newGrade.trim(),
      topConnection: newTopConn.trim() || config.connection,
      bottomConnection: newBotConn.trim() || config.connection,
      measuredLength: newLen,
      lengthUnit: newUnit,
      quantityAvailable: Math.max(0, newQty),
      serialNo: newSerial.trim(),
      source: 'manual',
      remarks: newRemarks.trim() || 'Rig rack inventory',
    };

    onChangeLibrary([item, ...library]);
    setNewCode('');
    setNewSerial('');
    setNewRemarks('');
    setShowAddForm(false);
  };

  const adjustQty = (id: string, delta: number) => {
    onChangeLibrary(
      library.map((item) =>
        item.id === id
          ? { ...item, quantityAvailable: Math.max(0, item.quantityAvailable + delta) }
          : item
      )
    );
  };

  const deleteItem = (id: string) => {
    onChangeLibrary(library.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Auto-Recommended for Active String */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Auto-Recommended for {config.stringName}
            </h2>
            <p className="text-xs text-slate-500">
              Live matches from your library for active XO mismatches, Shoe Target space-out pups, and full-joint shortfalls.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenInspectionModal}
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 whitespace-nowrap self-start"
          >
            <ScanText className="h-3.5 w-3.5" />
            Import from Inspection Report
          </button>
        </div>

        {recommendations.length === 0 ? (
          <div className="py-5 text-center text-xs text-slate-500">
            Active tally currently has no pending XO mismatches, missing float gear, or space-out gaps matching library stock.
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((rec) => {
              const isCritical = rec.priority === 'critical';
              return (
                <div
                  key={rec.id}
                  className={`flex flex-col justify-between rounded-md border p-3 text-xs ${
                    isCritical
                      ? 'border-amber-200 bg-amber-50/70'
                      : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                        {isCritical && <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />}
                        {rec.title}
                      </span>
                      <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 border border-slate-200">
                        Qty {rec.libraryItem.quantityAvailable}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">{rec.reason}</p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-2">
                    <span className="font-mono text-[11px] text-slate-600">
                      {formatNum(
                        convertLength(
                          rec.libraryItem.measuredLength,
                          rec.libraryItem.lengthUnit,
                          config.lengthUnit
                        ),
                        2
                      )}{' '}
                      {config.lengthUnit} · {rec.libraryItem.weightLbFt}#
                    </span>
                    <button
                      type="button"
                      onClick={() => onApplyRecommendation(rec)}
                      className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold text-white whitespace-nowrap ${
                        isCritical
                          ? 'bg-amber-700 hover:bg-amber-800'
                          : 'bg-sky-700 hover:bg-sky-800'
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                      {rec.insertAfterRowId
                        ? 'Insert XO'
                        : rec.recommendedCount > 1
                          ? `Add ${rec.recommendedCount}× to Tally`
                          : 'Add to Tally'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Main Equipment Library Inventory */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `All (${library.length})` },
                {
                  id: 'joint',
                  label: `Joints (${library.filter((i) => i.category === 'joint').length})`,
                },
                {
                  id: 'pup',
                  label: `Pup Joints (${library.filter((i) => i.category === 'pup').length})`,
                },
                {
                  id: 'xo',
                  label: `Crossovers / XO (${library.filter((i) => i.category === 'xo').length})`,
                },
                {
                  id: 'float',
                  label: 'Float & Hanger',
                },
                {
                  id: 'inspection',
                  label: `From Reports (${library.filter((i) => i.source === 'inspection').length})`,
                },
              ] as Array<{ id: CategoryFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[190px] flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search size, conn, code..."
                className="h-[36px] w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 focus:border-sky-600 focus:outline-none sm:w-52"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex h-[36px] items-center gap-1.5 rounded-md bg-sky-700 px-3 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Library Item
            </button>

            {confirmReset ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onResetLibrary();
                    setConfirmReset(false);
                  }}
                  className="h-[36px] rounded-md bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 whitespace-nowrap"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="h-[36px] rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex h-[36px] items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Defaults
              </button>
            )}
          </div>
        </div>

        {/* Inline Add Item Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddItem}
            className="grid grid-cols-2 gap-2.5 border-b border-slate-200 bg-sky-50/40 p-4 text-xs sm:grid-cols-6 lg:grid-cols-12"
          >
            <label className="col-span-1 lg:col-span-2">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">Type</span>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ComponentType)}
                className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs"
              >
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-1 lg:col-span-2">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">Item Code</span>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. XO-958-BV"
                className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs"
              />
            </label>
            <label className="col-span-1 lg:col-span-1">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">Size (OD)</span>
              <input
                type="text"
                value={newSizeLabel}
                onChange={(e) => {
                  setNewSizeLabel(e.target.value);
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n > 0) setNewSizeIn(n);
                }}
                className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs"
              />
            </label>
            <label className="col-span-1 lg:col-span-1">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">lb/ft</span>
              <NumericInput
                value={newWeight}
                onChangeValue={(v) => setNewWeight(v ?? 0)}
                min={0.1}
                className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs"
              />
            </label>
            <label className="col-span-1 lg:col-span-1">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">Grade</span>
              <input
                type="text"
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs"
              />
            </label>
            <label className="col-span-1 lg:col-span-1">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">Top Conn</span>
              <input
                type="text"
                list="lib-conn-list"
                value={newTopConn}
                onChange={(e) => setNewTopConn(e.target.value)}
                className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs"
              />
            </label>
            <label className="col-span-1 lg:col-span-1">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">Bot Conn</span>
              <input
                type="text"
                list="lib-conn-list"
                value={newBotConn}
                onChange={(e) => setNewBotConn(e.target.value)}
                className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs"
              />
            </label>
            <label className="col-span-1 lg:col-span-1">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">Len</span>
              <NumericInput
                value={newLen}
                onChangeValue={(v) => setNewLen(v ?? 0)}
                min={0.05}
                className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs"
              />
            </label>
            <label className="col-span-1 lg:col-span-1">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">Unit</span>
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value as LengthUnit)}
                className="h-8 w-full rounded border border-slate-300 bg-white px-1.5 font-mono text-xs"
              >
                <option value="m">m</option>
                <option value="ft">ft</option>
              </select>
            </label>
            <label className="col-span-1 lg:col-span-1">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">Qty</span>
              <NumericInput
                value={newQty}
                onChangeValue={(v) => setNewQty(v ?? 1)}
                integer
                min={0}
                className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs"
              />
            </label>
            <div className="col-span-2 flex items-end gap-2 sm:col-span-6 lg:col-span-12">
              <input
                type="text"
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value)}
                placeholder="Serial / Heat No (optional)"
                className="h-8 w-44 rounded border border-slate-300 bg-white px-2 font-mono text-xs"
              />
              <input
                type="text"
                value={newRemarks}
                onChange={(e) => setNewRemarks(e.target.value)}
                placeholder="Notes / rack location"
                className="h-8 flex-1 rounded border border-slate-300 bg-white px-2 text-xs"
              />
              <button
                type="submit"
                className="h-8 rounded bg-sky-700 px-3.5 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
              >
                Save to Library
              </button>
            </div>
            <datalist id="lib-conn-list">
              {COMMON_CONNECTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </form>
        )}

        {/* Table */}
        <div className="tally-scroll overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Item Code</th>
                <th className="px-2.5 py-2.5">Type</th>
                <th className="px-2.5 py-2.5">Size</th>
                <th className="px-2.5 py-2.5 text-right">Wt (lb/ft)</th>
                <th className="px-2.5 py-2.5">Grade</th>
                <th className="px-2.5 py-2.5">Top Conn</th>
                <th className="px-2.5 py-2.5">Bot Conn</th>
                <th className="px-2.5 py-2.5 text-right">Length ({config.lengthUnit})</th>
                <th className="px-2.5 py-2.5">Serial / Source</th>
                <th className="px-2.5 py-2.5 text-center">Stock Qty</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-xs text-slate-500">
                    <Package className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                    No library items match your filter. Add items manually or scan an inspection report.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const lenInActiveUnit = convertLength(
                    item.measuredLength,
                    item.lengthUnit,
                    config.lengthUnit
                  );
                  const sizeMatchesActive = Math.abs(item.sizeIn - config.pipeSizeIn) <= 0.25;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50 ${
                        item.quantityAvailable === 0 ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="font-mono font-semibold text-slate-900">
                          {item.itemCode}
                        </div>
                        <div className="text-[11px] text-slate-500">{item.remarks}</div>
                      </td>
                      <td className="px-2.5 py-2">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
                            item.category === 'xo'
                              ? 'bg-amber-100 text-amber-800'
                              : item.category === 'pup'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {CATEGORY_LABELS[item.category]}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 font-mono">
                        <span
                          className={
                            sizeMatchesActive ? 'font-semibold text-sky-800' : 'text-slate-700'
                          }
                        >
                          {item.sizeLabel}&quot;
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                        {item.weightLbFt}
                      </td>
                      <td className="px-2.5 py-2 font-mono">{item.grade || '—'}</td>
                      <td className="px-2.5 py-2 font-mono text-slate-800">
                        {item.topConnection || '—'}
                      </td>
                      <td className="px-2.5 py-2 font-mono text-slate-800">
                        {item.bottomConnection || '—'}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {formatNum(lenInActiveUnit, 2)}
                        {item.lengthUnit !== config.lengthUnit && (
                          <span className="ml-1 text-[10px] font-normal text-slate-400">
                            ({item.measuredLength.toFixed(2)} {item.lengthUnit})
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 font-mono text-[11px] text-slate-600">
                        <div>{item.serialNo || '—'}</div>
                        {item.source === 'inspection' && (
                          <span className="text-[10px] text-emerald-700">Inspection Report</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-center">
                        <div className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => adjustQty(item.id, -1)}
                            className="h-5 w-5 rounded text-slate-600 hover:bg-slate-100"
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-mono font-semibold text-slate-900">
                            {item.quantityAvailable}
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustQty(item.id, 1)}
                            className="h-5 w-5 rounded text-slate-600 hover:bg-slate-100"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={item.quantityAvailable <= 0}
                            onClick={() => onAddLibraryItemToTally(item, 1)}
                            className="inline-flex items-center gap-1 rounded bg-sky-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                          >
                            <Plus className="h-3 w-3" />
                            Add to Tally
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            aria-label={`Delete ${item.itemCode}`}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
