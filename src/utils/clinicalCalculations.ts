import { DATASET, PediatricDrug, DoseBand, RenalTier, BroselowZone, BROSELOW_SPECTRUM } from '../data/dataset';

// ==========================================
// 1. BIOMETRICS, WEECH, LENGTH & BSA ENGINE
// ==========================================

export function estimateWeightFromAge(ageVal: number | null | undefined, unit: 'yr' | 'mo' = 'yr'): number | null {
  const num = Number(ageVal);
  if (!Number.isFinite(num) || num <= 0) return null;

  let ageYr = unit === 'mo' ? num / 12 : num;
  let ageMo = unit === 'mo' ? num : num * 12;

  if (ageYr > 15) {
    ageYr = 15;
    ageMo = 180;
  }

  // < 1 yr: Weech formula = (mo + 9) / 2
  if (ageYr < 1) {
    return Math.round(((ageMo + 9) / 2) * 10) / 10;
  }
  // 1–6 yr: 2 * age + 8
  if (ageYr <= 6) {
    return Math.round((ageYr * 2 + 8) * 10) / 10;
  }
  // > 6 yr: (7 * age - 5) / 2
  return Math.round(((7 * ageYr - 5) / 2) * 10) / 10;
}

export function estimateWeightFromLength(lengthVal: number | null | undefined): number | null {
  const len = Number(lengthVal);
  if (!Number.isFinite(len) || len <= 0) return null;

  if (len < 46) {
    return Math.round(((len * len * 1.65) / 1000) * 10) / 10;
  }
  if (len <= 59.5) return 4.5;
  if (len <= 67.5) return 6.5;
  if (len <= 77.5) return 8.5;
  if (len <= 87.5) return 10.5;
  if (len <= 97.5) return 13.0;
  if (len <= 109.5) return 16.5;
  if (len <= 121.5) return 21.0;
  if (len <= 136.5) return 26.5;
  if (len <= 145) return 33.0;

  return Math.round(((len - 100) * 0.9) * 10) / 10;
}

export function calcBSA(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) return null;
  // Mosteller formula: sqrt((height_cm * weight_kg) / 3600)
  return Math.round(Math.sqrt((w * h) / 3600) * 100) / 100;
}

export interface GrowthZScoreResult {
  waz: number | null;
  wazLabel: string | null;
  wazStatus: 'good' | 'warning' | 'danger' | null;
  haz: number | null;
  hazLabel: string | null;
  hazStatus: 'good' | 'warning' | 'danger' | null;
  bmi: number | null;
  nutritionIndicator: 'WFH' | 'BMI' | null;
  nutritionLabel: string | null;
  nutritionStatus: 'good' | 'warning' | 'danger' | null;
  refAgeMo: number;
  medianWeight: number;
  medianHeight: number;
}

