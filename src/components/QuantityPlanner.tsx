import React, { useMemo, useState } from 'react';
import { Calculator, ArrowRight } from 'lucide-react';
import type {
  LengthUnit,
  MakeUpLossUnit,
  TallyConfig,
  TallyRowInput,
} from '../types/tally';
import {
  LBS_TO_METRIC_TONNES,
  METERS_TO_FEET,
  computeBuoyancyFactor,
  convertMakeUpLossToLengthUnit,
  createId,
  formatNum,
} from '../utils/tallyEngine';
import { NumericInput } from './NumericInput';

interface QuantityPlannerProps {
  config: TallyConfig;
  onUpdateConfig: (patch: Partial<TallyConfig>) => void;
  onPopulateTally: (rows: TallyRowInput[], targetDepth: number) => void;
}

export const QuantityPlanner: React.FC<QuantityPlannerProps> = ({
  config,
  onUpdateConfig,
  onPopulateTally,
}) => {
  const [targetDepth, setTargetDepth] = useState(
    config.targetDepth > 0 ? config.targetDepth : config.lengthUnit === 'm' ? 1200 : 4000
  );
  const [avgJointLen, setAvgJointLen] = useState(config.lengthUnit === 'm' ? 12.15 : 40.0);
  const [shoeCollarAllowance, setShoeCollarAllowance] = useState(
    config.lengthUnit === 'm' ? 1.2 : 4.0
  );
  const [sparePct, setSparePct] = useState(5);
  const [includeShoeTrack, setIncludeShoeTrack] = useState(true);

  const unit: LengthUnit = config.lengthUnit;

  const plan = useMemo(() => {
    const muLossInUnit = convertMakeUpLossToLengthUnit(
      config.defaultMakeUpLoss,
      config.makeUpLossUnit,
      unit
    );
    const netJointLen = Math.max(0.1, avgJointLen - muLossInUnit);
    const netDepthForJoints = Math.max(
      0,
      targetDepth - (includeShoeTrack ? shoeCollarAllowance : 0)
    );

    const exactJoints = netDepthForJoints / netJointLen;
    const fullJointsNeeded = Math.floor(exactJoints);
    const remainderLen = Math.max(0, netDepthForJoints - fullJointsNeeded * netJointLen);

    // If remainder is > 85% of a joint, usually order 1 more full joint, else use pup joint(s)
    const jointsToRun = fullJointsNeeded;
    const needsPup = remainderLen > 0.05;
    const spareJoints = Math.ceil((jointsToRun * sparePct) / 100);
    const totalOrderJoints = jointsToRun + (remainderLen > netJointLen * 0.85 ? 1 : 0) + spareJoints;

    const totalRunLengthFt = unit === 'm' ? targetDepth * METERS_TO_FEET : targetDepth;
    const totalOrderLength = totalOrderJoints * avgJointLen + (includeShoeTrack ? shoeCollarAllowance : 0);
    const totalOrderLengthFt = unit === 'm' ? totalOrderLength * METERS_TO_FEET : totalOrderLength;

    const bf = computeBuoyancyFactor(config.mudWeightPpg);
    const estAirWeightLbs = totalRunLengthFt * config.weightLbFt;
    const estBuoyedWeightLbs = estAirWeightLbs * bf;
    const orderAirWeightLbs = totalOrderLengthFt * config.weightLbFt;

    return {
      muLossInUnit,
      netJointLen,
      exactJoints,
      fullJointsNeeded,
      remainderLen,
      needsPup,
      spareJoints,
      totalOrderJoints,
      estAirWeightLbs,
      estBuoyedWeightLbs,
      orderAirWeightLbs,
      bf,
    };
  }, [
    targetDepth,
    avgJointLen,
    shoeCollarAllowance,
    sparePct,
    includeShoeTrack,
    config.defaultMakeUpLoss,
    config.makeUpLossUnit,
    config.weightLbFt,
    config.mudWeightPpg,
    unit,
  ]);

  const handleGenerateTally = () => {
    const generated: TallyRowInput[] = [];
    const muLossInUnit = plan.muLossInUnit;

    if (includeShoeTrack && shoeCollarAllowance > 0) {
      const shoeLen = Number((shoeCollarAllowance * 0.52).toFixed(2));
      const collarLen = Number((shoeCollarAllowance * 0.48).toFixed(2));
      generated.push({
        id: createId(),
        jointNo: 'SHOE',
        componentType: 'shoe',
        measuredLength: shoeLen,
        makeUpLossOverride: 0,
        weightLbFtOverride: null,
        gradeOverride: config.grade,
        serialNo: '',
        remarks: 'Planned Float Shoe',
      });
      generated.push({
        id: createId(),
        jointNo: 'FC-1',
        componentType: 'collar',
        measuredLength: collarLen,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: config.grade,
        serialNo: '',
        remarks: 'Planned Float Collar',
      });
    }

    const cappedJoints = Math.min(400, plan.fullJointsNeeded);
    for (let i = 1; i <= cappedJoints; i++) {
      generated.push({
        id: createId(),
        jointNo: String(i),
        componentType: 'joint',
        measuredLength: Number(avgJointLen.toFixed(2)),
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        serialNo: '',
        remarks: '',
      });
    }

    if (plan.needsPup) {
      const grossPup = Number((plan.remainderLen + muLossInUnit).toFixed(2));
      generated.push({
        id: createId(),
        jointNo: 'PUP-1',
        componentType: 'pup',
        measuredLength: grossPup,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        serialNo: '',
        remarks: 'Calculated space-out pup',
      });
    }

    onPopulateTally(generated, targetDepth);
  };

  const applyRangeLength = (range: 'R1' | 'R2' | 'R3') => {
    const mapM = { R1: 6.1, R2: 9.5, R3: 12.15 };
    const mapFt = { R1: 20.0, R2: 31.0, R3: 40.0 };
    setAvgJointLen(unit === 'm' ? mapM[range] : mapFt[range]);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left: Engineering Inputs */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-5">
        <div className="mb-4 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-sky-700" />
          <h2 className="font-display text-base font-semibold text-slate-900">
            String Quantity &amp; Space-Out Parameters
          </h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Target Setting Depth ({unit})
              </label>
              <NumericInput
                step="0.1"
                min={0}
                fallbackValue={0}
                value={targetDepth}
                onChangeValue={(val) => {
                  if (val !== null) setTargetDepth(val);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Unit System
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1">
                {(['m', 'ft'] as LengthUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => onUpdateConfig({ lengthUnit: u })}
                    className={`rounded px-2 py-1.5 font-mono text-xs font-medium transition-colors ${
                      unit === u ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Pipe OD (in)
              </label>
              <NumericInput
                step="0.001"
                min={0.5}
                fallbackValue={0.5}
                value={config.pipeSizeIn}
                onChangeValue={(val) => {
                  if (val !== null) {
                    onUpdateConfig({
                      pipeSizeIn: val,
                      pipeSizeLabel: String(val),
                    });
                  }
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Nominal Weight (lb/ft)
              </label>
              <NumericInput
                step="0.1"
                min={0.1}
                fallbackValue={0.1}
                value={config.weightLbFt}
                onChangeValue={(val) => {
                  if (val !== null) onUpdateConfig({ weightLbFt: val });
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700">
                Avg Joint Measured Length ({unit})
              </label>
              <div className="flex items-center gap-1">
                {(['R1', 'R2', 'R3'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => applyRangeLength(r)}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <NumericInput
              step="0.01"
              min={0.1}
              fallbackValue={0.1}
              value={avgJointLen}
              onChangeValue={(val) => {
                if (val !== null) setAvgJointLen(val);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Make-Up Loss / Joint
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
                  className="w-full rounded-l-md border border-r-0 border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                />
                <select
                  value={config.makeUpLossUnit}
                  onChange={(e) =>
                    onUpdateConfig({ makeUpLossUnit: e.target.value as MakeUpLossUnit })
                  }
                  className="rounded-r-md border border-slate-300 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-700 focus:border-sky-600 focus:outline-none"
                >
                  <option value="in">in</option>
                  <option value="ft">ft</option>
                  <option value="m">m</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Contingency / Spare (%)
              </label>
              <NumericInput
                step="1"
                min={0}
                max={50}
                integer
                fallbackValue={0}
                value={sparePct}
                onChangeValue={(val) => {
                  if (val !== null) setSparePct(val);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-slate-700">
              <span>Include Float Shoe &amp; Collar Assembly</span>
              <input
                type="checkbox"
                checked={includeShoeTrack}
                onChange={(e) => setIncludeShoeTrack(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
              />
            </label>
            {includeShoeTrack && (
              <div className="mt-2.5">
                <label className="mb-1 block text-[11px] text-slate-500">
                  Combined Shoe + Collar Length ({unit})
                </label>
                <NumericInput
                  step="0.05"
                  min={0}
                  fallbackValue={0}
                  value={shoeCollarAllowance}
                  onChangeValue={(val) => {
                    if (val !== null) setShoeCollarAllowance(val);
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Calculated Quantity & Weight Breakdown */}
      <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 lg:col-span-7">
        <div>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-3">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Calculated Pipe Requirements
            </h2>
            <span className="font-mono text-xs text-slate-500">
              {config.pipeSizeLabel}&quot; · {config.weightLbFt} lb/ft · {config.grade}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-xs text-slate-500">Full Joints to Run</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {plan.fullJointsNeeded} <span className="text-sm font-normal text-slate-500">jts</span>
              </div>
              <div className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                Net {plan.netJointLen.toFixed(3)} {unit}/jt
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-xs text-slate-500">Order Qty (+{sparePct}% Spare)</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-sky-800 tabular-nums">
                {plan.totalOrderJoints} <span className="text-sm font-normal text-slate-500">jts</span>
              </div>
              <div className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                Includes {plan.spareJoints} contingency jts
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-xs text-slate-500">Space-Out Pup Joint</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {plan.needsPup ? plan.remainderLen.toFixed(2) : '0.00'}{' '}
                <span className="text-sm font-normal text-slate-500">{unit}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {plan.needsPup ? 'Net space-out remainder' : 'Exact joint fit'}
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-slate-200">
                <tr className="bg-white">
                  <td className="px-4 py-2.5 text-slate-600">Net Effective Length per Joint</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                    {plan.netJointLen.toFixed(3)} {unit} (MU loss -{plan.muLossInUnit.toFixed(3)} {unit})
                  </td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="px-4 py-2.5 text-slate-600">Estimated String Air Weight (at TD)</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                    {formatNum(plan.estAirWeightLbs, 0)} lbs (
                    {formatNum(plan.estAirWeightLbs * LBS_TO_METRIC_TONNES, 2)} MT)
                  </td>
                </tr>
                <tr className="bg-white">
                  <td className="px-4 py-2.5 text-slate-600">
                    Estimated Buoyed Hook Load ({config.mudWeightPpg} ppg, BF {plan.bf.toFixed(4)})
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                    {formatNum(plan.estBuoyedWeightLbs, 0)} lbs (
                    {formatNum(plan.estBuoyedWeightLbs * LBS_TO_METRIC_TONNES, 2)} MT)
                  </td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="px-4 py-2.5 text-slate-600">Total Yard Loadout Weight (+Spare)</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                    {formatNum(plan.orderAirWeightLbs, 0)} lbs (
                    {formatNum(plan.orderAirWeightLbs * LBS_TO_METRIC_TONNES, 2)} MT)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">
            Creates Shoe, Collar, {Math.min(400, plan.fullJointsNeeded)} nominal joints
            {plan.needsPup ? ', and 1 Space-Out Pup' : ''} in your Running Tally.
          </p>
          <button
            type="button"
            onClick={handleGenerateTally}
            className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-800 whitespace-nowrap shrink-0"
          >
            Populate Running Tally
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
