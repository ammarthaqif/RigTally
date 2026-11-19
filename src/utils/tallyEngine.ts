import type {
  ComponentType,
  ComputedTallyResult,
  ComputedTallyRow,
  CrossoverAlert,
  DeckJointItem,
  LayerPickupOrder,
  LengthUnit,
  MakeUpLossUnit,
  PipePreset,
  TallyConfig,
  TallyRowInput,
} from '../types/tally';

export const COMMON_CONNECTIONS = [
  'BTC',
  'LTC',
  'STC',
  'VAM TOP',
  'VAM 21',
  'EUE 8RD',
  'NUE 10RD',
  'TenarisHydril Blue',
  'Hydril 521',
  'Hydril 563',
  'Weld-On',
];

export const METERS_TO_FEET = 3.280839895;
export const FEET_TO_METERS = 0.3048;
export const INCHES_TO_FEET = 1 / 12;
export const INCHES_TO_METERS = 0.0254;
export const LBS_TO_METRIC_TONNES = 0.00045359237;
export const STEEL_DENSITY_PPG = 65.44;

export const PIPE_PRESETS: PipePreset[] = [
  {
    category: 'conductor',
    label: '30" Structural Conductor',
    sizeLabel: '30',
    sizeIn: 30,
    weights: [310, 234, 196],
    defaultWeight: 310,
    defaultGrade: 'X-56',
    defaultConnection: 'Weld-On / RL-4S',
    defaultMakeUpLossIn: 0,
  },
  {
    category: 'conductor',
    label: '20" Surface Conductor',
    sizeLabel: '20',
    sizeIn: 20,
    weights: [133, 106.5, 94],
    defaultWeight: 133,
    defaultGrade: 'K-55',
    defaultConnection: 'BTC',
    defaultMakeUpLossIn: 5.125,
  },
  {
    category: 'casing',
    label: '13-3/8" Surface Casing',
    sizeLabel: '13-3/8',
    sizeIn: 13.375,
    weights: [72, 68, 61, 54.5],
    defaultWeight: 68,
    defaultGrade: 'N-80',
    defaultConnection: 'BTC',
    defaultMakeUpLossIn: 4.875,
  },
  {
    category: 'casing',
    label: '9-5/8" Intermediate / Prod Casing',
    sizeLabel: '9-5/8',
    sizeIn: 9.625,
    weights: [53.5, 47, 43.5, 40],
    defaultWeight: 47,
    defaultGrade: 'L-80',
    defaultConnection: 'BTC / Premium',
    defaultMakeUpLossIn: 4.5,
  },
  {
    category: 'casing',
    label: '7" Production Liner / Casing',
    sizeLabel: '7',
    sizeIn: 7,
    weights: [35, 32, 29, 26, 23],
    defaultWeight: 29,
    defaultGrade: 'P-110',
    defaultConnection: 'Premium Gas-Tight',
    defaultMakeUpLossIn: 4.125,
  },
  {
    category: 'casing',
    label: '5-1/2" Production Casing',
    sizeLabel: '5-1/2',
    sizeIn: 5.5,
    weights: [23, 20, 17, 15.5],
    defaultWeight: 20,
    defaultGrade: 'P-110',
    defaultConnection: 'Premium',
    defaultMakeUpLossIn: 3.75,
  },
  {
    category: 'tubing',
    label: '4-1/2" Production Tubing',
    sizeLabel: '4-1/2',
    sizeIn: 4.5,
    weights: [15.1, 13.5, 12.6, 11.6],
    defaultWeight: 12.6,
    defaultGrade: 'L-80',
    defaultConnection: 'EUE / Vam Top',
    defaultMakeUpLossIn: 3.5,
  },
  {
    category: 'tubing',
    label: '3-1/2" Production Tubing',
    sizeLabel: '3-1/2',
    sizeIn: 3.5,
    weights: [12.95, 10.2, 9.3, 7.7],
    defaultWeight: 9.3,
    defaultGrade: 'L-80 13Cr',
    defaultConnection: 'EUE / Fox',
    defaultMakeUpLossIn: 3.25,
  },
  {
    category: 'tubing',
    label: '2-7/8" Production Tubing',
    sizeLabel: '2-7/8',
    sizeIn: 2.875,
    weights: [8.7, 7.9, 6.5, 6.4],
    defaultWeight: 6.5,
    defaultGrade: 'N-80',
    defaultConnection: 'EUE 8RD',
    defaultMakeUpLossIn: 2.875,
  },
];

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (!Number.isFinite(value)) return 0;
  if (from === to) return value;
  return from === 'm' ? value * METERS_TO_FEET : value * FEET_TO_METERS;
}

export function convertMakeUpLossToLengthUnit(
  value: number,
  fromUnit: MakeUpLossUnit,
  toLengthUnit: LengthUnit
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (fromUnit === toLengthUnit) return value;
  if (fromUnit === 'in') {
    return toLengthUnit === 'ft' ? value * INCHES_TO_FEET : value * INCHES_TO_METERS;
  }
  if (fromUnit === 'ft') {
    return toLengthUnit === 'm' ? value * FEET_TO_METERS : value;
  }
  return toLengthUnit === 'ft' ? value * METERS_TO_FEET : value;
}

