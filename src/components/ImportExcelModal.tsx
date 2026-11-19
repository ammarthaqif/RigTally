import React, { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet, AlertCircle, Check } from 'lucide-react';
import type { ComponentType, LengthUnit, TallyRowInput } from '../types/tally';
import { createId } from '../utils/tallyEngine';

interface ParsedExcelResponse {
  fileName: string;
  sheetNames: string[];
  activeSheetName: string;
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  jointNo: number;
  measuredLength: number;
  makeUpLoss: number;
  weightLbFt: number;
  componentType: number;
  topConnection: number;
  bottomConnection: number;
  connection: number;
  serialNo: number;
  remarks: number;
}

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  lengthUnit: LengthUnit;
  nextJointNumber: number;
  onImportRows: (rows: TallyRowInput[], mode: 'append' | 'replace') => void;
}

function autoDetectMapping(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase());
  const findCol = (patterns: string[], exclude: number[] = []): number => {
    for (const pat of patterns) {
      const idx = lower.findIndex((h, i) => !exclude.includes(i) && h.includes(pat));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const measuredLength = findCol([
    'measured',
    'gross',
    'joint len',
    'jt len',
    'length',
    'len',
  ]);
  const jointNo = findCol(['joint no', 'jt no', 'joint #', 'jt #', 'joint', 'jt', 'no', 'tag'], [
    measuredLength,
  ]);
  const makeUpLoss = findCol(['make-up', 'makeup', 'mu loss', 'loss'], [measuredLength, jointNo]);
  const weightLbFt = findCol(['lb/ft', 'ppf', 'weight', 'wt'], [measuredLength, jointNo]);
  const componentType = findCol(['type', 'item', 'component', 'desc'], [measuredLength, jointNo]);
  const topConnection = findCol(['top conn', 'top thread', 'box conn'], [measuredLength, jointNo, componentType]);
  const bottomConnection = findCol(['bot conn', 'btm conn', 'bottom conn', 'pin conn'], [measuredLength, jointNo, componentType, topConnection]);
  const connection = findCol(['conn', 'thread'], [measuredLength, jointNo, componentType, topConnection, bottomConnection]);
  const serialNo = findCol(['serial', 'heat', 'sn'], [measuredLength, jointNo]);
  const remarks = findCol(['remark', 'note', 'comment'], [measuredLength, jointNo]);

  return {
    jointNo,
    measuredLength: measuredLength !== -1 ? measuredLength : headers.length > 1 ? 1 : 0,
    makeUpLoss,
    weightLbFt,
    componentType,
    topConnection,
    bottomConnection,
    connection,
    serialNo,
    remarks,
  };
}

function inferComponentType(raw: string): ComponentType {
  const t = raw.toLowerCase();
  if (t.includes('shoe')) return 'shoe';
  if (t.includes('collar')) return 'collar';
  if (t.includes('pup')) return 'pup';
  if (t.includes('xo') || t.includes('cross')) return 'xo';
  if (t.includes('bha') || t.includes('packer') || t.includes('sub')) return 'bha';
  return 'joint';
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  isOpen,
  onClose,
  lengthUnit,
  nextJointNumber,
  onImportRows,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedExcelResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    jointNo: -1,
    measuredLength: 0,
    makeUpLoss: -1,
    weightLbFt: -1,
    componentType: -1,
    topConnection: -1,
    bottomConnection: -1,
    connection: -1,
    serialNo: -1,
    remarks: -1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  if (!isOpen) return null;

  const uploadAndParse = async (file: File, sheetName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (sheetName) formData.append('sheetName', sheetName);

      const res = await fetch('/api/tally/parse-excel', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse Excel file.');
      }
      setParsed(data);
      setMapping(autoDetectMapping(data.headers));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read file.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    void uploadAndParse(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    void uploadAndParse(file);
  };

  const buildRows = (): TallyRowInput[] => {
    if (!parsed) return [];
    let counter = importMode === 'replace' ? 1 : nextJointNumber;
    const out: TallyRowInput[] = [];

    for (const raw of parsed.rows) {
      const firstNonEmpty = raw.find((c) => c.trim().length > 0)?.trim().toLowerCase() ?? '';
      if (firstNonEmpty === 'total' || firstNonEmpty === 'totals' || firstNonEmpty.startsWith('total ')) {
        continue;
      }

      const lenRaw = raw[mapping.measuredLength] ?? '';
      const measuredLength = Number(String(lenRaw).replace(/[^0-9.-]/g, ''));
      if (!Number.isFinite(measuredLength) || measuredLength <= 0) continue;

      const jointNo =
        mapping.jointNo >= 0 && raw[mapping.jointNo]
          ? String(raw[mapping.jointNo]).trim()
          : String(counter);

      const muRaw = mapping.makeUpLoss >= 0 ? raw[mapping.makeUpLoss] : '';
      const muNum = muRaw !== '' ? Number(String(muRaw).replace(/[^0-9.-]/g, '')) : NaN;
      const makeUpLossOverride = Number.isFinite(muNum) && muNum >= 0 ? muNum : null;

      const wtRaw = mapping.weightLbFt >= 0 ? raw[mapping.weightLbFt] : '';
      const wtNum = wtRaw !== '' ? Number(String(wtRaw).replace(/[^0-9.-]/g, '')) : NaN;
      const weightLbFtOverride = Number.isFinite(wtNum) && wtNum > 0 ? wtNum : null;

      const typeText = mapping.componentType >= 0 ? raw[mapping.componentType] : '';
      const connectionOverride = mapping.connection >= 0 ? raw[mapping.connection] : '';
      const topConnectionOverride = mapping.topConnection >= 0 ? raw[mapping.topConnection] : '';
      const bottomConnectionOverride =
        mapping.bottomConnection >= 0 ? raw[mapping.bottomConnection] : '';
      const remarks = mapping.remarks >= 0 ? raw[mapping.remarks] : '';
      const serialNo = mapping.serialNo >= 0 ? raw[mapping.serialNo] : '';

      out.push({
        id: createId(),
        jointNo,
        componentType: inferComponentType(`${typeText} ${jointNo} ${remarks}`),
        measuredLength,
        makeUpLossOverride,
        weightLbFtOverride,
        gradeOverride: '',
        connectionOverride,
        topConnectionOverride,
        bottomConnectionOverride,
        serialNo,
        remarks,
      });

      counter += 1;
    }

    return out;
  };

  const previewRows = parsed ? buildRows() : [];

  const handleConfirm = () => {
    if (previewRows.length === 0) {
      setError('No valid positive length rows found with the selected column mapping.');
      return;
    }
    onImportRows(previewRows, importMode);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Import Excel or CSV Tally"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-sky-700" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              Import Excel or CSV Tally
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

        <div className="tally-scroll flex-1 space-y-5 overflow-y-auto p-5">
          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-7 text-center transition-colors hover:border-sky-600 hover:bg-sky-50/40"
          >
            <Upload className="mb-2 h-6 w-6 text-slate-500" />
            <p className="text-sm font-medium text-slate-900">
              {selectedFile ? selectedFile.name : 'Drop .xlsx, .xls, or .csv tally file here'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Click to browse · Parsed on server for fast multi-sheet ingestion
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {loading && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Parsing workbook columns and rows...
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {parsed && (
            <>
              {/* Sheet selector + Import Mode */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Workbook Sheet
                  </label>
                  <select
                    value={parsed.activeSheetName}
                    onChange={(e) => selectedFile && void uploadAndParse(selectedFile, e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  >
                    {parsed.sheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Insert Behavior
                  </label>
                  <div className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setImportMode('append')}
                      className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        importMode === 'append'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Append Rows
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('replace')}
                      className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        importMode === 'replace'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Replace Tally
                    </button>
                  </div>
                </div>
              </div>

              {/* Column Mapping */}
              <div>
                <h3 className="mb-2.5 text-xs font-semibold text-slate-700">
                  Column Mapping (Measured Length in {lengthUnit})
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { key: 'measuredLength' as const, label: `Measured Len (${lengthUnit}) *`, required: true },
                    { key: 'jointNo' as const, label: 'Joint / Tag #' },
                    { key: 'makeUpLoss' as const, label: 'MU Loss Override' },
                    { key: 'weightLbFt' as const, label: 'Weight (lb/ft)' },
                    { key: 'componentType' as const, label: 'Component Type' },
                    { key: 'topConnection' as const, label: 'Top Connection' },
                    { key: 'bottomConnection' as const, label: 'Bottom Connection' },
                    { key: 'connection' as const, label: 'Single Connection' },
                    { key: 'serialNo' as const, label: 'Serial / Heat #' },
                    { key: 'remarks' as const, label: 'Remarks' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs text-slate-600">{field.label}</label>
                      <select
                        value={mapping[field.key]}
                        onChange={(e) =>
                          setMapping((prev) => ({
                            ...prev,
                            [field.key]: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                      >
                        {!field.required && <option value={-1}>— Skip —</option>}
                        {parsed.headers.map((h, idx) => (
                          <option key={`${h}-${idx}`} value={idx}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Preview */}
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Detected <strong className="font-mono text-slate-900">{previewRows.length}</strong>{' '}
                    valid rows
                  </span>
                  <span className="font-mono tabular-nums">
                    Sum:{' '}
                    {previewRows.reduce((s, r) => s + r.measuredLength, 0).toFixed(2)}{' '}
                    {lengthUnit}
                  </span>
                </div>
                <div className="max-h-48 overflow-auto rounded-md border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-3 py-2 font-medium">Joint</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Measured ({lengthUnit})
                        </th>
                        <th className="px-3 py-2 text-right font-medium">MU Loss</th>
                        <th className="px-3 py-2 font-medium">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.slice(0, 8).map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-1.5 font-mono text-slate-900">{r.jointNo}</td>
                          <td className="px-3 py-1.5 text-slate-600">{r.componentType}</td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-900">
                            {r.measuredLength.toFixed(2)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-500">
                            {r.makeUpLossOverride !== null ? r.makeUpLossOverride.toFixed(3) : 'Default'}
                          </td>
                          <td className="max-w-[180px] truncate px-3 py-1.5 text-slate-600">
                            {r.remarks || r.serialNo || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
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
            disabled={!parsed || previewRows.length === 0}
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Import {previewRows.length > 0 ? `${previewRows.length} Joints` : 'Tally'}
          </button>
        </div>
      </div>
    </div>
  );
};
