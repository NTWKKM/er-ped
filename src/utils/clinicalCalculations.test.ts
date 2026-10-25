import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateWeightFromAge,
  estimateWeightFromLength,
  calcBSA,
  calcGrowthZScores,
  computeWhoWaz,
  getInterpolatedLMS,
  getBroselowZone,
  resolveDrugDose,
  calcSchwartzEGFR,
  calcPatientRenalDose,
  calcMaintenanceMlPerHr,
  calcFluidRegimen,
  MAINTENANCE_CAP_ML_DAY,
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

  // Helper to compute exact threshold weight W = M * (1 + L * S * SD)^(1 / L)
  const getExactWeight = (l: number, m: number, s: number, sd: number) =>
    m * Math.pow(1 + l * s * sd, 1 / l);

  // WHO WAZ LMS method and fine-grained classification threshold validation (120-month boys and girls)
  // Classify with unrounded score, round only displayed score (testing immediately below, exactly at, and above thresholds)
  // Boys 120 mo (10 yr): L = -0.6764, M = 31.1586, S = 0.16305
  const bL = -0.6764, bM = 31.1586, bS = 0.16305;
  const boyMedian = calcGrowthZScores(10, 31.16, 137.8, 'male');
  assert.equal(boyMedian?.waz, 0);
  assert.equal(boyMedian?.wazLabel, 'Normal');
  assert.equal(boyMedian?.wazStatus, 'good');

  // Boys: -2 SD threshold (exact W = 23.205996... kg)
  const boyWNeg2 = getExactWeight(bL, bM, bS, -2);
  // Regression test: 23.10 kg (rounds to -2.0, but unrounded ~ -2.034, strictly Underweight)
  const boyBelowNeg2 = calcGrowthZScores(10, 23.10, 137.8, 'male');
  assert.equal(boyBelowNeg2?.waz, -2);
  assert.equal(boyBelowNeg2?.wazLabel, 'Underweight');
  assert.equal(boyBelowNeg2?.wazStatus, 'warning');

  // Immediately below -2 SD threshold (W_exact - 0.005 kg)
  const boyImmedBelowNeg2 = calcGrowthZScores(10, boyWNeg2 - 0.005, 137.8, 'male');
  assert.equal(boyImmedBelowNeg2?.waz, -2);
  assert.equal(boyImmedBelowNeg2?.wazLabel, 'Underweight');
  assert.equal(boyImmedBelowNeg2?.wazStatus, 'warning');

  // Exact equality at -2 SD threshold (W_exact)
  const boyAtNeg2 = calcGrowthZScores(10, boyWNeg2, 137.8, 'male');
  assert.equal(boyAtNeg2?.waz, -2);
  assert.equal(boyAtNeg2?.wazLabel, 'Normal');
  assert.equal(boyAtNeg2?.wazStatus, 'good');

  // Immediately above -2 SD threshold (W_exact + 0.005 kg)
  const boyImmedAboveNeg2 = calcGrowthZScores(10, boyWNeg2 + 0.005, 137.8, 'male');
  assert.equal(boyImmedAboveNeg2?.waz, -2);
  assert.equal(boyImmedAboveNeg2?.wazLabel, 'Normal');
  assert.equal(boyImmedAboveNeg2?.wazStatus, 'good');

  // Boys: +2 SD threshold (exact W = 45.038053... kg)
  const boyWPos2 = getExactWeight(bL, bM, bS, 2);
  // Immediately below +2 SD threshold (W_exact - 0.005 kg)
  const boyImmedBelowPos2 = calcGrowthZScores(10, boyWPos2 - 0.005, 137.8, 'male');
  assert.equal(boyImmedBelowPos2?.waz, 2);
  assert.equal(boyImmedBelowPos2?.wazLabel, 'Normal');
  assert.equal(boyImmedBelowPos2?.wazStatus, 'good');

  // Exact equality at +2 SD threshold (W_exact)
  const boyAtPos2 = calcGrowthZScores(10, boyWPos2, 137.8, 'male');
  assert.equal(boyAtPos2?.waz, 2);
  assert.equal(boyAtPos2?.wazLabel, 'Normal');
  assert.equal(boyAtPos2?.wazStatus, 'good');

  // Immediately above +2 SD threshold (W_exact + 0.005 kg)
  const boyImmedAbovePos2 = calcGrowthZScores(10, boyWPos2 + 0.005, 137.8, 'male');
  assert.equal(boyImmedAbovePos2?.waz, 2);
  assert.equal(boyImmedAbovePos2?.wazLabel, 'High Weight');
  assert.equal(boyImmedAbovePos2?.wazStatus, 'warning');

  // Boys: -3 SD threshold (exact W = 20.420117... kg)
  const boyWNeg3 = getExactWeight(bL, bM, bS, -3);
  // Immediately below -3 SD threshold (W_exact - 0.005 kg)
  const boyImmedBelowNeg3 = calcGrowthZScores(10, boyWNeg3 - 0.005, 137.8, 'male');
  assert.equal(boyImmedBelowNeg3?.waz, -3);
  assert.equal(boyImmedBelowNeg3?.wazLabel, 'Severe Underweight');
  assert.equal(boyImmedBelowNeg3?.wazStatus, 'danger');

  // Exact equality at -3 SD threshold (W_exact)
  const boyAtNeg3 = calcGrowthZScores(10, boyWNeg3, 137.8, 'male');
  assert.equal(boyAtNeg3?.waz, -3);
  assert.equal(boyAtNeg3?.wazLabel, 'Underweight');
  assert.equal(boyAtNeg3?.wazStatus, 'warning');

  // Immediately above -3 SD threshold (W_exact + 0.005 kg)
  const boyImmedAboveNeg3 = calcGrowthZScores(10, boyWNeg3 + 0.005, 137.8, 'male');
  assert.equal(boyImmedAboveNeg3?.waz, -3);
  assert.equal(boyImmedAboveNeg3?.wazLabel, 'Underweight');
  assert.equal(boyImmedAboveNeg3?.wazStatus, 'warning');

  // Girls 120 mo (10 yr): L = -0.5958, M = 31.8578, S = 0.17262
  const gL = -0.5958, gM = 31.8578, gS = 0.17262;
  const girlMedian = calcGrowthZScores(10, 31.86, 138.6, 'female');
  assert.equal(girlMedian?.waz, 0);
  assert.equal(girlMedian?.wazLabel, 'Normal');
  assert.equal(girlMedian?.wazStatus, 'good');

  // Girls: -2 SD threshold (exact W = 23.273739... kg)
  const girlWNeg2 = getExactWeight(gL, gM, gS, -2);
  // Below -2 SD threshold: 23.20 kg
  const girlBelowNeg2 = calcGrowthZScores(10, 23.20, 138.6, 'female');
  assert.equal(girlBelowNeg2?.waz, -2);
  assert.equal(girlBelowNeg2?.wazLabel, 'Underweight');
  assert.equal(girlBelowNeg2?.wazStatus, 'warning');

  // Immediately below -2 SD threshold (W_exact - 0.005 kg)
  const girlImmedBelowNeg2 = calcGrowthZScores(10, girlWNeg2 - 0.005, 138.6, 'female');
  assert.equal(girlImmedBelowNeg2?.waz, -2);
  assert.equal(girlImmedBelowNeg2?.wazLabel, 'Underweight');
  assert.equal(girlImmedBelowNeg2?.wazStatus, 'warning');

  // Exact equality at -2 SD threshold (W_exact)
  const girlAtNeg2 = calcGrowthZScores(10, girlWNeg2, 138.6, 'female');
  assert.equal(girlAtNeg2?.waz, -2);
  assert.equal(girlAtNeg2?.wazLabel, 'Normal');
  assert.equal(girlAtNeg2?.wazStatus, 'good');

  // Immediately above -2 SD threshold (W_exact + 0.005 kg)
  const girlImmedAboveNeg2 = calcGrowthZScores(10, girlWNeg2 + 0.005, 138.6, 'female');
  assert.equal(girlImmedAboveNeg2?.waz, -2);
  assert.equal(girlImmedAboveNeg2?.wazLabel, 'Normal');
  assert.equal(girlImmedAboveNeg2?.wazStatus, 'good');

  // Girls: +2 SD threshold (exact W = 46.889730... kg)
  const girlWPos2 = getExactWeight(gL, gM, gS, 2);
  // Immediately below +2 SD threshold (W_exact - 0.005 kg)
  const girlImmedBelowPos2 = calcGrowthZScores(10, girlWPos2 - 0.005, 138.6, 'female');
  assert.equal(girlImmedBelowPos2?.waz, 2);
  assert.equal(girlImmedBelowPos2?.wazLabel, 'Normal');
  assert.equal(girlImmedBelowPos2?.wazStatus, 'good');

  // Exact equality at +2 SD threshold (W_exact)
  const girlAtPos2 = calcGrowthZScores(10, girlWPos2, 138.6, 'female');
  assert.equal(girlAtPos2?.waz, 2);
  assert.equal(girlAtPos2?.wazLabel, 'Normal');
  assert.equal(girlAtPos2?.wazStatus, 'good');

  // Immediately above +2 SD threshold (W_exact + 0.005 kg)
  const girlImmedAbovePos2 = calcGrowthZScores(10, girlWPos2 + 0.005, 138.6, 'female');
  assert.equal(girlImmedAbovePos2?.waz, 2);
  assert.equal(girlImmedAbovePos2?.wazLabel, 'High Weight');
  assert.equal(girlImmedAbovePos2?.wazStatus, 'warning');

  // Girls: -3 SD threshold (exact W = 20.286078... kg)
  const girlWNeg3 = getExactWeight(gL, gM, gS, -3);
  // Immediately below -3 SD threshold (W_exact - 0.005 kg)
  const girlImmedBelowNeg3 = calcGrowthZScores(10, girlWNeg3 - 0.005, 138.6, 'female');
  assert.equal(girlImmedBelowNeg3?.waz, -3);
  assert.equal(girlImmedBelowNeg3?.wazLabel, 'Severe Underweight');
  assert.equal(girlImmedBelowNeg3?.wazStatus, 'danger');

  // Exact equality at -3 SD threshold (W_exact)
  const girlAtNeg3 = calcGrowthZScores(10, girlWNeg3, 138.6, 'female');
  assert.equal(girlAtNeg3?.waz, -3);
  assert.equal(girlAtNeg3?.wazLabel, 'Underweight');
  assert.equal(girlAtNeg3?.wazStatus, 'warning');

  // Immediately above -3 SD threshold (W_exact + 0.005 kg)
  const girlImmedAboveNeg3 = calcGrowthZScores(10, girlWNeg3 + 0.005, 138.6, 'female');
  assert.equal(girlImmedAboveNeg3?.waz, -3);
  assert.equal(girlImmedAboveNeg3?.wazLabel, 'Underweight');
  assert.equal(girlImmedAboveNeg3?.wazStatus, 'warning');

  // WHO HAZ Gaussian method and fine-grained classification threshold validation (120-month boys and girls)
  // Reference values sourced from WHO Growth Reference 2007 (5–19 years):
  // Boys 120 mo (10 yr): hMed = 137.8 cm, hSD = 6.4 cm
  // Girls 120 mo (10 yr): hMed = 138.6 cm, hSD = 6.4 cm
  // Classify with unrounded score, round only displayed score (testing immediately below, exactly at, and above thresholds)
  const boyHMed = 137.8, boyHSD = 6.4;
  const boyHNeg2 = +(boyHMed - 2 * boyHSD).toFixed(1); // 125.0 cm (-2 SD)
  const boyHPos2 = +(boyHMed + 2 * boyHSD).toFixed(1); // 150.6 cm (+2 SD)
  const boyHNeg3 = +(boyHMed - 3 * boyHSD).toFixed(1); // 118.6 cm (-3 SD)

  const boyHMedian = calcGrowthZScores(10, 31, boyHMed, 'male');
  assert.equal(boyHMedian?.haz, 0);
  assert.equal(boyHMedian?.hazLabel, 'Normal');
  assert.equal(boyHMedian?.hazStatus, 'good');

  // Boys: -2 SD threshold (125.0 cm) derived from median (137.8) and SD (6.4)
  // Values below -2 SD boundary (e.g. boyHNeg2 - 0.1 = 124.9 cm, and legacy 124.2 / 124.1 cm) must NOT be classified as Normal
  const boyHBelowNeg2 = calcGrowthZScores(10, 31, +(boyHNeg2 - 0.1).toFixed(1), 'male');
  assert.equal(boyHBelowNeg2?.haz, -2);
  assert.equal(boyHBelowNeg2?.hazLabel, 'Stunted');
  assert.equal(boyHBelowNeg2?.hazStatus, 'warning');

  // Regression check: Old boundary (124.2 cm) was previously misclassified as Normal when hSD was 6.8;
  // with WHO 2007 hSD = 6.4, it is strictly Stunted (~ -2.13 SD)
  const boyOldBoundary = calcGrowthZScores(10, 31, 124.2, 'male');
  assert.equal(boyOldBoundary?.haz, -2.1);
  assert.equal(boyOldBoundary?.hazLabel, 'Stunted');
  assert.equal(boyOldBoundary?.hazStatus, 'warning');

  // 125.0 cm (exact at -2 SD threshold: ~ -2.000)
  const boyHAtNeg2 = calcGrowthZScores(10, 31, boyHNeg2, 'male');
  assert.equal(boyHAtNeg2?.haz, -2);
  assert.equal(boyHAtNeg2?.hazLabel, 'Normal');
  assert.equal(boyHAtNeg2?.hazStatus, 'good');

  // 125.1 cm (immediately above -2 SD threshold: ~ -1.984)
  const boyHAboveNeg2 = calcGrowthZScores(10, 31, +(boyHNeg2 + 0.1).toFixed(1), 'male');
  assert.equal(boyHAboveNeg2?.haz, -2);
  assert.equal(boyHAboveNeg2?.hazLabel, 'Normal');
  assert.equal(boyHAboveNeg2?.hazStatus, 'good');

  // Boys: +2 SD threshold (150.6 cm)
  // 150.5 cm (immediately below +2 SD threshold: ~ 1.984)
  const boyHBelowPos2 = calcGrowthZScores(10, 31, +(boyHPos2 - 0.1).toFixed(1), 'male');
  assert.equal(boyHBelowPos2?.haz, 2);
  assert.equal(boyHBelowPos2?.hazLabel, 'Normal');
  assert.equal(boyHBelowPos2?.hazStatus, 'good');

  // 150.6 cm (exact at +2 SD threshold: ~ 2.000)
  const boyHAtPos2 = calcGrowthZScores(10, 31, boyHPos2, 'male');
  assert.equal(boyHAtPos2?.haz, 2);
  assert.equal(boyHAtPos2?.hazLabel, 'Normal');
  assert.equal(boyHAtPos2?.hazStatus, 'good');

  // 150.7 cm (immediately above +2 SD threshold: ~ 2.016)
  const boyHAbovePos2 = calcGrowthZScores(10, 31, +(boyHPos2 + 0.1).toFixed(1), 'male');
  assert.equal(boyHAbovePos2?.haz, 2);
  assert.equal(boyHAbovePos2?.hazLabel, 'Tall');
  assert.equal(boyHAbovePos2?.hazStatus, 'warning');

  // Boys: -3 SD threshold (118.6 cm)
  // 118.5 cm (immediately below -3 SD threshold: ~ -3.016)
  const boyHBelowNeg3 = calcGrowthZScores(10, 31, +(boyHNeg3 - 0.1).toFixed(1), 'male');
  assert.equal(boyHBelowNeg3?.haz, -3);
  assert.equal(boyHBelowNeg3?.hazLabel, 'Severe Stunting');
  assert.equal(boyHBelowNeg3?.hazStatus, 'danger');

  // 118.6 cm (exact at -3 SD threshold: ~ -3.000)
  const boyHAtNeg3 = calcGrowthZScores(10, 31, boyHNeg3, 'male');
  assert.equal(boyHAtNeg3?.haz, -3);
  assert.equal(boyHAtNeg3?.hazLabel, 'Stunted');
  assert.equal(boyHAtNeg3?.hazStatus, 'warning');

  // 118.7 cm (immediately above -3 SD threshold: ~ -2.984)
  const boyHAboveNeg3 = calcGrowthZScores(10, 31, +(boyHNeg3 + 0.1).toFixed(1), 'male');
  assert.equal(boyHAboveNeg3?.haz, -3);
  assert.equal(boyHAboveNeg3?.hazLabel, 'Stunted');
  assert.equal(boyHAboveNeg3?.hazStatus, 'warning');

  // Girls 120 mo (10 yr): hMed = 138.6, hSD = 6.4
  const girlHMed = 138.6, girlHSD = 6.4;
  const girlHNeg2 = +(girlHMed - 2 * girlHSD).toFixed(1); // 125.8 cm (-2 SD)
  const girlHPos2 = +(girlHMed + 2 * girlHSD).toFixed(1); // 151.4 cm (+2 SD)
  const girlHNeg3 = +(girlHMed - 3 * girlHSD).toFixed(1); // 119.4 cm (-3 SD)

  const girlHMedian = calcGrowthZScores(10, 31, girlHMed, 'female');
  assert.equal(girlHMedian?.haz, 0);
  assert.equal(girlHMedian?.hazLabel, 'Normal');
  assert.equal(girlHMedian?.hazStatus, 'good');

  // Girls: -2 SD threshold (125.8 cm) derived from median (138.6) and SD (6.4)
  // Values below -2 SD boundary (e.g. girlHNeg2 - 0.1 = 125.7 cm, and legacy 124.4 / 124.3 cm) must NOT be classified as Normal
  const girlHBelowNeg2 = calcGrowthZScores(10, 31, +(girlHNeg2 - 0.1).toFixed(1), 'female');
  assert.equal(girlHBelowNeg2?.haz, -2);
  assert.equal(girlHBelowNeg2?.hazLabel, 'Stunted');
  assert.equal(girlHBelowNeg2?.hazStatus, 'warning');

  // Regression check: Old boundary (124.4 cm) was previously misclassified as Normal when hSD was 6.8;
  // with WHO 2007 hMed = 138.6 and hSD = 6.4, it is strictly Stunted (~ -2.22 SD)
  const girlOldBoundary = calcGrowthZScores(10, 31, 124.4, 'female');
  assert.equal(girlOldBoundary?.haz, -2.2);
  assert.equal(girlOldBoundary?.hazLabel, 'Stunted');
  assert.equal(girlOldBoundary?.hazStatus, 'warning');

  // 125.8 cm (exact at -2 SD threshold: ~ -2.000)
  const girlHAtNeg2 = calcGrowthZScores(10, 31, girlHNeg2, 'female');
  assert.equal(girlHAtNeg2?.haz, -2);
  assert.equal(girlHAtNeg2?.hazLabel, 'Normal');
  assert.equal(girlHAtNeg2?.hazStatus, 'good');

  // 125.9 cm (immediately above -2 SD threshold: ~ -1.984)
  const girlHAboveNeg2 = calcGrowthZScores(10, 31, +(girlHNeg2 + 0.1).toFixed(1), 'female');
  assert.equal(girlHAboveNeg2?.haz, -2);
  assert.equal(girlHAboveNeg2?.hazLabel, 'Normal');
  assert.equal(girlHAboveNeg2?.hazStatus, 'good');

  // Girls: +2 SD threshold (151.4 cm)
  // 151.3 cm (immediately below +2 SD threshold: ~ 1.984)
  const girlHBelowPos2 = calcGrowthZScores(10, 31, +(girlHPos2 - 0.1).toFixed(1), 'female');
  assert.equal(girlHBelowPos2?.haz, 2);
  assert.equal(girlHBelowPos2?.hazLabel, 'Normal');
  assert.equal(girlHBelowPos2?.hazStatus, 'good');

  // 151.4 cm (exact at +2 SD threshold: ~ 2.000)
  const girlHAtPos2 = calcGrowthZScores(10, 31, girlHPos2, 'female');
  assert.equal(girlHAtPos2?.haz, 2);
  assert.equal(girlHAtPos2?.hazLabel, 'Normal');
  assert.equal(girlHAtPos2?.hazStatus, 'good');

  // 151.5 cm (immediately above +2 SD threshold: ~ 2.016)
  const girlHAbovePos2 = calcGrowthZScores(10, 31, +(girlHPos2 + 0.1).toFixed(1), 'female');
  assert.equal(girlHAbovePos2?.haz, 2);
  assert.equal(girlHAbovePos2?.hazLabel, 'Tall');
  assert.equal(girlHAbovePos2?.hazStatus, 'warning');

  // Girls: -3 SD threshold (119.4 cm)
  // 119.3 cm (immediately below -3 SD threshold: ~ -3.016)
  const girlHBelowNeg3 = calcGrowthZScores(10, 31, +(girlHNeg3 - 0.1).toFixed(1), 'female');
  assert.equal(girlHBelowNeg3?.haz, -3);
  assert.equal(girlHBelowNeg3?.hazLabel, 'Severe Stunting');
  assert.equal(girlHBelowNeg3?.hazStatus, 'danger');

  // 119.4 cm (exact at -3 SD threshold: ~ -3.000)
  const girlHAtNeg3 = calcGrowthZScores(10, 31, girlHNeg3, 'female');
  assert.equal(girlHAtNeg3?.haz, -3);
  assert.equal(girlHAtNeg3?.hazLabel, 'Stunted');
  assert.equal(girlHAtNeg3?.hazStatus, 'warning');

  // 119.5 cm (immediately above -3 SD threshold: ~ -2.984)
  const girlHAboveNeg3 = calcGrowthZScores(10, 31, +(girlHNeg3 + 0.1).toFixed(1), 'female');
  assert.equal(girlHAboveNeg3?.haz, -3);
  assert.equal(girlHAboveNeg3?.hazLabel, 'Stunted');
  assert.equal(girlHAboveNeg3?.hazStatus, 'warning');

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
    { ageYr: 5, sex: 'male', med: 18.34, neg2: 14.07, pos2: 24.16 },
    { ageYr: 5, sex: 'female', med: 18.22, neg2: 13.74, pos2: 24.92 },
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