export function computeBuoyancyFactor(mudWeightPpg: number): number {
  if (!Number.isFinite(mudWeightPpg) || mudWeightPpg <= 0) return 1;
  const bf = 1 - mudWeightPpg / STEEL_DENSITY_PPG;
  return Math.max(0.1, Math.min(1, bf));
}

export function getTargetShoeDepth(config: TallyConfig): number {
  if (Number.isFinite(config.sectionTd) && config.sectionTd > 0) {
    const offTd = Math.max(0, Number(config.shoeOffTd) || 0);
    return Math.max(0, config.sectionTd - offTd);
  }
  return Math.max(0, Number(config.targetDepth) || 0);
}

export function computeTally(config: TallyConfig, rawRows: TallyRowInput[]): ComputedTallyResult {
  const buoyancyFactor = computeBuoyancyFactor(config.mudWeightPpg);
  const defaultLossInLengthUnit = convertMakeUpLossToLengthUnit(
    config.defaultMakeUpLoss,
    config.makeUpLossUnit,
    config.lengthUnit
  );

  let activeCounter = 0;

  const prelim = rawRows.map((row, idx) => {
    const isDiscarded = Boolean(row.discarded);
    const measured = Math.max(0, Number(row.measuredLength) || 0);

    if (isDiscarded) {
      return {
        row,
        seq: idx + 1,
        runSeq: null as number | null,
        isDiscarded: true,
        measured: 0,
        effectiveMakeUpLoss: 0,
        effectiveLength: 0,
        unitWeightLbFt:
          row.weightLbFtOverride !== null &&
          row.weightLbFtOverride !== undefined &&
          Number.isFinite(row.weightLbFtOverride)
            ? Math.max(0, Number(row.weightLbFtOverride))
            : Math.max(0, Number(config.weightLbFt) || 0),
        segmentAirWeightLbs: 0,
        segmentBuoyedWeightLbs: 0,
      };
    }

    activeCounter += 1;

    let rawLossInput =
      row.makeUpLossOverride !== null && row.makeUpLossOverride !== undefined
        ? Number(row.makeUpLossOverride)
        : row.componentType === 'shoe' && !config.applyMakeUpLossToShoe
          ? 0
          : config.defaultMakeUpLoss;

    if (!Number.isFinite(rawLossInput) || rawLossInput < 0) rawLossInput = 0;

    const effectiveMakeUpLoss =
      row.makeUpLossOverride !== null && row.makeUpLossOverride !== undefined
        ? convertMakeUpLossToLengthUnit(rawLossInput, config.makeUpLossUnit, config.lengthUnit)
        : row.componentType === 'shoe' && !config.applyMakeUpLossToShoe
          ? 0
          : defaultLossInLengthUnit;

    const clampedLoss = Math.min(measured, effectiveMakeUpLoss);
    const effectiveLength = Math.max(0, measured - clampedLoss);

    const unitWeightLbFt =
      row.weightLbFtOverride !== null &&
      row.weightLbFtOverride !== undefined &&
      Number.isFinite(row.weightLbFtOverride)
        ? Math.max(0, Number(row.weightLbFtOverride))
        : Math.max(0, Number(config.weightLbFt) || 0);

    const effectiveLengthFt =
      config.lengthUnit === 'm' ? effectiveLength * METERS_TO_FEET : effectiveLength;
    const segmentAirWeightLbs = effectiveLengthFt * unitWeightLbFt;
    const segmentBuoyedWeightLbs = segmentAirWeightLbs * buoyancyFactor;

    return {
      row,
      seq: idx + 1,
      runSeq: activeCounter,
      isDiscarded: false,
      measured,
      effectiveMakeUpLoss: clampedLoss,
      effectiveLength,
      unitWeightLbFt,
      segmentAirWeightLbs,
      segmentBuoyedWeightLbs,
    };
  });

  let cumLength = 0;
  let belowHangerCum = 0;
  let landingCum = 0;
  let cumAirWeightLbs = 0;
  let cumBuoyedWeightLbs = 0;
  let totalMeasuredLength = 0;
  let totalMakeUpLoss = 0;
  let standardJointCount = 0;
  let pupJointCount = 0;
  let accessoryCount = 0;
  let landingJointCount = 0;
  let discardedCount = 0;
  let standardJointLengthSum = 0;

  // Pre-calculate total below-hanger length for hanger-referenced depths
  const totalBelowHangerLength = prelim.reduce((sum, p) => {
    if (p.isDiscarded || p.row.componentType === 'landing') return sum;
    return sum + p.effectiveLength;
  }, 0);

  const targetShoeDepth = getTargetShoeDepth(config);
  const hangerDepth = config.hasHanger ? Math.max(0, Number(config.hangerDepth) || 0) : 0;

  // If hanger is active and hangerDepth > 0, achieved shoe depth = hangerDepth + totalBelowHangerLength
  const effectiveBottomBase =
    config.hasHanger && hangerDepth > 0
      ? hangerDepth + totalBelowHangerLength
      : targetShoeDepth;

  let runningLandingCum = 0;

  const defaultTopConn = (config.topConnection ?? '').trim() || (config.connection || '').trim();
  const defaultBottomConn =
    (config.bottomConnection ?? '').trim() || (config.connection || '').trim();

  const resolveConnections = (row: TallyRowInput) => {
    const rawTop = (row.topConnectionOverride ?? '').trim();
    const rawBot = (row.bottomConnectionOverride ?? '').trim();
    const rawSingle = (row.connectionOverride ?? '').trim();

    let top = rawTop;
    let bot = rawBot;

    if (!top && !bot && rawSingle) {
      if (row.componentType === 'xo') {
        const parts = rawSingle.split(/\s+x\s+|\s*\/\s*/i).map((s) => s.trim()).filter(Boolean);
        if (parts.length === 2) {
          if (config.runOrder === 'bottom-to-top') {
            bot = parts[0];
            top = parts[1];
          } else {
            top = parts[0];
            bot = parts[1];
          }
        } else {
          top = rawSingle;
          bot = rawSingle;
        }
      } else {
        top = rawSingle;
        bot = rawSingle;
      }
    }

    const effectiveTopConnection = top || defaultTopConn;
    const effectiveBottomConnection = bot || defaultBottomConn;
    const effectiveConnection =
      effectiveTopConnection && effectiveBottomConnection
        ? effectiveTopConnection === effectiveBottomConnection
          ? effectiveTopConnection
          : `${effectiveTopConnection} / ${effectiveBottomConnection}`
        : effectiveTopConnection || effectiveBottomConnection;

    return {
      effectiveTopConnection,
      effectiveBottomConnection,
      effectiveConnection,
    };
  };

  const computedRows: ComputedTallyRow[] = prelim.map((item) => {
    const {
      effectiveTopConnection,
      effectiveBottomConnection,
      effectiveConnection,
    } = resolveConnections(item.row);

    if (item.isDiscarded) {
      discardedCount += 1;
      return {
        ...item.row,
        seq: item.seq,
        runSeq: null,
        effectiveConnection,
        effectiveTopConnection,
        effectiveBottomConnection,
        effectiveMakeUpLoss: 0,
        effectiveLength: 0,
        cumLength,
        topDepth: 0,
        bottomDepth: 0,
        unitWeightLbFt: item.unitWeightLbFt,
        segmentAirWeightLbs: 0,
        segmentBuoyedWeightLbs: 0,
        cumAirWeightLbs,
        cumBuoyedWeightLbs,
      };
    }

    const prevCumLength = cumLength;
    cumLength += item.effectiveLength;
    cumAirWeightLbs += item.segmentAirWeightLbs;
    cumBuoyedWeightLbs += item.segmentBuoyedWeightLbs;
    totalMeasuredLength += item.measured;
    totalMakeUpLoss += item.effectiveMakeUpLoss;

    if (item.row.componentType === 'joint') {
      standardJointCount += 1;
      standardJointLengthSum += item.effectiveLength;
    } else if (item.row.componentType === 'pup') {
      pupJointCount += 1;
    } else if (item.row.componentType === 'landing') {
      landingJointCount += 1;
    } else {
      accessoryCount += 1;
    }

    if (item.row.componentType === 'landing') {
      landingCum += item.effectiveLength;
    } else {
      belowHangerCum += item.effectiveLength;
    }

    let topDepth = 0;
    let bottomDepth = 0;

    if (config.runOrder === 'bottom-to-top') {
      if (config.hasHanger && hangerDepth > 0) {
        if (item.row.componentType === 'landing') {
          const prevLanding = runningLandingCum;
          runningLandingCum += item.effectiveLength;
          bottomDepth = hangerDepth - prevLanding;
          topDepth = hangerDepth - runningLandingCum; // negative = stick-up above rig floor!
        } else {
          bottomDepth = effectiveBottomBase - prevCumLength;
          topDepth = effectiveBottomBase - cumLength;
        }
      } else if (targetShoeDepth > 0) {
        bottomDepth = targetShoeDepth - prevCumLength;
        topDepth = targetShoeDepth - cumLength;
      } else {
        bottomDepth = cumLength;
        topDepth = prevCumLength;
      }
    } else {
      topDepth = prevCumLength;
      bottomDepth = cumLength;
    }

    return {
      ...item.row,
      seq: item.seq,
      runSeq: item.runSeq,
      effectiveConnection,
      effectiveTopConnection,
      effectiveBottomConnection,
      effectiveMakeUpLoss: item.effectiveMakeUpLoss,
      effectiveLength: item.effectiveLength,
      cumLength,
      topDepth,
      bottomDepth,
      unitWeightLbFt: item.unitWeightLbFt,
      segmentAirWeightLbs: item.segmentAirWeightLbs,
      segmentBuoyedWeightLbs: item.segmentBuoyedWeightLbs,
      cumAirWeightLbs,
      cumBuoyedWeightLbs,
    };
  });

  // Detect adjacent active rows with mismatched mating connections requiring an XO
  const crossoverAlerts: CrossoverAlert[] = [];
  const activeComputed = computedRows.filter((r) => !r.discarded);
  const normConn = (c: string) => c.trim().toLowerCase().replace(/\s+/g, ' ');

  for (let i = 0; i < activeComputed.length - 1; i++) {
    const curr = activeComputed[i];
    const next = activeComputed[i + 1];

    // In bottom-to-top order, curr is lower and next is upper: curr's TOP mates with next's BOTTOM.
    // In top-to-bottom order, curr is upper and next is lower: curr's BOTTOM mates with next's TOP.
    const isBottomToTop = config.runOrder === 'bottom-to-top';
    const fromEnd: 'Top' | 'Bottom' = isBottomToTop ? 'Top' : 'Bottom';
    const toEnd: 'Top' | 'Bottom' = isBottomToTop ? 'Bottom' : 'Top';
    const fromConnRaw = isBottomToTop
      ? curr.effectiveTopConnection
      : curr.effectiveBottomConnection;
    const toConnRaw = isBottomToTop
      ? next.effectiveBottomConnection
      : next.effectiveTopConnection;

    const c1 = normConn(fromConnRaw);
    const c2 = normConn(toConnRaw);
    if (c1 && c2 && c1 !== c2) {
      // Skip if either side is a legacy unsplit XO without distinct top/bottom overrides
      const currIsUnsplitXo =
        curr.componentType === 'xo' &&
        !curr.topConnectionOverride &&
        !curr.bottomConnectionOverride &&
        !(curr.connectionOverride ?? '').includes(' x ');
      const nextIsUnsplitXo =
        next.componentType === 'xo' &&
        !next.topConnectionOverride &&
        !next.bottomConnectionOverride &&
        !(next.connectionOverride ?? '').includes(' x ');
      if (currIsUnsplitXo || nextIsUnsplitXo) continue;

      crossoverAlerts.push({
        id: `xo-${curr.id}-${next.id}`,
        afterRowId: curr.id,
        beforeRowId: next.id,
        fromJointNo: curr.jointNo,
        toJointNo: next.jointNo,
        fromEnd,
        toEnd,
        fromConnection: fromConnRaw,
        toConnection: toConnRaw,
        xoBottomConnection: isBottomToTop ? fromConnRaw : toConnRaw,
        xoTopConnection: isBottomToTop ? toConnRaw : fromConnRaw,
      });
    }
  }

  const averageJointLength =
    standardJointCount > 0 ? standardJointLengthSum / standardJointCount : 0;

  const achievedShoeDepth =
    config.hasHanger && hangerDepth > 0
      ? hangerDepth + belowHangerCum
      : belowHangerCum;

  // Target delta: positive = still short of target Shoe Depth; negative = excess / deeper than target
  const targetDelta =
    targetShoeDepth > 0
      ? config.hasHanger && hangerDepth > 0
        ? targetShoeDepth - achievedShoeDepth
        : targetShoeDepth - cumLength
      : 0;

  const estimatedRemainingJoints =
    targetDelta > 0 && averageJointLength > 0 ? Math.ceil(targetDelta / averageJointLength) : 0;

  const actualStickupAboveRigFloor =
    config.hasHanger && hangerDepth > 0 && landingCum > 0 ? landingCum - hangerDepth : 0;
  const stickupDeltaFromTarget =
    config.hasHanger && hangerDepth > 0 && landingCum > 0
      ? actualStickupAboveRigFloor - (config.hangerStickupTarget || 0)
      : 0;

  return {
    rows: computedRows,
    crossoverAlerts,
    summary: {
      totalJoints: activeCounter,
      discardedCount,
      standardJointCount,
      pupJointCount,
      accessoryCount,
      landingJointCount,
      totalMeasuredLength,
      totalMakeUpLoss,
      totalEffectiveLength: cumLength,
      belowHangerEffectiveLength: belowHangerCum,
      landingEffectiveLength: landingCum,
      achievedShoeDepth,
      actualStickupAboveRigFloor,
      stickupDeltaFromTarget,
      totalAirWeightLbs: cumAirWeightLbs,
      totalBuoyedWeightLbs: cumBuoyedWeightLbs,
      totalAirWeightTonnes: cumAirWeightLbs * LBS_TO_METRIC_TONNES,
      totalBuoyedWeightTonnes: cumBuoyedWeightLbs * LBS_TO_METRIC_TONNES,
      buoyancyFactor,
      targetDelta,
      averageJointLength,
      estimatedRemainingJoints,
    },
  };
}

