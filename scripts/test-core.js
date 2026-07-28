const assert = require('assert');
const fs = require('fs');
const path = require('path');

const datasetPath = path.join(__dirname, '..', 'dataset.json');
const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

console.log('🧪 Running Core ER-PED Calculation Unit Tests...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

// 1. Test Weech Formula
function calcWeech(age, unit) {
  if (age === null || age === undefined || isNaN(age)) return null;
  const a = parseFloat(age);
  if (unit === 'mo') {
    return Math.round(((a + 9) / 2) * 10) / 10;
  }
  if (a < 1) {
    const mo = a * 12;
    return Math.round(((mo + 9) / 2) * 10) / 10;
  } else if (a <= 6) {
    return Math.round((2 * a + 8) * 10) / 10;
  } else {
    return Math.round(((7 * a - 5) / 2) * 10) / 10;
  }
}

test('Weech Formula: 6 months infant', () => {
  assert.strictEqual(calcWeech(6, 'mo'), 7.5);
});

test('Weech Formula: 3 years child', () => {
  assert.strictEqual(calcWeech(3, 'yr'), 14.0);
});

test('Weech Formula: 8 years child', () => {
  assert.strictEqual(calcWeech(8, 'yr'), 25.5);
});

// 2. Test Holliday-Segar Maintenance Fluid
function calcHollidaySegar(weight) {
  if (!weight || weight <= 0) return { mlPerDay: 0, mlPerHour: 0 };
  let mlPerDay = 0;
  if (weight <= 10) {
    mlPerDay = weight * 100;
  } else if (weight <= 20) {
    mlPerDay = 1000 + (weight - 10) * 50;
  } else {
    mlPerDay = 1500 + (weight - 20) * 20;
  }
  const mlPerHour = Math.round((mlPerDay / 24) * 10) / 10;
  return { mlPerDay, mlPerHour };
}

test('Holliday-Segar: 8 kg infant', () => {
  const res = calcHollidaySegar(8);
  assert.strictEqual(res.mlPerDay, 800);
  assert.strictEqual(res.mlPerHour, 33.3);
});

test('Holliday-Segar: 15 kg child', () => {
  const res = calcHollidaySegar(15);
  assert.strictEqual(res.mlPerDay, 1250);
  assert.strictEqual(res.mlPerHour, 52.1);
});

test('Holliday-Segar: 25 kg child', () => {
  const res = calcHollidaySegar(25);
  assert.strictEqual(res.mlPerDay, 1600);
  assert.strictEqual(res.mlPerHour, 66.7);
});

// 3. Continuous Infusion Drip Calculation
// Formula: mL/hr = (dose_mcg_kg_min * weight_kg * 60) / (conc_mg_ml * 1000)
function calcDripRate(doseMcgKgMin, weightKg, concMgPerMl) {
  if (!doseMcgKgMin || !weightKg || !concMgPerMl) return 0;
  const mcgPerHour = doseMcgKgMin * weightKg * 60;
  const concMcgPerMl = concMgPerMl * 1000;
  const mlPerHour = mcgPerHour / concMcgPerMl;
  return Math.round(mlPerHour * 100) / 100;
}

test('Drip Rate: Epinephrine 0.1 mcg/kg/min for 10 kg patient (1 mg in 50 mL = 0.02 mg/mL)', () => {
  // 0.1 * 10 * 60 = 60 mcg/hr. Conc = 20 mcg/mL. 60 / 20 = 3.0 mL/hr
  const rate = calcDripRate(0.1, 10, 0.02);
  assert.strictEqual(rate, 3.0);
});

test('Drip Rate: Dopamine 5 mcg/kg/min for 20 kg patient (150 mg in 50 mL = 3.0 mg/mL)', () => {
  // 5 * 20 * 60 = 6000 mcg/hr. Conc = 3000 mcg/mL. 6000 / 3000 = 2.0 mL/hr
  const rate = calcDripRate(5, 20, 3.0);
  assert.strictEqual(rate, 2.0);
});

// 4. Test DKA Protocol Fluid & Regular Insulin Drip Math
function calcDKAFluids(weightKg, pctDeficit, priorBolusMl) {
  if (!weightKg || weightKg <= 0) return { totalDeficitMl: 0, netDeficitMl: 0, replaceRateMlHr: 0, totalRateMlHr: 0 };
  const totalDeficitMl = weightKg * pctDeficit * 10;
  const netDeficitMl = Math.max(0, totalDeficitMl - (priorBolusMl || 0));
  const replaceRateMlHr = Math.round((netDeficitMl / 48) * 10) / 10;
  
  let mntDay = 0;
  if (weightKg <= 10) mntDay = weightKg * 100;
  else if (weightKg <= 20) mntDay = 1000 + (weightKg - 10) * 50;
  else mntDay = 1500 + (weightKg - 20) * 20;
  const mntHr = mntDay / 24;
  
  const totalRateMlHr = Math.round((mntHr + replaceRateMlHr) * 10) / 10;
  return { totalDeficitMl, netDeficitMl, replaceRateMlHr, totalRateMlHr };
}

function calcDKAInsulinRate(weightKg, unitsPerKgHr) {
  if (!weightKg || !unitsPerKgHr) return 0;
  return Math.round((weightKg * unitsPerKgHr) * 10) / 10;
}

test('DKA Fluids: 20 kg child with 8% dehydration minus 200 mL prior bolus', () => {
  const res = calcDKAFluids(20, 8, 200);
  assert.strictEqual(res.totalDeficitMl, 1600);
  assert.strictEqual(res.netDeficitMl, 1400);
  assert.strictEqual(res.totalRateMlHr, 91.7);
});

test('DKA Regular Insulin Drip: 0.1 U/kg/hr for 20 kg child (1 U/mL prep)', () => {
  const rate = calcDKAInsulinRate(20, 0.1);
  assert.strictEqual(rate, 2.0);
});

// 5. Test Procedural Sedation (PSA) Fentanyl Dosing
test('PSA Fentanyl (IV): 10 kg child (1–2 mcg/kg -> 10–20 mcg)', () => {
  const item = dataset.proceduralSedation.find(d => d.key === 'fentanyl-psa-iv');
  const w = 10;
  const minDose = item.doseMinMcgPerKg * w;
  const maxDose = item.doseMaxMcgPerKg * w;
  assert.strictEqual(minDose, 10);
  assert.strictEqual(maxDose, 20);
  assert.strictEqual(item.unit, 'mcg');
});

test('PSA Fentanyl (IN): 10 kg child (1.5–2 mcg/kg -> 15–20 mcg)', () => {
  const item = dataset.proceduralSedation.find(d => d.key === 'fentanyl-psa-in');
  const w = 10;
  const minDose = item.doseMinMcgPerKg * w;
  const maxDose = item.doseMaxMcgPerKg * w;
  assert.strictEqual(minDose, 15);
  assert.strictEqual(maxDose, 20);
  assert.strictEqual(item.unit, 'mcg');
});

// 6. Test Sub-milligram fmtMg Formatting
function fmtMgTest(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n === 0) return '0';
  if (n >= 100) return n.toFixed(0);
  if (n >= 1) return n.toFixed(1).replace(/\.0$/, '');
  if (n >= 0.1) return n.toFixed(2).replace(/0$/, '');
  return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

test('Sub-milligram fmtMg: 0.01 mg (Flumazenil/Terbutaline 1 kg) formats as 0.01, not 0.0', () => {
  assert.strictEqual(fmtMgTest(0.01), '0.01');
  assert.strictEqual(fmtMgTest(0.03), '0.03');
  assert.strictEqual(fmtMgTest(0.05), '0.05');
  assert.strictEqual(fmtMgTest(12.5), '12.5');
  assert.strictEqual(fmtMgTest(150), '150');
});

// 7. Test PALS Epinephrine Dosing
test('PALS Epinephrine: 10 kg child (0.01 mg/kg = 0.1 mg)', () => {
  const pals = dataset.pals; // object, not array
  const doseMg = pals.epiArrest.dose_mgPerKg * 10;
  assert.strictEqual(doseMg, 0.1);
});

// 8. Test PALS Defibrillation (J/kg)
test('PALS Defibrillation: 10 kg child (2-4 J/kg initial, max 4 J/kg)', () => {
  const pals = dataset.pals;
  const minJ = pals.defib.first_JPerKg * 10;
  const maxJ = pals.defib.next_JPerKg * 10;
  assert.strictEqual(minJ, 20);
  assert.strictEqual(maxJ, 40);
});

// 9. Test Antibiotic (ATB) Dosing
test('ATB Ampicillin: 10 kg child, 25 mg/kg/day div q6h = 62.5 mg/dose', () => {
  const item = dataset.pediatricATB.find(d => d.key === 'ampicillin-iv-im-unasyn');
  const w = 10;
  const dailyMg = item.doseMinMgPerKg * w;
  const dosesPerDay = 4; // q6h = 4x/day
  const perDose = dailyMg / dosesPerDay;
  assert.strictEqual(dailyMg, 250);  // 25 * 10 = 250 mg/day
  assert.strictEqual(perDose, 62.5); // 250 / 4 = 62.5 mg/dose
});

// 10. Test Vital Signs Age Bands
test('Vitals: 5 year old HR normal 80-140', () => {
  const vs = dataset.vitalSignsRef.find(v => v.maxAgeYr >= 5 && v.minAgeYr <= 5);
  assert.strictEqual(vs.hrMin, 80);
  assert.strictEqual(vs.hrMax, 140);
});

// 11. Test Toxicology Naloxone
test('Toxicology Naloxone: 10 kg child (0.1 mg/kg = 1 mg)', () => {
  const item = dataset.toxicologyAntidotes.find(d => d.key === 'naloxone-antidote');
  const w = 10;
  const doseMg = item.doseMgPerKg * w;
  assert.strictEqual(doseMg, 1);
});

// 12. Test Broselow Zone Matching
test('Broselow: 18 kg child -> White zone', () => {
  const weight = 18;
  const band = dataset.broselow.find(b => weight >= b.min && weight <= b.max);
  assert.strictEqual(band.color, '🤍 White');
});

// 13. Test NCPR Neonatal Resuscitation
function calcNCPRCore(weightKg) {
  if (!weightKg || weightKg <= 0) return null;
  const epiIV = 0.02 * weightKg;
  const epiIVml = epiIV / 0.1;
  const epiETT = 0.10 * weightKg;
  const epiETTml = epiETT / 0.1;
  const bolusMl = 10 * weightKg;
  const d10wBolusMl = 2 * weightKg;
  const d10wMntMlHr = 3.5 * weightKg;
  return { epiIV, epiIVml, epiETT, epiETTml, bolusMl, d10wBolusMl, d10wMntMlHr };
}

test('NCPR Resuscitation: 3.0 kg newborn', () => {
  const res = calcNCPRCore(3.0);
  assert.strictEqual(res.epiIV, 0.06);
  assert.strictEqual(res.epiIVml, 0.6);
  assert.strictEqual(Math.round(res.epiETT * 100) / 100, 0.3);
  assert.strictEqual(Math.round(res.epiETTml * 100) / 100, 3.0);
  assert.strictEqual(res.bolusMl, 30);
  assert.strictEqual(res.d10wBolusMl, 6.0);
  assert.strictEqual(res.d10wMntMlHr, 10.5);
});

// 14. Test General Pediatric Dosing (calcDose)
test('General Pediatric Dose: Paracetamol 10 kg child (10–15 mg/kg -> 100–150 mg)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'paracetamol-syrup-120-mg-5-ml');
  const w = 10;
  const minMg = item.doseMinMgPerKg * w;
  const maxMg = item.doseMaxMgPerKg * w;
  assert.strictEqual(minMg, 100);
  assert.strictEqual(maxMg, 150);
});

