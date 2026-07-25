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

console.log(`\n----------------------------------------`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`----------------------------------------\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