export interface AutoPopulateOptions {
  config: TallyConfig;
  deckJoints: DeckJointItem[];
  pickupOrder: LayerPickupOrder;
  shoeLength: number;
  collarLength: number;
  shoeTrackJointCount: number;
  hangerLength: number;
  availablePupLengths: number[];
  useRemainingDeckForLanding: boolean;
  landingJointMeasuredLength: number;
}

export interface AutoPopulatePlanResult {
  rows: TallyRowInput[];
  pickedDeckJointIds: string[];
  unusedDeckJointCount: number;
  projectedShoeDepth: number;
  projectedStickup: number;
  belowHangerDelta: number;
  landingDelta: number;
}

export function autoPopulateTallyFromDeck(options: AutoPopulateOptions): AutoPopulatePlanResult {
  const {
    config,
    deckJoints,
    pickupOrder,
    shoeLength,
    collarLength,
    shoeTrackJointCount,
    hangerLength,
    availablePupLengths,
    useRemainingDeckForLanding,
    landingJointMeasuredLength,
  } = options;

  const muLoss = convertMakeUpLossToLengthUnit(
    config.defaultMakeUpLoss,
    config.makeUpLossUnit,
    config.lengthUnit
  );

  // Exclude discarded joints while maintaining each joint's original jointNo & layer
  const activeDeck = deckJoints
    .filter((j) => !j.discarded && j.measuredLength > 0)
    .sort((a, b) => {
      if (a.layer !== b.layer) {
        return pickupOrder === 'top-layer-first' ? b.layer - a.layer : a.layer - b.layer;
      }
      return a.jointNo - b.jointNo;
    });

  const targetShoeDepth = getTargetShoeDepth(config);
  const hangerDepth = config.hasHanger ? Math.max(0, config.hangerDepth || 0) : 0;
  const requiredBelowHanger = config.hasHanger
    ? Math.max(0, targetShoeDepth - hangerDepth)
    : targetShoeDepth;

  const shoeNet =
    shoeLength > 0
      ? Math.max(0, shoeLength - (config.applyMakeUpLossToShoe ? muLoss : 0))
      : 0;
  const collarNet = collarLength > 0 ? Math.max(0, collarLength - muLoss) : 0;
  const hangerNet = config.hasHanger && hangerLength > 0 ? Math.max(0, hangerLength - muLoss) : 0;

  const rows: TallyRowInput[] = [];
  const pickedIds: string[] = [];
  let deckCursor = 0;
  let currentBelowLen = 0;

  // 1. Float Shoe
  if (shoeLength > 0) {
    rows.push({
      id: createId(),
      jointNo: 'SHOE',
      componentType: 'shoe',
      measuredLength: shoeLength,
      makeUpLossOverride: config.applyMakeUpLossToShoe ? null : 0,
      weightLbFtOverride: null,
      gradeOverride: config.grade,
      serialNo: '',
      remarks: 'Float Shoe',
    });
    currentBelowLen += shoeNet;
  }

  // 2. Shoe Track Joints (between shoe and float collar)
  const trackCount = Math.min(Math.max(0, shoeTrackJointCount), activeDeck.length);
  for (let i = 0; i < trackCount; i++) {
    const jt = activeDeck[deckCursor++];
    pickedIds.push(jt.id);
    const net = Math.max(0, jt.measuredLength - muLoss);
    rows.push({
      id: createId(),
      jointNo: String(jt.jointNo),
      componentType: 'joint',
      measuredLength: jt.measuredLength,
      makeUpLossOverride: null,
      weightLbFtOverride: null,
      gradeOverride: '',
      connectionOverride: jt.connection || '',
      topConnectionOverride: jt.topConnection || '',
      bottomConnectionOverride: jt.bottomConnection || '',
      serialNo: jt.serialNo,
      remarks: jt.remarks || `Shoe track · Layer ${jt.layer}`,
      layer: jt.layer,
    });
    currentBelowLen += net;
  }

  // 3. Float Collar
  if (collarLength > 0) {
    rows.push({
      id: createId(),
      jointNo: 'FC-1',
      componentType: 'collar',
      measuredLength: collarLength,
      makeUpLossOverride: null,
      weightLbFtOverride: null,
      gradeOverride: config.grade,
      serialNo: '',
      remarks: 'Float Collar',
    });
    currentBelowLen += collarNet;
  }

  // Reserve hanger length so joints stop right below hanger
  const targetForPipeAndPup = Math.max(0, requiredBelowHanger - hangerNet);

  // 4. Pick casing/tubing joints from cantilever deck up to targetForPipeAndPup
  const sortedPups = [...availablePupLengths]
    .filter((p) => Number.isFinite(p) && p > muLoss)
    .sort((a, b) => b - a);

  while (deckCursor < activeDeck.length) {
    const nextJt = activeDeck[deckCursor];
    const nextNet = Math.max(0, nextJt.measuredLength - muLoss);

    // If adding this full joint would exceed targetForPipeAndPup beyond half a joint tolerance, stop & try pup joint
    if (requiredBelowHanger > 0 && currentBelowLen + nextNet > targetForPipeAndPup + 0.15) {
      break;
    }

    deckCursor += 1;
    pickedIds.push(nextJt.id);
    rows.push({
      id: createId(),
      jointNo: String(nextJt.jointNo),
      componentType: 'joint',
      measuredLength: nextJt.measuredLength,
      makeUpLossOverride: null,
      weightLbFtOverride: null,
      gradeOverride: '',
      connectionOverride: nextJt.connection || '',
      topConnectionOverride: nextJt.topConnection || '',
      bottomConnectionOverride: nextJt.bottomConnection || '',
      serialNo: nextJt.serialNo,
      remarks: nextJt.remarks || `Layer ${nextJt.layer}`,
      layer: nextJt.layer,
    });
    currentBelowLen += nextNet;

    if (requiredBelowHanger > 0 && currentBelowLen >= targetForPipeAndPup - 0.15) {
      break;
    }
  }

  // 5. Space-out with best-fit Pup Joint(s) if remaining gap > 0.4 and pups are available
  if (requiredBelowHanger > 0 && sortedPups.length > 0) {
    const remainingPups = [...sortedPups];
    let guard = 0;
    while (currentBelowLen < targetForPipeAndPup - 0.2 && remainingPups.length > 0 && guard < 4) {
      guard += 1;
      const gap = targetForPipeAndPup - currentBelowLen;
      // Find largest pup that fits within gap + 0.15 tolerance
      const fitIdx = remainingPups.findIndex((p) => p - muLoss <= gap + 0.15);
      if (fitIdx === -1) break;
      const chosenPup = remainingPups.splice(fitIdx, 1)[0];
      const pupNet = Math.max(0, chosenPup - muLoss);
      rows.push({
        id: createId(),
        jointNo: `PUP-${guard}`,
        componentType: 'pup',
        measuredLength: chosenPup,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: '',
        serialNo: '',
        remarks: 'Space-out pup joint',
      });
      currentBelowLen += pupNet;
    }
  }

  // 6. Hanger Joint + Landing String (from Hanger Landing Profile up to Rig Floor + Cementing Head Stickup)
  let currentLandingLen = 0;
  let requiredLandingTotal = 0;

  if (config.hasHanger) {
    if (hangerLength > 0) {
      rows.push({
        id: createId(),
        jointNo: 'HGR-1',
        componentType: 'hanger',
        measuredLength: hangerLength,
        makeUpLossOverride: null,
        weightLbFtOverride: null,
        gradeOverride: config.grade,
        serialNo: '',
        remarks: `Hanger landed @ ${hangerDepth.toFixed(2)} ${config.lengthUnit}`,
      });
      currentBelowLen += hangerNet;
    }

    const stickupTarget = Math.max(0, config.hangerStickupTarget || 0);
    requiredLandingTotal = hangerDepth + stickupTarget;
    let landingIdx = 1;

    while (currentLandingLen < hangerDepth + 0.25) {
      if (useRemainingDeckForLanding && deckCursor < activeDeck.length) {
        const jt = activeDeck[deckCursor++];
        pickedIds.push(jt.id);
        const net = Math.max(0, jt.measuredLength - muLoss);
        rows.push({
          id: createId(),
          jointNo: `LND-${landingIdx} (Jt ${jt.jointNo})`,
          componentType: 'landing',
          measuredLength: jt.measuredLength,
          makeUpLossOverride: null,
          weightLbFtOverride: null,
          gradeOverride: '',
          connectionOverride: jt.connection || '',
          topConnectionOverride: jt.topConnection || '',
          bottomConnectionOverride: jt.bottomConnection || '',
          serialNo: jt.serialNo,
          remarks: `Landing joint · Layer ${jt.layer}`,
          layer: jt.layer,
        });
        currentLandingLen += net;
        landingIdx += 1;
      } else if (!useRemainingDeckForLanding && landingJointMeasuredLength > muLoss) {
        const net = Math.max(0, landingJointMeasuredLength - muLoss);
        rows.push({
          id: createId(),
          jointNo: `LND-${landingIdx}`,
          componentType: 'landing',
          measuredLength: landingJointMeasuredLength,
          makeUpLossOverride: null,
          weightLbFtOverride: null,
          gradeOverride: '',
          serialNo: '',
          remarks: 'Landing joint',
        });
        currentLandingLen += net;
        landingIdx += 1;
      } else {
        break;
      }

      // Stop once we clear Rig Floor with at least 0.5 unit or close to stickupTarget
      if (currentLandingLen >= requiredLandingTotal - 0.5) {
        break;
      }
      if (landingIdx > 80) break;
    }
  }

  const projectedShoeDepth = config.hasHanger ? hangerDepth + currentBelowLen : currentBelowLen;
  const projectedStickup = config.hasHanger ? currentLandingLen - hangerDepth : 0;

  return {
    rows,
    pickedDeckJointIds: pickedIds,
    unusedDeckJointCount: Math.max(0, activeDeck.length - deckCursor),
    projectedShoeDepth,
    projectedStickup,
    belowHangerDelta: targetShoeDepth - projectedShoeDepth,
    landingDelta: config.hasHanger ? projectedStickup - (config.hangerStickupTarget || 0) : 0,
  };
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function parseClipboardTextToRows(
  text: string,
  defaultStartNo: number
): Array<{
  jointNo: string;
  componentType: ComponentType;
  measuredLength: number;
  makeUpLossOverride: number | null;
  weightLbFtOverride: number | null;
  gradeOverride: string;
  serialNo: string;
  remarks: string;
}> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsed: Array<{
    jointNo: string;
    componentType: ComponentType;
    measuredLength: number;
    makeUpLossOverride: number | null;
    weightLbFtOverride: number | null;
    gradeOverride: string;
    serialNo: string;
    remarks: string;
  }> = [];

  let counter = defaultStartNo;

  for (const line of lines) {
    let cells: string[];
    if (line.includes('\t')) {
      cells = line.split('\t').map((c) => c.trim());
    } else if (line.includes(';')) {
      cells = line.split(';').map((c) => c.trim());
    } else if (line.includes(',')) {
      cells = line.split(',').map((c) => c.trim());
    } else {
      cells = line.split(/\s+/).map((c) => c.trim());
    }

    const numericCells = cells
      .map((c) => ({ raw: c, num: Number(c.replace(/[^0-9.-]/g, '')) }))
      .filter((x) => x.raw !== '' && Number.isFinite(x.num) && /[0-9]/.test(x.raw));

    if (numericCells.length === 0) continue;

    let jointNo = String(counter);
    let measuredLength = 0;
    let makeUpLossOverride: number | null = null;
    let weightLbFtOverride: number | null = null;
    let componentType: ComponentType = 'joint';
    let serialNo = '';
    let remarks = '';

    if (cells.length === 1) {
      measuredLength = numericCells[0].num;
    } else if (cells.length === 2) {
      const firstIsInt = /^\d+$/.test(cells[0]) && Number(cells[0]) < 10000;
      const secondNum = Number(cells[1]);
      if (firstIsInt && Number.isFinite(secondNum) && secondNum > 0) {
        jointNo = cells[0];
        measuredLength = secondNum;
      } else if (Number.isFinite(Number(cells[0]))) {
        measuredLength = Number(cells[0]);
        remarks = cells[1];
      } else {
        jointNo = cells[0];
        measuredLength = numericCells[numericCells.length - 1].num;
      }
    } else {
      const first = cells[0];
      const secondNum = Number(cells[1]);
      const firstNum = Number(first);

      if (Number.isFinite(secondNum) && secondNum > 0) {
        jointNo = first || String(counter);
        measuredLength = secondNum;
        if (cells[2] !== undefined && cells[2] !== '' && Number.isFinite(Number(cells[2]))) {
          makeUpLossOverride = Number(cells[2]);
        }
        if (cells[3] !== undefined && cells[3] !== '' && Number.isFinite(Number(cells[3]))) {
          weightLbFtOverride = Number(cells[3]);
        }
        if (cells[4]) serialNo = cells[4];
        if (cells[5]) remarks = cells.slice(5).join(' ');
      } else if (Number.isFinite(firstNum) && firstNum > 0) {
        measuredLength = firstNum;
        if (cells[1]) remarks = cells.slice(1).join(' ');
      } else {
        jointNo = first || String(counter);
        measuredLength = numericCells[0].num;
        remarks = cells.slice(2).join(' ');
      }
    }

    if (measuredLength <= 0) continue;

    const combinedText = `${jointNo} ${remarks}`.toLowerCase();
    if (combinedText.includes('shoe')) componentType = 'shoe';
    else if (combinedText.includes('collar')) componentType = 'collar';
    else if (combinedText.includes('hanger') || combinedText.includes('hgr')) componentType = 'hanger';
    else if (combinedText.includes('landing') || combinedText.includes('lnd')) componentType = 'landing';
    else if (combinedText.includes('pup')) componentType = 'pup';
    else if (combinedText.includes('xo') || combinedText.includes('cross')) componentType = 'xo';
    else if (combinedText.includes('bha') || combinedText.includes('packer')) componentType = 'bha';

    parsed.push({
      jointNo,
      componentType,
      measuredLength,
      makeUpLossOverride,
      weightLbFtOverride,
      gradeOverride: '',
      serialNo,
      remarks,
    });

    counter += 1;
  }

  return parsed;
}

