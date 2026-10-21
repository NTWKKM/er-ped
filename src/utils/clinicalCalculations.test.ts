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

  // WHO WAZ LMS method and fine-grained classification threshold validation (120-month boys and girls)
  // Classify with unrounded score, round only displayed score (testing immediately below, at, and above thresholds)
  // Boys 120 mo (10 yr): L = -0.6764, M = 31.1586, S = 0.16305
  // Exact cutoffs: -3 SD = 20.420 kg, -2 SD = 23.206 kg, Median = 31.159 kg, +2 SD = 45.038 kg
  const boyMedian = calcGrowthZScores(10, 31.16, 137.8, 'male');
  assert.equal(boyMedian?.waz, 0);
  assert.equal(boyMedian?.wazLabel, 'Normal');
  assert.equal(boyMedian?.wazStatus, 'good');

  // Boys: -2 SD threshold (23.206 kg)
  // 23.10 kg (unrounded ~ -2.034, rounds to -2.0 but strictly Underweight)
  const boyBelowNeg2 = calcGrowthZScores(10, 23.10, 137.8, 'male');
  assert.equal(boyBelowNeg2?.waz, -2);
  assert.equal(boyBelowNeg2?.wazLabel, 'Underweight');
  assert.equal(boyBelowNeg2?.wazStatus, 'warning');

  // 23.19 kg (immediately below -2 SD threshold: ~ -2.005)
  const boyImmedBelowNeg2 = calcGrowthZScores(10, 23.19, 137.8, 'male');
  assert.equal(boyImmedBelowNeg2?.waz, -2);
  assert.equal(boyImmedBelowNeg2?.wazLabel, 'Underweight');
  assert.equal(boyImmedBelowNeg2?.wazStatus, 'warning');

  // 23.206 kg (at -2 SD threshold: ~ -2.000)
  const boyAtNeg2 = calcGrowthZScores(10, 23.206, 137.8, 'male');
  assert.equal(boyAtNeg2?.waz, -2);
  assert.equal(boyAtNeg2?.wazLabel, 'Normal');
  assert.equal(boyAtNeg2?.wazStatus, 'good');

  // 23.22 kg (immediately above -2 SD threshold: ~ -1.996)
  const boyImmedAboveNeg2 = calcGrowthZScores(10, 23.22, 137.8, 'male');
  assert.equal(boyImmedAboveNeg2?.waz, -2);
  assert.equal(boyImmedAboveNeg2?.wazLabel, 'Normal');
  assert.equal(boyImmedAboveNeg2?.wazStatus, 'good');

  // 23.30 kg (above threshold: ~ -1.970)
  const boyAboveNeg2 = calcGrowthZScores(10, 23.30, 137.8, 'male');
  assert.equal(boyAboveNeg2?.waz, -2);
  assert.equal(boyAboveNeg2?.wazLabel, 'Normal');
  assert.equal(boyAboveNeg2?.wazStatus, 'good');

  // Boys: +2 SD threshold (45.038 kg)
  // 45.00 kg (immediately below +2 SD threshold: ~ 1.996)
  const boyImmedBelowPos2 = calcGrowthZScores(10, 45.00, 137.8, 'male');
  assert.equal(boyImmedBelowPos2?.waz, 2);
  assert.equal(boyImmedBelowPos2?.wazLabel, 'Normal');
  assert.equal(boyImmedBelowPos2?.wazStatus, 'good');

  // 45.0380 kg (at +2 SD threshold: ~ 2.000)
  const boyAtPos2 = calcGrowthZScores(10, 45.038, 137.8, 'male');
  assert.equal(boyAtPos2?.waz, 2);
  assert.equal(boyAtPos2?.wazLabel, 'Normal');
  assert.equal(boyAtPos2?.wazStatus, 'good');

  // 45.06 kg (immediately above +2 SD threshold: ~ 2.003)
  const boyImmedAbovePos2 = calcGrowthZScores(10, 45.06, 137.8, 'male');
  assert.equal(boyImmedAbovePos2?.waz, 2);
  assert.equal(boyImmedAbovePos2?.wazLabel, 'High Weight');
  assert.equal(boyImmedAbovePos2?.wazStatus, 'warning');

  // 45.10 kg (above +2 SD threshold: ~ 2.008)
  const boyAbovePos2 = calcGrowthZScores(10, 45.10, 137.8, 'male');
  assert.equal(boyAbovePos2?.waz, 2);
  assert.equal(boyAbovePos2?.wazLabel, 'High Weight');
  assert.equal(boyAbovePos2?.wazStatus, 'warning');

  // Boys: -3 SD threshold (20.420 kg)
  // 20.40 kg (immediately below -3 SD threshold: ~ -3.007)
  const boyImmedBelowNeg3 = calcGrowthZScores(10, 20.40, 137.8, 'male');
  assert.equal(boyImmedBelowNeg3?.waz, -3);
  assert.equal(boyImmedBelowNeg3?.wazLabel, 'Severe Underweight');
  assert.equal(boyImmedBelowNeg3?.wazStatus, 'danger');

  // 20.42012 kg (at -3 SD threshold: ~ -3.000)
  const boyAtNeg3 = calcGrowthZScores(10, 20.42012, 137.8, 'male');
  assert.equal(boyAtNeg3?.waz, -3);
  assert.equal(boyAtNeg3?.wazLabel, 'Underweight');
  assert.equal(boyAtNeg3?.wazStatus, 'warning');

  // 20.44 kg (immediately above -3 SD threshold: ~ -2.993)
  const boyImmedAboveNeg3 = calcGrowthZScores(10, 20.44, 137.8, 'male');
  assert.equal(boyImmedAboveNeg3?.waz, -3);
  assert.equal(boyImmedAboveNeg3?.wazLabel, 'Underweight');
  assert.equal(boyImmedAboveNeg3?.wazStatus, 'warning');

  // Girls 120 mo (10 yr): L = -0.5958, M = 31.8578, S = 0.17262
  // Exact cutoffs: -3 SD = 20.286 kg, -2 SD = 23.274 kg, Median = 31.858 kg, +2 SD = 46.890 kg
  const girlMedian = calcGrowthZScores(10, 31.86, 138.0, 'female');
  assert.equal(girlMedian?.waz, 0);
  assert.equal(girlMedian?.wazLabel, 'Normal');
  assert.equal(girlMedian?.wazStatus, 'good');

  // Girls: -2 SD threshold (23.274 kg)
  // 23.20 kg (below -2 SD threshold: ~ -2.025)
  const girlBelowNeg2 = calcGrowthZScores(10, 23.20, 138.0, 'female');
  assert.equal(girlBelowNeg2?.waz, -2);
  assert.equal(girlBelowNeg2?.wazLabel, 'Underweight');
  assert.equal(girlBelowNeg2?.wazStatus, 'warning');

  // 23.25 kg (immediately below -2 SD threshold: ~ -2.008)
  const girlImmedBelowNeg2 = calcGrowthZScores(10, 23.25, 138.0, 'female');
  assert.equal(girlImmedBelowNeg2?.waz, -2);
  assert.equal(girlImmedBelowNeg2?.wazLabel, 'Underweight');
  assert.equal(girlImmedBelowNeg2?.wazStatus, 'warning');

  // 23.2738 kg (at -2 SD threshold: ~ -2.000)
  const girlAtNeg2 = calcGrowthZScores(10, 23.2738, 138.0, 'female');
  assert.equal(girlAtNeg2?.waz, -2);
  assert.equal(girlAtNeg2?.wazLabel, 'Normal');
  assert.equal(girlAtNeg2?.wazStatus, 'good');

  // 23.30 kg (immediately above -2 SD threshold: ~ -1.991)
  const girlImmedAboveNeg2 = calcGrowthZScores(10, 23.30, 138.0, 'female');
  assert.equal(girlImmedAboveNeg2?.waz, -2);
  assert.equal(girlImmedAboveNeg2?.wazLabel, 'Normal');
  assert.equal(girlImmedAboveNeg2?.wazStatus, 'good');

  // Girls: +2 SD threshold (46.890 kg)
  // 46.85 kg (immediately below +2 SD threshold: ~ 1.996)
  const girlImmedBelowPos2 = calcGrowthZScores(10, 46.85, 138.0, 'female');
  assert.equal(girlImmedBelowPos2?.waz, 2);
  assert.equal(girlImmedBelowPos2?.wazLabel, 'Normal');
  assert.equal(girlImmedBelowPos2?.wazStatus, 'good');

  // 46.8897 kg (at +2 SD threshold: ~ 2.000)
  const girlAtPos2 = calcGrowthZScores(10, 46.8897, 138.0, 'female');
  assert.equal(girlAtPos2?.waz, 2);
  assert.equal(girlAtPos2?.wazLabel, 'Normal');
  assert.equal(girlAtPos2?.wazStatus, 'good');

  // 46.95 kg (immediately above +2 SD threshold: ~ 2.006)
  const girlImmedAbovePos2 = calcGrowthZScores(10, 46.95, 138.0, 'female');
  assert.equal(girlImmedAbovePos2?.waz, 2);
  assert.equal(girlImmedAbovePos2?.wazLabel, 'High Weight');
  assert.equal(girlImmedAbovePos2?.wazStatus, 'warning');

  // Girls: -3 SD threshold (20.286 kg)
  // 20.25 kg (immediately below -3 SD threshold: ~ -3.013)
  const girlImmedBelowNeg3 = calcGrowthZScores(10, 20.25, 138.0, 'female');
  assert.equal(girlImmedBelowNeg3?.waz, -3);
  assert.equal(girlImmedBelowNeg3?.wazLabel, 'Severe Underweight');
  assert.equal(girlImmedBelowNeg3?.wazStatus, 'danger');

  // 20.2861 kg (at -3 SD threshold: ~ -3.000)
  const girlAtNeg3 = calcGrowthZScores(10, 20.2861, 138.0, 'female');
  assert.equal(girlAtNeg3?.waz, -3);
  assert.equal(girlAtNeg3?.wazLabel, 'Underweight');
  assert.equal(girlAtNeg3?.wazStatus, 'warning');

  // 20.32 kg (immediately above -3 SD threshold: ~ -2.988)
  const girlImmedAboveNeg3 = calcGrowthZScores(10, 20.32, 138.0, 'female');
  assert.equal(girlImmedAboveNeg3?.waz, -3);
  assert.equal(girlImmedAboveNeg3?.wazLabel, 'Underweight');
  assert.equal(girlImmedAboveNeg3?.wazStatus, 'warning');

  // Independent WHO reference output validation across both sexes and supported age range
  // Testing Median (0 SD), -2 SD, and +2 SD across multiple pediatric age checkpoints:
  // 1 mo (1/12 yr), 6 mo (0.5 yr), 12 mo (1 yr), 24 mo (2 yr), 60 mo (5 yr), 84 mo (7 yr)
  const whoCheckpoints: Array<{
    ageYr: number;
    sex: 'male' | 'female';
    med: number;
    neg2: number;
    pos2: number;
  }> = [
    { ageYr: 1 / 12, sex: 'male', med: 4.47, neg2: 3.39, pos2: 5.80 },
    { ageYr: 1 / 12, sex: 'female', med: 4.19, neg2: 3.16, pos2: 5.48 },
    { ageYr: 0.5, sex: 'male', med: 7.93, neg2: 6.35, pos2: 9.85 },
    { ageYr: 0.5, sex: 'female', med: 7.30, neg2: 5.73, pos2: 9.34 },
    { ageYr: 1, sex: 'male', med: 9.65, neg2: 7.74, pos2: 11.99 },
    { ageYr: 1, sex: 'female', med: 8.95, neg2: 7.04, pos2: 11.51 },
    { ageYr: 2, sex: 'male', med: 12.15, neg2: 9.67, pos2: 15.28 },
    { ageYr: 2, sex: 'female', med: 11.48, neg2: 9.04, pos2: 14.85 },
    { ageYr: 5, sex: 'male', med: 18.33, neg2: 14.24, pos2: 23.91 },
    { ageYr: 5, sex: 'female', med: 18.08, neg2: 13.84, pos2: 24.54 },
    { ageYr: 7, sex: 'male', med: 22.89, neg2: 17.65, pos2: 30.69 },
    { ageYr: 7, sex: 'female', med: 22.37, neg2: 16.78, pos2: 31.44 },
  ];

  for (const cp of whoCheckpoints) {
    const resMed = calcGrowthZScores(cp.ageYr, cp.med, 100, cp.sex);
    assert.equal(resMed?.waz, 0, `Failed median for ${cp.sex} at ${cp.ageYr} yr`);
    assert.equal(resMed?.wazLabel, 'Normal');

    const resNeg2 = calcGrowthZScores(cp.ageYr, cp.neg2, 100, cp.sex);
    assert.equal(resNeg2?.waz, -2, `Failed -2 SD for ${cp.sex} at ${cp.ageYr} yr`);
    assert.ok(
      resNeg2?.wazLabel === 'Normal' || resNeg2?.wazLabel === 'Underweight',
      `Expected Normal or Underweight at -2 SD for ${cp.sex} at ${cp.ageYr} yr`
    );

    const resPos2 = calcGrowthZScores(cp.ageYr, cp.pos2, 100, cp.sex);
    assert.equal(resPos2?.waz, 2, `Failed +2 SD for ${cp.sex} at ${cp.ageYr} yr`);
    assert.ok(
      resPos2?.wazLabel === 'Normal' || resPos2?.wazLabel === 'High Weight',
      `Expected Normal or High Weight at +2 SD for ${cp.sex} at ${cp.ageYr} yr`
    );
  }
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
