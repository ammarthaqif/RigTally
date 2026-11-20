import React from 'react';
import { AlertTriangle, ArrowRight, PackageCheck, Plus, Ruler } from 'lucide-react';
import type { TallyConfig, TallyRecommendation } from '../types/tally';

interface LibraryRecommendationsCardProps {
  config: TallyConfig;
  recommendations: TallyRecommendation[];
  onApplyRecommendation: (rec: TallyRecommendation) => void;
  onOpenLibrary: () => void;
}

export const LibraryRecommendationsCard: React.FC<LibraryRecommendationsCardProps> = ({
  config,
  recommendations,
  onApplyRecommendation,
  onOpenLibrary,
}) => {
  return (
    <section
      aria-label="Pipe and XO Library Recommendations"
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <PackageCheck className="h-4 w-4 text-sky-700" />
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Library Recommendations
          </h3>
        </div>
        <button
          type="button"
          onClick={onOpenLibrary}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-900"
        >
          Open Library
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {recommendations.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-500">
          No pending space-out or crossover items needed for {config.pipeSizeLabel}&quot;{' '}
          {config.stringCategory}.
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {recommendations.slice(0, 4).map((rec) => {
            const isCritical = rec.priority === 'critical';
            const isPup = rec.kind === 'pup-spaceout' || rec.kind === 'landing-spaceout';

            return (
              <div
                key={rec.id}
                className={`rounded-md border p-2.5 text-xs ${
                  isCritical
                    ? 'border-amber-200 bg-amber-50/70'
                    : isPup
                      ? 'border-sky-200 bg-sky-50/60'
                      : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5">
                    {isCritical ? (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                    ) : (
                      <Ruler className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700" />
                    )}
                    <div>
                      <div className="font-semibold text-slate-900">{rec.title}</div>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{rec.reason}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-slate-500">
                    Stock: {rec.libraryItem.quantityAvailable} · {rec.libraryItem.grade || 'Std'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onApplyRecommendation(rec)}
                    className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold text-white transition-colors whitespace-nowrap ${
                      isCritical
                        ? 'bg-amber-700 hover:bg-amber-800'
                        : 'bg-sky-700 hover:bg-sky-800'
                    }`}
                  >
                    <Plus className="h-3 w-3" />
                    {rec.insertAfterRowId
                      ? 'Insert XO'
                      : rec.recommendedCount > 1
                        ? `Add ${rec.recommendedCount}×`
                        : 'Add to Tally'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
