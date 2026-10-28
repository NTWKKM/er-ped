import rawDataset from './dataset.json';

export interface RenalTier {
  gfr: string;
  minGfr: number;
  maxGfr: number;
  doseAdjustment: string;
  freq?: string;
  maxPerDoseMg?: number;
  maxPerDayMg?: number;
  clinicalNote: string;
}

export interface DoseBand {
  minAgeYr?: number | null;
  maxAgeYr?: number | null;
  minKg?: number | null;
  maxKg?: number | null;
  minWeightKg?: number | null;
  maxWeightKg?: number | null;
  doseMg?: number | null;
  minMg?: number | null;
  maxMg?: number | null;
  doseMl?: number | null;
  minMl?: number | null;
  maxMl?: number | null;
  doseUnits?: number | null;
  minUnits?: number | null;
  maxUnits?: number | null;
  note?: string;
}

export interface PediatricDrug {
  key: string;
  drug: string;
  name: string;
  preparation?: string;
  note?: string;
  unit?: string;
  unitType?: string;
  doseMinMgPerKg?: number | null;
  doseMaxMgPerKg?: number | null;
  dose?: number | null;
  maxPerDoseMg?: number | null;
  maxPerDayMg?: number | null;
  freq?: string;
  split?: string;
  route?: string;
  renalAdjust?: boolean;
  renalDosing?: RenalTier[];
  minAgeYr?: number | null;
  maxAgeYr?: number | null;
  minWeightKg?: number | null;
  maxWeightKg?: number | null;
  aliases?: string[];
  isAtb?: boolean;
  category?: string;
  fixedDose?: {
    doseMg?: number | null;
    doseUnits?: number | null;
  };
  doseBands?: DoseBand[];
}

export interface InfusionDripItem {
  key: string;
  drug: string;
  doseMinMcgKgMin: number;
  doseMaxMcgKgMin: number;
  doseDefaultMcgKgMin: number;
  unit: string;
  standardPrep: string;
  concMgPerMl: number;
  maxRateMcgKgMin: number;
  note: string;
  route: string;
}

export interface BroselowZone {
  color: string;
  min: number;
  max: number;
  approxKg: number;
  drugs: Record<string, any>;
}

export interface EvidenceRef {
  title: string;
  organization: string;
  year: number;
  journal: string;
  doi?: string;
  pmid?: string;
  isbn?: string;
  loe: string;
  category: string;
  summary: string;
}

export const DATASET = rawDataset as {
  meta: { version: string; source: string };
  pediatricDose: PediatricDrug[];
  pediatricATB: PediatricDrug[];
  fluids: typeof rawDataset.fluids;
  pals: typeof rawDataset.pals;
  ncpr: typeof rawDataset.ncpr;
  broselow: BroselowZone[];
  infusionDrips: InfusionDripItem[];
  seizureProtocol: typeof rawDataset.seizureProtocol;
  toxicologyAntidotes: typeof rawDataset.toxicologyAntidotes;
  proceduralSedation: typeof rawDataset.proceduralSedation;
  vitalSignsRef: typeof rawDataset.vitalSignsRef;
  dkaProtocol: typeof rawDataset.dkaProtocol;
  asthmaProtocol: typeof rawDataset.asthmaProtocol;
  electrolyteRef: typeof rawDataset.electrolyteRef;
  electrolyteProtocols: typeof rawDataset.electrolyteProtocols;
  evidenceReferences: Record<string, EvidenceRef>;
  airway: typeof rawDataset.airway;
  sepsis: typeof rawDataset.sepsis;
  anaphylaxis: typeof rawDataset.anaphylaxis;
  trauma: typeof rawDataset.trauma;
  croup: typeof rawDataset.croup;
  transfusion: typeof rawDataset.transfusion;
  whoGrowth: typeof rawDataset.whoGrowth;
};

export interface BroselowSpectrumBand {
  color: string;
  label: string;
  range: string;
  min: number;
  max: number;
  approxKg: number;
  ageApprox: string;
  bg: string;
  fg: string;
}

export const BROSELOW_SPECTRUM: BroselowSpectrumBand[] = [
  { color: 'Grey', label: 'Grey', range: '3–5.9 kg', min: 3, max: 5.9, approxKg: 5, ageApprox: '~1–2 mo', bg: '#E5E7EB', fg: '#1F2937' },
  { color: 'Pink', label: 'Pink', range: '6–7.9 kg', min: 6, max: 7.9, approxKg: 7, ageApprox: '~4–6 mo', bg: '#FCE7F3', fg: '#9D174D' },
  { color: 'Red', label: 'Red', range: '8–9.9 kg', min: 8, max: 9.9, approxKg: 9, ageApprox: '~8–10 mo', bg: '#FEE2E2', fg: '#991B1B' },
  { color: 'Purple', label: 'Purple', range: '10–11.9 kg', min: 10, max: 11.9, approxKg: 10.5, ageApprox: '~1–1.5 yr', bg: '#F3E8FF', fg: '#6B21A8' },
  { color: 'Yellow', label: 'Yellow', range: '12–14.9 kg', min: 12, max: 14.9, approxKg: 13, ageApprox: '~2–3 yr', bg: '#FEF3C7', fg: '#92400E' },
  { color: 'White', label: 'White', range: '15–18.9 kg', min: 15, max: 18.9, approxKg: 16.5, ageApprox: '~4–5 yr', bg: '#F8FAFC', fg: '#0F172A' },
  { color: 'Blue', label: 'Blue', range: '19–23.9 kg', min: 19, max: 23.9, approxKg: 21, ageApprox: '~6–7 yr', bg: '#DBEAFE', fg: '#1E40AF' },
  { color: 'Orange', label: 'Orange', range: '24–29.9 kg', min: 24, max: 29.9, approxKg: 26.5, ageApprox: '~8–9 yr', bg: '#FFEDD5', fg: '#9A3412' },
  { color: 'Green', label: 'Green', range: '30–36 kg', min: 30, max: 36, approxKg: 33, ageApprox: '~10–11 yr', bg: '#DCFCE7', fg: '#166534' },
];

