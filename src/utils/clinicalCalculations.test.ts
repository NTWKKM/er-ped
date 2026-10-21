import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateWeightFromAge,
  estimateWeightFromLength,
  calcBSA,
  calcGrowthZScores,
  getBroselowZone,
  resolveDrugDose,
  calcSchwartzEGFR,
  calcMaintenanceMlPerHr,
  calcDripForward,
  calcDripReverse,
  calcCorrectedNa,
  calcCorrectedCa,
  calcKShift,
  calcIVKClReplacement,
  calcNaDeficit,
  calcFreeWaterDeficit,
  calcBicarbonateDeficit,
  calcAnionGap,
  calcDeltaRatio,
  interpretDeltaRatio,
  calcParklandBurn,
  calcTransfusion,
} from './clinicalCalculations';
import { DATASET } from '../data/dataset';

test('Weech age-based weight estimation and 15-year pediatric cap', () => {
  // < 1 yr: (mo + 9) / 2 -> 6 mo = 7.5 kg
  assert.equal(estimateWeightFromAge(6, 'mo'), 7.5);
  // 1-6 yr: 2 * age + 8 -> 4 yr = 16 kg
  assert.equal(estimateWeightFromAge(4, 'yr'), 16);
  // > 6 yr: (7 * age - 5) / 2 -> 10 yr = 32.5 kg
  assert.equal(estimateWeightFromAge(10, 'yr'), 32.5);
  // Capped at 15 yr: (7 * 15 - 5) / 2 = 50 kg
  assert.equal(estimateWeightFromAge(19, 'yr'), 50);
});

test('Broselow length-to-weight estimation and BSA calculation', () => {
  assert.equal(estimateWeightFromLength(75), 8.5);
  assert.equal(estimateWeightFromLength(100), 16.5);
  // BSA for 16 kg, 100 cm -> sqrt(1600/3600) = sqrt(0.4444) = 0.67 m2
  assert.equal(calcBSA(16, 100), 0.67);
});

test('Broselow decimal weight boundary matching (no gaps)', () => {
  const redZone = getBroselowZone(9.5);
  assert.ok(redZone && redZone.color.includes('Red'));
  const purpleZone = getBroselowZone(11.4);
  assert.ok(purpleZone && purpleZone.color.includes('Purple'));
});

test('WHO Growth Z-Score calculation for weight and height (male and female)', () => {
  const resMale = calcGrowthZScores(2, 12.2, 87.8, 'male');
  assert.ok(resMale);
  assert.equal(resMale.waz, 0);
  assert.equal(resMale.wazLabel, 'Normal');
  assert.equal(resMale.haz, 0);

  // Female comparison for the same age
  const resFemale = calcGrowthZScores(2, 11.5, 86.4, 'female');
  assert.ok(resFemale);
  assert.equal(resFemale.waz, 0);
  assert.equal(resFemale.wazLabel, 'Normal');
  assert.equal(resFemale.haz, 0);
});

test('Unified drug dose resolution with safety ceilings and age restriction', () => {
  const pcm = DATASET.pediatricDose.find((d) => d.key === 'paracetamol-syrup-120-mg-5-ml');
  assert.ok(pcm);
  const resolved10kg = resolveDrugDose(pcm, 10, 2);
  assert.ok(resolved10kg);
  assert.equal(resolved10kg.doseMinMg, 100);
  assert.equal(resolved10kg.doseMaxMg, 150);
  assert.equal(resolved10kg.isCappedPerDose, false);

  // Test max single dose ceiling (1000 mg) at 80 kg
  const resolved80kg = resolveDrugDose(pcm, 80, 14);
  assert.ok(resolved80kg);
  assert.equal(resolved80kg.doseMaxMg, 1000);
  assert.equal(resolved80kg.isCappedPerDose, true);

  // Test Tramadol age restriction (< 12 yr contraindicated)
  const tramadol = DATASET.pediatricDose.find((d) => d.key === 'tramadol-oral-iv');
  assert.ok(tramadol);
  const resChild = resolveDrugDose(tramadol, 20, 6);
  assert.ok(resChild);
  assert.equal(resChild.isAgeRestricted, true);
});

