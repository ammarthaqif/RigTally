import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LengthUnit, MakeUpLossUnit, StringCategory, TallyConfig } from '../types/tally';
import { COMMON_CONNECTIONS, PIPE_PRESETS, getTargetShoeDepth } from '../utils/tallyEngine';
import { NumericInput } from './NumericInput';

interface StringParamBarProps {
  config: TallyConfig;
  onUpdateConfig: (patch: Partial<TallyConfig>) => void;
  onChangeLengthUnit: (newUnit: LengthUnit, convertValues: boolean) => void;
}

export const StringParamBar: React.FC<StringParamBarProps> = ({
  config,
  onUpdateConfig,
  onChangeLengthUnit,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredPresets = PIPE_PRESETS.filter((p) => p.category === config.stringCategory);
  const targetShoeDepth = getTargetShoeDepth(config);

  const handleCategoryChange = (cat: StringCategory) => {
    const first = PIPE_PRESETS.find((p) => p.category === cat);
    if (first) {
      onUpdateConfig({
        stringCategory: cat,
        stringName: first.label,
        pipeSizeIn: first.sizeIn,
        pipeSizeLabel: first.sizeLabel,
        weightLbFt: first.defaultWeight,
        grade: first.defaultGrade,
        connection: first.defaultConnection,
        topConnection: first.defaultConnection,
        bottomConnection: first.defaultConnection,
        defaultMakeUpLoss: first.defaultMakeUpLossIn,
        makeUpLossUnit: 'in',
        hasHanger: cat === 'conductor' ? false : config.hasHanger,
      });
    } else {
      onUpdateConfig({ stringCategory: cat });
    }
  };

  const handlePresetSelect = (sizeInStr: string) => {
    const preset = PIPE_PRESETS.find(
      (p) => p.category === config.stringCategory && String(p.sizeIn) === sizeInStr
    );
    if (!preset) return;
    onUpdateConfig({
      stringName: preset.label,
      pipeSizeIn: preset.sizeIn,
      pipeSizeLabel: preset.sizeLabel,
      weightLbFt: preset.defaultWeight,
      grade: preset.defaultGrade,
      connection: preset.defaultConnection,
      topConnection: preset.defaultConnection,
      bottomConnection: preset.defaultConnection,
      defaultMakeUpLoss: preset.defaultMakeUpLossIn,
      makeUpLossUnit: 'in',
    });
  };

  const activePreset = filteredPresets.find((p) => p.sizeIn === config.pipeSizeIn);
  const unit = config.lengthUnit;

  return (
    <section
      aria-label="String Engineering Parameters"
      className="rounded-lg border border-slate-200 bg-white"
    >
      {/* Mobile toggle header */}
      <div className="flex items-center justify-between px-4 py-3 md:hidden">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">
            {config.pipeSizeLabel}&quot; {config.stringCategory} · {config.weightLbFt} lb/ft ·{' '}
            {config.connection || 'Conn'}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Shoe: {targetShoeDepth.toFixed(1)} {unit} · MU: {config.defaultMakeUpLoss}{' '}
            {config.makeUpLossUnit}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex min-h-[40px] items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          Specs
          {mobileOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Parameter controls */}
      <div
        className={`${
          mobileOpen ? 'block border-t border-slate-200' : 'hidden'
        } space-y-3.5 p-4 md:block`}
      >
        {/* Row 1: Pipe Specifications */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          {/* String Category */}
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              String Type
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1">
              {(['conductor', 'casing', 'tubing'] as StringCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`rounded px-1.5 py-1.5 text-[11px] font-medium capitalize transition-colors whitespace-nowrap ${
                    config.stringCategory === cat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Pipe OD Size (in) */}
          <div className="lg:col-span-3">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Pipe Size OD (in)
            </label>
            <div className="flex gap-1.5">
              <select
                aria-label="Pipe OD Preset"
                value={activePreset ? String(activePreset.sizeIn) : 'custom'}
                onChange={(e) => {
                  if (e.target.value !== 'custom') handlePresetSelect(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-900 focus:border-sky-600 focus:outline-none"
              >
                {filteredPresets.map((p) => (
                  <option key={p.sizeIn} value={String(p.sizeIn)}>
                    {p.sizeLabel}&quot; ({p.sizeIn})
                  </option>
                ))}
                {!activePreset && (
                  <option value="custom">{config.pipeSizeLabel}&quot; Custom</option>
                )}
              </select>
              <NumericInput
                step="0.001"
                min={0.5}
                fallbackValue={config.pipeSizeIn}
                aria-label="Custom OD inches"
                value={config.pipeSizeIn}
                onChangeValue={(val) => {
                  if (val !== null) {
                    onUpdateConfig({
                      pipeSizeIn: val,
                      pipeSizeLabel: String(val),
                    });
                  }
                }}
                className="w-20 shrink-0 rounded-md border border-slate-300 px-2 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Nominal Weight (lb/ft) */}
          <div className="lg:col-span-1">
            <label className="mb-1.5 block text-xs font-medium text-slate-600 whitespace-nowrap">
              Wt (lb/ft)
            </label>
            <NumericInput
              step="0.1"
              min={0.1}
              fallbackValue={config.weightLbFt}
              value={config.weightLbFt}
              onChangeValue={(val) => {
                if (val !== null) onUpdateConfig({ weightLbFt: val });
              }}
              list="pipe-weight-options"
              className="w-full rounded-md border border-slate-300 px-2 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
            />
            <datalist id="pipe-weight-options">
              {(activePreset?.weights ?? [68, 53.5, 47, 29, 12.6, 9.3, 6.5]).map((w) => (
                <option key={w} value={w} />
              ))}
            </datalist>
          </div>

          {/* Default Top & Bottom Connections */}
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Conn (Top / Bottom)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="text"
                value={config.topConnection ?? config.connection}
                onChange={(e) => {
                  const top = e.target.value;
                  const bot = config.bottomConnection ?? config.connection;
                  onUpdateConfig({
                    topConnection: top,
                    connection: top === bot ? top : [top, bot].filter(Boolean).join(' / '),
                  });
                }}
                list="common-connections-list"
                placeholder="Top"
                title="Default Top Connection (Box)"
                aria-label="Default Top Connection"
                className="w-full rounded-md border border-slate-300 px-2 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
              <input
                type="text"
                value={config.bottomConnection ?? config.connection}
                onChange={(e) => {
                  const bot = e.target.value;
                  const top = config.topConnection ?? config.connection;
                  onUpdateConfig({
                    bottomConnection: bot,
                    connection: top === bot ? top : [top, bot].filter(Boolean).join(' / '),
                  });
                }}
                list="common-connections-list"
                placeholder="Btm"
                title="Default Bottom Connection (Pin)"
                aria-label="Default Bottom Connection"
                className="w-full rounded-md border border-slate-300 px-2 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
            <datalist id="common-connections-list">
              {COMMON_CONNECTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {/* Length Unit */}
          <div className="lg:col-span-1">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Unit</label>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1">
              {(['m', 'ft'] as LengthUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    if (config.lengthUnit !== u) {
                      onChangeLengthUnit(u, true);
                    }
                  }}
                  title={`Switch to ${u === 'm' ? 'meters' : 'feet'} (converts values)`}
                  className={`rounded px-1.5 py-1.5 font-mono text-xs font-medium transition-colors whitespace-nowrap ${
                    config.lengthUnit === u
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Make-Up Loss */}
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Make-Up Loss / Jt
            </label>
            <div className="flex">
              <NumericInput
                step="0.01"
                min={0}
                fallbackValue={0}
                value={config.defaultMakeUpLoss}
                onChangeValue={(val) => {
                  if (val !== null) onUpdateConfig({ defaultMakeUpLoss: val });
                }}
                className="w-full rounded-l-md border border-r-0 border-slate-300 px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
              <select
                aria-label="Make-up loss unit"
                value={config.makeUpLossUnit}
                onChange={(e) =>
                  onUpdateConfig({ makeUpLossUnit: e.target.value as MakeUpLossUnit })
                }
                className="rounded-r-md border border-slate-300 bg-slate-50 px-2 py-2 font-mono text-xs text-slate-700 focus:border-sky-600 focus:outline-none"
              >
                <option value="in">in</option>
                <option value="ft">ft</option>
                <option value="m">m</option>
              </select>
            </div>
          </div>

          {/* Mud Weight */}
          <div className="lg:col-span-1">
            <label className="mb-1.5 block text-xs font-medium text-slate-600 whitespace-nowrap">
              MW (ppg)
            </label>
            <NumericInput
              step="0.1"
              min={0}
              max={25}
              fallbackValue={0}
              value={config.mudWeightPpg}
              onChangeValue={(val) => {
                if (val !== null) onUpdateConfig({ mudWeightPpg: val });
              }}
              className="w-full rounded-md border border-slate-300 px-2 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Row 2: Section TD, Shoe Off-TD & Hanger / Landing Parameters */}
        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-2">
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

          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Shoe Off TD ({unit})
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

          <div className="lg:col-span-2">
            <div className="mb-1 text-xs font-medium text-slate-500">Target Shoe Depth</div>
            <div className="flex h-[34px] items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 font-mono text-xs font-semibold text-slate-900 tabular-nums">
              {targetShoeDepth.toFixed(2)} {unit}
            </div>
          </div>

          {/* Hanger Toggle */}
          <div className="lg:col-span-2">
            <label className="flex h-[34px] cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800">
              <span className="whitespace-nowrap">Has Hanger</span>
              <input
                type="checkbox"
                checked={config.hasHanger}
                onChange={(e) => onUpdateConfig({ hasHanger: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
              />
            </label>
          </div>

          {config.hasHanger && (
            <>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600 whitespace-nowrap">
                  Hanger Profile MD ({unit})
                </label>
                <NumericInput
                  step="0.01"
                  min={0}
                  fallbackValue={0}
                  value={config.hangerDepth}
                  onChangeValue={(val) => {
                    if (val !== null) onUpdateConfig({ hangerDepth: val });
                  }}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600 whitespace-nowrap">
                  Cmt Head Stickup ({unit})
                </label>
                <NumericInput
                  step="0.05"
                  min={0}
                  fallbackValue={0}
                  value={config.hangerStickupTarget}
                  onChangeValue={(val) => {
                    if (val !== null) onUpdateConfig({ hangerStickupTarget: val });
                  }}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
