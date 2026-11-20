import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  ChevronDown,
  AlertCircle,
  Check,
} from 'lucide-react';
import type {
  DeckJointItem,
  LengthUnit,
  LibraryItem,
  RunOrder,
  TallyConfig,
  TallyRecommendation,
  TallyRowInput,
} from './types/tally';
import {
  DEFAULT_CONFIG,
  DEFAULT_LIBRARY_ITEMS,
  PIPE_PRESETS,
  SAMPLE_DECK_JOINTS,
  SAMPLE_ROWS,
  computeTally,
  convertLength,
  createId,
  formatNum,
  libraryItemToTallyRow,
  recommendLibraryItems,
} from './utils/tallyEngine';
import { StringParamBar } from './components/StringParamBar';
import { SummaryStrip } from './components/SummaryStrip';
import { TallyGrid } from './components/TallyGrid';
import { TallyProgressChart } from './components/TallyProgressChart';
import { CantileverDeckView } from './components/CantileverDeckView';
import { EquipmentLibraryView } from './components/EquipmentLibraryView';
import { LibraryRecommendationsCard } from './components/LibraryRecommendationsCard';
import { QuantityPlanner } from './components/QuantityPlanner';
import { WellSpecsView } from './components/WellSpecsView';
import { ImportExcelModal } from './components/ImportExcelModal';
import { ImportInspectionModal } from './components/ImportInspectionModal';
import { PasteTallyModal } from './components/PasteTallyModal';
import { BatchAddModal } from './components/BatchAddModal';

type WorkspaceTab = 'tally' | 'deck' | 'library' | 'quantity' | 'specs';

interface StringDocument {
  config: TallyConfig;
  rows: TallyRowInput[];
  deckJoints: DeckJointItem[];
}

const STORAGE_KEY = 'rigtally_workspace_v2';
const LIBRARY_STORAGE_KEY = 'rigtally_library_v1';

