import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { ComputedTallyResult, TallyConfig } from '../types/tally';
import { formatNum, getTargetShoeDepth } from '../utils/tallyEngine';

interface TallyProgressChartProps {
  config: TallyConfig;
  computed: ComputedTallyResult;
}

interface BarDatum {
  id: string;
  label: string;
  value: number;
  subLabel: string;
  color: string;
}

export const TallyProgressChart: React.FC<TallyProgressChartProps> = ({
  config,
  computed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(300);
  const [hoveredBar, setHoveredBar] = useState<BarDatum | null>(null);

  const unit = config.lengthUnit;
  const { summary } = computed;
  const targetShoeDepth = getTargetShoeDepth(config);
  const plannedTd =
    config.sectionTd > 0 ? config.sectionTd : targetShoeDepth;

  const bars: BarDatum[] = useMemo(() => {
    const cumLen = summary.totalEffectiveLength;
    const isOnOrNearTarget =
      targetShoeDepth > 0 && Math.abs(summary.targetDelta) <= 0.25;
    const isOverTarget = targetShoeDepth > 0 && summary.targetDelta < -0.25;

    const cumColor = isOnOrNearTarget
      ? '#15803D'
      : isOverTarget
        ? '#B45309'
        : '#0369A1';

    return [
      {
        id: 'cum',
        label: 'Cum. Length',
        value: cumLen,
        subLabel: config.hasHanger
          ? `Below-Hanger ${formatNum(summary.belowHangerEffectiveLength, 2)} + Landing ${formatNum(summary.landingEffectiveLength, 2)} ${unit}`
          : `${summary.totalJoints} active pieces tallied`,
        color: cumColor,
      },
      {
        id: 'shoe',
        label: 'Shoe Target',
        value: targetShoeDepth,
        subLabel:
          config.shoeOffTd > 0
            ? `Section TD minus ${formatNum(config.shoeOffTd, 2)} ${unit} off bottom`
            : 'Target setting depth',
        color: '#334155',
      },
      {
        id: 'td',
        label: 'Section TD',
        value: plannedTd,
        subLabel: 'Planned section total depth',
        color: '#94A3B8',
      },
    ];
  }, [
    summary.totalEffectiveLength,
    summary.belowHangerEffectiveLength,
    summary.landingEffectiveLength,
    summary.totalJoints,
    summary.targetDelta,
    targetShoeDepth,
    plannedTd,
    config.hasHanger,
    config.shoeOffTd,
    unit,
  ]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const width = Math.max(240, containerWidth);
    const height = 340;
    const margin = { top: 28, right: 16, bottom: 44, left: 54 };
    const innerWidth = Math.max(120, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxVal = Math.max(
      10,
      d3.max(bars, (d) => d.value) ?? 0,
      summary.achievedShoeDepth
    );
    const yMax = maxVal * 1.12;

    const x = d3
      .scaleBand<string>()
      .domain(bars.map((d) => d.label))
      .range([0, innerWidth])
      .padding(0.32);

    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

    // Horizontal gridlines
    g.append('g')
      .attr('class', 'grid-lines')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .call((grid) => grid.select('.domain').remove())
      .call((grid) =>
        grid
          .selectAll('.tick line')
          .attr('stroke', '#E2E8F0')
          .attr('stroke-dasharray', '2,2')
      );

    // Y Axis
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => `${Number(d)}`)
      )
      .call((axis) => axis.select('.domain').attr('stroke', '#CBD5E1'))
      .call((axis) => axis.selectAll('.tick line').attr('stroke', '#CBD5E1'))
      .call((axis) =>
        axis
          .selectAll('.tick text')
          .attr('fill', '#475569')
          .style('font-family', 'JetBrains Mono, monospace')
          .style('font-size', '10px')
      );

    // Y-axis unit label
    g.append('text')
      .attr('x', -margin.left + 4)
      .attr('y', -12)
      .attr('fill', '#64748B')
      .style('font-family', 'JetBrains Mono, monospace')
      .style('font-size', '10px')
      .text(`Depth / Len (${unit})`);

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .call((axis) => axis.select('.domain').attr('stroke', '#CBD5E1'))
      .call((axis) => axis.selectAll('.tick line').remove())
      .call((axis) =>
        axis
          .selectAll('.tick text')
          .attr('fill', '#334155')
          .attr('dy', '1.1em')
          .style('font-family', 'DM Sans, sans-serif')
          .style('font-size', '11px')
          .style('font-weight', '500')
      );

    // Reference threshold lines
    if (plannedTd > 0) {
      const tdY = y(plannedTd);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', tdY)
        .attr('y2', tdY)
        .attr('stroke', '#64748B')
        .attr('stroke-width', 1.25)
        .attr('stroke-dasharray', '4,3');
    }

    if (targetShoeDepth > 0 && targetShoeDepth !== plannedTd) {
      const shoeY = y(targetShoeDepth);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', shoeY)
        .attr('y2', shoeY)
        .attr('stroke', '#0369A1')
        .attr('stroke-width', 1.25)
        .attr('stroke-dasharray', '3,3');
    }

    // Bars
    const barGroups = g
      .selectAll('.tally-bar-group')
      .data(bars)
      .enter()
      .append('g')
      .attr('class', 'tally-bar-group')
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => setHoveredBar(d))
      .on('mouseleave', () => setHoveredBar(null));

    barGroups
      .append('rect')
      .attr('x', (d) => x(d.label) ?? 0)
      .attr('y', innerHeight)
      .attr('width', x.bandwidth())
      .attr('height', 0)
      .attr('rx', 3)
      .attr('fill', (d) => d.color)
      .transition()
      .duration(220)
      .attr('y', (d) => y(d.value))
      .attr('height', (d) => Math.max(0, innerHeight - y(d.value)));

    // If hasHanger and Cum Length bar has Landing portion, overlay subtle top landing segment
    if (config.hasHanger && summary.landingEffectiveLength > 0) {
      const cumX = x('Cum. Length') ?? 0;
      const bw = x.bandwidth();
      const totalY = y(summary.totalEffectiveLength);
      const belowY = y(summary.belowHangerEffectiveLength);
      const landingHeight = Math.max(0, belowY - totalY);

      if (landingHeight > 2) {
        g.append('rect')
          .attr('x', cumX)
          .attr('y', totalY)
          .attr('width', bw)
          .attr('height', landingHeight)
          .attr('rx', 3)
          .attr('fill', '#38BDF8')
          .attr('pointer-events', 'none');
      }
    }

    // Numeric value labels on top of bars
    barGroups
      .append('text')
      .attr('x', (d) => (x(d.label) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.value) - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#0F172A')
      .style('font-family', 'JetBrains Mono, monospace')
      .style('font-size', '10px')
      .style('font-weight', '600')
      .text((d) => formatNum(d.value, 1));
  }, [
    bars,
    containerWidth,
    plannedTd,
    targetShoeDepth,
    unit,
    config.hasHanger,
    summary.achievedShoeDepth,
    summary.belowHangerEffectiveLength,
    summary.landingEffectiveLength,
    summary.totalEffectiveLength,
  ]);

  const progressPct =
    plannedTd > 0
      ? Math.min(999, (summary.totalEffectiveLength / plannedTd) * 100)
      : 0;

  return (
    <section
      aria-label="Running Tally Depth Progress Chart"
      className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4"
    >
      <div>
        <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-2.5">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Tally vs. Section TD
          </h3>
          <span className="font-mono text-xs font-semibold text-sky-700 tabular-nums">
            {plannedTd > 0 ? `${progressPct.toFixed(1)}%` : '—'}
          </span>
        </div>

        <div ref={containerRef} className="mt-2 w-full">
          <svg ref={svgRef} className="block w-full overflow-visible" />
        </div>
      </div>

      {/* Hover details or Legend */}
      <div className="mt-2 border-t border-slate-100 pt-2.5 text-xs">
        {hoveredBar ? (
          <div>
            <div className="flex items-center justify-between font-medium text-slate-900">
              <span>{hoveredBar.label}</span>
              <span className="font-mono tabular-nums">
                {formatNum(hoveredBar.value, 2)} {unit}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">{hoveredBar.subLabel}</div>
          </div>
        ) : (
          <div className="space-y-1 text-[11px] text-slate-600">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-sky-700" />
                Cum. Run Length
              </span>
              <span className="font-mono font-medium text-slate-900 tabular-nums">
                {formatNum(summary.totalEffectiveLength, 2)} {unit}
              </span>
            </div>
            {config.hasHanger && summary.landingEffectiveLength > 0 && (
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-xs bg-sky-400" />
                  Landing Segment
                </span>
                <span className="font-mono font-medium text-slate-900 tabular-nums">
                  {formatNum(summary.landingEffectiveLength, 2)} {unit}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-slate-700" />
                Target Shoe Depth
              </span>
              <span className="font-mono font-medium text-slate-900 tabular-nums">
                {formatNum(targetShoeDepth, 2)} {unit}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-slate-400" />
                Planned Section TD
              </span>
              <span className="font-mono font-medium text-slate-900 tabular-nums">
                {formatNum(plannedTd, 2)} {unit}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