test('WHO Anthro and AnthroPlus independent reference output comparison (fractional ages, transition, and tails)', () => {
  // Independent validation against official WHO Anthro (v1.1.0) and AnthroPlus (v1.1.0) software:
  // - WHO Child Growth Standards (0–60 completed months): anthro R package v1.1.0 (https://CRAN.R-project.org/package=anthro)
  // - WHO Growth Reference 2007 (61–120 months): anthroplus R package v1.1.0 (https://CRAN.R-project.org/package=anthroplus)
  // - Official AnthroPlus validation survey: survey_who2007_z.csv (https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/main/data-raw/survey_who2007_z.csv)

  // 1. Fractional ages above 60 months (WHO AnthroPlus survey dataset)
  const whoBenchmarks60Plus: Array<{
    id: number;
    sex: 'male' | 'female';
    ageMo: number;
    wt: number;
    expectedWaz: number;
  }> = [
    { id: 6, sex: 'male', ageMo: 80.65, wt: 18.8, expectedWaz: -1.26 },
    { id: 10, sex: 'male', ageMo: 89.78, wt: 25.3, expectedWaz: 0.35 },
    { id: 21, sex: 'female', ageMo: 74.27, wt: 29.7, expectedWaz: 2.23 },
    { id: 28, sex: 'male', ageMo: 78.74, wt: 16.6, expectedWaz: -2.13 },
    { id: 35, sex: 'female', ageMo: 97.94, wt: 29.7, expectedWaz: 0.90 },
    { id: 40, sex: 'male', ageMo: 115.09, wt: 30.9, expectedWaz: 0.22 },
  ];

  for (const b of whoBenchmarks60Plus) {
    const [l, m, s] = getInterpolatedLMS(b.ageMo, b.sex);
    const unroundedZ = computeWhoWaz(b.wt, l, m, s);
    assert.ok(
      Math.abs(unroundedZ - b.expectedWaz) < 0.005,
      `Case ${b.id} (${b.sex}, ${b.ageMo} mo, ${b.wt} kg): expected ${b.expectedWaz}, got ${unroundedZ.toFixed(4)}`
    );

    const zScoreRes = calcGrowthZScores(b.ageMo / 12, b.wt, 120, b.sex);
    assert.ok(zScoreRes);
    const expectedRounded = Math.abs(b.expectedWaz) < 0.05 ? 0 : +b.expectedWaz.toFixed(1);
    assert.equal(zScoreRes.waz, expectedRounded);
  }

  // 2. Fractional ages below 60 months (WHO Anthro v1.1.0 Child Growth Standards)
  // Sourced via anthro::anthro_zscores(is_age_in_month = TRUE) across both sexes
  const whoBenchmarksUnder60: Array<{
    sex: 'male' | 'female';
    ageMo: number;
    wt: number;
    expectedWaz: number;
  }> = [
    { sex: 'male', ageMo: 6.5, wt: 8.3, expectedWaz: 0.20 },
    { sex: 'female', ageMo: 6.5, wt: 7.6, expectedWaz: 0.13 },
    { sex: 'male', ageMo: 18.5, wt: 11.2, expectedWaz: 0.13 },
    { sex: 'female', ageMo: 18.5, wt: 10.5, expectedWaz: 0.13 },
    { sex: 'male', ageMo: 30.5, wt: 13.5, expectedWaz: 0.07 },
    { sex: 'female', ageMo: 30.5, wt: 13.0, expectedWaz: 0.12 },
    { sex: 'male', ageMo: 42.5, wt: 15.5, expectedWaz: 0.03 },
    { sex: 'female', ageMo: 42.5, wt: 15.0, expectedWaz: -0.03 },
    { sex: 'male', ageMo: 54.5, wt: 17.5, expectedWaz: 0.03 },
    { sex: 'female', ageMo: 54.5, wt: 17.0, expectedWaz: -0.10 },
  ];

  for (const b of whoBenchmarksUnder60) {
    const [l, m, s] = getInterpolatedLMS(b.ageMo, b.sex);
    const unroundedZ = computeWhoWaz(b.wt, l, m, s);
    // Agreement within 0.015 Z-score across fractional months vs daily spline
    assert.ok(
      Math.abs(unroundedZ - b.expectedWaz) <= 0.015,
      `Under 60m ${b.sex} ${b.ageMo}mo ${b.wt}kg: expected ${b.expectedWaz}, got ${unroundedZ.toFixed(4)}`
    );

    const zScoreRes = calcGrowthZScores(b.ageMo / 12, b.wt, 100, b.sex);
    assert.ok(zScoreRes);
    assert.equal(zScoreRes.wazLabel, 'Normal');
    assert.equal(zScoreRes.wazStatus, 'good');
  }

  // 3. The 60–61-month reference transition (Child Growth Standards -> WHO 2007 Reference)
  // Independently verified with exact generating calls from official WHO packages across median and non-median weights:
  // - 59.5 mo: anthro::anthro_zscores(sex = c(1, 1, 2, 2), age = 59.5, is_age_in_month = TRUE, weight = c(15.0, 22.0, 14.5, 22.0))
  // - 60.0 mo: WHO Child Growth Standards 60-month standard (Boys: L=-0.1506, M=18.3366, S=0.13517; Girls: L=-0.3518, M=18.2193, S=0.14821)
  // - 61.0 mo: anthroplus::anthroplus_zscores(sex = c(1, 1, 2, 2), age_in_months = 61.0, weight_in_kg = c(15.0, 22.0, 14.5, 22.0))
  const transitionCases: Array<{
    sex: 'male' | 'female';
    ageMo: number;
    wt: number;
    whoPkg: string;
    expectedWaz: number;
    expectedLabel: string;
  }> = [
    // 59.5 mo (anthro 1.1.0 Child Growth Standards) - non-median low and high weights
    { sex: 'male', ageMo: 59.5, wt: 15.0, whoPkg: 'anthro 1.1.0', expectedWaz: -1.48, expectedLabel: 'Normal' },
    { sex: 'male', ageMo: 59.5, wt: 22.0, whoPkg: 'anthro 1.1.0', expectedWaz: 1.36, expectedLabel: 'Normal' },
    { sex: 'female', ageMo: 59.5, wt: 14.5, whoPkg: 'anthro 1.1.0', expectedWaz: -1.57, expectedLabel: 'Normal' },
    { sex: 'female', ageMo: 59.5, wt: 22.0, whoPkg: 'anthro 1.1.0', expectedWaz: 1.26, expectedLabel: 'Normal' },

    // 60.0 mo (WHO Child Growth Standards 60-month) - median, low, and high weights
    { sex: 'male', ageMo: 60.0, wt: 18.34, whoPkg: 'WHO CGS 60m', expectedWaz: 0.00, expectedLabel: 'Normal' },
    { sex: 'male', ageMo: 60.0, wt: 15.0, whoPkg: 'WHO CGS 60m', expectedWaz: -1.51, expectedLabel: 'Normal' },
    { sex: 'male', ageMo: 60.0, wt: 22.0, whoPkg: 'WHO CGS 60m', expectedWaz: 1.33, expectedLabel: 'Normal' },
    { sex: 'female', ageMo: 60.0, wt: 18.22, whoPkg: 'WHO CGS 60m', expectedWaz: 0.00, expectedLabel: 'Normal' },
    { sex: 'female', ageMo: 60.0, wt: 14.5, whoPkg: 'WHO CGS 60m', expectedWaz: -1.60, expectedLabel: 'Normal' },
    { sex: 'female', ageMo: 60.0, wt: 22.0, whoPkg: 'WHO CGS 60m', expectedWaz: 1.23, expectedLabel: 'Normal' },

    // 61.0 mo (anthroplus 1.1.0 WHO 2007 Reference) - median, low, and high weights
    { sex: 'male', ageMo: 61.0, wt: 18.51, whoPkg: 'anthroplus 1.1.0', expectedWaz: 0.00, expectedLabel: 'Normal' },
    { sex: 'male', ageMo: 61.0, wt: 15.0, whoPkg: 'anthroplus 1.1.0', expectedWaz: -1.65, expectedLabel: 'Normal' },
    { sex: 'male', ageMo: 61.0, wt: 22.0, whoPkg: 'anthroplus 1.1.0', expectedWaz: 1.31, expectedLabel: 'Normal' },
    { sex: 'female', ageMo: 61.0, wt: 18.26, whoPkg: 'anthroplus 1.1.0', expectedWaz: 0.00, expectedLabel: 'Normal' },
    { sex: 'female', ageMo: 61.0, wt: 14.5, whoPkg: 'anthroplus 1.1.0', expectedWaz: -1.70, expectedLabel: 'Normal' },
    { sex: 'female', ageMo: 61.0, wt: 22.0, whoPkg: 'anthroplus 1.1.0', expectedWaz: 1.25, expectedLabel: 'Normal' },
  ];

  for (const tc of transitionCases) {
    const [l, m, s] = getInterpolatedLMS(tc.ageMo, tc.sex);
    const unroundedZ = computeWhoWaz(tc.wt, l, m, s);
    assert.ok(
      Math.abs(unroundedZ - tc.expectedWaz) <= 0.015,
      `Transition mismatch for ${tc.sex} ${tc.ageMo}mo ${tc.wt}kg: expected ${tc.expectedWaz}, got ${unroundedZ.toFixed(4)}`
    );
    const zScoreRes = calcGrowthZScores(tc.ageMo / 12, tc.wt, 110, tc.sex);
    assert.ok(zScoreRes);
    assert.equal(zScoreRes.wazLabel, tc.expectedLabel);
  }

  // Continuous unrounded smoothness across the 60-month transition:
  // Evaluated at 59.9 mo vs 60.1 mo across median and non-median weights for both sexes.
  // Directly compares unrounded continuous z-scores to guarantee delta <= 0.03 SD without quantization hiding.
  const smoothnessCases: Array<{ sex: 'male' | 'female'; wt: number }> = [
    { sex: 'male', wt: 18.3 },
    { sex: 'male', wt: 15.0 },
    { sex: 'male', wt: 22.0 },
    { sex: 'female', wt: 18.2 },
    { sex: 'female', wt: 14.5 },
    { sex: 'female', wt: 22.0 },
  ];

  for (const sc of smoothnessCases) {
    const [l59_9, m59_9, s59_9] = getInterpolatedLMS(59.9, sc.sex);
    const unrounded59_9 = computeWhoWaz(sc.wt, l59_9, m59_9, s59_9);

    const [l60_1, m60_1, s60_1] = getInterpolatedLMS(60.1, sc.sex);
    const unrounded60_1 = computeWhoWaz(sc.wt, l60_1, m60_1, s60_1);

    const delta = Math.abs(unrounded59_9 - unrounded60_1);
    assert.ok(
      delta <= 0.03,
      `Smoothness delta too large for ${sc.sex} ${sc.wt}kg: got unrounded delta ${delta.toFixed(4)}`
    );
  }

  // 4. Negative extreme tails (< -3 SD) across both sexes and age ranges (<60 mo and >=60 mo)
  // Sourced from WHO Anthro v1.1.0 and WHO AnthroPlus v1.1.0 (restricted-SD negative tail formula)
  const negTails: Array<{
    sex: 'male' | 'female';
    ageMo: number;
    wt: number;
    expectedWaz: number;
  }> = [
    // Under 60 mo (WHO Anthro Child Growth Standards)
    { sex: 'male', ageMo: 12.0, wt: 6.0, expectedWaz: -4.14 },
    { sex: 'female', ageMo: 12.0, wt: 5.5, expectedWaz: -4.01 },
    { sex: 'male', ageMo: 24.0, wt: 7.5, expectedWaz: -4.09 },
    { sex: 'female', ageMo: 24.0, wt: 7.0, expectedWaz: -4.10 },
    { sex: 'male', ageMo: 36.0, wt: 9.0, expectedWaz: -3.81 },
    { sex: 'female', ageMo: 36.0, wt: 8.5, expectedWaz: -3.93 },
    { sex: 'male', ageMo: 48.0, wt: 10.0, expectedWaz: -3.84 },
    { sex: 'female', ageMo: 48.0, wt: 9.5, expectedWaz: -3.96 },
    // Above 60 mo (WHO AnthroPlus Growth Reference 2007)
    { sex: 'male', ageMo: 70.0, wt: 12.0, expectedWaz: -4.02 },
    { sex: 'female', ageMo: 70.0, wt: 11.5, expectedWaz: -4.00 },
    { sex: 'male', ageMo: 100.0, wt: 15.0, expectedWaz: -4.22 },
    { sex: 'female', ageMo: 100.0, wt: 14.5, expectedWaz: -3.99 },
  ];

  for (const nt of negTails) {
    const [l, m, s] = getInterpolatedLMS(nt.ageMo, nt.sex);
    const unroundedZ = computeWhoWaz(nt.wt, l, m, s);
    assert.ok(
      Math.abs(unroundedZ - nt.expectedWaz) < 0.01,
      `Negative tail ${nt.sex} ${nt.ageMo}mo ${nt.wt}kg: expected ${nt.expectedWaz}, got ${unroundedZ.toFixed(4)}`
    );

    const zScoreRes = calcGrowthZScores(nt.ageMo / 12, nt.wt, 100, nt.sex);
    assert.ok(zScoreRes);
    assert.equal(zScoreRes.wazLabel, 'Severe Underweight');
    assert.equal(zScoreRes.wazStatus, 'danger');
  }

  // 5. Positive extreme tails (> +3 SD up to +6.24 SD) from WHO AnthroPlus
  const posTails: Array<{
    id: number;
    sex: 'male' | 'female';
    ageMo: number;
    wt: number;
    expectedWaz: number;
  }> = [
    { id: 748, sex: 'female', ageMo: 61.99, wt: 30.5, expectedWaz: 3.14 },
    { id: 488, sex: 'female', ageMo: 98.59, wt: 50.3, expectedWaz: 3.54 },
    { id: 161, sex: 'male', ageMo: 66.27, wt: 34.4, expectedWaz: 4.23 },
    { id: 465, sex: 'male', ageMo: 101.29, wt: 66.2, expectedWaz: 5.89 },
    { id: 640, sex: 'male', ageMo: 64.97, wt: 41.6, expectedWaz: 6.24 },
  ];

  for (const pt of posTails) {
    const [l, m, s] = getInterpolatedLMS(pt.ageMo, pt.sex);
    const unroundedZ = computeWhoWaz(pt.wt, l, m, s);
    assert.ok(
      Math.abs(unroundedZ - pt.expectedWaz) < 0.005,
      `Positive tail ${pt.id}: expected ${pt.expectedWaz}, got ${unroundedZ.toFixed(4)}`
    );

    const zScoreRes = calcGrowthZScores(pt.ageMo / 12, pt.wt, 120, pt.sex);
    assert.ok(zScoreRes);
    assert.equal(zScoreRes.wazLabel, 'High Weight');
    assert.equal(zScoreRes.wazStatus, 'warning');
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

  // Renal dosing tier evaluation: numeric dose vs qualitative review guidance
  const cipro = DATASET.pediatricDose.find((d) => d.key === 'ciprofloxacin-po')!;
  const tierNormal = cipro.renalDosing!.find((t) => t.gfr === '> 50')!;
  const tierGuidance = cipro.renalDosing!.find((t) => t.gfr === '30–50')!;

  const doseNormal = calcPatientRenalDose(tierNormal, cipro, 10);
  const doseGuidance = calcPatientRenalDose(tierGuidance, cipro, 10);

  const numRegex = /\d+\s*(?:–|-|\s)*\d*\s*(?:mg|g|mcg|mL|units?|U\b)/i;
  assert.equal(numRegex.test(doseNormal), true);
  assert.equal(numRegex.test(doseGuidance), false);
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

const near = (actual: number, expected: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) < 0.01, msg ?? `${actual} ≉ ${expected}`);

test('calcFluidRegimen: rejects missing / invalid weight', () => {
  assert.equal(calcFluidRegimen({ weightKg: 0, deficitPct: 5, durationHr: 24 }), null);
  assert.equal(calcFluidRegimen({ weightKg: NaN, deficitPct: 5, durationHr: 24 }), null);
});

test('calcFluidRegimen: V1 parity — 10 kg, 3% / 8% / 10% over 24 h', () => {
  const mild = calcFluidRegimen({ weightKg: 10, deficitPct: 3, durationHr: 24 })!;
  near(mild.mntMlHr, 41.667);
  near(mild.replaceMlHr, 12.5);
  near(mild.combinedMlHr, 54.167);
  assert.equal(mild.day1TotalMl, 1300);
  assert.equal(mild.severity, 'mild');

  const mod = calcFluidRegimen({ weightKg: 10, deficitPct: 8, durationHr: 24 })!;
  near(mod.replaceMlHr, 33.333);
  assert.equal(mod.severity, 'moderate');

  const sev = calcFluidRegimen({ weightKg: 10, deficitPct: 10, durationHr: 24 })!;
  near(sev.replaceMlHr, 41.667);
  assert.equal(sev.severity, 'severe');
  assert.equal(sev.orsPlan, null, 'severe dehydration has no ORS plan');
});

test('calcFluidRegimen: 48 h plan replaces half the net deficit on day 1', () => {
  const r = calcFluidRegimen({ weightKg: 10, deficitPct: 10, durationHr: 48 })!;
  near(r.replaceMlHr, 20.833);
  assert.equal(r.day1TotalMl, 1500);
});

test('calcFluidRegimen: prior boluses are subtracted from the deficit (floor 0)', () => {
  const r = calcFluidRegimen({ weightKg: 10, deficitPct: 10, durationHr: 24, priorBolusMl: 200 })!;
  assert.equal(r.deficitMl, 1000);
  assert.equal(r.netDeficitMl, 800);
  near(r.replaceMlHr, 33.333);

  const over = calcFluidRegimen({ weightKg: 10, deficitPct: 3, durationHr: 24, priorBolusMl: 500 })!;
  assert.equal(over.netDeficitMl, 0);
  assert.equal(over.replaceMlHr, 0);
});

test('calcFluidRegimen: maintenance capped at 2400 mL/day; boluses capped per aliquot', () => {
  const r = calcFluidRegimen({ weightKg: 70, deficitPct: 5, durationHr: 24 })!;
  assert.equal(r.mntMlDay, 2400);
  assert.equal(r.mntMlHr, 100);
  assert.equal(r.isMntCapped, true);
  assert.equal(r.bolus10Ml, 500);
  assert.equal(r.bolus20Ml, 1000);
  assert.equal(r.isBolusCapped, true);
  // Verify that calcMaintenanceMlPerHr remains uncapped (104.2 mL/hr) for other callers,
  // while order sheet display cap caps at 100 mL/hr.
  assert.equal(calcMaintenanceMlPerHr(70), 104.2);
  assert.equal(Math.min(calcMaintenanceMlPerHr(70), +(MAINTENANCE_CAP_ML_DAY / 24).toFixed(1)), 100);

  const small = calcFluidRegimen({ weightKg: 15, deficitPct: 5, durationHr: 24 })!;
  assert.equal(small.isMntCapped, false);
  assert.equal(small.bolus10Ml, 150);
  assert.equal(small.bolus20Ml, 300);
  assert.equal(small.isBolusCapped, false);
});

test('calcFluidRegimen: ORS plan (mild 50 mL/kg, moderate 75 mL/kg over 4 h)', () => {
  const mild = calcFluidRegimen({ weightKg: 10, deficitPct: 5, durationHr: 24 })!;
  assert.deepEqual(mild.orsPlan, { mlPerKg: 50, volumeMl: 500, overHr: 4 });
  const mod = calcFluidRegimen({ weightKg: 10, deficitPct: 7, durationHr: 24 })!;
  assert.deepEqual(mod.orsPlan, { mlPerKg: 75, volumeMl: 750, overHr: 4 });
});

test('calcFluidRegimen: weight-based urine output target', () => {
  const child = calcFluidRegimen({ weightKg: 10, deficitPct: 5, durationHr: 24 })!;
  assert.equal(child.uoTargetMlKgHr, 1);
  assert.equal(child.uoTargetMlHr, 10);
  const teen = calcFluidRegimen({ weightKg: 60, deficitPct: 5, durationHr: 24 })!;
  assert.equal(teen.uoTargetMlKgHr, 0.5);
  assert.equal(teen.uoTargetMlHr, 30);
});