test('General Pediatric Dose: Paracetamol 80 kg patient max per dose capping (15 mg/kg = 1200 mg, capped at max 1000 mg)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'paracetamol-syrup-120-mg-5-ml');
  const w = 80;
  let maxMg = item.doseMaxMgPerKg * w;
  if (item.maxPerDoseMg && maxMg > item.maxPerDoseMg) {
    maxMg = item.maxPerDoseMg;
  }
  assert.strictEqual(maxMg, 1000);
});

test('General Pediatric Dose: Fixed dose Albendazole (400 mg)', () => {
  const item = dataset.pediatricATB.find(d => d.key === 'albendazole-syrup-200mg-5ml-tab-200mg');
  assert.strictEqual(item.fixedDose.doseMg, 400);
});

test('General Pediatric Dose: Dose band Oseltamivir for 12 kg child (30 mg bid)', () => {
  const item = dataset.pediatricATB.find(d => d.key === 'oseltamivir-weight-based');
  const w = 12;
  const ageYr = 3;
  const band = item.doseBands.find(b => (b.minAgeYr == null || ageYr >= b.minAgeYr) && (b.maxKg == null || w <= b.maxKg));
  assert.strictEqual(band.doseMg, 30);
});

test('General Pediatric Dose: Methylprednisolone loading dose (1–2 mg/kg, max 60 mg)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'methylprednisolone-iv-load');
  const w = 10;
  const minMg = item.doseMinMgPerKg * w;
  const maxMg = item.doseMaxMgPerKg * w;
  assert.strictEqual(minMg, 10);
  assert.strictEqual(maxMg, 20);
  assert.strictEqual(item.maxPerDoseMg, 60);
});

