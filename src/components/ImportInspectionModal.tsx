import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  FileText,
  Image as ImageIcon,
  Loader2,
  ScanText,
  Upload,
  X,
} from 'lucide-react';
import type {
  ComponentType,
  InspectionReportItem,
  InspectionReportResult,
  LengthUnit,
  LibraryItem,
  TallyConfig,
  TallyRowInput,
} from '../types/tally';
import { COMMON_CONNECTIONS, convertLength, createId } from '../utils/tallyEngine';
import { NumericInput } from './NumericInput';

interface ImportInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TallyConfig;
  nextJointNumber: number;
  onImportToTally: (
    rows: TallyRowInput[],
    mode: 'append' | 'replace',
    configPatch?: Partial<TallyConfig>
  ) => void;
  onSaveToLibrary: (items: LibraryItem[]) => void;
}

const COMPONENT_OPTIONS: Array<{ value: ComponentType; label: string }> = [
  { value: 'joint', label: 'Joint' },
  { value: 'pup', label: 'Pup' },
  { value: 'xo', label: 'XO' },
  { value: 'shoe', label: 'Shoe' },
  { value: 'collar', label: 'Collar' },
  { value: 'hanger', label: 'Hanger' },
  { value: 'landing', label: 'Landing' },
  { value: 'bha', label: 'BHA' },
];

