import React from 'react';
import type { TallyConfig } from '../types/tally';
import { PIPE_PRESETS } from '../utils/tallyEngine';

interface WellSpecsViewProps {
  config: TallyConfig;
  onUpdateConfig: (patch: Partial<TallyConfig>) => void;
}

export const WellSpecsView: React.FC<WellSpecsViewProps> = ({ config, onUpdateConfig }) => {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Well & Header Metadata */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-6">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Well &amp; Report Header Information
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Printed on all exported Excel workbooks and rig-floor PDF running tally sheets.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Well Name</label>
            <input
              type="text"
              value={config.wellName}
              onChange={(e) => onUpdateConfig({ wellName: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Rig / Unit</label>
            <input
              type="text"
              value={config.rigName}
              onChange={(e) => onUpdateConfig({ rigName: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Field / Block</label>
            <input
              type="text"
              value={config.fieldBlock}
              onChange={(e) => onUpdateConfig({ fieldBlock: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Drilling Engineer
            </label>
            <input
              type="text"
              value={config.engineerName}
              onChange={(e) => onUpdateConfig({ engineerName: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Active String Title
            </label>
            <input
              type="text"
              value={config.stringName}
              onChange={(e) => onUpdateConfig({ stringName: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Steel Grade</label>
            <input
              type="text"
              value={config.grade}
              onChange={(e) => onUpdateConfig({ grade: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Default Top Connection
            </label>
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Default Bottom Connection
            </label>
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3.5">
          <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-medium text-slate-800">
            <span>Apply Default Make-Up Loss to Float Shoe</span>
            <input
              type="checkbox"
              checked={config.applyMakeUpLossToShoe}
              onChange={(e) => onUpdateConfig({ applyMakeUpLossToShoe: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Typically unchecked since the shoe is the bottom-most pin/nose and its collar coupling is accounted for on Joint #1.
          </p>
        </div>
      </div>

      {/* API Tubular Quick Reference */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-6">
        <h2 className="font-display text-base font-semibold text-slate-900">
          API Conductor, Casing &amp; Tubing Presets
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Select any standard tubular profile to apply OD, weight, grade, and typical connection make-up loss.
        </p>

        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Category</th>
                <th className="px-3 py-2.5 font-semibold">OD (in)</th>
                <th className="px-3 py-2.5 text-right font-semibold">Wt (lb/ft)</th>
                <th className="px-3 py-2.5 font-semibold">Grade</th>
                <th className="px-3 py-2.5 text-right font-semibold">MU Loss (in)</th>
                <th className="px-3 py-2.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PIPE_PRESETS.map((p) => {
                const isActive =
                  config.stringCategory === p.category && config.pipeSizeIn === p.sizeIn;
                return (
                  <tr key={p.label} className={isActive ? 'bg-sky-50/70' : 'bg-white'}>
                    <td className="px-3 py-2 capitalize text-slate-700">{p.category}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-slate-900">
                      {p.sizeLabel}&quot;
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                      {p.defaultWeight.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">{p.defaultGrade}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                      {p.defaultMakeUpLossIn.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateConfig({
                            stringCategory: p.category,
                            stringName: p.label,
                            pipeSizeIn: p.sizeIn,
                            pipeSizeLabel: p.sizeLabel,
                            weightLbFt: p.defaultWeight,
                            grade: p.defaultGrade,
                            connection: p.defaultConnection,
                            topConnection: p.defaultConnection,
                            bottomConnection: p.defaultConnection,
                            defaultMakeUpLoss: p.defaultMakeUpLossIn,
                            makeUpLossUnit: 'in',
                          })
                        }
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-sky-700 text-white'
                            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {isActive ? 'Active' : 'Apply'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
