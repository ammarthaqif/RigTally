export type StringCategory = 'conductor' | 'casing' | 'tubing';

export type LengthUnit = 'm' | 'ft';

export type MakeUpLossUnit = 'in' | 'ft' | 'm';

export type ComponentType =
  | 'joint'
  | 'pup'
  | 'shoe'
  | 'collar'
  | 'hanger'
  | 'landing'
  | 'xo'
  | 'bha';

export type RunOrder = 'bottom-to-top' | 'top-to-bottom';

export type LayerPickupOrder = 'top-layer-first' | 'bottom-layer-first';

export interface TallyConfig {
  id: string;
  wellName: string;
  rigName: string;
  fieldBlock: string;
  engineerName: string;
  stringName: string;
  stringCategory: StringCategory;
  lengthUnit: LengthUnit;
  pipeSizeIn: number;
  pipeSizeLabel: string;
  weightLbFt: number;
  grade: string;
  connection: string;
  topConnection?: string;
  bottomConnection?: string;
  defaultMakeUpLoss: number;
  makeUpLossUnit: MakeUpLossUnit;
  applyMakeUpLossToShoe: boolean;
  // Section TD & Shoe Depth
  sectionTd: number;
  shoeOffTd: number;
  targetDepth: number; // Computed or direct Shoe Depth = sectionTd - shoeOffTd
  // Hanger & Landing configuration
  hasHanger: boolean;
  hangerDepth: number; // Hanger landing profile depth MD from Rig Floor (RKB)
  hangerStickupTarget: number; // Desired stickup above rig floor for cementing head make-up
  mudWeightPpg: number;
  runOrder: RunOrder;
  updatedAt: string;
}

export interface TallyRowInput {
  id: string;
  jointNo: string;
  componentType: ComponentType;
  measuredLength: number;
  makeUpLossOverride: number | null;
  weightLbFtOverride: number | null;
  gradeOverride: string;
  connectionOverride?: string;
  topConnectionOverride?: string;
  bottomConnectionOverride?: string;
  serialNo: string;
  remarks: string;
  layer?: number; // Cantilever deck layer (1 = bottom layer, 2, 3...)
  discarded?: boolean; // Rejected / discarded joint — preserves jointNo tracking, excluded from depth/weight
  discardReason?: string;
}

export interface DeckJointItem {
  id: string;
  jointNo: number;
  layer: number;
  measuredLength: number;
  connection?: string;
  topConnection?: string;
  bottomConnection?: string;
  serialNo: string;
  remarks: string;
  discarded: boolean;
  discardReason: string;
}

export interface ComputedTallyRow extends TallyRowInput {
  seq: number; // Active run sequence (null/0-based display handled for discarded)
  runSeq: number | null; // Sequential number among non-discarded active run pieces
  effectiveConnection: string;
  effectiveTopConnection: string;
  effectiveBottomConnection: string;
  effectiveMakeUpLoss: number;
  effectiveLength: number;
  cumLength: number;
  topDepth: number;
  bottomDepth: number;
  unitWeightLbFt: number;
  segmentAirWeightLbs: number;
  segmentBuoyedWeightLbs: number;
  cumAirWeightLbs: number;
  cumBuoyedWeightLbs: number;
}

export interface CrossoverAlert {
  id: string;
  afterRowId: string;
  beforeRowId: string;
  fromJointNo: string;
  toJointNo: string;
  fromEnd: 'Top' | 'Bottom';
  toEnd: 'Top' | 'Bottom';
  fromConnection: string;
  toConnection: string;
  xoTopConnection: string;
  xoBottomConnection: string;
}

export interface TallySummary {
  totalJoints: number; // Active run pieces (excluding discarded)
  discardedCount: number;
  standardJointCount: number;
  pupJointCount: number;
  accessoryCount: number;
  landingJointCount: number;
  totalMeasuredLength: number;
  totalMakeUpLoss: number;
  totalEffectiveLength: number;
  belowHangerEffectiveLength: number;
  landingEffectiveLength: number;
  achievedShoeDepth: number;
  actualStickupAboveRigFloor: number;
  stickupDeltaFromTarget: number;
  totalAirWeightLbs: number;
  totalBuoyedWeightLbs: number;
  totalAirWeightTonnes: number;
  totalBuoyedWeightTonnes: number;
  buoyancyFactor: number;
  targetDelta: number; // positive = remaining to reach Shoe Depth, negative = excess
  averageJointLength: number;
  estimatedRemainingJoints: number;
}

export interface ComputedTallyResult {
  rows: ComputedTallyRow[];
  summary: TallySummary;
  crossoverAlerts: CrossoverAlert[];
}

export interface PipePreset {
  category: StringCategory;
  label: string;
  sizeLabel: string;
  sizeIn: number;
  weights: number[];
  defaultWeight: number;
  defaultGrade: string;
  defaultConnection: string;
  defaultMakeUpLossIn: number;
}

export interface LibraryItem {
  id: string;
  category: ComponentType;
  itemCode: string;
  description: string;
  sizeLabel: string;
  sizeIn: number;
  weightLbFt: number;
  grade: string;
  topConnection: string;
  bottomConnection: string;
  measuredLength: number;
  lengthUnit: LengthUnit;
  quantityAvailable: number;
  serialNo: string;
  source: 'preset' | 'inspection' | 'manual';
  remarks: string;
}

export interface TallyRecommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium';
  kind: 'xo' | 'pup-spaceout' | 'landing-spaceout' | 'joint-replenish' | 'float-equipment';
  title: string;
  reason: string;
  libraryItem: LibraryItem;
  insertAfterRowId?: string;
  recommendedCount: number;
  projectedDeltaLabel?: string;
}

export interface InspectionReportItem {
  id: string;
  jointNo: string;
  componentType: ComponentType;
  sizeLabel: string;
  sizeIn: number | null;
  weightLbFt: number | null;
  grade: string;
  topConnection: string;
  bottomConnection: string;
  measuredLength: number;
  lengthUnit: LengthUnit | 'unknown';
  serialNo: string;
  condition: 'accepted' | 'rejected' | 'repair';
  remarks: string;
}

export interface InspectionReportResult {
  fileName: string;
  reportTitle: string;
  inspectorCompany: string;
  detectedUnit: LengthUnit | 'unknown';
  detectedSizeLabel: string;
  detectedSizeIn: number | null;
  detectedWeightLbFt: number | null;
  detectedGrade: string;
  detectedConnection: string;
  notes: string;
  items: InspectionReportItem[];
}