export function calcGrowthZScores(
  ageYr: number | null | undefined,
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
  sex: 'male' | 'female' = 'male'
): GrowthZScoreResult | null {
  const w = Number(weightKg);
  const a = Number(ageYr);
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(a) || a <= 0 || !DATASET.whoGrowth) {
    return null;
  }

  const ageMo = Math.min(180, Math.max(0, a * 12));
  const table = sex === 'male' ? DATASET.whoGrowth.boys.table : DATASET.whoGrowth.girls.table;

  // Continuous linear interpolation across reference table months to avoid abrupt discrete jumps
  let rowA = table[0];
  let rowB = table[table.length - 1];

  for (let i = 0; i < table.length - 1; i++) {
    if (ageMo >= table[i][0] && ageMo <= table[i + 1][0]) {
      rowA = table[i];
      rowB = table[i + 1];
      break;
    }
  }

  let wMed: number, wSD: number, hMed: number, hSD: number;
  if (rowA[0] === rowB[0] || ageMo <= table[0][0]) {
    wMed = table[0][1];
    wSD = table[0][2];
    hMed = table[0][3];
    hSD = table[0][4];
  } else if (ageMo >= table[table.length - 1][0]) {
    const last = table[table.length - 1];
    wMed = last[1];
    wSD = last[2];
    hMed = last[3];
    hSD = last[4];
  } else {
    const t = (ageMo - rowA[0]) / (rowB[0] - rowA[0]);
    wMed = rowA[1] + t * (rowB[1] - rowA[1]);
    wSD = rowA[2] + t * (rowB[2] - rowA[2]);
    hMed = rowA[3] + t * (rowB[3] - rowA[3]);
    hSD = rowA[4] + t * (rowB[4] - rowA[4]);
  }

  // WHO weight-for-age is standardized up to 10 completed years (120 months); beyond 120 mo, WAZ is unstandardized
  const isWazSupported = ageMo <= 120;
  let waz: number | null = null;
  let wazLabel: string | null = null;
  let wazStatus: 'good' | 'warning' | 'danger' | null = null;

  if (isWazSupported) {
    waz = +((w - wMed) / wSD).toFixed(1);
    if (waz < -3) {
      wazStatus = 'danger';
      wazLabel = 'Severe Underweight';
    } else if (waz < -2) {
      wazStatus = 'warning';
      wazLabel = 'Underweight';
    } else if (waz > 2) {
      wazStatus = 'warning';
      wazLabel = 'High Weight';
    } else {
      wazStatus = 'good';
      wazLabel = 'Normal';
    }
  }

  // Height-for-Age (HAZ) is standardized 0-19 years
  const h = Number(heightCm);
  let haz: number | null = null;
  let hazLabel: string | null = null;
  let hazStatus: 'good' | 'warning' | 'danger' | null = null;

  if (Number.isFinite(h) && h > 0) {
    haz = +((h - hMed) / hSD).toFixed(1);
    if (haz < -3) {
      hazStatus = 'danger';
      hazLabel = 'Severe Stunting';
    } else if (haz < -2) {
      hazStatus = 'warning';
      hazLabel = 'Stunted';
    } else if (haz > 2) {
      hazStatus = 'warning';
      hazLabel = 'Tall';
    } else {
      hazStatus = 'good';
      hazLabel = 'Normal';
    }
  }

  // Excess weight / body habitus indicator: Weight-for-height (<5y) and BMI-for-age (5-19y)
  let bmi: number | null = null;
  let nutritionIndicator: 'WFH' | 'BMI' | null = null;
  let nutritionLabel: string | null = null;
  let nutritionStatus: 'good' | 'warning' | 'danger' | null = null;

  if (Number.isFinite(h) && h > 0) {
    const heightM = h / 100;
    bmi = +(w / (heightM * heightM)).toFixed(1);

    if (ageMo < 60) {
      nutritionIndicator = 'WFH';
      const refW = estimateWeightFromLength(h);
      if (refW && refW > 0) {
        const ratio = w / refW;
        if (ratio > 1.3) {
          nutritionStatus = 'danger';
          nutritionLabel = 'Obese';
        } else if (ratio > 1.2) {
          nutritionStatus = 'warning';
          nutritionLabel = 'Overweight';
        } else if (ratio < 0.7) {
          nutritionStatus = 'danger';
          nutritionLabel = 'Severe Wasting';
        } else if (ratio < 0.8) {
          nutritionStatus = 'warning';
          nutritionLabel = 'Wasted';
        } else {
          nutritionStatus = 'good';
          nutritionLabel = 'Normal';
        }
      }
    } else {
      nutritionIndicator = 'BMI';
      const medianBmi = wMed / ((hMed / 100) * (hMed / 100));
      const ratio = bmi / medianBmi;
      if (ratio > 1.3) {
        nutritionStatus = 'danger';
        nutritionLabel = 'Obese';
      } else if (ratio > 1.15) {
        nutritionStatus = 'warning';
        nutritionLabel = 'Overweight';
      } else if (ratio < 0.7) {
        nutritionStatus = 'danger';
        nutritionLabel = 'Severe Thinness';
      } else if (ratio < 0.8) {
        nutritionStatus = 'warning';
        nutritionLabel = 'Thinness';
      } else {
        nutritionStatus = 'good';
        nutritionLabel = 'Normal';
      }
    }
  }

  // If age > 10y and no height was entered, no supported growth indicator can be computed
  if (waz === null && haz === null && nutritionLabel === null) {
    return null;
  }

  return {
    waz,
    wazLabel,
    wazStatus,
    haz,
    hazLabel,
    hazStatus,
    bmi,
    nutritionIndicator,
    nutritionLabel,
    nutritionStatus,
    refAgeMo: Math.round(ageMo * 10) / 10,
    medianWeight: Math.round(wMed * 10) / 10,
    medianHeight: Math.round(hMed * 10) / 10,
  };
}

// ==========================================
// 2. BROSELOW & AIRWAY SIZING HELPERS
// ==========================================

export function getBroselowZone(w: number | null | undefined): BroselowZone | null {
  const num = Number(w);
  if (!Number.isFinite(num) || num <= 0 || !DATASET.broselow) return null;
  for (const b of DATASET.broselow) {
    if (num >= b.min && num <= b.max) return b;
  }
  return null;
}

export function getBroselowSpectrumBand(w: number | null | undefined) {
  const num = Number(w);
  if (!Number.isFinite(num) || num <= 0) return null;
  return BROSELOW_SPECTRUM.find((b) => num >= b.min && num <= b.max) || null;
}

export function weightToETTCuffed(kg: number): string {
  if (kg < 6) return '3.0';
  if (kg < 9) return '3.5';
  if (kg < 12) return '4.0';
  if (kg < 15) return '4.5';
  if (kg < 19) return '5.0';
  if (kg < 24) return '5.5';
  if (kg < 30) return '6.0';
  if (kg < 36) return '6.5';
  return '7.0';
}