test('Bedside Schwartz eGFR and Holliday-Segar maintenance fluids', () => {
  // eGFR = 0.413 * 100 / 0.826 = 50
  const egfr = calcSchwartzEGFR(0.826, 100);
  assert.ok(egfr && Math.abs(egfr - 50) < 0.01);

  // Holliday-Segar: 25 kg -> (1500 + 5*20)/24 = 1600/24 = 66.7 mL/hr
  assert.equal(calcMaintenanceMlPerHr(25), 66.7);
});

test('Forward and Reverse Vasoactive Drip calculations', () => {
  // Epinephrine 0.1 mcg/kg/min for 20 kg, 1 mg in 50 mL (20 mcg/mL)
  // mcg/hr = 0.1 * 20 * 60 = 120 mcg/hr -> 120 / 20 = 6.0 mL/hr
  const fwd = calcDripForward(0.1, 20, 1, 50);
  assert.equal(fwd.rateMlHr, 6);

  // Reverse: 6 mL/hr -> 0.1 mcg/kg/min
  const rev = calcDripReverse(6, 20, 1, 50);
  assert.equal(rev, 0.1);
});

test('Electrolyte correctors, IV KCl piggyback, and Delta Ratio interpretation', () => {
  // Katz Corrected Na: Na 130, Glucose 300 -> 130 + 1.6 * 2 = 133.2
  assert.equal(calcCorrectedNa(130, 300, 'katz'), 133.2);
  // ISPAD Corrected Na: Na 130, Glucose 300 -> 130 + 2.0 * 2 = 134.0
  assert.equal(calcCorrectedNa(130, 300, 'ispad'), 134.0);
  // Payne Corrected Ca: Ca 7.2, Albumin 2.0 -> 7.2 + 0.8 * 2 = 8.8
  assert.ok(Math.abs((calcCorrectedCa(7.2, 2.0) || 0) - 8.8) < 0.01);
  // K+ shift: K 4.0 at pH 7.10 (delta 0.3) -> 4.0 - 1.8 = 2.2
  assert.ok(Math.abs((calcKShift(4.0, 7.1) || 0) - 2.2) < 0.01);

  // IV KCl for 20 kg at 0.5 mEq/kg = 10 mEq -> min peripheral vol 250 mL
  const kcl = calcIVKClReplacement(20, 0.5);
  assert.ok(kcl);
  assert.equal(kcl.doseMeq, 10);
  assert.equal(kcl.minVolPeripheralMl, 250);

  // Delta Ratio with HCO3 >= 24 and AG > 12 -> Mixed High AG Acidosis + Metabolic Alkalosis
  const ag = calcAnionGap(140, 95, 26); // 19
  assert.equal(ag, 19);
  assert.ok(interpretDeltaRatio(ag, 26).includes('Metabolic Alkalosis'));
  assert.ok(calcNaDeficit(20, 125, 135, 5)! > 0);
  assert.ok(calcFreeWaterDeficit(20, 154, 140, 5)! > 0);
  assert.ok(calcBicarbonateDeficit(20, 10, 15)! > 0);
  assert.ok(calcDeltaRatio(24, 12) === 1);
});

test('Parkland burn resuscitation and PRBC transfusion calculations', () => {
  // 20 kg, 20% TBSA -> 3 * 20 * 20 = 1200 mL total, 600 mL first 8h (75 mL/hr)
  const burn = calcParklandBurn(20, 20, 0);
  assert.equal(burn.total24h, 1200);
  assert.equal(burn.rateFirst8h, 75);

  // Transfusion: 15 kg, Hb 6 -> 10 (delta 4), CPDA-1 (x3) -> 15 * 4 * 3 = 180 mL
  const tx = calcTransfusion(15, 6, 10, 'cpda');
  assert.equal(tx.prbcVol, 180);
  assert.equal(tx.maxInfusionRate, 75);
});
