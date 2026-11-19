import React, { useMemo, useState } from 'react';
import { ClipboardPaste, X, Check } from 'lucide-react';
import type { LengthUnit, TallyRowInput } from '../types/tally';
import { createId, parseClipboardTextToRows } from '../utils/tallyEngine';

interface PasteTallyModalProps {
  isOpen: boolean;
  onClose: () => void;
  lengthUnit: LengthUnit;
  nextJointNumber: number;
  onImportRows: (rows: TallyRowInput[], mode: 'append' | 'replace') => void;
}

export const PasteTallyModal: React.FC<PasteTallyModalProps> = ({
  isOpen,
  onClose,
  lengthUnit,
  nextJointNumber,
  onImportRows,
}) => {
  const [rawText, setRawText] = useState('');
  const [mode, setMode] = useState<'append' | 'replace'>('append');

  const parsedItems = useMemo(() => {
    const startNo = mode === 'replace' ? 1 : nextJointNumber;
    return parseClipboardTextToRows(rawText, startNo);
  }, [rawText, mode, nextJointNumber]);

  if (!isOpen) return null;

  const totalLen = parsedItems.reduce((sum, item) => sum + item.measuredLength, 0);

  const handlePasteFromClipboardApi = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRawText(text);
    } catch {
      // Fallback: user pastes manually into textarea with Ctrl+V / Cmd+V
    }
  };

  const handleApply = () => {
    if (parsedItems.length === 0) return;
    const rows: TallyRowInput[] = parsedItems.map((p) => ({
      id: createId(),
      ...p,
    }));
    onImportRows(rows, mode);
    setRawText('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Paste Tally Data from Clipboard"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ClipboardPaste className="h-5 w-5 text-sky-700" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              Paste Tally from Clipboard
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="tally-scroll flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              Paste single-column lengths (e.g. 12.14) or multi-column Excel rows (Joint, Length, MU Loss, Weight, Serial, Remarks).
            </p>
            <button
              type="button"
              onClick={() => void handlePasteFromClipboardApi()}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Read Clipboard
            </button>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={7}
            placeholder={`Example:\n12.18\n12.24\n12.09\n\nOr tab-separated from Excel:\n10\t12.15\t\t47\tHT-4410\tProduction joint`}
            className="w-full rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode('append')}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'append'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Append Rows
              </button>
              <button
                type="button"
                onClick={() => setMode('replace')}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'replace'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Replace Tally
              </button>
            </div>

            <div className="text-xs text-slate-600 font-mono tabular-nums">
              Parsed: <strong className="text-slate-900">{parsedItems.length}</strong> joints ·{' '}
              <strong className="text-slate-900">{totalLen.toFixed(2)}</strong> {lengthUnit}
            </div>
          </div>

          {parsedItems.length > 0 && (
            <div className="max-h-44 overflow-auto rounded-md border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 font-medium">Joint</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 text-right font-medium">Length ({lengthUnit})</th>
                    <th className="px-3 py-2 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedItems.slice(0, 12).map((item, idx) => (
                    <tr key={`${item.jointNo}-${idx}`}>
                      <td className="px-3 py-1.5 font-mono text-slate-900">{item.jointNo}</td>
                      <td className="px-3 py-1.5 text-slate-600">{item.componentType}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-900">
                        {item.measuredLength.toFixed(2)}
                      </td>
                      <td className="truncate px-3 py-1.5 text-slate-600">
                        {item.remarks || item.serialNo || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={parsedItems.length === 0}
            onClick={handleApply}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Insert {parsedItems.length > 0 ? `${parsedItems.length} Rows` : 'Data'}
          </button>
        </div>
      </div>
    </div>
  );
};