export function weightToETTUncuffed(kg: number): string {
  const c = Number(weightToETTCuffed(kg));
  return c ? (c + 0.5).toFixed(1) : '';
}

export function weightToDepth(kg: number): string {
  const c = Number(weightToETTCuffed(kg));
  return c ? (c * 3).toFixed(1) : '';
}

export function suggestBlade(kg: number): string {
  if (kg < 10) return '0–1 straight (Miller)';
  if (kg < 12) return '1–1.5 straight';
  if (kg < 24) return '2 straight/curved';
  return '3 curved (Mac)';
}

export function suggestNG(kg: number): string {
  if (kg < 10) return '6–8';
  if (kg < 19) return '8–10';
  if (kg < 24) return '10–12';
  return '12–14';
}

export function suggestFoley(kg: number): string {
  if (kg < 10) return '6–8';
  if (kg < 19) return '8–10';
  return '10–12';
}

export function suggestOPA(kg: number): string {
  if (kg < 10) return '40–50';
  if (kg < 19) return '60';
  if (kg < 24) return '70';
  return '80';
}

export function suggestNPA(kg: number): number {
  if (kg < 10) return 14;
  if (kg < 19) return 18;
  if (kg < 24) return 20;
  return 24;
}

export function suggestSuction(kg: number): string {
  if (kg < 10) return '6–8';
  if (kg < 19) return '8';
  return '10';
}

// ==========================================
// 3. MEDICATION & ANTIBIOTIC DOSING ENGINE
// ==========================================

export function fmtMg(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (n === 0) return '0';
  if (n >= 100) return n.toFixed(0);
  if (n >= 1) return n.toFixed(1).replace(/\.0$/, '');
  if (n >= 0.1) return n.toFixed(2).replace(/0$/, '');
  return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export function fmtMl(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n >= 10 ? n.toFixed(1) : n.toFixed(2);
}

export function parseStrength(prepText?: string | null): { mgPerMl?: number; mgPerTab?: number } {
  if (!prepText) return {};
  const s = String(prepText).replace(/\s+/g, ' ').trim();

  let m = s.match(/(\d+(?:\.\d+)?)\s*mg\s*\/\s*(\d+(?:\.\d+)?)\s*mL/i);
  if (m) {
    const mg = parseFloat(m[1]);
    const ml = parseFloat(m[2]);
    if (mg > 0 && ml > 0) return { mgPerMl: mg / ml };
  }
  m = s.match(/(\d+(?:\.\d+)?)\s*mg\s*\/\s*5\s*mL/i);
  if (m) {
    const mg = parseFloat(m[1]);
    if (mg > 0) return { mgPerMl: mg / 5 };
  }
  m = s.match(/(\d+(?:\.\d+)?)\s*mg\s*\/\s*(?:tab|tablet|cap)/i);
  if (m) {
    const mg = parseFloat(m[1]);
    if (mg > 0) return { mgPerTab: mg };
  }
  return {};
}

export function dosesPerDayFromFreq(freq?: string | null): number | null {
  if (!freq) return null;
  const f = String(freq).trim().toLowerCase();

  let m = f.match(/div(?:ided)?\s*(\d+)/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0) return n;
  }

  m = f.match(/q\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*h/);
  if (m) {
    const h1 = parseFloat(m[1]);
    const h2 = m[2] ? parseFloat(m[2]) : h1;
    const qh = Math.min(h1, h2);
    if (qh > 0) return Math.max(1, Math.round(24 / qh));
  }

  if (/\bqid\b/.test(f)) return 4;
  if (/\btid\b/.test(f)) return 3;
  if (/\bbid\b/.test(f)) return 2;
  if (/\b(od|qd|once\s*daily|once\s*a\s*day|daily)\b/.test(f)) return 1;

  return null;
}

export function findMatchedDoseBand(
  bands: DoseBand[] | undefined,
  w: number | null,
  ageYr: number | null
): DoseBand | null {
  if (!Array.isArray(bands)) return null;
  return (
    bands.find((b, _idx, arr) => {
      if (b.minAgeYr != null && (ageYr == null || ageYr < b.minAgeYr)) return false;
      if (b.maxAgeYr != null && ageYr != null) {
        const hasNextAdjacent = arr.some((other) => other.minAgeYr === b.maxAgeYr);
        if (hasNextAdjacent ? ageYr >= b.maxAgeYr : ageYr > b.maxAgeYr) return false;
      }
      const minW = b.minKg ?? b.minWeightKg ?? null;
      const maxW = b.maxKg ?? b.maxWeightKg ?? null;
      if (minW != null && (w == null || w < minW)) return false;
      if (maxW != null && w != null && w > maxW) return false;
      return true;
    }) || null
  );
}