export function formatNum(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return (0).toFixed(decimals);
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export const DEFAULT_CONFIG: TallyConfig = {
  id: 'default-casing-run',
  wellName: 'Kestrel-4H Exploration',
  rigName: 'Rig Horizon-12',
  fieldBlock: 'Block PM-318',
  engineerName: 'Drilling Eng. Lead',
  stringName: '9-5/8" Production Casing',
  stringCategory: 'casing',
  lengthUnit: 'm',
  pipeSizeIn: 9.625,
  pipeSizeLabel: '9-5/8',
  weightLbFt: 47,
  grade: 'L-80',
  connection: 'BTC',
  topConnection: 'BTC',
  bottomConnection: 'BTC',
  defaultMakeUpLoss: 4.5,
  makeUpLossUnit: 'in',
  applyMakeUpLossToShoe: false,
  sectionTd: 165,
  shoeOffTd: 2.5,
  targetDepth: 162.5,
  hasHanger: true,
  hangerDepth: 45,
  hangerStickupTarget: 2.0,
  mudWeightPpg: 10.5,
  runOrder: 'bottom-to-top',
  updatedAt: new Date().toISOString(),
};

export const SAMPLE_DECK_JOINTS: DeckJointItem[] = [
  { id: 'dk-1', jointNo: 1, layer: 1, measuredLength: 12.18, serialNo: 'HT-4401', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-2', jointNo: 2, layer: 1, measuredLength: 12.24, serialNo: 'HT-4402', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-3', jointNo: 3, layer: 1, measuredLength: 12.11, serialNo: 'HT-4403', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-4', jointNo: 4, layer: 1, measuredLength: 12.29, serialNo: 'HT-4404', remarks: '', discarded: true, discardReason: 'Damaged pin thread on inspection' },
  { id: 'dk-5', jointNo: 5, layer: 1, measuredLength: 12.06, serialNo: 'HT-4405', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-6', jointNo: 6, layer: 1, measuredLength: 12.19, serialNo: 'HT-4406', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-7', jointNo: 7, layer: 2, measuredLength: 12.22, serialNo: 'HT-4407', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-8', jointNo: 8, layer: 2, measuredLength: 12.15, serialNo: 'HT-4408', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-9', jointNo: 9, layer: 2, measuredLength: 12.17, serialNo: 'HT-4409', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-10', jointNo: 10, layer: 2, measuredLength: 12.21, serialNo: 'HT-4410', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-11', jointNo: 11, layer: 2, measuredLength: 12.09, serialNo: 'HT-4411', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-12', jointNo: 12, layer: 2, measuredLength: 12.14, serialNo: 'HT-4412', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-13', jointNo: 13, layer: 3, measuredLength: 12.25, serialNo: 'HT-4413', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-14', jointNo: 14, layer: 3, measuredLength: 12.12, serialNo: 'HT-4414', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-15', jointNo: 15, layer: 3, measuredLength: 12.20, serialNo: 'HT-4415', remarks: '', discarded: false, discardReason: '' },
  { id: 'dk-16', jointNo: 16, layer: 3, measuredLength: 12.16, serialNo: 'HT-4416', remarks: '', discarded: false, discardReason: '' },
];

export const SAMPLE_ROWS: TallyRowInput[] = [
  {
    id: 'jt-shoe',
    jointNo: 'SHOE',
    componentType: 'shoe',
    measuredLength: 0.65,
    makeUpLossOverride: 0,
    weightLbFtOverride: 55,
    gradeOverride: 'L-80',
    serialNo: 'FS-958-01',
    remarks: '9-5/8" Double Valve Float Shoe',
  },
  {
    id: 'jt-1',
    jointNo: '15',
    componentType: 'joint',
    measuredLength: 12.20,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'HT-4415',
    remarks: 'Shoe track joint · Layer 3',
    layer: 3,
  },
  {
    id: 'jt-fc',
    jointNo: 'FC-1',
    componentType: 'collar',
    measuredLength: 0.58,
    makeUpLossOverride: null,
    weightLbFtOverride: 55,
    gradeOverride: 'L-80',
    serialNo: 'FC-958-04',
    remarks: 'Float Collar w/ Threadlock',
  },
  {
    id: 'jt-2',
    jointNo: '16',
    componentType: 'joint',
    measuredLength: 12.16,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'HT-4416',
    remarks: 'Layer 3',
    layer: 3,
  },
  {
    id: 'jt-3',
    jointNo: '13',
    componentType: 'joint',
    measuredLength: 12.25,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'HT-4413',
    remarks: 'Layer 3',
    layer: 3,
  },
  {
    id: 'jt-4',
    jointNo: '14',
    componentType: 'joint',
    measuredLength: 12.12,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'HT-4414',
    remarks: 'Layer 3',
    layer: 3,
  },
  {
    id: 'jt-5',
    jointNo: '7',
    componentType: 'joint',
    measuredLength: 12.22,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'HT-4407',
    remarks: 'Layer 2',
    layer: 2,
  },
  {
    id: 'jt-6',
    jointNo: '8',
    componentType: 'joint',
    measuredLength: 12.15,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'HT-4408',
    remarks: 'Layer 2',
    layer: 2,
  },
  {
    id: 'jt-7',
    jointNo: '9',
    componentType: 'joint',
    measuredLength: 12.17,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'HT-4409',
    remarks: 'Layer 2',
    layer: 2,
  },
  {
    id: 'jt-8',
    jointNo: '10',
    componentType: 'joint',
    measuredLength: 12.21,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'HT-4410',
    remarks: 'Layer 2',
    layer: 2,
  },
  {
    id: 'jt-9',
    jointNo: '11',
    componentType: 'joint',
    measuredLength: 12.09,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'HT-4411',
    remarks: 'Layer 2',
    layer: 2,
  },
  {
    id: 'jt-pup',
    jointNo: 'PUP-1',
    componentType: 'pup',
    measuredLength: 6.10,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'PUP-958-20',
    remarks: 'Space-out pup joint',
  },
  {
    id: 'jt-hgr',
    jointNo: 'HGR-1',
    componentType: 'hanger',
    measuredLength: 2.15,
    makeUpLossOverride: null,
    weightLbFtOverride: 62,
    gradeOverride: 'L-80',
    serialNo: 'MH-958-02',
    remarks: 'Mudline Casing Hanger',
  },
  {
    id: 'jt-lnd-1',
    jointNo: 'LND-1',
    componentType: 'landing',
    measuredLength: 12.14,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'HT-4412',
    remarks: 'Landing joint · Layer 2',
    layer: 2,
  },
  {
    id: 'jt-lnd-2',
    jointNo: 'LND-2',
    componentType: 'landing',
    measuredLength: 12.18,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'HT-4401',
    remarks: 'Landing joint · Layer 1',
    layer: 1,
  },
  {
    id: 'jt-lnd-3',
    jointNo: 'LND-3',
    componentType: 'landing',
    measuredLength: 12.24,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'HT-4402',
    remarks: 'Landing joint · Layer 1',
    layer: 1,
  },
  {
    id: 'jt-lnd-4',
    jointNo: 'LND-4',
    componentType: 'landing',
    measuredLength: 10.95,
    makeUpLossOverride: null,
    weightLbFtOverride: null,
    gradeOverride: '',
    serialNo: 'LND-SP-01',
    remarks: 'Top landing joint w/ cementing head stick-up',
  },
];
