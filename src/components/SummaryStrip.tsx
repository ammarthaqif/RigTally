import React from 'react';
import { CheckCircle2, AlertTriangle, ArrowDownUp } from 'lucide-react';
import type { ComputedTallyResult, TallyConfig } from '../types/tally';
import { formatNum, getTargetShoeDepth } from '../utils/tallyEngine';

interface SummaryStripProps {
  config: TallyConfig;
  computed: ComputedTallyResult;
}

export const SummaryStrip: React.FC<SummaryStripProps> = ({ config, computed }) => {
  const { summary } = computed;
  const unit = config.lengthUnit;
  const targetShoeDepth = getTargetShoeDepth(config);
  const hasTarget = targetShoeDepth > 0;
  const absDelta = Math.abs(summary.targetDelta);

  const isOnTarget = hasTarget && absDelta <= 0.25;
  const isOver = hasTarget && summary.targetDelta < -0.25;

  return (
    <section
      aria-label="Running Tally Totals"
      className="grid grid-cols-1 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4"
    >
      {/* 1. Net Run Length & Shoe Depth */}
      <div className="p-4">
        <div className="text-xs font-medium text-slate-500">
          {config.hasHanger ? 'Below-Hanger / Total Run' : 'Total Net Run Length'}
        </div>
        <div className="mt-1 flex items-baseline gap-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
          <span>
            {formatNum(
              config.hasHanger ? summary.belowHangerEffectiveLength : summary.totalEffectiveLength,
              2
            )}
          </span>
          <span className="text-sm font-medium text-slate-500">{unit}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
          {config.hasHanger ? (
            <>
              <span>Landing {formatNum(summary.landingEffectiveLength, 2)} {unit}</span>
              <span aria-hidden="true">·</span>
              <span>MU -{formatNum(summary.totalMakeUpLoss, 2)} {unit}</span>
            </>
          ) : (
            <>
              <span>Gross {formatNum(summary.totalMeasuredLength, 2)} {unit}</span>
              <span aria-hidden="true">·</span>
              <span>MU -{formatNum(summary.totalMakeUpLoss, 3)} {unit}</span>
            </>
          )}
        </div>
      </div>

      {/* 2. Piece & Discarded Count */}
      <div className="p-4">
        <div className="text-xs font-medium text-slate-500">Tallied Pipe Quantity</div>
        <div className="mt-1 flex items-baseline gap-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
          <span>{summary.totalJoints}</span>
          <span className="text-sm font-medium text-slate-500">run pcs</span>
          {summary.discardedCount > 0 && (
            <span className="ml-1 text-xs font-medium text-red-700">
              ({summary.discardedCount} rejected)
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
          <span>{summary.standardJointCount} jts</span>
          <span aria-hidden="true">·</span>
          <span>{summary.pupJointCount} pup</span>
          {config.hasHanger && (
            <>
              <span aria-hidden="true">·</span>
              <span>{summary.landingJointCount} lnd</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{summary.accessoryCount} acc</span>
        </div>
      </div>

      {/* 3. Segment Weights */}
      <div className="p-4">
        <div className="text-xs font-medium text-slate-500">String Weight (Air / Buoyed)</div>
        <div className="mt-1 flex items-baseline gap-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
          <span>{formatNum(summary.totalAirWeightLbs, 0)}</span>
          <span className="text-sm font-medium text-slate-500">lbs</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
          <span>{formatNum(summary.totalAirWeightTonnes, 2)} MT</span>
          <span aria-hidden="true">·</span>
          <span>Buoyed {formatNum(summary.totalBuoyedWeightLbs, 0)} lbs</span>
        </div>
      </div>

      {/* 4. Shoe Depth & Landing Stick-Up */}
      <div className="p-4">
        <div className="text-xs font-medium text-slate-500">
          {config.hasHanger ? 'Shoe Depth & Cmt Head Stick-Up' : 'Target Shoe Space-Out'}
        </div>
        {!hasTarget ? (
          <>
            <div className="mt-1 font-mono text-2xl font-semibold text-slate-400 tabular-nums">
              —
            </div>
            <div className="mt-1.5 text-xs text-slate-500">
              Set Section TD &amp; Off-TD to verify shoe depth
            </div>
          </>
        ) : (
          <>
            <div className="mt-1 flex items-center gap-2 font-mono text-xl font-semibold tabular-nums">
              {isOnTarget ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>{formatNum(summary.achievedShoeDepth, 2)} {unit}</span>
                </span>
              ) : isOver ? (
                <span className="inline-flex items-center gap-1.5 text-amber-700">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>{formatNum(summary.achievedShoeDepth, 2)} {unit}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-900">
                  <ArrowDownUp className="h-5 w-5 shrink-0 text-sky-700" />
                  <span>{formatNum(summary.targetDelta, 2)} {unit} short</span>
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
              <span>Target {formatNum(targetShoeDepth, 2)} {unit}</span>
              {config.hasHanger && config.hangerDepth > 0 && summary.landingEffectiveLength > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      summary.actualStickupAboveRigFloor >= 0.5
                        ? 'font-medium text-emerald-700'
                        : 'font-medium text-amber-700'
                    }
                  >
                    Stick-up {summary.actualStickupAboveRigFloor >= 0 ? '+' : ''}
                    {formatNum(summary.actualStickupAboveRigFloor, 2)} {unit}
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
