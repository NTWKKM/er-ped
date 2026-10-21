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

  // Unmeasured / non-manual weight returns null (gates WAZ to measured values only)
  assert.equal(calcGrowthZScores(2, null, 87.8, 'male'), null);
  assert.equal(calcGrowthZScores(2, undefined, 87.8, 'male'), null);

  // Continuous linear interpolation prevents abrupt discrete jumps between sparse table rows (2.54 vs 2.55 yr)
  const at254 = calcGrowthZScores(2.54, 10, 92.3, 'male');
  const at255 = calcGrowthZScores(2.55, 10, 92.3, 'male');
  assert.ok(at254 && at255);
  assert.ok(Math.abs((at254.waz ?? 0) - (at255.waz ?? 0)) <= 0.05);
  assert.equal(at254.wazLabel, 'Underweight');
  assert.equal(at255.wazLabel, 'Underweight');

  // WAZ > +2 is classified as 'High Weight', never 'Overweight' or 'Obese' on WAZ alone
  const heavyChild = calcGrowthZScores(3, 19, 96, 'male');
  assert.ok(heavyChild);
  assert.equal(heavyChild.wazLabel, 'High Weight');
  assert.equal(heavyChild.nutritionIndicator, null);
  assert.equal(heavyChild.nutritionLabel, null);
  assert.equal(heavyChild.nutritionStatus, null);
  assert.equal(heavyChild.bmi, 20.6);

  // Adolescent children (> 10 yr): WAZ is suppressed (null); HAZ and raw BMI are preserved
  const adolescent = calcGrowthZScores(12, 45, 150, 'male');
  assert.ok(adolescent);
  assert.equal(adolescent.waz, null);
  assert.equal(adolescent.wazLabel, null);
  assert.ok(adolescent.haz !== null);
  assert.equal(adolescent.bmi, 20);
  assert.equal(adolescent.nutritionIndicator, null);
  assert.equal(adolescent.nutritionLabel, null);

  // Adolescent children without height: returns null (hides unsupported WAZ badge)
  assert.equal(calcGrowthZScores(12, 45, null, 'male'), null);

  // 60-month boundary test for both sexes: continuous interpolation across 4.99 yr vs 5.01 yr
  const b59mo = calcGrowthZScores(4.99, 18.2, 109.9, 'male');
  const b60mo = calcGrowthZScores(5.01, 18.3, 110.1, 'male');
  assert.ok(b59mo && b60mo);
  assert.ok(Math.abs((b59mo.waz ?? 0) - (b60mo.waz ?? 0)) <= 0.05);
  assert.ok(Math.abs((b59mo.haz ?? 0) - (b60mo.haz ?? 0)) <= 0.05);

  const g59mo = calcGrowthZScores(4.99, 18.1, 109.3, 'female');
  const g60mo = calcGrowthZScores(5.01, 18.2, 109.5, 'female');
  assert.ok(g59mo && g60mo);
  assert.ok(Math.abs((g59mo.waz ?? 0) - (g60mo.waz ?? 0)) <= 0.05);
  assert.ok(Math.abs((g59mo.haz ?? 0) - (g60mo.haz ?? 0)) <= 0.05);

  // WFH band-edge boundary test: 97.5 cm vs 97.6 cm produces continuous HAZ without step-function jumps
  const edge975 = calcGrowthZScores(3, 15, 97.5, 'male');
  const edge976 = calcGrowthZScores(3, 15, 97.6, 'male');
  assert.ok(edge975 && edge976);
  assert.ok(Math.abs((edge975.haz ?? 0) - (edge976.haz ?? 0)) <= 0.05);
  assert.equal(edge975.nutritionLabel, null);
  assert.equal(edge976.nutritionLabel, null);

  // WHO WAZ multi-point reference cut-offs and boundary validation (120-month boys and girls)
  // Boys 120 mo (10 yr): WHO cut-offs [-3 SD: 20.4, -2 SD: 23.2, Median: 31.2, +2 SD: 45.0, +3 SD: 56.4]
  const boyMedian = calcGrowthZScores(10, 31.2, 137.8, 'male');
  assert.equal(boyMedian?.waz, 0);
  assert.equal(boyMedian?.wazLabel, 'Normal');

  const boyNeg2 = calcGrowthZScores(10, 23.2, 137.8, 'male');
  assert.equal(boyNeg2?.waz, -2);
  assert.equal(boyNeg2?.wazLabel, 'Normal');

  const boyPos2 = calcGrowthZScores(10, 45.0, 137.8, 'male');
  assert.equal(boyPos2?.waz, 2);
  assert.equal(boyPos2?.wazLabel, 'Normal');

  const boyNeg3 = calcGrowthZScores(10, 20.4, 137.8, 'male');
  assert.equal(boyNeg3?.waz, -3);
  assert.equal(boyNeg3?.wazLabel, 'Underweight');

  // Both sides of -2 SD boundary (23.2 kg)
  const boyUnder2 = calcGrowthZScores(10, 22.8, 137.8, 'male');
  assert.equal(boyUnder2?.waz, -2.1);
  assert.equal(boyUnder2?.wazLabel, 'Underweight');
  assert.equal(boyUnder2?.wazStatus, 'warning');

  const boyAboveNeg2 = calcGrowthZScores(10, 23.6, 137.8, 'male');
  assert.equal(boyAboveNeg2?.waz, -1.9);
  assert.equal(boyAboveNeg2?.wazLabel, 'Normal');
  assert.equal(boyAboveNeg2?.wazStatus, 'good');

  // Both sides of +2 SD boundary (45.0 kg)
  const boyBelowPos2 = calcGrowthZScores(10, 44.5, 137.8, 'male');
  assert.equal(boyBelowPos2?.waz, 1.9);
  assert.equal(boyBelowPos2?.wazLabel, 'Normal');
  assert.equal(boyBelowPos2?.wazStatus, 'good');

  const boyHigh2 = calcGrowthZScores(10, 45.9, 137.8, 'male');
  assert.equal(boyHigh2?.waz, 2.1);
  assert.equal(boyHigh2?.wazLabel, 'High Weight');
  assert.equal(boyHigh2?.wazStatus, 'warning');

  // Both sides of -3 SD boundary (20.4 kg)
  const boySevere3 = calcGrowthZScores(10, 20.0, 137.8, 'male');
  assert.equal(boySevere3?.waz, -3.1);
  assert.equal(boySevere3?.wazLabel, 'Severe Underweight');
  assert.equal(boySevere3?.wazStatus, 'danger');

  const boyAboveNeg3 = calcGrowthZScores(10, 20.8, 137.8, 'male');
  assert.equal(boyAboveNeg3?.waz, -2.9);
  assert.equal(boyAboveNeg3?.wazLabel, 'Underweight');
  assert.equal(boyAboveNeg3?.wazStatus, 'warning');

  // Girls 120 mo (10 yr): WHO cut-offs [-3 SD: 20.3, -2 SD: 23.3, Median: 31.9, +2 SD: 46.9, +3 SD: 59.2]
  const girlMedian = calcGrowthZScores(10, 31.9, 138.0, 'female');
  assert.equal(girlMedian?.waz, 0);
  assert.equal(girlMedian?.wazLabel, 'Normal');

  // Both sides of -2 SD boundary (23.3 kg)
  const girlUnder2 = calcGrowthZScores(10, 23.0, 138.0, 'female');
  assert.equal(girlUnder2?.waz, -2.1);
  assert.equal(girlUnder2?.wazLabel, 'Underweight');

  const girlAboveNeg2 = calcGrowthZScores(10, 23.8, 138.0, 'female');
  assert.equal(girlAboveNeg2?.waz, -1.9);
  assert.equal(girlAboveNeg2?.wazLabel, 'Normal');

  // Both sides of +2 SD boundary (46.9 kg)
  const girlBelowPos2 = calcGrowthZScores(10, 45.6, 138.0, 'female');
  assert.equal(girlBelowPos2?.waz, 1.9);
  assert.equal(girlBelowPos2?.wazLabel, 'Normal');

  const girlHigh2 = calcGrowthZScores(10, 48.2, 138.0, 'female');
  assert.equal(girlHigh2?.waz, 2.1);
  assert.equal(girlHigh2?.wazLabel, 'High Weight');

  // Both sides of -3 SD boundary (20.3 kg)
  const girlSevere3 = calcGrowthZScores(10, 19.9, 138.0, 'female');
  assert.equal(girlSevere3?.waz, -3.1);
  assert.equal(girlSevere3?.wazLabel, 'Severe Underweight');

  const girlAboveNeg3 = calcGrowthZScores(10, 20.7, 138.0, 'female');
  assert.equal(girlAboveNeg3?.waz, -2.9);
  assert.equal(girlAboveNeg3?.wazLabel, 'Underweight');
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
