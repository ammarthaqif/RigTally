import React, { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Layers,
  ClipboardPaste,
  FileSpreadsheet,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Search,
  ArrowUpDown,
  CornerDownRight,
  Ban,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import type {
  ComponentType,
  ComputedTallyResult,
  RunOrder,
  TallyConfig,
  TallyRowInput,
} from '../types/tally';
import {
  COMMON_CONNECTIONS,
  convertMakeUpLossToLengthUnit,
  createId,
  formatNum,
  parseClipboardTextToRows,
} from '../utils/tallyEngine';
import { NumericInput } from './NumericInput';

interface TallyGridProps {
  config: TallyConfig;
  rawRows: TallyRowInput[];
  computed: ComputedTallyResult;
  nextJointNumber: number;
  onAddRow: (row: TallyRowInput, insertAfterId?: string) => void;
  onAddBatchRows: (rows: TallyRowInput[]) => void;
  onUpdateRow: (id: string, patch: Partial<TallyRowInput>) => void;
  onBulkUpdateRows: (ids: string[], patch: Partial<TallyRowInput>) => void;
  onBulkDeleteRows: (ids: string[]) => void;
  onDeleteRow: (id: string) => void;
  onMoveRow: (id: string, direction: 'up' | 'down') => void;
  onDuplicateRow: (id: string) => void;
  onClearAll: () => void;
  onToggleRunOrder: (order: RunOrder) => void;
  onOpenBatchModal: () => void;
  onOpenPasteModal: () => void;
  onOpenExcelModal: () => void;
  onLoadSample: () => void;
}

const COMPONENT_LABELS: Record<ComponentType, string> = {
  joint: 'Joint',
  pup: 'Pup',
  shoe: 'Shoe',
  collar: 'Collar',
  hanger: 'Hanger',
  landing: 'Landing',
  xo: 'XO',
  bha: 'BHA',
};

export const TallyGrid: React.FC<TallyGridProps> = ({
  config,
  rawRows,
  computed,
  nextJointNumber,
  onAddRow,
  onAddBatchRows,
  onUpdateRow,
  onBulkUpdateRows,
  onBulkDeleteRows,
  onDeleteRow,
  onMoveRow,
  onDuplicateRow,
  onClearAll,
  onToggleRunOrder,
  onOpenBatchModal,
  onOpenPasteModal,
  onOpenExcelModal,
  onLoadSample,
}) => {
  const [quickJointNo, setQuickJointNo] = useState('');
  const [quickType, setQuickType] = useState<ComponentType>('joint');
  const [quickLength, setQuickLength] = useState('');
  const [quickLayer, setQuickLayer] = useState('');
  const [quickTopConn, setQuickTopConn] = useState('');
  const [quickBotConn, setQuickBotConn] = useState('');
  const [quickRemarks, setQuickRemarks] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Multi-row selection & bulk action state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkWeight, setBulkWeight] = useState<number | null>(null);
  const [bulkTopConnection, setBulkTopConnection] = useState('');
  const [bulkBotConnection, setBulkBotConnection] = useState('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const lengthInputRef = useRef<HTMLInputElement>(null);

  const defaultLossConverted = convertMakeUpLossToLengthUnit(
    config.defaultMakeUpLoss,
    config.makeUpLossUnit,
    config.lengthUnit
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return computed.rows;
    return computed.rows.filter(
      (r) =>
        r.jointNo.toLowerCase().includes(q) ||
        r.componentType.toLowerCase().includes(q) ||
        r.effectiveConnection.toLowerCase().includes(q) ||
        r.effectiveTopConnection.toLowerCase().includes(q) ||
        r.effectiveBottomConnection.toLowerCase().includes(q) ||
        r.serialNo.toLowerCase().includes(q) ||
        r.remarks.toLowerCase().includes(q) ||
        (r.discarded && 'rejected discarded'.includes(q))
    );
  }, [computed.rows, searchQuery]);

  // Prune any selectedIds that are no longer in rawRows
  const activeSelectedIds = useMemo(() => {
    const existing = new Set(rawRows.map((r) => r.id));
    return Array.from(selectedIds).filter((id) => existing.has(id));
  }, [selectedIds, rawRows]);

  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id));
  const someFilteredSelected =
    filteredRows.some((r) => selectedIds.has(r.id)) && !allFilteredSelected;

  const crossoverAfterRowMap = useMemo(() => {
    const map = new Map<string, (typeof computed.crossoverAlerts)[number]>();
    for (const alert of computed.crossoverAlerts) {
      map.set(alert.afterRowId, alert);
    }
    return map;
  }, [computed.crossoverAlerts]);

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.id)));
    }
    setConfirmBulkDelete(false);
  };

  const toggleSelectRow = (id: string, shiftKey: boolean) => {
    setConfirmBulkDelete(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedId) {
        const startIdx = filteredRows.findIndex((r) => r.id === lastSelectedId);
        const endIdx = filteredRows.findIndex((r) => r.id === id);
        if (startIdx !== -1 && endIdx !== -1) {
          const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          for (let i = lo; i <= hi; i++) {
            next.add(filteredRows[i].id);
          }
          return next;
        }
      }

      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLastSelectedId(id);
  };

  const handleBulkDiscard = (discarded: boolean) => {
    if (activeSelectedIds.length === 0) return;
    onBulkUpdateRows(activeSelectedIds, {
      discarded,
      discardReason: discarded ? 'Rejected in bulk inspection' : '',
    });
    setSelectedIds(new Set());
  };

  const handleBulkApplyWeight = () => {
    if (activeSelectedIds.length === 0 || bulkWeight === null || bulkWeight <= 0) return;
    onBulkUpdateRows(activeSelectedIds, { weightLbFtOverride: bulkWeight });
    setBulkWeight(null);
  };

  const handleBulkApplyConnection = () => {
    if (activeSelectedIds.length === 0) return;
    const top = bulkTopConnection.trim();
    const bot = bulkBotConnection.trim();
    const patch: Partial<TallyRowInput> = {};
    if (top !== '') patch.topConnectionOverride = top;
    if (bot !== '') patch.bottomConnectionOverride = bot;
    if (top === '' && bot === '') {
      patch.topConnectionOverride = '';
      patch.bottomConnectionOverride = '';
      patch.connectionOverride = '';
    }
    onBulkUpdateRows(activeSelectedIds, patch);
    setBulkTopConnection('');
    setBulkBotConnection('');
  };

  const handleBulkDelete = () => {
    if (activeSelectedIds.length === 0) return;
    onBulkDeleteRows(activeSelectedIds);
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
  };

  const handleInsertCrossover = (alert: (typeof computed.crossoverAlerts)[number]) => {
    const xoDefaultLen = config.lengthUnit === 'm' ? 0.5 : 1.6;
    onAddRow(
      {
        id: createId(),
        jointNo: 'XO',
        componentType: 'xo',
        measuredLength: xoDefaultLen,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        topConnectionOverride: alert.xoTopConnection,
        bottomConnectionOverride: alert.xoBottomConnection,
        connectionOverride:
          alert.xoTopConnection === alert.xoBottomConnection
            ? alert.xoTopConnection
            : `${alert.xoBottomConnection} x ${alert.xoTopConnection}`,
        serialNo: '',
        remarks: `XO (${alert.xoBottomConnection} Btm × ${alert.xoTopConnection} Top)`,
      },
      alert.afterRowId
    );
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const len = Number(quickLength);
    if (!Number.isFinite(len) || len <= 0) {
      lengthInputRef.current?.focus();
      return;
    }

    const jointTag = quickJointNo.trim() || String(nextJointNumber);
    const parsedLayer = quickLayer.trim() ? Number(quickLayer) : undefined;
    onAddRow({
      id: createId(),
      jointNo: jointTag,
      componentType: quickType,
      measuredLength: len,
      makeUpLossOverride: quickType === 'shoe' && !config.applyMakeUpLossToShoe ? 0 : null,
      weightLbFtOverride: null,
      gradeOverride: '',
      topConnectionOverride: quickTopConn.trim(),
      bottomConnectionOverride: quickBotConn.trim(),
      serialNo: '',
      remarks: quickRemarks.trim(),
      layer: Number.isFinite(parsedLayer) && (parsedLayer ?? 0) > 0 ? parsedLayer : undefined,
      discarded: false,
    });

    setQuickJointNo('');
    setQuickLength('');
    setQuickRemarks('');
    lengthInputRef.current?.focus();
  };

  const handleQuickPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (text && (text.includes('\n') || text.includes('\t'))) {
      const parsed = parseClipboardTextToRows(text, nextJointNumber);
      if (parsed.length > 0) {
        e.preventDefault();
        onAddBatchRows(
          parsed.map((p) => ({
            id: createId(),
            ...p,
          }))
        );
      }
    }
  };

  const toggleDiscardRow = (row: TallyRowInput) => {
    const nextDiscarded = !row.discarded;
    onUpdateRow(row.id, {
      discarded: nextDiscarded,
      remarks: nextDiscarded && !row.remarks ? 'Rejected on inspection' : row.remarks,
    });
  };

  const unit = config.lengthUnit;

  return (
    <section
      aria-label="Pipe Running Tally Grid"
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
    >
      {/* Automatic Crossover (XO) Mismatch Notification Banner */}
      {computed.crossoverAlerts.length > 0 && (
        <div
          role="alert"
          className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="flex-1 space-y-1.5">
              <div className="font-semibold text-amber-950">
                Crossover (XO) Required ({computed.crossoverAlerts.length} connection{' '}
                {computed.crossoverAlerts.length === 1 ? 'change' : 'changes'} detected)
              </div>
              <div className="space-y-1">
                {computed.crossoverAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200/80 bg-white/80 px-2.5 py-1.5"
                  >
                    <span>
                      <strong>Jt #{alert.fromJointNo}</strong> {alert.fromEnd} (
                      <span className="font-mono font-semibold">{alert.fromConnection}</span>) ↔{' '}
                      <strong>Jt #{alert.toJointNo}</strong> {alert.toEnd} (
                      <span className="font-mono font-semibold">{alert.toConnection}</span>)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleInsertCrossover(alert)}
                      className="rounded bg-amber-700 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-amber-800 whitespace-nowrap"
                    >
                      + Insert XO ({alert.xoBottomConnection} Btm × {alert.xoTopConnection} Top)
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenBatchModal}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            Batch Add
          </button>
          <button
            type="button"
            onClick={onOpenPasteModal}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            <ClipboardPaste className="h-3.5 w-3.5 text-slate-500" />
            Paste Clipboard
          </button>
          <button
            type="button"
            onClick={onOpenExcelModal}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
            Import Excel
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:flex-initial">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter joint, conn, remarks..."
              aria-label="Filter tally rows"
              className="h-[38px] w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none sm:w-48"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              onToggleRunOrder(
                config.runOrder === 'bottom-to-top' ? 'top-to-bottom' : 'bottom-to-top'
              )
            }
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            title="Toggle depth calculation order"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
            {config.runOrder === 'bottom-to-top' ? 'Shoe Up (Bottom→Top)' : 'Surface Down (Top→Bot)'}
          </button>

          {rawRows.length > 0 &&
            (confirmClear ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setSelectedIds(new Set());
                    setConfirmClear(false);
                  }}
                  className="min-h-[38px] rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 whitespace-nowrap shrink-0"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="min-h-[38px] rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-red-300 hover:text-red-700 whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            ))}
        </div>
      </div>

      {/* Multi-Row Selection Bulk Actions Bar */}
      {activeSelectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-mono font-semibold text-sky-900">
              {activeSelectedIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedIds(new Set());
                setConfirmBulkDelete(false);
              }}
              className="text-sky-700 underline hover:text-sky-900"
            >
              Clear selection
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bulk Change Weight */}
            <div className="flex items-center rounded border border-slate-300 bg-white">
              <NumericInput
                step="0.1"
                min={0.1}
                allowEmpty
                placeholder="lb/ft"
                aria-label="Bulk weight lb/ft"
                value={bulkWeight}
                onChangeValue={(val) => setBulkWeight(val)}
                className="h-8 w-20 rounded-l px-2 font-mono text-xs text-slate-900 focus:outline-none"
              />
              <button
                type="button"
                disabled={bulkWeight === null || bulkWeight <= 0}
                onClick={handleBulkApplyWeight}
                className="h-8 border-l border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap"
              >
                Set Weight
              </button>
            </div>

            {/* Bulk Change Top / Bottom Connection */}
            <div className="flex items-center rounded border border-slate-300 bg-white">
              <input
                type="text"
                value={bulkTopConnection}
                onChange={(e) => setBulkTopConnection(e.target.value)}
                list="tally-conn-list"
                placeholder="Top Conn"
                aria-label="Bulk top connection"
                className="h-8 w-22 rounded-l px-2 font-mono text-xs text-slate-900 focus:outline-none"
              />
              <input
                type="text"
                value={bulkBotConnection}
                onChange={(e) => setBulkBotConnection(e.target.value)}
                list="tally-conn-list"
                placeholder="Btm Conn"
                aria-label="Bulk bottom connection"
                className="h-8 w-22 border-l border-slate-200 px-2 font-mono text-xs text-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleBulkApplyConnection}
                className="h-8 border-l border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                Set Conn
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleBulkDiscard(true)}
              className="inline-flex h-8 items-center gap-1 rounded border border-amber-300 bg-white px-2.5 font-medium text-amber-800 hover:bg-amber-100 whitespace-nowrap"
            >
              <Ban className="h-3.5 w-3.5" />
              Discard
            </button>

            <button
              type="button"
              onClick={() => handleBulkDiscard(false)}
              className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2.5 font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore
            </button>

            {confirmBulkDelete ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="h-8 rounded bg-red-600 px-3 font-medium text-white hover:bg-red-700 whitespace-nowrap"
                >
                  Confirm Delete ({activeSelectedIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(false)}
                  className="h-8 rounded border border-slate-300 bg-white px-2 text-slate-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(true)}
                className="inline-flex h-8 items-center gap-1 rounded border border-red-300 bg-white px-2.5 font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rapid Quick-Entry Bar */}
      <form
        onSubmit={handleQuickAdd}
        className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-sky-50/40 px-4 py-2.5 sm:flex sm:flex-wrap sm:items-center"
      >
        <div className="sm:w-20">
          <input
            type="text"
            value={quickJointNo}
            onChange={(e) => setQuickJointNo(e.target.value)}
            placeholder={`#${nextJointNumber}`}
            aria-label="New joint number"
            className="h-[40px] w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
          />
        </div>

        <div className="sm:w-24">
          <select
            value={quickType}
            onChange={(e) => setQuickType(e.target.value as ComponentType)}
            aria-label="New component type"
            className="h-[40px] w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-900 focus:border-sky-600 focus:outline-none"
          >
            {Object.entries(COMPONENT_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:w-18">
          <input
            type="number"
            min="1"
            value={quickLayer}
            onChange={(e) => setQuickLayer(e.target.value)}
            placeholder="Layer"
            aria-label="Deck layer"
            className="h-[40px] w-full rounded-md border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
          />
        </div>

        <div className="sm:w-24">
          <input
            type="text"
            value={quickTopConn}
            onChange={(e) => setQuickTopConn(e.target.value)}
            list="tally-conn-list"
            placeholder={`Top: ${config.topConnection || config.connection || 'Conn'}`}
            aria-label="New joint top connection"
            className="h-[40px] w-full rounded-md border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
          />
        </div>

        <div className="sm:w-24">
          <input
            type="text"
            value={quickBotConn}
            onChange={(e) => setQuickBotConn(e.target.value)}
            list="tally-conn-list"
            placeholder={`Btm: ${config.bottomConnection || config.connection || 'Conn'}`}
            aria-label="New joint bottom connection"
            className="h-[40px] w-full rounded-md border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
          />
          <datalist id="tally-conn-list">
            {COMMON_CONNECTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="col-span-2 sm:w-40">
          <input
            ref={lengthInputRef}
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0.01"
            value={quickLength}
            onChange={(e) => setQuickLength(e.target.value)}
            onPaste={handleQuickPaste}
            placeholder={`Length (${unit}) · Enter`}
            aria-label="Measured pipe length"
            className="h-[40px] w-full rounded-md border border-sky-300 bg-white px-3 font-mono text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
          />
        </div>

        <div className="col-span-2 sm:flex-1">
          <input
            type="text"
            value={quickRemarks}
            onChange={(e) => setQuickRemarks(e.target.value)}
            placeholder="Serial # or remarks"
            aria-label="Remarks"
            className="h-[40px] w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="col-span-2 inline-flex h-[40px] items-center justify-center gap-1.5 rounded-md bg-sky-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-sky-800 whitespace-nowrap shrink-0 sm:col-span-1"
        >
          <Plus className="h-4 w-4" />
          Add Joint
        </button>
      </form>

      {/* Empty State */}
      {rawRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <h3 className="font-display text-base font-semibold text-slate-900">
            No pipe joints tallied yet
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Enter a strapped length above, paste from Excel, or use the Cantilever Deck tab to auto-populate from layered pipe racks.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onOpenPasteModal}
              className="rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800"
            >
              Paste from Clipboard
            </button>
            <button
              type="button"
              onClick={onOpenExcelModal}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Import Excel File
            </button>
            <button
              type="button"
              onClick={onLoadSample}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Load Sample Casing Tally
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Spreadsheet Grid */}
          <div className="tally-scroll hidden max-h-[560px] overflow-auto md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-slate-700">
                <tr>
                  <th className="w-9 px-2.5 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someFilteredSelected;
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Select all visible rows"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                    />
                  </th>
                  <th className="w-11 px-2 py-2.5 font-semibold">Run</th>
                  <th className="w-22 px-2 py-2.5 font-semibold">Joint / Tag</th>
                  <th className="w-14 px-1.5 py-2.5 text-center font-semibold">Layer</th>
                  <th className="w-20 px-1.5 py-2.5 font-semibold">Type</th>
                  <th className="w-24 px-1.5 py-2.5 font-semibold">Top Conn</th>
                  <th className="w-24 px-1.5 py-2.5 font-semibold">Bot Conn</th>
                  <th className="w-20 px-1.5 py-2.5 text-right font-semibold">
                    Gross ({unit})
                  </th>
                  <th className="w-18 px-1.5 py-2.5 text-right font-semibold">
                    MU ({config.makeUpLossUnit})
                  </th>
                  <th className="w-20 px-2 py-2.5 text-right font-semibold">
                    Net ({unit})
                  </th>
                  <th className="w-20 px-2 py-2.5 text-right font-semibold">
                    Cum ({unit})
                  </th>
                  <th className="w-20 px-2 py-2.5 text-right font-semibold">Top MD</th>
                  <th className="w-20 px-2 py-2.5 text-right font-semibold">Bot MD</th>
                  <th className="w-16 px-1.5 py-2.5 text-right font-semibold">lb/ft</th>
                  <th className="w-20 px-2 py-2.5 text-right font-semibold">Seg Wt</th>
                  <th className="w-22 px-2 py-2.5 text-right font-semibold">Cum Wt</th>
                  <th className="min-w-[130px] px-2 py-2.5 font-semibold">Serial / Remarks</th>
                  <th className="w-32 px-2 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const isDiscarded = Boolean(row.discarded);
                  const isSelected = selectedIds.has(row.id);
                  const xoAfter = crossoverAfterRowMap.get(row.id);
                  const isHangerOrLanding =
                    row.componentType === 'hanger' || row.componentType === 'landing';
                  const isXo = row.componentType === 'xo';
                  const isAccessory =
                    row.componentType !== 'joint' && !isHangerOrLanding && !isXo;

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className={`group h-[38px] transition-colors ${
                          isSelected
                            ? 'bg-sky-50/80'
                            : isDiscarded
                              ? 'bg-red-50/50 text-slate-400'
                              : isXo
                                ? 'bg-amber-50/50 hover:bg-amber-50'
                                : isHangerOrLanding
                                  ? 'bg-sky-50/40 hover:bg-sky-50/70'
                                  : isAccessory
                                    ? 'bg-slate-50/70 hover:bg-sky-50/40'
                                    : 'bg-white hover:bg-sky-50/40'
                        }`}
                      >
                        <td className="px-2.5 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            onClick={(e) => toggleSelectRow(row.id, e.shiftKey)}
                            aria-label={`Select row ${row.jointNo}`}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                          />
                        </td>

                        <td className="px-2 py-1 font-mono tabular-nums">
                          {isDiscarded ? (
                            <span className="text-[11px] font-semibold text-red-700">REJ</span>
                          ) : (
                            <span className="text-slate-500">{row.runSeq}</span>
                          )}
                        </td>

                        {/* Joint Tag */}
                        <td className="px-1.5 py-1">
                          <input
                            type="text"
                            value={row.jointNo}
                            onChange={(e) => onUpdateRow(row.id, { jointNo: e.target.value })}
                            aria-label={`Joint tag row ${row.seq}`}
                            className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 font-mono text-xs font-medium focus:border-sky-600 focus:bg-white focus:outline-none ${
                              isDiscarded ? 'text-red-700 line-through' : 'text-slate-900'
                            }`}
                          />
                        </td>

                        {/* Cantilever Deck Layer */}
                        <td className="px-1 py-1 text-center">
                          <NumericInput
                            integer
                            allowEmpty
                            min={1}
                            value={row.layer ?? null}
                            placeholder="—"
                            onChangeValue={(val) =>
                              onUpdateRow(row.id, { layer: val ?? undefined })
                            }
                            aria-label={`Layer row ${row.seq}`}
                            className="w-11 rounded border border-transparent bg-transparent px-1 py-1 text-center font-mono text-xs text-slate-600 placeholder:text-slate-300 focus:border-sky-600 focus:bg-white focus:outline-none"
                          />
                        </td>

                        {/* Type */}
                        <td className="px-1 py-1">
                          <select
                            value={row.componentType}
                            onChange={(e) =>
                              onUpdateRow(row.id, {
                                componentType: e.target.value as ComponentType,
                              })
                            }
                            aria-label={`Component type row ${row.seq}`}
                            className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-xs font-medium text-slate-700 focus:border-sky-600 focus:bg-white focus:outline-none"
                          >
                            {Object.entries(COMPONENT_LABELS).map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Top Connection */}
                        <td className="px-1 py-1">
                          <input
                            type="text"
                            value={row.topConnectionOverride ?? ''}
                            placeholder={
                              row.effectiveTopConnection ||
                              config.topConnection ||
                              config.connection ||
                              'Top'
                            }
                            list="tally-conn-list"
                            onChange={(e) =>
                              onUpdateRow(row.id, { topConnectionOverride: e.target.value })
                            }
                            aria-label={`Top connection row ${row.seq}`}
                            className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 font-mono text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none"
                          />
                        </td>

                        {/* Bottom Connection */}
                        <td className="px-1 py-1">
                          <input
                            type="text"
                            value={row.bottomConnectionOverride ?? ''}
                            placeholder={
                              row.effectiveBottomConnection ||
                              config.bottomConnection ||
                              config.connection ||
                              'Btm'
                            }
                            list="tally-conn-list"
                            onChange={(e) =>
                              onUpdateRow(row.id, { bottomConnectionOverride: e.target.value })
                            }
                            aria-label={`Bottom connection row ${row.seq}`}
                            className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 font-mono text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none"
                          />
                        </td>

                        {/* Gross Measured Length */}
                        <td className="px-1 py-1">
                          <NumericInput
                            step="0.001"
                            min={0}
                            fallbackValue={0}
                            value={row.measuredLength}
                            onChangeValue={(val) => {
                              if (val !== null) onUpdateRow(row.id, { measuredLength: val });
                            }}
                            aria-label={`Gross length row ${row.seq}`}
                            className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-right font-mono text-xs font-semibold tabular-nums focus:border-sky-600 focus:bg-white focus:outline-none ${
                              isDiscarded ? 'text-slate-400 line-through' : 'text-slate-900'
                            }`}
                          />
                        </td>

                        {/* Make-Up Loss override */}
                        <td className="px-1 py-1">
                          <NumericInput
                            step="0.01"
                            min={0}
                            allowEmpty
                            disabled={isDiscarded}
                            value={row.makeUpLossOverride}
                            placeholder={
                              row.componentType === 'shoe' && !config.applyMakeUpLossToShoe
                                ? '0'
                                : String(config.defaultMakeUpLoss)
                            }
                            onChangeValue={(val) =>
                              onUpdateRow(row.id, { makeUpLossOverride: val })
                            }
                            title={`Effective MU loss: ${row.effectiveMakeUpLoss.toFixed(3)} ${unit}`}
                            aria-label={`Make-up loss override row ${row.seq}`}
                            className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-right font-mono text-xs text-slate-600 tabular-nums placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:text-slate-900 focus:outline-none disabled:opacity-40"
                          />
                        </td>

                        {/* Net Length */}
                        <td
                          className="px-2 py-1 text-right font-mono text-slate-900 tabular-nums"
                          title={`MU Loss deducted: ${defaultLossConverted.toFixed(3)} ${unit}`}
                        >
                          {isDiscarded ? '0.00' : row.effectiveLength.toFixed(2)}
                        </td>

                        {/* Cumulative Length */}
                        <td className="px-2 py-1 text-right font-mono font-semibold text-sky-800 tabular-nums">
                          {isDiscarded ? '—' : row.cumLength.toFixed(2)}
                        </td>

                        {/* Top MD */}
                        <td
                          className={`px-2 py-1 text-right font-mono tabular-nums ${
                            !isDiscarded && row.topDepth < 0
                              ? 'font-semibold text-emerald-700'
                              : 'text-slate-600'
                          }`}
                          title={
                            row.topDepth < 0
                              ? `Stick-up above Rig Floor: +${Math.abs(row.topDepth).toFixed(2)} ${unit}`
                              : undefined
                          }
                        >
                          {isDiscarded
                            ? '—'
                            : row.topDepth < 0
                              ? `+${Math.abs(row.topDepth).toFixed(2)} SU`
                              : row.topDepth.toFixed(2)}
                        </td>

                        {/* Bot MD */}
                        <td className="px-2 py-1 text-right font-mono text-slate-900 tabular-nums">
                          {isDiscarded ? '—' : row.bottomDepth.toFixed(2)}
                        </td>

                        {/* Weight lb/ft override */}
                        <td className="px-1 py-1">
                          <NumericInput
                            step="0.1"
                            min={0}
                            allowEmpty
                            disabled={isDiscarded}
                            value={row.weightLbFtOverride}
                            placeholder={String(config.weightLbFt)}
                            onChangeValue={(val) =>
                              onUpdateRow(row.id, { weightLbFtOverride: val })
                            }
                            aria-label={`Weight lb/ft override row ${row.seq}`}
                            className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-right font-mono text-xs text-slate-600 tabular-nums placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:text-slate-900 focus:outline-none disabled:opacity-40"
                          />
                        </td>

                        {/* Segment Air Weight */}
                        <td className="px-2 py-1 text-right font-mono text-slate-700 tabular-nums">
                          {isDiscarded ? '0' : formatNum(row.segmentAirWeightLbs, 0)}
                        </td>

                        {/* Cumulative Air Weight */}
                        <td className="px-2 py-1 text-right font-mono font-medium text-slate-900 tabular-nums">
                          {isDiscarded ? '—' : formatNum(row.cumAirWeightLbs, 0)}
                        </td>

                        {/* Serial / Remarks */}
                        <td className="px-1.5 py-1">
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={(e) => onUpdateRow(row.id, { remarks: e.target.value })}
                            placeholder={row.serialNo || 'Add note...'}
                            aria-label={`Remarks row ${row.seq}`}
                            className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none ${
                              isDiscarded ? 'text-red-700' : 'text-slate-700'
                            }`}
                          />
                        </td>

                        {/* Row Actions */}
                        <td className="px-2 py-1 text-right">
                          <div className="inline-flex items-center gap-0.5 opacity-85 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => toggleDiscardRow(row)}
                              title={
                                isDiscarded
                                  ? 'Restore joint into active tally'
                                  : 'Mark joint as rejected / discarded (keeps Joint #)'
                              }
                              className={`rounded p-1 transition-colors ${
                                isDiscarded
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'text-slate-500 hover:bg-amber-100 hover:text-amber-800'
                              }`}
                            >
                              {isDiscarded ? (
                                <RotateCcw className="h-3.5 w-3.5" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onMoveRow(row.id, 'up')}
                              title="Move up"
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onMoveRow(row.id, 'down')}
                              title="Move down"
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onAddRow(
                                  {
                                    id: createId(),
                                    jointNo: String(nextJointNumber),
                                    componentType: 'joint',
                                    measuredLength: row.measuredLength,
                                    makeUpLossOverride: null,
                                    weightLbFtOverride: null,
                                    gradeOverride: '',
                                    connectionOverride: row.connectionOverride || '',
                                    topConnectionOverride: row.topConnectionOverride || '',
                                    bottomConnectionOverride: row.bottomConnectionOverride || '',
                                    serialNo: '',
                                    remarks: '',
                                  },
                                  row.id
                                )
                              }
                              title="Insert joint below"
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                            >
                              <CornerDownRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDuplicateRow(row.id)}
                              title="Duplicate row"
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteRow(row.id)}
                              title="Delete row"
                              className="rounded p-1 text-slate-500 hover:bg-red-100 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Inline Crossover Transition Marker Row */}
                      {xoAfter && (
                        <tr className="bg-amber-50/80 text-[11px] text-amber-900">
                          <td colSpan={18} className="px-4 py-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 font-medium">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                                XO required between Jt #{xoAfter.fromJointNo} {xoAfter.fromEnd} (
                                <span className="font-mono font-semibold">
                                  {xoAfter.fromConnection}
                                </span>
                                ) &amp; Jt #{xoAfter.toJointNo} {xoAfter.toEnd} (
                                <span className="font-mono font-semibold">
                                  {xoAfter.toConnection}
                                </span>
                                )
                              </span>
                              <button
                                type="button"
                                onClick={() => handleInsertCrossover(xoAfter)}
                                className="rounded border border-amber-300 bg-white px-2.5 py-0.5 font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap"
                              >
                                + Insert XO ({xoAfter.xoBottomConnection} Btm ×{' '}
                                {xoAfter.xoTopConnection} Top)
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Touch Card View */}
          <div className="divide-y divide-slate-200 md:hidden">
            <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2 text-xs">
              <label className="inline-flex items-center gap-2 font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-sky-700"
                />
                Select All ({filteredRows.length})
              </label>
            </div>

            {filteredRows.map((row) => {
              const isDiscarded = Boolean(row.discarded);
              const isSelected = selectedIds.has(row.id);
              const xoAfter = crossoverAfterRowMap.get(row.id);
              return (
                <React.Fragment key={row.id}>
                  <div
                    className={`space-y-2.5 p-3.5 ${
                      isSelected ? 'bg-sky-50/70' : isDiscarded ? 'bg-red-50/50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          onClick={(e) => toggleSelectRow(row.id, e.shiftKey)}
                          aria-label={`Select joint ${row.jointNo}`}
                          className="h-4 w-4 rounded border-slate-300 text-sky-700"
                        />
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {isDiscarded ? 'REJ' : `#${row.runSeq}`}
                        </span>
                        <input
                          type="text"
                          value={row.jointNo}
                          onChange={(e) => onUpdateRow(row.id, { jointNo: e.target.value })}
                          className={`h-9 w-18 rounded border border-slate-200 px-2 font-mono text-xs font-semibold ${
                            isDiscarded ? 'text-red-700 line-through' : 'text-slate-900'
                          }`}
                        />
                        <select
                          value={row.componentType}
                          onChange={(e) =>
                            onUpdateRow(row.id, {
                              componentType: e.target.value as ComponentType,
                            })
                          }
                          className="h-9 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700"
                        >
                          {Object.entries(COMPONENT_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleDiscardRow(row)}
                          aria-label={isDiscarded ? 'Restore joint' : 'Reject joint'}
                          className={`flex h-10 w-10 items-center justify-center rounded border ${
                            isDiscarded
                              ? 'border-red-300 bg-red-100 text-red-700'
                              : 'border-slate-200 text-amber-700'
                          }`}
                        >
                          {isDiscarded ? (
                            <RotateCcw className="h-4 w-4" />
                          ) : (
                            <Ban className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRow(row.id)}
                          aria-label="Delete"
                          className="flex h-10 w-10 items-center justify-center rounded border border-slate-200 text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-slate-500">
                          Measured ({unit})
                        </label>
                        <NumericInput
                          step="0.001"
                          min={0}
                          fallbackValue={0}
                          value={row.measuredLength}
                          onChangeValue={(val) => {
                            if (val !== null) onUpdateRow(row.id, { measuredLength: val });
                          }}
                          className="h-11 w-full rounded border border-slate-300 px-2.5 font-mono text-sm font-semibold text-slate-900"
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-[11px] text-slate-500">Cum / Seg Wt</div>
                        <div className="flex h-11 flex-col justify-center rounded bg-slate-50 px-2 font-mono text-xs tabular-nums">
                          <span className="font-semibold text-sky-800">
                            {isDiscarded ? 'REJECTED' : `${row.cumLength.toFixed(2)} ${unit}`}
                          </span>
                          <span className="text-slate-600">
                            {isDiscarded ? '0 lb' : `${formatNum(row.segmentAirWeightLbs, 0)} lb`}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-slate-500">Top Conn</label>
                        <input
                          type="text"
                          value={row.topConnectionOverride ?? ''}
                          placeholder={row.effectiveTopConnection || 'Top'}
                          list="tally-conn-list"
                          onChange={(e) =>
                            onUpdateRow(row.id, { topConnectionOverride: e.target.value })
                          }
                          className="h-10 w-full rounded border border-slate-200 px-2 font-mono text-xs text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-slate-500">Bot Conn</label>
                        <input
                          type="text"
                          value={row.bottomConnectionOverride ?? ''}
                          placeholder={row.effectiveBottomConnection || 'Btm'}
                          list="tally-conn-list"
                          onChange={(e) =>
                            onUpdateRow(row.id, { bottomConnectionOverride: e.target.value })
                          }
                          className="h-10 w-full rounded border border-slate-200 px-2 font-mono text-xs text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {xoAfter && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 px-3.5 py-2 text-xs text-amber-900">
                      <span>
                        XO needed: Jt #{xoAfter.fromJointNo} {xoAfter.fromEnd} (
                        <strong className="font-mono">{xoAfter.fromConnection}</strong>) ↔ Jt #
                        {xoAfter.toJointNo} {xoAfter.toEnd} (
                        <strong className="font-mono">{xoAfter.toConnection}</strong>)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleInsertCrossover(xoAfter)}
                        className="rounded border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900"
                      >
                        + Insert XO
                      </button>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