export const ImportInspectionModal: React.FC<ImportInspectionModalProps> = ({
  isOpen,
  onClose,
  config,
  nextJointNumber,
  onImportToTally,
  onSaveToLibrary,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<InspectionReportResult | null>(null);
  const [editableItems, setEditableItems] = useState<InspectionReportItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [convertUnits, setConvertUnits] = useState(true);
  const [applySpecsToString, setApplySpecsToString] = useState(false);
  const [alsoSaveLibrary, setAlsoSaveLibrary] = useState(true);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    }

    setLoading(true);
    setError(null);
    setReport(null);
    setEditableItems([]);
    setSelectedIds(new Set());

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/tally/parse-inspection', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to read inspection report.');
      }

      const parsed = data as InspectionReportResult;
      setReport(parsed);
      setEditableItems(parsed.items);
      setSelectedIds(new Set(parsed.items.map((item) => item.id)));
      setApplySpecsToString(
        Boolean(
          parsed.detectedWeightLbFt ||
            parsed.detectedGrade ||
            parsed.detectedConnection ||
            parsed.detectedSizeLabel
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process inspection report.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData.items || []);
    const imgItem = items.find((it) => it.type.startsWith('image/'));
    if (imgItem) {
      const blob = imgItem.getAsFile();
      if (blob) {
        e.preventDefault();
        const file = new File([blob], `inspection-snapshot-${Date.now()}.png`, {
          type: blob.type || 'image/png',
        });
        void processFile(file);
      }
    }
  };

  const updateItem = (id: string, patch: Partial<InspectionReportItem>) => {
    setEditableItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected =
    editableItems.length > 0 && editableItems.every((i) => selectedIds.has(i.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(editableItems.map((i) => i.id)));
    }
  };

  const selectedItems = editableItems.filter((i) => selectedIds.has(i.id));

  const resolveRowLength = (item: InspectionReportItem): number => {
    const srcUnit: LengthUnit =
      item.lengthUnit === 'ft' || item.lengthUnit === 'm'
        ? item.lengthUnit
        : report?.detectedUnit === 'ft' || report?.detectedUnit === 'm'
          ? report.detectedUnit
          : config.lengthUnit;

    if (!convertUnits || srcUnit === config.lengthUnit) {
      return Number(item.measuredLength.toFixed(3));
    }
    return Number(convertLength(item.measuredLength, srcUnit, config.lengthUnit).toFixed(3));
  };

  const buildLibraryItems = (itemsToSave: InspectionReportItem[]): LibraryItem[] => {
    const fallbackSizeLabel = report?.detectedSizeLabel || config.pipeSizeLabel;
    const fallbackSizeIn = report?.detectedSizeIn ?? config.pipeSizeIn;

    return itemsToSave.map((item) => {
      const srcUnit: LengthUnit =
        item.lengthUnit === 'ft' || item.lengthUnit === 'm'
          ? item.lengthUnit
          : report?.detectedUnit === 'ft' || report?.detectedUnit === 'm'
            ? report.detectedUnit
            : config.lengthUnit;

      const szLabel = item.sizeLabel || fallbackSizeLabel;
      const szIn = item.sizeIn ?? fallbackSizeIn;
      const wt = item.weightLbFt ?? report?.detectedWeightLbFt ?? config.weightLbFt;
      const gr = item.grade || report?.detectedGrade || config.grade;
      const topC = item.topConnection || report?.detectedConnection || config.connection;
      const botC = item.bottomConnection || topC;

      return {
        id: createId(),
        category: item.componentType,
        itemCode: `${item.componentType.toUpperCase()}-${item.jointNo}`,
        description: `${szLabel}" ${wt}# ${gr} ${
          topC === botC ? topC : `${botC} × ${topC}`
        } (${item.measuredLength.toFixed(2)} ${srcUnit})`,
        sizeLabel: szLabel,
        sizeIn: szIn,
        weightLbFt: wt,
        grade: gr,
        topConnection: topC,
        bottomConnection: botC,
        measuredLength: item.measuredLength,
        lengthUnit: srcUnit,
        quantityAvailable: item.condition === 'rejected' ? 0 : 1,
        serialNo: item.serialNo,
        source: 'inspection',
        remarks:
          item.remarks ||
          (report?.inspectorCompany
            ? `Inspection: ${report.inspectorCompany}`
            : `Scanned from ${report?.fileName ?? 'report'}`),
      };
    });
  };

  const handleImport = (saveLibraryOnly = false) => {
    if (selectedItems.length === 0) {
      setError('Select at least one extracted row to import.');
      return;
    }

    if (saveLibraryOnly) {
      onSaveToLibrary(buildLibraryItems(selectedItems));
      onClose();
      return;
    }

    let counter = importMode === 'replace' ? 1 : nextJointNumber;
    const tallyRows: TallyRowInput[] = selectedItems.map((item) => {
      const len = resolveRowLength(item);
      const isRejected = item.condition === 'rejected';
      const jointTag = item.jointNo.trim() || String(counter);
      counter += 1;

      const sizeNote =
        item.sizeLabel && item.sizeLabel !== config.pipeSizeLabel
          ? `${item.sizeLabel}" `
          : '';
      const combinedRemarks = [
        sizeNote ? `OD ${sizeNote.trim()}` : '',
        item.condition === 'repair' ? 'Marked for repair' : '',
        item.remarks,
      ]
        .filter(Boolean)
        .join(' · ');

      return {
        id: createId(),
        jointNo: jointTag,
        componentType: item.componentType,
        measuredLength: len,
        makeUpLossOverride: item.componentType === 'shoe' ? 0 : null,
        weightLbFtOverride: item.weightLbFt,
        gradeOverride: item.grade,
        topConnectionOverride: item.topConnection,
        bottomConnectionOverride: item.bottomConnection,
        connectionOverride:
          item.topConnection && item.bottomConnection && item.topConnection !== item.bottomConnection
            ? `${item.bottomConnection} x ${item.topConnection}`
            : item.topConnection || item.bottomConnection,
        serialNo: item.serialNo,
        remarks: combinedRemarks,
        discarded: isRejected,
        discardReason: isRejected ? item.remarks || 'Rejected in inspection report' : '',
      };
    });

    let configPatch: Partial<TallyConfig> | undefined;
    if (applySpecsToString && report) {
      configPatch = {};
      if (report.detectedSizeLabel) configPatch.pipeSizeLabel = report.detectedSizeLabel;
      if (report.detectedSizeIn) configPatch.pipeSizeIn = report.detectedSizeIn;
      if (report.detectedWeightLbFt) configPatch.weightLbFt = report.detectedWeightLbFt;
      if (report.detectedGrade) configPatch.grade = report.detectedGrade;
      if (report.detectedConnection) {
        configPatch.connection = report.detectedConnection;
        configPatch.topConnection = report.detectedConnection;
        configPatch.bottomConnection = report.detectedConnection;
      }
    }

    if (alsoSaveLibrary) {
      onSaveToLibrary(buildLibraryItems(selectedItems));
    }

    onImportToTally(tallyRows, importMode, configPatch);
    onClose();
  };

  const detectedDiffersFromActive =
    report &&
    report.detectedUnit !== 'unknown' &&
    report.detectedUnit !== config.lengthUnit;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Scan Inspection Report"
      onPaste={handlePaste}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ScanText className="h-5 w-5 text-sky-700" />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Scan Inspection Report (PDF or Snapshot)
              </h2>
              <p className="text-[11px] text-slate-500">
                Extracts size, weight, grade, top/bottom connections, serials, and joint lengths directly into your tally &amp; equipment library.
              </p>
            </div>
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

        {/* Body */}
        <div className="tally-scroll flex-1 space-y-4 overflow-y-auto p-5">
          {/* Upload / Paste Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-6 text-center transition-colors hover:border-sky-600 hover:bg-sky-50/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {loading ? (
              <>
                <Loader2 className="h-7 w-7 animate-spin text-sky-700" />
                <div className="text-sm font-medium text-slate-800">
                  Scanning {selectedFile?.name}...
                </div>
                <div className="text-xs text-slate-500">
                  Extracting tubular specs, connections, and measured joint lengths
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-slate-500">
                  <Upload className="h-5 w-5 text-sky-700" />
                  <ImageIcon className="h-5 w-5 text-slate-400" />
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>
                <div className="text-sm font-medium text-slate-800">
                  {selectedFile
                    ? `Selected: ${selectedFile.name} (click to replace)`
                    : 'Drop inspection PDF or photo here, click to browse, or press Ctrl+V to paste a snapshot'}
                </div>
                <div className="text-xs text-slate-500">
                  Supports PNG, JPG, WEBP snapshots and multi-page PDF inspection reports (up to 15 MB)
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Thumbnail / File summary + Detected Header Specs */}
          {report && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 md:grid-cols-12">
              {previewUrl && (
                <div className="md:col-span-3">
                  <img
                    src={previewUrl}
                    alt="Inspection report snapshot preview"
                    className="max-h-36 w-full rounded border border-slate-200 bg-white object-contain"
                  />
                </div>
              )}
              <div className={previewUrl ? 'md:col-span-9' : 'md:col-span-12'}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-800">
                      {report.reportTitle}
                    </h3>
                    {report.inspectorCompany && (
                      <p className="text-[11px] text-slate-500">
                        Inspector / Yard: {report.inspectorCompany}
                      </p>
                    )}
                  </div>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                    {editableItems.length} item{editableItems.length === 1 ? '' : 's'} detected
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                  <div className="rounded border border-slate-200 bg-white px-2.5 py-1.5">
                    <div className="text-[10px] uppercase text-slate-500">Size (OD)</div>
                    <div className="font-mono font-semibold text-slate-900">
                      {report.detectedSizeLabel ? `${report.detectedSizeLabel}"` : 'Mixed / Row'}
                    </div>
                  </div>
                  <div className="rounded border border-slate-200 bg-white px-2.5 py-1.5">
                    <div className="text-[10px] uppercase text-slate-500">Weight</div>
                    <div className="font-mono font-semibold text-slate-900">
                      {report.detectedWeightLbFt ? `${report.detectedWeightLbFt} lb/ft` : '—'}
                    </div>
                  </div>
                  <div className="rounded border border-slate-200 bg-white px-2.5 py-1.5">
                    <div className="text-[10px] uppercase text-slate-500">Grade</div>
                    <div className="font-mono font-semibold text-slate-900">
                      {report.detectedGrade || '—'}
                    </div>
                  </div>
                  <div className="rounded border border-slate-200 bg-white px-2.5 py-1.5">
                    <div className="text-[10px] uppercase text-slate-500">Connection</div>
                    <div className="font-mono font-semibold text-slate-900">
                      {report.detectedConnection || 'Per row'}
                    </div>
                  </div>
                  <div className="rounded border border-slate-200 bg-white px-2.5 py-1.5">
                    <div className="text-[10px] uppercase text-slate-500">Report Unit</div>
                    <div className="font-mono font-semibold text-slate-900">
                      {report.detectedUnit === 'unknown'
                        ? `Assume ${config.lengthUnit}`
                        : report.detectedUnit}
                    </div>
                  </div>
                </div>

                {report.notes && (
                  <p className="mt-2 text-[11px] text-slate-600">{report.notes}</p>
                )}
              </div>
            </div>
          )}

          {/* Extracted Review Table */}
          {editableItems.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-700">
                  Verify extracted joints before importing ({selectedItems.length} of{' '}
                  {editableItems.length} selected)
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {detectedDiffersFromActive && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-sky-800">
                      <input
                        type="checkbox"
                        checked={convertUnits}
                        onChange={(e) => setConvertUnits(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700"
                      />
                      Convert {report?.detectedUnit} → {config.lengthUnit} on tally import
                    </label>
                  )}
                </div>
              </div>

              <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="w-9 px-2.5 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          aria-label="Select all extracted rows"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700"
                        />
                      </th>
                      <th className="px-2 py-2">Jt / Tag</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Size</th>
                      <th className="px-2 py-2 text-right">Wt (lb/ft)</th>
                      <th className="px-2 py-2">Grade</th>
                      <th className="px-2 py-2">Top Conn</th>
                      <th className="px-2 py-2">Bot Conn</th>
                      <th className="px-2 py-2 text-right">Length</th>
                      <th className="px-2 py-2">Serial / Heat</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {editableItems.map((item) => {
                      const checked = selectedIds.has(item.id);
                      const isRejected = item.condition === 'rejected';
                      return (
                        <tr
                          key={item.id}
                          className={
                            isRejected
                              ? 'bg-red-50/50 text-red-900'
                              : checked
                                ? 'bg-white'
                                : 'bg-slate-50/60 opacity-60'
                          }
                        >
                          <td className="px-2.5 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleItem(item.id)}
                              aria-label={`Select joint ${item.jointNo}`}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={item.jointNo}
                              onChange={(e) => updateItem(item.id, { jointNo: e.target.value })}
                              className="h-7 w-16 rounded border border-slate-200 bg-white px-1.5 text-[11px] font-semibold text-slate-900 focus:border-sky-600 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5 font-sans">
                            <select
                              value={item.componentType}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  componentType: e.target.value as ComponentType,
                                })
                              }
                              className="h-7 rounded border border-slate-200 bg-white px-1 text-[11px] text-slate-800 focus:border-sky-600 focus:outline-none"
                            >
                              {COMPONENT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={item.sizeLabel}
                              onChange={(e) => updateItem(item.id, { sizeLabel: e.target.value })}
                              placeholder={config.pipeSizeLabel}
                              className="h-7 w-16 rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-800 focus:border-sky-600 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <NumericInput
                              value={item.weightLbFt}
                              onChangeValue={(val) => updateItem(item.id, { weightLbFt: val })}
                              allowEmpty
                              min={0.1}
                              placeholder={String(config.weightLbFt)}
                              className="h-7 w-16 rounded border border-slate-200 bg-white px-1.5 text-right text-[11px] text-slate-800 focus:border-sky-600 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={item.grade}
                              onChange={(e) => updateItem(item.id, { grade: e.target.value })}
                              placeholder={config.grade}
                              className="h-7 w-16 rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-800 focus:border-sky-600 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              list="inspection-conn-list"
                              value={item.topConnection}
                              onChange={(e) =>
                                updateItem(item.id, { topConnection: e.target.value })
                              }
                              className="h-7 w-24 rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-800 focus:border-sky-600 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              list="inspection-conn-list"
                              value={item.bottomConnection}
                              onChange={(e) =>
                                updateItem(item.id, { bottomConnection: e.target.value })
                              }
                              className="h-7 w-24 rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-800 focus:border-sky-600 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <NumericInput
                                value={item.measuredLength}
                                onChangeValue={(val) =>
                                  updateItem(item.id, { measuredLength: val ?? 0 })
                                }
                                min={0.01}
                                fallbackValue={0.5}
                                className="h-7 w-16 rounded border border-slate-200 bg-white px-1.5 text-right text-[11px] font-semibold text-slate-900 focus:border-sky-600 focus:outline-none"
                              />
                              <span className="text-[10px] text-slate-500">
                                {item.lengthUnit === 'unknown' ? config.lengthUnit : item.lengthUnit}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={item.serialNo}
                              onChange={(e) => updateItem(item.id, { serialNo: e.target.value })}
                              placeholder="—"
                              className="h-7 w-24 rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 focus:border-sky-600 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5 font-sans">
                            <select
                              value={item.condition}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  condition: e.target.value as InspectionReportItem['condition'],
                                })
                              }
                              className={`h-7 rounded border px-1 text-[11px] font-medium focus:outline-none ${
                                item.condition === 'rejected'
                                  ? 'border-red-300 bg-red-100 text-red-800'
                                  : item.condition === 'repair'
                                    ? 'border-amber-300 bg-amber-100 text-amber-800'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              }`}
                            >
                              <option value="accepted">Accepted</option>
                              <option value="rejected">Rejected</option>
                              <option value="repair">Repair</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <datalist id="inspection-conn-list">
                  {COMMON_CONNECTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* Options */}
              <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-slate-700">
                    <input
                      type="checkbox"
                      checked={alsoSaveLibrary}
                      onChange={(e) => setAlsoSaveLibrary(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700"
                    />
                    Also add extracted items to Pipe &amp; XO Library
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-slate-700">
                    <input
                      type="checkbox"
                      checked={applySpecsToString}
                      onChange={(e) => setApplySpecsToString(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700"
                    />
                    Update string specs from report header
                  </label>
                </div>

                <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 self-start">
                  <button
                    type="button"
                    onClick={() => setImportMode('append')}
                    className={`rounded px-2.5 py-1 text-xs font-medium ${
                      importMode === 'append' ? 'bg-sky-700 text-white' : 'text-slate-600'
                    }`}
                  >
                    Append
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`rounded px-2.5 py-1 text-xs font-medium ${
                      importMode === 'replace' ? 'bg-sky-700 text-white' : 'text-slate-600'
                    }`}
                  >
                    Replace Tally
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {editableItems.length > 0 && (
              <button
                type="button"
                disabled={selectedItems.length === 0 || loading}
                onClick={() => handleImport(true)}
                className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Save to Library Only ({selectedItems.length})
              </button>
            )}
            <button
              type="button"
              disabled={selectedItems.length === 0 || loading}
              onClick={() => handleImport(false)}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Import {selectedItems.length} to Running Tally
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