function createInitialLibrary(): LibraryItem[] {
  try {
    const saved = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((item) => item && item.id && item.measuredLength > 0);
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_LIBRARY_ITEMS;
}

function createInitialDocuments(): { docs: StringDocument[]; activeId: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as { docs: StringDocument[]; activeId: string };
      if (Array.isArray(parsed.docs) && parsed.docs.length > 0) {
        const normalizedDocs = parsed.docs
          .filter((d) => d && d.config)
          .map((d) => {
            const mergedConfig: TallyConfig = {
              ...DEFAULT_CONFIG,
              ...d.config,
              topConnection:
                d.config.topConnection ?? d.config.connection ?? DEFAULT_CONFIG.topConnection,
              bottomConnection:
                d.config.bottomConnection ?? d.config.connection ?? DEFAULT_CONFIG.bottomConnection,
            };
            return {
              config: mergedConfig,
              rows: Array.isArray(d.rows) ? d.rows : [],
              deckJoints: Array.isArray(d.deckJoints) ? d.deckJoints : [],
            };
          });
        if (normalizedDocs.length > 0) {
          const validActiveId = normalizedDocs.some((d) => d.config.id === parsed.activeId)
            ? parsed.activeId
            : normalizedDocs[0].config.id;
          return {
            docs: normalizedDocs,
            activeId: validActiveId,
          };
        }
      }
    }
  } catch {
    // ignore storage errors
  }

  const conductorPreset = PIPE_PRESETS.find((p) => p.sizeIn === 20)!;
  const tubingPreset = PIPE_PRESETS.find((p) => p.sizeIn === 3.5)!;

  const casingDoc: StringDocument = {
    config: DEFAULT_CONFIG,
    rows: SAMPLE_ROWS,
    deckJoints: SAMPLE_DECK_JOINTS,
  };

  const conductorDoc: StringDocument = {
    config: {
      ...DEFAULT_CONFIG,
      id: 'default-conductor-run',
      stringName: conductorPreset.label,
      stringCategory: 'conductor',
      pipeSizeIn: conductorPreset.sizeIn,
      pipeSizeLabel: conductorPreset.sizeLabel,
      weightLbFt: conductorPreset.defaultWeight,
      grade: conductorPreset.defaultGrade,
      connection: conductorPreset.defaultConnection,
      topConnection: conductorPreset.defaultConnection,
      bottomConnection: conductorPreset.defaultConnection,
      defaultMakeUpLoss: conductorPreset.defaultMakeUpLossIn,
      makeUpLossUnit: 'in',
      sectionTd: 62,
      shoeOffTd: 2,
      targetDepth: 60,
      hasHanger: false,
      hangerDepth: 0,
      hangerStickupTarget: 1.5,
      mudWeightPpg: 9.2,
    },
    deckJoints: [
      { id: createId(), jointNo: 1, layer: 1, measuredLength: 12.12, serialNo: 'C-201', remarks: '', discarded: false, discardReason: '' },
      { id: createId(), jointNo: 2, layer: 1, measuredLength: 12.08, serialNo: 'C-202', remarks: '', discarded: false, discardReason: '' },
      { id: createId(), jointNo: 3, layer: 1, measuredLength: 12.16, serialNo: 'C-203', remarks: '', discarded: false, discardReason: '' },
      { id: createId(), jointNo: 4, layer: 2, measuredLength: 12.14, serialNo: 'C-204', remarks: '', discarded: false, discardReason: '' },
      { id: createId(), jointNo: 5, layer: 2, measuredLength: 12.05, serialNo: 'C-205', remarks: '', discarded: false, discardReason: '' },
    ],
    rows: [
      {
        id: createId(),
        jointNo: 'SHOE',
        componentType: 'shoe',
        measuredLength: 0.75,
        makeUpLossOverride: 0,
        weightLbFtOverride: 140,
        gradeOverride: 'K-55',
        serialNo: 'CS-20-01',
        remarks: '20" Guide Shoe',
      },
      {
        id: createId(),
        jointNo: '1',
        componentType: 'joint',
        measuredLength: 12.12,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        serialNo: 'C-201',
        remarks: 'Layer 1',
        layer: 1,
      },
      {
        id: createId(),
        jointNo: '2',
        componentType: 'joint',
        measuredLength: 12.08,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        serialNo: 'C-202',
        remarks: 'Layer 1',
        layer: 1,
      },
      {
        id: createId(),
        jointNo: '3',
        componentType: 'joint',
        measuredLength: 12.16,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        serialNo: 'C-203',
        remarks: 'Layer 1',
        layer: 1,
      },
      {
        id: createId(),
        jointNo: '4',
        componentType: 'joint',
        measuredLength: 12.14,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        serialNo: 'C-204',
        remarks: 'Layer 2',
        layer: 2,
      },
      {
        id: createId(),
        jointNo: '5',
        componentType: 'joint',
        measuredLength: 12.05,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        serialNo: 'C-205',
        remarks: 'Landing joint · Layer 2',
        layer: 2,
      },
    ],
  };

  const tubingDoc: StringDocument = {
    config: {
      ...DEFAULT_CONFIG,
      id: 'default-tubing-run',
      stringName: tubingPreset.label,
      stringCategory: 'tubing',
      pipeSizeIn: tubingPreset.sizeIn,
      pipeSizeLabel: tubingPreset.sizeLabel,
      weightLbFt: tubingPreset.defaultWeight,
      grade: tubingPreset.defaultGrade,
      connection: tubingPreset.defaultConnection,
      topConnection: tubingPreset.defaultConnection,
      bottomConnection: tubingPreset.defaultConnection,
      defaultMakeUpLoss: tubingPreset.defaultMakeUpLossIn,
      makeUpLossUnit: 'in',
      sectionTd: 110,
      shoeOffTd: 5,
      targetDepth: 105,
      hasHanger: true,
      hangerDepth: 35,
      hangerStickupTarget: 1.8,
      mudWeightPpg: 9.5,
    },
    deckJoints: [
      { id: createId(), jointNo: 1, layer: 1, measuredLength: 9.54, serialNo: 'TB-101', remarks: '', discarded: false, discardReason: '' },
      { id: createId(), jointNo: 2, layer: 1, measuredLength: 9.61, serialNo: 'TB-102', remarks: '', discarded: false, discardReason: '' },
      { id: createId(), jointNo: 3, layer: 1, measuredLength: 9.48, serialNo: 'TB-103', remarks: '', discarded: false, discardReason: '' },
    ],
    rows: [
      {
        id: createId(),
        jointNo: 'BHA-1',
        componentType: 'bha',
        measuredLength: 2.85,
        makeUpLossOverride: 0,
        weightLbFtOverride: 14.5,
        gradeOverride: 'L-80 13Cr',
        serialNo: 'PKR-350',
        remarks: 'Production Packer + Wireline Entry Guide',
      },
      {
        id: createId(),
        jointNo: '1',
        componentType: 'joint',
        measuredLength: 9.54,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        serialNo: 'TB-101',
        remarks: 'Layer 1',
        layer: 1,
      },
      {
        id: createId(),
        jointNo: '2',
        componentType: 'joint',
        measuredLength: 9.61,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        serialNo: 'TB-102',
        remarks: 'Layer 1',
        layer: 1,
      },
      {
        id: createId(),
        jointNo: '3',
        componentType: 'joint',
        measuredLength: 9.48,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        serialNo: 'TB-103',
        remarks: 'Layer 1',
        layer: 1,
      },
    ],
  };

  return {
    docs: [casingDoc, conductorDoc, tubingDoc],
    activeId: casingDoc.config.id,
  };
}