test('General Pediatric Dose: Methylprednisolone maintenance dose (0.5–1 mg/kg/dose q6h, max 60 mg)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'methylprednisolone-iv-maint');
  const w = 10;
  const minMg = item.doseMinMgPerKg * w;
  const maxMg = item.doseMaxMgPerKg * w;
  assert.strictEqual(minMg, 5);
  assert.strictEqual(maxMg, 10);
  assert.strictEqual(item.freq, 'q 6 hr');
  assert.strictEqual(item.maxPerDoseMg, 60);
  assert.strictEqual(item.maxPerDayMg, 240);
});

// 15. Test Seizure Protocol Dosing (calcSeizure)
test('Seizure Protocol Stage 1: IN Midazolam 10 kg child (0.2 mg/kg = 2.0 mg)', () => {
  const stage1 = dataset.seizureProtocol.find(s => s.stage === '5–10 min');
  const drug = stage1.drugs.find(d => d.key === 'midazolam-buccal-in');
  const w = 10;
  let dose = drug.doseMgPerKg * w;
  if (drug.maxDoseMg && dose > drug.maxDoseMg) dose = drug.maxDoseMg;
  assert.strictEqual(dose, 2.0);
});

test('Seizure Protocol Stage 1: IV Diazepam 60 kg patient capped at max 10 mg', () => {
  const stage1 = dataset.seizureProtocol.find(s => s.stage === '5–10 min');
  const drug = stage1.drugs.find(d => d.key === 'diazepam-iv');
  const w = 60;
  let dose = drug.doseMgPerKg * w;
  if (drug.maxDoseMg && dose > drug.maxDoseMg) dose = drug.maxDoseMg;
  assert.strictEqual(dose, 10);
});

test('Seizure Protocol Stage 2: IV Keppra Load 10 kg child (60 mg/kg = 600 mg)', () => {
  const stage2 = dataset.seizureProtocol.find(s => s.stage === '10–20 min');
  const drug = stage2.drugs.find(d => d.key === 'levetiracetam-iv-load');
  const w = 10;
  let dose = drug.doseMgPerKg * w;
  if (drug.maxDoseMg && dose > drug.maxDoseMg) dose = drug.maxDoseMg;
  assert.strictEqual(dose, 600);
});

console.log(`\n----------------------------------------`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`----------------------------------------\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