export interface ResolvedDrugDose {
  type: 'fixed' | 'band' | 'weight';
  isAgeRestricted: boolean;
  matchedBand: DoseBand | null;
  doseMg: number | null;
  doseMinMg: number | null;
  doseMaxMg: number | null;
  doseMl: number | null;
  doseMinMl: number | null;
  doseMaxMl: number | null;
  doseUnits: number | null;
  doseMinUnits: number | null;
  doseMaxUnits: number | null;
  perDayMinMg: number | null;
  perDayMaxMg: number | null;
  isCappedPerDose: boolean;
  isCappedPerDay: boolean;
  nPerDay: number | null;
}

export function resolveDrugDose(
  drug: PediatricDrug | null | undefined,
  w: number | null | undefined,
  ageYr: number | null | undefined,
  isAtb = false
): ResolvedDrugDose | null {
  if (!drug) return null;
  const isAtbDrug =
    isAtb ||
    (Array.isArray(DATASET.pediatricATB) && DATASET.pediatricATB.some((d) => d.key === drug.key));
  const weight = w != null && w > 0 ? Number(w) : null;
  const age = ageYr != null ? Number(ageYr) : null;

  const isAgeRestricted =
    age != null &&
    ((drug.minAgeYr != null && age < drug.minAgeYr) ||
      (drug.maxAgeYr != null && age > drug.maxAgeYr));

  const nPerDay = dosesPerDayFromFreq(drug.freq || drug.split);

  if (Array.isArray(drug.doseBands) && drug.doseBands.length > 0) {
    const matchedBand = findMatchedDoseBand(drug.doseBands, weight, age);
    if (matchedBand) {
      const doseMg = matchedBand.doseMg ?? null;
      const minMg = matchedBand.minMg ?? doseMg;
      const maxMg = matchedBand.maxMg ?? doseMg;

      const doseMl = matchedBand.doseMl ?? null;
      const minMl = matchedBand.minMl ?? doseMl;
      const maxMl = matchedBand.maxMl ?? doseMl;

      const doseUnits = matchedBand.doseUnits ?? null;
      const minUnits = matchedBand.minUnits ?? doseUnits;
      const maxUnits = matchedBand.maxUnits ?? doseUnits;

      const perDayMinMg = minMg != null && nPerDay ? minMg * nPerDay : minMg;
      const perDayMaxMg = maxMg != null && nPerDay ? maxMg * nPerDay : maxMg;

      return {
        type: 'band',
        isAgeRestricted,
        matchedBand,
        doseMg: maxMg ?? minMg,
        doseMinMg: minMg,
        doseMaxMg: maxMg,
        doseMl: maxMl ?? minMl,
        doseMinMl: minMl,
        doseMaxMl: maxMl,
        doseUnits: maxUnits ?? minUnits,
        doseMinUnits: minUnits,
        doseMaxUnits: maxUnits,
        perDayMinMg,
        perDayMaxMg,
        isCappedPerDose: false,
        isCappedPerDay: false,
        nPerDay,
      };
    }
  }

  if (drug.fixedDose) {
    const doseMg = drug.fixedDose.doseMg ?? null;
    const doseUnits = drug.fixedDose.doseUnits ?? null;
    const perDayMg = doseMg != null && nPerDay ? doseMg * nPerDay : doseMg;
    return {
      type: 'fixed',
      isAgeRestricted,
      matchedBand: null,
      doseMg,
      doseMinMg: doseMg,
      doseMaxMg: doseMg,
      doseMl: null,
      doseMinMl: null,
      doseMaxMl: null,
      doseUnits,
      doseMinUnits: doseUnits,
      doseMaxUnits: doseUnits,
      perDayMinMg: perDayMg,
      perDayMaxMg: perDayMg,
      isCappedPerDose: false,
      isCappedPerDay: false,
      nPerDay,
    };
  }

  const unit = drug.unit || 'mg/kg';
  const isPerDay = !isAtbDrug && (/mg\/kg\/day/i.test(unit) || drug.unitType === 'perDay');
  const minPerKg = drug.doseMinMgPerKg ?? drug.dose ?? null;
  const maxPerKg = drug.doseMaxMgPerKg ?? drug.dose ?? minPerKg;

  let perDoseMinMg: number | null = null;
  let perDoseMaxMg: number | null = null;
  let perDayMinMg: number | null = null;
  let perDayMaxMg: number | null = null;
  let isCappedPerDose = false;
  let isCappedPerDay = false;

  if (weight != null) {
    if (isPerDay) {
      if (minPerKg != null) perDayMinMg = weight * minPerKg;
      if (maxPerKg != null) perDayMaxMg = weight * maxPerKg;
      if (drug.maxPerDayMg && perDayMaxMg != null && perDayMaxMg > drug.maxPerDayMg) {
        isCappedPerDay = true;
        if (perDayMinMg != null) perDayMinMg = Math.min(perDayMinMg, drug.maxPerDayMg);
        perDayMaxMg = Math.min(perDayMaxMg, drug.maxPerDayMg);
      }
      const freqDiv = nPerDay || 1;
      if (perDayMinMg != null) perDoseMinMg = perDayMinMg / freqDiv;
      if (perDayMaxMg != null) perDoseMaxMg = perDayMaxMg / freqDiv;
      if (drug.maxPerDoseMg && perDoseMaxMg != null && perDoseMaxMg > drug.maxPerDoseMg) {
        isCappedPerDose = true;
        if (perDoseMinMg != null) perDoseMinMg = Math.min(perDoseMinMg, drug.maxPerDoseMg);
        perDoseMaxMg = Math.min(perDoseMaxMg, drug.maxPerDoseMg);
      }
    } else {
      if (minPerKg != null) perDoseMinMg = weight * minPerKg;
      if (maxPerKg != null) perDoseMaxMg = weight * maxPerKg;
      if (drug.maxPerDoseMg && perDoseMaxMg != null && perDoseMaxMg > drug.maxPerDoseMg) {
        isCappedPerDose = true;
        if (perDoseMinMg != null) perDoseMinMg = Math.min(perDoseMinMg, drug.maxPerDoseMg);
        perDoseMaxMg = Math.min(perDoseMaxMg, drug.maxPerDoseMg);
      }
      if (nPerDay) {
        if (perDoseMinMg != null) perDayMinMg = perDoseMinMg * nPerDay;
        if (perDoseMaxMg != null) perDayMaxMg = perDoseMaxMg * nPerDay;
      }
      if (drug.maxPerDayMg && perDayMaxMg != null && perDayMaxMg > drug.maxPerDayMg) {
        isCappedPerDay = true;
        if (perDayMinMg != null) perDayMinMg = Math.min(perDayMinMg, drug.maxPerDayMg);
        perDayMaxMg = Math.min(perDayMaxMg, drug.maxPerDayMg);
      }
    }
  }

  return {
    type: 'weight',
    isAgeRestricted,
    matchedBand: null,
    doseMg: perDoseMaxMg ?? perDoseMinMg,
    doseMinMg: perDoseMinMg,
    doseMaxMg: perDoseMaxMg,
    doseMl: null,
    doseMinMl: null,
    doseMaxMl: null,
    doseUnits: null,
    doseMinUnits: null,
    doseMaxUnits: null,
    perDayMinMg,
    perDayMaxMg,
    isCappedPerDose,
    isCappedPerDay,
    nPerDay,
  };
}