export default function App() {
  const initial = useMemo(() => createInitialDocuments(), []);
  const [docs, setDocs] = useState<StringDocument[]>(initial.docs);
  const [activeId, setActiveId] = useState<string>(initial.activeId);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>(() => createInitialLibrary());
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('tally');

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'excel' | 'pdf' | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const hasMountedStorageRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ docs, activeId }));
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(libraryItems));
      if (hasMountedStorageRef.current) {
        setSavedVisible(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => {
          setSavedVisible(false);
        }, 2200);
      } else {
        hasMountedStorageRef.current = true;
      }
    } catch {
      // ignore quota errors
    }
  }, [docs, activeId, libraryItems]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const activeDoc = useMemo(
    () => docs.find((d) => d.config.id === activeId) ?? docs[0],
    [docs, activeId]
  );

  const computed = useMemo(
    () => computeTally(activeDoc.config, activeDoc.rows),
    [activeDoc.config, activeDoc.rows]
  );

  const libraryRecommendations = useMemo(
    () => recommendLibraryItems(activeDoc.config, computed, libraryItems),
    [activeDoc.config, computed, libraryItems]
  );

  const nextJointNumber = useMemo(() => {
    let maxNum = 0;
    for (const r of activeDoc.rows) {
      const n = Number(r.jointNo);
      if (Number.isInteger(n) && n > maxNum) maxNum = n;
    }
    return maxNum + 1;
  }, [activeDoc.rows]);

  const updateActiveDoc = (updater: (doc: StringDocument) => StringDocument) => {
    setDocs((prev) =>
      prev.map((d) => (d.config.id === activeDoc.config.id ? updater(d) : d))
    );
  };

  const handleUpdateConfig = (patch: Partial<TallyConfig>) => {
    updateActiveDoc((d) => ({
      ...d,
      config: { ...d.config, ...patch, updatedAt: new Date().toISOString() },
    }));
  };

  const handleChangeLengthUnit = (newUnit: LengthUnit, convertValues: boolean) => {
    const oldUnit = activeDoc.config.lengthUnit;
    if (oldUnit === newUnit) return;

    updateActiveDoc((d) => ({
      config: {
        ...d.config,
        lengthUnit: newUnit,
        sectionTd: convertValues
          ? Number(convertLength(d.config.sectionTd || 0, oldUnit, newUnit).toFixed(2))
          : d.config.sectionTd,
        shoeOffTd: convertValues
          ? Number(convertLength(d.config.shoeOffTd || 0, oldUnit, newUnit).toFixed(2))
          : d.config.shoeOffTd,
        targetDepth: convertValues
          ? Number(convertLength(d.config.targetDepth, oldUnit, newUnit).toFixed(2))
          : d.config.targetDepth,
        hangerDepth: convertValues
          ? Number(convertLength(d.config.hangerDepth || 0, oldUnit, newUnit).toFixed(2))
          : d.config.hangerDepth,
        hangerStickupTarget: convertValues
          ? Number(convertLength(d.config.hangerStickupTarget || 0, oldUnit, newUnit).toFixed(2))
          : d.config.hangerStickupTarget,
        updatedAt: new Date().toISOString(),
      },
      rows: convertValues
        ? d.rows.map((r) => ({
            ...r,
            measuredLength: Number(convertLength(r.measuredLength, oldUnit, newUnit).toFixed(3)),
          }))
        : d.rows,
      deckJoints: convertValues
        ? d.deckJoints.map((j) => ({
            ...j,
            measuredLength: Number(convertLength(j.measuredLength, oldUnit, newUnit).toFixed(3)),
          }))
        : d.deckJoints,
    }));

    setNotice({
      type: 'success',
      text: `Converted tally & deck measurements from ${oldUnit} to ${newUnit}.`,
    });
  };

  const handleAddRow = (row: TallyRowInput, insertAfterId?: string) => {
    updateActiveDoc((d) => {
      if (!insertAfterId) {
        return { ...d, rows: [...d.rows, row] };
      }
      const idx = d.rows.findIndex((r) => r.id === insertAfterId);
      if (idx === -1) return { ...d, rows: [...d.rows, row] };
      const copy = [...d.rows];
      copy.splice(idx + 1, 0, row);
      return { ...d, rows: copy };
    });
  };

  const handleAddBatchRows = (rows: TallyRowInput[], mode: 'append' | 'replace' = 'append') => {
    updateActiveDoc((d) => ({
      ...d,
      rows: mode === 'replace' ? rows : [...d.rows, ...rows],
    }));
    setNotice({
      type: 'success',
      text: `${mode === 'replace' ? 'Populated tally with' : 'Added'} ${rows.length} pieces.`,
    });
  };

  const handleUpdateRow = (id: string, patch: Partial<TallyRowInput>) => {
    updateActiveDoc((d) => ({
      ...d,
      rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const handleBulkUpdateRows = (ids: string[], patch: Partial<TallyRowInput>) => {
    const idSet = new Set(ids);
    updateActiveDoc((d) => ({
      ...d,
      rows: d.rows.map((r) => (idSet.has(r.id) ? { ...r, ...patch } : r)),
    }));
  };

  const handleBulkDeleteRows = (ids: string[]) => {
    const idSet = new Set(ids);
    updateActiveDoc((d) => ({
      ...d,
      rows: d.rows.filter((r) => !idSet.has(r.id)),
    }));
    setNotice({
      type: 'success',
      text: `Deleted ${ids.length} selected row${ids.length === 1 ? '' : 's'}.`,
    });
  };

  const handleDeleteRow = (id: string) => {
    updateActiveDoc((d) => ({
      ...d,
      rows: d.rows.filter((r) => r.id !== id),
    }));
  };

  const handleMoveRow = (id: string, direction: 'up' | 'down') => {
    updateActiveDoc((d) => {
      const idx = d.rows.findIndex((r) => r.id === id);
      if (idx === -1) return d;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= d.rows.length) return d;
      const copy = [...d.rows];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      return { ...d, rows: copy };
    });
  };

  const handleDuplicateRow = (id: string) => {
    updateActiveDoc((d) => {
      const idx = d.rows.findIndex((r) => r.id === id);
      if (idx === -1) return d;
      const src = d.rows[idx];
      const clone: TallyRowInput = {
        ...src,
        id: createId(),
        jointNo: String(nextJointNumber),
      };
      const copy = [...d.rows];
      copy.splice(idx + 1, 0, clone);
      return { ...d, rows: copy };
    });
  };

  const handleClearAll = () => {
    updateActiveDoc((d) => ({ ...d, rows: [] }));
  };

  const handleSaveToLibrary = (newItems: LibraryItem[]) => {
    if (newItems.length === 0) return;
    setLibraryItems((prev) => [...newItems, ...prev]);
    setNotice({
      type: 'success',
      text: `Saved ${newItems.length} item${newItems.length === 1 ? '' : 's'} to Pipe & XO Library.`,
    });
  };

  const handleAddLibraryItemToTally = (
    item: LibraryItem,
    count = 1,
    insertAfterRowId?: string
  ) => {
    const qty = Math.max(1, count);
    const rowsToAdd: TallyRowInput[] = [];
    let jtCursor = nextJointNumber;

    for (let i = 0; i < qty; i++) {
      const jointTag =
        item.category === 'joint'
          ? String(jtCursor++)
          : item.category === 'xo'
            ? item.itemCode.startsWith('XO')
              ? item.itemCode
              : 'XO'
            : item.itemCode;
      rowsToAdd.push(libraryItemToTallyRow(item, activeDoc.config.lengthUnit, jointTag));
    }

    if (insertAfterRowId && rowsToAdd.length === 1) {
      handleAddRow(rowsToAdd[0], insertAfterRowId);
    } else {
      handleAddBatchRows(rowsToAdd, 'append');
    }

    setLibraryItems((prev) =>
      prev.map((lib) =>
        lib.id === item.id
          ? { ...lib, quantityAvailable: Math.max(0, lib.quantityAvailable - qty) }
          : lib
      )
    );

    setNotice({
      type: 'success',
      text: `Added ${qty}× ${item.itemCode} from library to running tally.`,
    });
  };

  const handleApplyRecommendation = (rec: TallyRecommendation) => {
    handleAddLibraryItemToTally(
      rec.libraryItem,
      rec.recommendedCount,
      rec.insertAfterRowId
    );
  };

  const handleCreateString = () => {
    const newId = createId();
    const newDoc: StringDocument = {
      config: {
        ...activeDoc.config,
        id: newId,
        stringName: `New String #${docs.length + 1}`,
        updatedAt: new Date().toISOString(),
      },
      rows: [],
      deckJoints: [],
    };
    setDocs((prev) => [...prev, newDoc]);
    setActiveId(newId);
    setActiveTab('tally');
  };

  const handleDeleteString = (id: string) => {
    if (docs.length <= 1) return;
    const remaining = docs.filter((d) => d.config.id !== id);
    setDocs(remaining);
    if (activeId === id) {
      setActiveId(remaining[0].config.id);
    }
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExportMenuOpen(false);
    setExportingFormat(format);
    try {
      const res = await fetch(`/api/tally/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: activeDoc.config,
          computed,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to export ${format.toUpperCase()}.`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (activeDoc.config.stringName || 'pipe_tally').replace(
        /[^a-zA-Z0-9_-]+/g,
        '_'
      );
      a.href = url;
      a.download = `${safeName}_tally.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setNotice({
        type: 'success',
        text: `Exported ${format === 'excel' ? 'Excel (.xlsx)' : 'PDF (.pdf)'} running tally.`,
      });
    } catch (err) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Export failed.',
      });
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900 md:pb-10">
      {/* Top Bar Contract: 1 row, 3 zones separated by gap-8 */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          {/* Zone 1: Single text wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('tally');
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            RigTally
          </a>

          {/* Zone 2: Clean single-line navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden items-center gap-7 text-sm font-medium md:flex"
          >
            {(
              [
                { id: 'tally', label: 'Running Tally' },
                { id: 'deck', label: 'Cantilever Deck' },
                { id: 'library', label: 'Pipe & XO Library' },
                { id: 'quantity', label: 'Quantity Planner' },
                { id: 'specs', label: 'Well & Pipe Specs' },
              ] as Array<{ id: WorkspaceTab; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === item.id
                    ? 'border-sky-700 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action (Export Menu) */}
          <div className="relative shrink-0" ref={exportMenuRef}>
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => setExportMenuOpen((v) => !v)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              {exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : 'Export Tally'}
              <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 z-30 mt-1.5 w-52 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => void handleExport('excel')}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                  <div>
                    <div>Export Excel (.xlsx)</div>
                    <div className="text-[11px] text-slate-500">Live formulas + summary</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => void handleExport('pdf')}
                  className="flex w-full items-center gap-2.5 border-t border-slate-100 px-3.5 py-2.5 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50"
                >
                  <FileText className="h-4 w-4 text-sky-700" />
                  <div>
                    <div>Export PDF (.pdf)</div>
                    <div className="text-[11px] text-slate-500">Print-ready rig tally sheet</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto max-w-[1440px] space-y-4 px-4 pt-4 sm:px-6">
        {/* Mobile Tab Switcher */}
        <div className="grid grid-cols-5 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 md:hidden">
          {(
            [
              { id: 'tally', label: 'Tally' },
              { id: 'deck', label: 'Deck' },
              { id: 'library', label: 'Library' },
              { id: 'quantity', label: 'Qty' },
              { id: 'specs', label: 'Specs' },
            ] as Array<{ id: WorkspaceTab; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[38px] rounded px-1 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                activeTab === item.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* String Switcher & Well Context Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {docs.map((doc) => {
              const active = doc.config.id === activeDoc.config.id;
              return (
                <div
                  key={doc.config.id}
                  className={`inline-flex items-center rounded-md border text-xs font-medium transition-colors ${
                    active
                      ? 'border-sky-700 bg-sky-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(doc.config.id)}
                    className="px-3 py-1.5 whitespace-nowrap"
                  >
                    {doc.config.pipeSizeLabel}&quot; {doc.config.stringCategory}
                  </button>
                  {docs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteString(doc.config.id)}
                      aria-label={`Remove ${doc.config.stringName}`}
                      className={`mr-1 rounded p-1 transition-colors ${
                        active
                          ? 'text-sky-100 hover:bg-sky-800 hover:text-white'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                      }`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={handleCreateString}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              New String
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{activeDoc.config.wellName}</span>
            <span aria-hidden="true">·</span>
            <span>{activeDoc.config.rigName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">
              {activeDoc.config.grade} · {activeDoc.config.connection}
            </span>
          </div>
        </div>

        {/* Inline Status Notice */}
        {notice && (
          <div
            role="status"
            className={`flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-xs font-medium ${
              notice.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {notice.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : (
              <Check className="h-4 w-4 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {/* Active View Content */}
        {activeTab === 'tally' && (
          <>
            <StringParamBar
              config={activeDoc.config}
              onUpdateConfig={handleUpdateConfig}
              onChangeLengthUnit={handleChangeLengthUnit}
            />

            <SummaryStrip config={activeDoc.config} computed={computed} />

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-9">
                <TallyGrid
                  config={activeDoc.config}
                  rawRows={activeDoc.rows}
                  computed={computed}
                  nextJointNumber={nextJointNumber}
                  onAddRow={handleAddRow}
                  onAddBatchRows={(rows) => handleAddBatchRows(rows, 'append')}
                  onUpdateRow={handleUpdateRow}
                  onBulkUpdateRows={handleBulkUpdateRows}
                  onBulkDeleteRows={handleBulkDeleteRows}
                  onDeleteRow={handleDeleteRow}
                  onMoveRow={handleMoveRow}
                  onDuplicateRow={handleDuplicateRow}
                  onClearAll={handleClearAll}
                  onToggleRunOrder={(order: RunOrder) => handleUpdateConfig({ runOrder: order })}
                  onOpenBatchModal={() => setBatchModalOpen(true)}
                  onOpenPasteModal={() => setPasteModalOpen(true)}
                  onOpenExcelModal={() => setExcelModalOpen(true)}
                  onOpenInspectionModal={() => setInspectionModalOpen(true)}
                  onLoadSample={() => handleAddBatchRows(SAMPLE_ROWS, 'replace')}
                />
              </div>

              <div className="min-w-0 space-y-4 lg:col-span-3">
                <TallyProgressChart config={activeDoc.config} computed={computed} />
                <LibraryRecommendationsCard
                  config={activeDoc.config}
                  recommendations={libraryRecommendations}
                  onApplyRecommendation={handleApplyRecommendation}
                  onOpenLibrary={() => setActiveTab('library')}
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'deck' && (
          <CantileverDeckView
            config={activeDoc.config}
            deckJoints={activeDoc.deckJoints}
            onChangeDeckJoints={(deckJoints) => updateActiveDoc((d) => ({ ...d, deckJoints }))}
            onUpdateConfig={handleUpdateConfig}
            onApplyAutoTally={(rows) => {
              handleAddBatchRows(rows, 'replace');
              setActiveTab('tally');
            }}
          />
        )}

        {activeTab === 'library' && (
          <EquipmentLibraryView
            config={activeDoc.config}
            library={libraryItems}
            recommendations={libraryRecommendations}
            onChangeLibrary={setLibraryItems}
            onResetLibrary={() => {
              setLibraryItems(DEFAULT_LIBRARY_ITEMS);
              setNotice({ type: 'success', text: 'Reset Pipe & XO Library to default rig inventory.' });
            }}
            onAddLibraryItemToTally={handleAddLibraryItemToTally}
            onApplyRecommendation={handleApplyRecommendation}
            onOpenInspectionModal={() => setInspectionModalOpen(true)}
          />
        )}

        {activeTab === 'quantity' && (
          <QuantityPlanner
            config={activeDoc.config}
            onUpdateConfig={handleUpdateConfig}
            onPopulateTally={(rows, targetDepth) => {
              handleUpdateConfig({
                sectionTd: targetDepth + (activeDoc.config.shoeOffTd || 0),
                targetDepth,
              });
              handleAddBatchRows(rows, 'replace');
              setActiveTab('tally');
            }}
          />
        )}

        {activeTab === 'specs' && (
          <WellSpecsView config={activeDoc.config} onUpdateConfig={handleUpdateConfig} />
        )}
      </main>

      {/* Mobile Compact Bottom Totals Bar (< 15% viewport height) */}
      {activeTab === 'tally' && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex h-14 items-center justify-between border-t border-slate-200 bg-white/95 px-4 backdrop-blur-xs md:hidden">
          <div className="font-mono text-xs tabular-nums">
            <div className="font-semibold text-slate-900">
              {formatNum(computed.summary.totalEffectiveLength, 2)} {activeDoc.config.lengthUnit}
              <span className="ml-1.5 font-normal text-slate-500">
                ({computed.summary.totalJoints} pcs)
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              {formatNum(computed.summary.totalAirWeightLbs, 0)} lbs ·{' '}
              {formatNum(computed.summary.totalAirWeightTonnes, 1)} MT
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleExport('excel')}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Excel
          </button>
        </div>
      )}

      {/* Ingestion & Batch Modals */}
      <ImportExcelModal
        isOpen={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        lengthUnit={activeDoc.config.lengthUnit}
        nextJointNumber={nextJointNumber}
        onImportRows={(rows, mode) => handleAddBatchRows(rows, mode)}
      />

      <ImportInspectionModal
        isOpen={inspectionModalOpen}
        onClose={() => setInspectionModalOpen(false)}
        config={activeDoc.config}
        nextJointNumber={nextJointNumber}
        onImportToTally={(rows, mode, configPatch) => {
          if (configPatch) {
            handleUpdateConfig(configPatch);
          }
          handleAddBatchRows(rows, mode);
        }}
        onSaveToLibrary={handleSaveToLibrary}
      />

      <PasteTallyModal
        isOpen={pasteModalOpen}
        onClose={() => setPasteModalOpen(false)}
        lengthUnit={activeDoc.config.lengthUnit}
        nextJointNumber={nextJointNumber}
        onImportRows={(rows, mode) => handleAddBatchRows(rows, mode)}
      />

      <BatchAddModal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        lengthUnit={activeDoc.config.lengthUnit}
        nextJointNumber={nextJointNumber}
        onAddBatch={(rows) => handleAddBatchRows(rows, 'append')}
      />

      {/* Quiet Engineering Footer */}
      <footer className="mx-auto mt-8 max-w-[1440px] border-t border-slate-200 px-4 py-4 text-xs text-slate-500 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <span>RigTally · Conductor, Casing &amp; Tubing Running Tally</span>
          <span>
            {activeDoc.config.engineerName
              ? `Prepared by ${activeDoc.config.engineerName}`
              : 'Local-first engineering workstation'}
          </span>
        </div>
      </footer>

      {/* Bottom-Right Automatic Local Draft Saved Indicator */}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-16 right-4 z-30 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm transition-all duration-150 md:bottom-4 ${
          savedVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-1 opacity-0'
        }`}
      >
        <Check className="h-3.5 w-3.5 text-emerald-700" />
        <span>Saved</span>
      </div>
    </div>
  );
}
