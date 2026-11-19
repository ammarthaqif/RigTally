import React, { useState } from 'react';
import { Layers, X, Check } from 'lucide-react';
import type { ComponentType, LengthUnit, TallyRowInput } from '../types/tally';
import { COMMON_CONNECTIONS, createId } from '../utils/tallyEngine';
import { NumericInput } from './NumericInput';

interface BatchAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  lengthUnit: LengthUnit;
  nextJointNumber: number;
  onAddBatch: (rows: TallyRowInput[]) => void;
}

export const BatchAddModal: React.FC<BatchAddModalProps> = ({
  isOpen,
  onClose,
  lengthUnit,
  nextJointNumber,
  onAddBatch,
}) => {
  const [count, setCount] = useState(10);
  const [startNo, setStartNo] = useState(nextJointNumber);
  const [layer, setLayer] = useState<number | null>(null);
  const [nominalLength, setNominalLength] = useState(lengthUnit === 'm' ? 12.15 : 40.0);
  const [componentType, setComponentType] = useState<ComponentType>('joint');
  const [topConnectionOverride, setTopConnectionOverride] = useState('');
  const [bottomConnectionOverride, setBottomConnectionOverride] = useState('');
  const [remarks, setRemarks] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const safeCount = Math.max(1, Math.min(500, Math.floor(count)));
    const safeLen = Math.max(0.01, Number(nominalLength) || 0);
    const rows: TallyRowInput[] = [];

    for (let i = 0; i < safeCount; i++) {
      rows.push({
        id: createId(),
        jointNo: String(startNo + i),
        componentType,
        measuredLength: safeLen,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        topConnectionOverride: topConnectionOverride.trim(),
        bottomConnectionOverride: bottomConnectionOverride.trim(),
        serialNo: '',
        remarks: remarks.trim(),
        layer: layer ?? undefined,
      });
    }

    onAddBatch(rows);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Batch Add Joints"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-sky-700" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              Batch Add Pipe Joints
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

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Quantity
              </label>
              <NumericInput
                integer
                min={1}
                max={500}
                fallbackValue={1}
                value={count}
                onChangeValue={(val) => {
                  if (val !== null) setCount(val);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Start Jt #
              </label>
              <NumericInput
                integer
                min={1}
                fallbackValue={1}
                value={startNo}
                onChangeValue={(val) => {
                  if (val !== null) setStartNo(val);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Layer
              </label>
              <NumericInput
                integer
                allowEmpty
                min={1}
                placeholder="—"
                value={layer}
                onChangeValue={(val) => setLayer(val)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Measured Length ({lengthUnit})
              </label>
              <NumericInput
                step="0.01"
                min={0.01}
                fallbackValue={12}
                value={nominalLength}
                onChangeValue={(val) => {
                  if (val !== null) setNominalLength(val);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Component Type
              </label>
              <select
                value={componentType}
                onChange={(e) => setComponentType(e.target.value as ComponentType)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              >
                <option value="joint">Pipe Joint</option>
                <option value="pup">Pup Joint</option>
                <option value="landing">Landing Joint</option>
                <option value="bha">BHA / Sub</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Top Connection (Optional)
              </label>
              <input
                type="text"
                value={topConnectionOverride}
                onChange={(e) => setTopConnectionOverride(e.target.value)}
                list="batch-conn-list"
                placeholder="Default string top conn"
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Bottom Connection (Optional)
              </label>
              <input
                type="text"
                value={bottomConnectionOverride}
                onChange={(e) => setBottomConnectionOverride(e.target.value)}
                list="batch-conn-list"
                placeholder="Default string btm conn"
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
              <datalist id="batch-conn-list">
                {COMMON_CONNECTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Remarks (Optional)
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Rack #2 R3"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
            Total gross length to add:{' '}
            <strong className="font-mono text-slate-900">
              {(Math.max(1, count) * Math.max(0, nominalLength)).toFixed(2)} {lengthUnit}
            </strong>
          </div>
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
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800"
          >
            <Check className="h-4 w-4" />
            Add {Math.max(1, count)} Joints
          </button>
        </div>
      </form>
    </div>
  );
};