// ==========================================
// 4. BEDSIDE SCHWARTZ eGFR & RENAL ENGINE
// ==========================================

export function calcSchwartzEGFR(
  scr: number | null | undefined,
  htCm: number | null | undefined
): number | null {
  const s = Number(scr);
  const h = Number(htCm);
  if (!Number.isFinite(s) || !Number.isFinite(h) || s <= 0 || h <= 0) return null;
  // Bedside Schwartz 2009: 0.413 * Height (cm) / SCr (mg/dL)
  return (0.413 * h) / s;
}

export function calcPatientRenalDose(
  tier: RenalTier,
  drug: PediatricDrug,
  bw: number | null | undefined
): string {
  if (!bw || bw <= 0) return `${tier.doseAdjustment || ''} ${tier.freq || ''}`.trim();
  let cap = drug.maxPerDoseMg || Infinity;
  if (tier.maxPerDoseMg) cap = Math.min(cap, tier.maxPerDoseMg);
  if (drug.maxPerDayMg && tier.freq) {
    const n = dosesPerDayFromFreq(tier.freq);
    if (n && n > 0) cap = Math.min(cap, drug.maxPerDayMg / n);
  }
  if (tier.maxPerDayMg && tier.freq) {
    const n = dosesPerDayFromFreq(tier.freq);
    if (n && n > 0) cap = Math.min(cap, tier.maxPerDayMg / n);
  }

  const mRange = (tier.doseAdjustment || '').match(
    /(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*mg\/kg/i
  );
  if (mRange) {
    const minMg = Math.min(bw * parseFloat(mRange[1]), cap);
    const maxMg = Math.min(bw * parseFloat(mRange[2]), cap);
    const rangeTxt = minMg === maxMg ? `${fmtMg(minMg)} mg` : `${fmtMg(minMg)}–${fmtMg(maxMg)} mg`;
    return `${rangeTxt} ${tier.freq || ''}`.trim();
  }

  const mSingle = (tier.doseAdjustment || '').match(/(\d+(?:\.\d+)?)\s*mg\/kg/i);
  if (mSingle) {
    const mg = Math.min(bw * parseFloat(mSingle[1]), cap);
    return `${fmtMg(mg)} mg ${tier.freq || ''}`.trim();
  }

  if (/50%/.test(tier.doseAdjustment || '') && drug.doseMinMgPerKg) {
    const minMg = Math.min(bw * drug.doseMinMgPerKg * 0.5, cap);
    const maxMg = Math.min(bw * (drug.doseMaxMgPerKg || drug.doseMinMgPerKg) * 0.5, cap);
    return (
      (minMg === maxMg ? `${fmtMg(minMg)} mg` : `${fmtMg(minMg)}–${fmtMg(maxMg)} mg`) +
      (tier.freq ? ` ${tier.freq}` : '')
    );
  }

  return `${tier.doseAdjustment || ''} (${tier.freq || ''})`.trim();
}

// ==========================================
// 5. IV FLUIDS & DRIP INFUSION ENGINE
// ==========================================

export function calcMaintenanceMlPerHr(weightKg: number | null | undefined): number {
  const w = Number(weightKg);
  if (!Number.isFinite(w) || w <= 0) return 0;
  let mlDay = 0;
  if (w <= 10) mlDay = w * 100;
  else if (w <= 20) mlDay = 1000 + (w - 10) * 50;
  else mlDay = 1500 + (w - 20) * 20;
  return +(mlDay / 24).toFixed(1);
}

export function calcMaintenanceMlPerDay(weightKg: number | null | undefined): number {
  const w = Number(weightKg);
  if (!Number.isFinite(w) || w <= 0) return 0;
  if (w <= 10) return +(w * 100).toFixed(0);
  if (w <= 20) return +(1000 + (w - 10) * 50).toFixed(0);
  return +(1500 + (w - 20) * 20).toFixed(0);
}

export function calcDripForward(
  doseMcgKgMin: number,
  weightKg: number,
  drugMg: number,
  diluentMl: number
) {
  if (!weightKg || weightKg <= 0 || !diluentMl || diluentMl <= 0 || !drugMg || drugMg <= 0) {
    return { concMgPerMl: 0, concMcgPerMl: 0, mcgPerHour: 0, rateMlHr: 0 };
  }
  const concMgPerMl = drugMg / diluentMl;
  const concMcgPerMl = concMgPerMl * 1000;
  const mcgPerHour = doseMcgKgMin * weightKg * 60;
  const rateMlHr = concMcgPerMl > 0 ? mcgPerHour / concMcgPerMl : 0;
  return {
    concMgPerMl: +concMgPerMl.toFixed(3),
    concMcgPerMl: +concMcgPerMl.toFixed(1),
    mcgPerHour: +mcgPerHour.toFixed(1),
    rateMlHr: +rateMlHr.toFixed(2),
  };
}

export function calcDripReverse(
  rateMlHr: number,
  weightKg: number,
  drugMg: number,
  diluentMl: number
): number {
  if (!weightKg || weightKg <= 0 || !diluentMl || diluentMl <= 0 || !drugMg || drugMg <= 0) {
    return 0;
  }
  const concMcgPerMl = (drugMg / diluentMl) * 1000;
  const mcgPerMin = (rateMlHr * concMcgPerMl) / 60;
  return +(mcgPerMin / weightKg).toFixed(3);
}

// ==========================================
// 6. ELECTROLYTE & ACID-BASE CORRECTORS
// ==========================================

export function calcCorrectedNa(
  measuredNa: number,
  glucose: number,
  formula: 'katz' | 'ispad' = 'katz'
): number | null {
  if (typeof measuredNa !== 'number' || Number.isNaN(measuredNa) || measuredNa <= 0) return null;
  if (typeof glucose !== 'number' || Number.isNaN(glucose) || glucose <= 0) return measuredNa;
  const factor = formula === 'ispad' ? 2.0 : 1.6;
  if (glucose <= 100) return measuredNa;
  return measuredNa + factor * ((glucose - 100) / 100);
}

export function calcCorrectedCa(totalCa: number, albumin: number): number | null {
  if (typeof totalCa !== 'number' || Number.isNaN(totalCa) || totalCa <= 0) return null;
  if (typeof albumin !== 'number' || Number.isNaN(albumin) || albumin <= 0) return totalCa;
  return totalCa + 0.8 * (4.0 - albumin);
}

export function calcKShift(measuredK: number, ph: number): number | null {
  if (typeof measuredK !== 'number' || Number.isNaN(measuredK) || measuredK <= 0) return null;
  if (typeof ph !== 'number' || Number.isNaN(ph) || ph <= 0) return measuredK;
  const deltaPh = 7.4 - ph;
  return measuredK - deltaPh * 6.0;
}

export function calcIVKClReplacement(weightKg: number, doseMeqPerKg = 0.5) {
  if (!weightKg || Number.isNaN(weightKg) || weightKg <= 0) return null;
  const rawDoseMeq = weightKg * doseMeqPerKg;
  const doseMeq = Math.min(rawDoseMeq, 20);
  const kcl2MeqPerMl = doseMeq / 2;
  const minVolPeripheralMl = Math.round((doseMeq / 40) * 1000);
  const minVolCentralMl = Math.round((doseMeq / 80) * 1000);
  const peripheralRateMlPerHr = +(minVolPeripheralMl / 2).toFixed(1);
  const centralRateMlPerHr = +(minVolCentralMl / 1).toFixed(1);
  const deliveryRateMeqPerKgPerHr = +(doseMeq / weightKg / 2).toFixed(2);
  return {
    doseMeq: +doseMeq.toFixed(1),
    rawDoseMeq: +rawDoseMeq.toFixed(1),
    kcl2MeqPerMl: +kcl2MeqPerMl.toFixed(1),
    minVolPeripheralMl,
    minVolCentralMl,
    peripheralRateMlPerHr,
    centralRateMlPerHr,
    deliveryRateMeqPerKgPerHr,
  };
}

export function calcOralKClReplacement(weightKg: number, doseMeqPerKgPerDay = 1.5) {
  if (!weightKg || Number.isNaN(weightKg) || weightKg <= 0) return null;
  const dailyMeq = Math.min(weightKg * doseMeqPerKgPerDay, 80);
  const tidDoseMeq = +(dailyMeq / 3).toFixed(1);
  const kcl10PctSyrupMlPerDose = +(tidDoseMeq / 1.34).toFixed(1);
  return {
    dailyMeq: +dailyMeq.toFixed(1),
    tidDoseMeq,
    kcl10PctSyrupMlPerDose,
  };
}

export function getTBWFactor(ageYr: number | null | undefined, isFemale = false): number {
  if (ageYr === null || ageYr === undefined || Number.isNaN(ageYr)) return 0.6;
  if (ageYr < 1 / 12) return 0.7;
  if (ageYr < 1) return 0.65;
  if (ageYr >= 12 && isFemale) return 0.5;
  return 0.6;
}

export function calcNaDeficit(
  weightKg: number,
  measuredNa: number,
  targetNa = 135,
  ageYr: number | null = 5,
  isFemale = false
): number | null {
  if (!weightKg || weightKg <= 0 || !measuredNa || measuredNa <= 0) return null;
  if (measuredNa >= targetNa) return 0;
  const tbw = weightKg * getTBWFactor(ageYr, isFemale);
  return tbw * (targetNa - measuredNa);
}

export function calcFreeWaterDeficit(
  weightKg: number,
  measuredNa: number,
  targetNa = 140,
  ageYr: number | null = 5,
  isFemale = false
): number | null {
  if (!weightKg || weightKg <= 0 || !measuredNa || measuredNa <= 0) return null;
  if (measuredNa <= targetNa) return 0;
  const tbw = weightKg * getTBWFactor(ageYr, isFemale);
  return tbw * (measuredNa / targetNa - 1);
}

export function calcBicarbonateDeficit(
  weightKg: number,
  measuredHCO3: number,
  targetHCO3 = 15
): number | null {
  if (!weightKg || weightKg <= 0 || measuredHCO3 === null || Number.isNaN(measuredHCO3)) return null;
  if (measuredHCO3 >= targetHCO3) return 0;
  return weightKg * 0.3 * (targetHCO3 - measuredHCO3);
}

export function calcAnionGap(na: number, cl: number, hco3: number): number | null {
  if (Number.isNaN(na) || Number.isNaN(cl) || Number.isNaN(hco3)) return null;
  return na - (cl + hco3);
}

export function calcCorrectedAnionGap(ag: number | null, albumin: number | null): number | null {
  if (ag === null || Number.isNaN(ag)) return null;
  if (albumin === null || Number.isNaN(albumin) || albumin <= 0) return ag;
  return ag + 2.5 * (4.0 - albumin);
}

export function calcDeltaRatio(ag: number | null, hco3: number | null): number | null {
  if (ag === null || Number.isNaN(ag) || hco3 === null || Number.isNaN(hco3)) return null;
  const deltaAG = ag - 12;
  const deltaHCO3 = 24 - hco3;
  if (deltaHCO3 === 0) return null;
  return deltaAG / deltaHCO3;
}

export function interpretDeltaRatio(ag: number | null, hco3: number | null): string {
  if (ag === null || Number.isNaN(ag) || hco3 === null || Number.isNaN(hco3)) {
    return 'ใช้ประเมิน Mixed acid-base disorders';
  }
  if (hco3 >= 24) {
    if (ag > 12) {
      return 'Mixed High AG Acidosis + Metabolic Alkalosis (HCO3 ≥ 24: มีภาวะด่างเกินร่วม เช่น อาเจียน/เสียกรด)';
    }
    return 'Normal AG & Normal/High HCO3 (ไม่มี High AG Acidosis)';
  }
  if (ag <= 12) {
    return 'Pure Normal AG (Hyperchloremic) Acidosis (AG ปกติแต่ HCO3 ต่ำ เช่น ท้องเสีย/RTA)';
  }
  const ratio = (ag - 12) / (24 - hco3);
  if (ratio < 0.8) {
    return `< 0.8 (${ratio.toFixed(2)}): Mixed High AG + Normal AG Acidosis (HCO3 ลดลงมากกว่า AG ที่เพิ่ม เช่น DKA + Diarrhea/Saline)`;
  }
  if (ratio <= 2.0) {
    return `0.8–2.0 (${ratio.toFixed(2)}): Pure High AG Metabolic Acidosis (DKA, Lactic Acidosis, Uremia, Toxins)`;
  }
  return `> 2.0 (${ratio.toFixed(2)}): Mixed High AG Acidosis + Metabolic Alkalosis (หรือ Compensated Chronic Resp Acidosis)`;
}

export function calcOsmolality(
  na: number | null,
  glucose?: number | null,
  bun?: number | null
): number | null {
  if (na === null || Number.isNaN(na) || na <= 0) return null;
  const g = glucose && !Number.isNaN(glucose) && glucose > 0 ? glucose / 18 : 0;
  const b = bun && !Number.isNaN(bun) && bun > 0 ? bun / 2.8 : 0;
  return 2 * na + g + b;
}

export function calcEffectiveTonicity(na: number | null, glucose?: number | null): number | null {
  if (na === null || Number.isNaN(na) || na <= 0) return null;
  const g = glucose && !Number.isNaN(glucose) && glucose > 0 ? glucose / 18 : 0;
  return 2 * na + g;
}

export function calcOsmolarGap(measuredOsm: number | null, calcOsm: number | null): number | null {
  if (measuredOsm === null || Number.isNaN(measuredOsm) || calcOsm === null || Number.isNaN(calcOsm))
    return null;
  return measuredOsm - calcOsm;
}

export function calcFeNa(uNa: number, sNa: number, uCr: number, sCr: number): number | null {
  if (
    Number.isNaN(uNa) ||
    Number.isNaN(sNa) ||
    Number.isNaN(uCr) ||
    Number.isNaN(sCr) ||
    sNa <= 0 ||
    uCr <= 0
  )
    return null;
  return ((uNa * sCr) / (sNa * uCr)) * 100;
}

export function calcFeUrea(uUrea: number, sBUN: number, uCr: number, sCr: number): number | null {
  if (
    Number.isNaN(uUrea) ||
    Number.isNaN(sBUN) ||
    Number.isNaN(uCr) ||
    Number.isNaN(sCr) ||
    sBUN <= 0 ||
    uCr <= 0
  )
    return null;
  return ((uUrea * sCr) / (sBUN * uCr)) * 100;
}

export function calcUAG(uNa: number, uK: number, uCl: number): number | null {
  if (Number.isNaN(uNa) || Number.isNaN(uK) || Number.isNaN(uCl)) return null;
  return uNa + uK - uCl;
}

export function calcTTKG(uK: number, sK: number, uOsm: number, sOsm: number): number | null {
  if (
    Number.isNaN(uK) ||
    Number.isNaN(sK) ||
    Number.isNaN(uOsm) ||
    Number.isNaN(sOsm) ||
    sK <= 0 ||
    uOsm <= 0
  )
    return null;
  return (uK * sOsm) / (sK * uOsm);
}

// ==========================================
// 7. TRAUMA, BURNS, TRANSFUSION & EHR ORDERS
// ==========================================

export function calcParklandBurn(weightKg: number, tbsaPct: number, hoursElapsed = 0) {
  const total24h = 3 * weightKg * tbsaPct;
  const first8h = total24h * 0.5;
  const next16h = total24h * 0.5;
  const hoursRem = Math.max(0.5, 8 - hoursElapsed);
  const rateFirst8h = +(first8h / hoursRem).toFixed(1);
  const rateNext16h = +(next16h / 16).toFixed(1);
  const maintRate = calcMaintenanceMlPerHr(weightKg);
  const targetUO = +(weightKg * 1.0).toFixed(1);
  return {
    total24h: Math.round(total24h),
    first8h: Math.round(first8h),
    next16h: Math.round(next16h),
    hoursRem,
    rateFirst8h,
    rateNext16h,
    maintRate,
    targetUO,
  };
}

export function calcTransfusion(
  weightKg: number,
  currentHb: number,
  targetHb = 10.0,
  prbcType: 'cpda' | 'sagm' = 'cpda'
) {
  const factor = prbcType === 'sagm' ? 4 : 3;
  const deltaHb = Math.max(0, targetHb - currentHb);
  const prbcVol = currentHb > 0 ? Math.round(weightKg * deltaHb * factor) : Math.round(weightKg * 10);
  const maxInfusionRate = Math.round(weightKg * 5);
  const pltVol = Math.round(weightKg * 10);
  const ffpVol = Math.round(weightKg * 12.5);
  const cryoVol = Math.round(weightKg * 5);
  const txaLoadingMg = Math.min(1000, Math.round(weightKg * 15));
  const txaInfusionRate = +(weightKg * 2).toFixed(1);
  return {
    prbcVol,
    deltaHb: +deltaHb.toFixed(1),
    factor,
    maxInfusionRate,
    pltVol,
    ffpVol,
    cryoVol,
    txaLoadingMg,
    txaInfusionRate,
  };
}
