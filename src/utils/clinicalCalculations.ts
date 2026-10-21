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

export const WHO_WFA_LMS = {
  boys: [
    [0.3487, 3.3464, 0.14602], // 0 mo
    [0.2297, 4.4709, 0.13395], // 1 mo
    [0.197, 5.5675, 0.12385], // 2 mo
    [0.1738, 6.3762, 0.11727], // 3 mo
    [0.1553, 7.0023, 0.11316], // 4 mo
    [0.1395, 7.5105, 0.1108], // 5 mo
    [0.1257, 7.934, 0.10958], // 6 mo
    [0.1134, 8.297, 0.10902], // 7 mo
    [0.1021, 8.6151, 0.10882], // 8 mo
    [0.0917, 8.9014, 0.10881], // 9 mo
    [0.082, 9.1649, 0.10891], // 10 mo
    [0.073, 9.4122, 0.10906], // 11 mo
    [0.0644, 9.6479, 0.10925], // 12 mo
    [0.0563, 9.8749, 0.10949], // 13 mo
    [0.0487, 10.0953, 0.10976], // 14 mo
    [0.0413, 10.3108, 0.11007], // 15 mo
    [0.0343, 10.5228, 0.11041], // 16 mo
    [0.0275, 10.7319, 0.11079], // 17 mo
    [0.0211, 10.9385, 0.11119], // 18 mo
    [0.0148, 11.143, 0.11164], // 19 mo
    [0.0087, 11.3462, 0.11211], // 20 mo
    [0.0029, 11.5486, 0.11261], // 21 mo
    [-0.0028, 11.7504, 0.11314], // 22 mo
    [-0.0083, 11.9514, 0.11369], // 23 mo
    [-0.0137, 12.1515, 0.11426], // 24 mo
    [-0.0189, 12.3502, 0.11485], // 25 mo
    [-0.024, 12.5466, 0.11544], // 26 mo
    [-0.0289, 12.7401, 0.11604], // 27 mo
    [-0.0337, 12.9303, 0.11664], // 28 mo
    [-0.0385, 13.1169, 0.11723], // 29 mo
    [-0.0431, 13.3, 0.11781], // 30 mo
    [-0.0476, 13.4798, 0.11839], // 31 mo
    [-0.052, 13.6567, 0.11896], // 32 mo
    [-0.0564, 13.8309, 0.11953], // 33 mo
    [-0.0606, 14.0031, 0.12008], // 34 mo
    [-0.0648, 14.1736, 0.12062], // 35 mo
    [-0.0689, 14.3429, 0.12116], // 36 mo
    [-0.0729, 14.5113, 0.12168], // 37 mo
    [-0.0769, 14.6791, 0.1222], // 38 mo
    [-0.0808, 14.8466, 0.12271], // 39 mo
    [-0.0846, 15.014, 0.12322], // 40 mo
    [-0.0883, 15.1813, 0.12373], // 41 mo
    [-0.092, 15.3486, 0.12425], // 42 mo
    [-0.0957, 15.5158, 0.12478], // 43 mo
    [-0.0993, 15.6828, 0.12531], // 44 mo
    [-0.1028, 15.8497, 0.12586], // 45 mo
    [-0.1063, 16.0163, 0.12643], // 46 mo
    [-0.1097, 16.1827, 0.127], // 47 mo
    [-0.1131, 16.3489, 0.12759], // 48 mo
    [-0.1165, 16.515, 0.12819], // 49 mo
    [-0.1198, 16.6811, 0.1288], // 50 mo
    [-0.123, 16.8471, 0.12943], // 51 mo
    [-0.1262, 17.0132, 0.13005], // 52 mo
    [-0.1294, 17.1792, 0.13069], // 53 mo
    [-0.1325, 17.3452, 0.13133], // 54 mo
    [-0.1356, 17.5111, 0.13197], // 55 mo
    [-0.1387, 17.6768, 0.13261], // 56 mo
    [-0.1417, 17.8422, 0.13325], // 57 mo
    [-0.1447, 18.0073, 0.13389], // 58 mo
    [-0.1477, 18.1722, 0.13453], // 59 mo
    [-0.1922, 18.3328, 0.12947], // 60 mo
    [-0.2026, 18.5057, 0.12988], // 61 mo
    [-0.213, 18.6802, 0.13028], // 62 mo
    [-0.2234, 18.8563, 0.13067], // 63 mo
    [-0.2338, 19.034, 0.13105], // 64 mo
    [-0.2443, 19.2132, 0.13142], // 65 mo
    [-0.2548, 19.394, 0.13178], // 66 mo
    [-0.2653, 19.5765, 0.13213], // 67 mo
    [-0.2758, 19.7607, 0.13246], // 68 mo
    [-0.2864, 19.9468, 0.13279], // 69 mo
    [-0.2969, 20.1344, 0.13311], // 70 mo
    [-0.3075, 20.3235, 0.13342], // 71 mo
    [-0.318, 20.5137, 0.13372], // 72 mo
    [-0.3285, 20.7052, 0.13402], // 73 mo
    [-0.339, 20.8979, 0.13432], // 74 mo
    [-0.3494, 21.0918, 0.13462], // 75 mo
    [-0.3598, 21.287, 0.13493], // 76 mo
    [-0.3701, 21.4833, 0.13523], // 77 mo
    [-0.3804, 21.681, 0.13554], // 78 mo
    [-0.3906, 21.8799, 0.13586], // 79 mo
    [-0.4007, 22.08, 0.13618], // 80 mo
    [-0.4107, 22.2813, 0.13652], // 81 mo
    [-0.4207, 22.4837, 0.13686], // 82 mo
    [-0.4305, 22.6872, 0.13722], // 83 mo
    [-0.4402, 22.8915, 0.13759], // 84 mo
    [-0.4499, 23.0968, 0.13797], // 85 mo
    [-0.4594, 23.3029, 0.13838], // 86 mo
    [-0.4688, 23.5101, 0.1388], // 87 mo
    [-0.4781, 23.7182, 0.13923], // 88 mo
    [-0.4873, 23.9272, 0.13969], // 89 mo
    [-0.4964, 24.1371, 0.14016], // 90 mo
    [-0.5053, 24.3479, 0.14065], // 91 mo
    [-0.5142, 24.5595, 0.14117], // 92 mo
    [-0.5229, 24.7722, 0.1417], // 93 mo
    [-0.5315, 24.9858, 0.14226], // 94 mo
    [-0.5399, 25.2005, 0.14284], // 95 mo
    [-0.5482, 25.4163, 0.14344], // 96 mo
    [-0.5564, 25.6332, 0.14407], // 97 mo
    [-0.5644, 25.8513, 0.14472], // 98 mo
    [-0.5722, 26.0706, 0.14539], // 99 mo
    [-0.5799, 26.2911, 0.14608], // 100 mo
    [-0.5873, 26.5128, 0.14679], // 101 mo
    [-0.5946, 26.7358, 0.14752], // 102 mo
    [-0.6017, 26.9602, 0.14828], // 103 mo
    [-0.6085, 27.1861, 0.14905], // 104 mo
    [-0.6152, 27.4137, 0.14984], // 105 mo
    [-0.6216, 27.6432, 0.15066], // 106 mo
    [-0.6278, 27.875, 0.15149], // 107 mo
    [-0.6337, 28.1092, 0.15233], // 108 mo
    [-0.6393, 28.3459, 0.15319], // 109 mo
    [-0.6446, 28.5854, 0.15406], // 110 mo
    [-0.6496, 28.8277, 0.15493], // 111 mo
    [-0.6543, 29.0731, 0.15581], // 112 mo
    [-0.6585, 29.3217, 0.1567], // 113 mo
    [-0.6624, 29.5736, 0.1576], // 114 mo
    [-0.6659, 29.8289, 0.1585], // 115 mo
    [-0.6689, 30.0877, 0.1594], // 116 mo
    [-0.6714, 30.3501, 0.16031], // 117 mo
    [-0.6735, 30.616, 0.16122], // 118 mo
    [-0.6752, 30.8854, 0.16213], // 119 mo
    [-0.6764, 31.1586, 0.16305], // 120 mo
  ],
  girls: [
    [0.3809, 3.2322, 0.14171], // 0 mo
    [0.1714, 4.1873, 0.13724], // 1 mo
    [0.0962, 5.1282, 0.13], // 2 mo
    [0.0402, 5.8458, 0.12619], // 3 mo
    [-0.005, 6.4237, 0.12402], // 4 mo
    [-0.043, 6.8985, 0.12274], // 5 mo
    [-0.0756, 7.297, 0.12204], // 6 mo
    [-0.1039, 7.6422, 0.12178], // 7 mo
    [-0.1288, 7.9487, 0.12181], // 8 mo
    [-0.1507, 8.2254, 0.12199], // 9 mo
    [-0.17, 8.48, 0.12223], // 10 mo
    [-0.1872, 8.7192, 0.12247], // 11 mo
    [-0.2024, 8.9481, 0.12268], // 12 mo
    [-0.2158, 9.1699, 0.12283], // 13 mo
    [-0.2278, 9.387, 0.12294], // 14 mo
    [-0.2384, 9.6008, 0.12299], // 15 mo
    [-0.2478, 9.8124, 0.12303], // 16 mo
    [-0.2562, 10.0226, 0.12306], // 17 mo
    [-0.2637, 10.2315, 0.12309], // 18 mo
    [-0.2703, 10.4393, 0.12315], // 19 mo
    [-0.2762, 10.6464, 0.12323], // 20 mo
    [-0.2815, 10.8534, 0.12335], // 21 mo
    [-0.2862, 11.0608, 0.1235], // 22 mo
    [-0.2903, 11.2688, 0.12369], // 23 mo
    [-0.2941, 11.4775, 0.1239], // 24 mo
    [-0.2975, 11.6864, 0.12414], // 25 mo
    [-0.3005, 11.8947, 0.12441], // 26 mo
    [-0.3032, 12.1015, 0.12472], // 27 mo
    [-0.3057, 12.3059, 0.12506], // 28 mo
    [-0.308, 12.5073, 0.12545], // 29 mo
    [-0.3101, 12.7055, 0.12587], // 30 mo
    [-0.312, 12.9006, 0.12633], // 31 mo
    [-0.3138, 13.093, 0.12683], // 32 mo
    [-0.3155, 13.2837, 0.12737], // 33 mo
    [-0.3171, 13.4731, 0.12794], // 34 mo
    [-0.3186, 13.6618, 0.12855], // 35 mo
    [-0.3201, 13.8503, 0.12919], // 36 mo
    [-0.3216, 14.0385, 0.12988], // 37 mo
    [-0.323, 14.2265, 0.13059], // 38 mo
    [-0.3243, 14.414, 0.13135], // 39 mo
    [-0.3257, 14.601, 0.13213], // 40 mo
    [-0.327, 14.7873, 0.13293], // 41 mo
    [-0.3283, 14.9727, 0.13376], // 42 mo
    [-0.3296, 15.1573, 0.1346], // 43 mo
    [-0.3309, 15.341, 0.13545], // 44 mo
    [-0.3322, 15.524, 0.1363], // 45 mo
    [-0.3335, 15.7064, 0.13716], // 46 mo
    [-0.3348, 15.8882, 0.138], // 47 mo
    [-0.3361, 16.0697, 0.13884], // 48 mo
    [-0.3374, 16.2511, 0.13968], // 49 mo
    [-0.3387, 16.4322, 0.14051], // 50 mo
    [-0.34, 16.6133, 0.14132], // 51 mo
    [-0.3414, 16.7942, 0.14213], // 52 mo
    [-0.3427, 16.9748, 0.14293], // 53 mo
    [-0.344, 17.1551, 0.14371], // 54 mo
    [-0.3453, 17.3347, 0.14448], // 55 mo
    [-0.3466, 17.5136, 0.14525], // 56 mo
    [-0.3479, 17.6916, 0.146], // 57 mo
    [-0.3492, 17.8686, 0.14675], // 58 mo
    [-0.3505, 18.0445, 0.14748], // 59 mo
    [-0.465, 18.0823, 0.1424], // 60 mo
    [-0.4681, 18.2579, 0.14295], // 61 mo
    [-0.4711, 18.4329, 0.1435], // 62 mo
    [-0.4742, 18.6073, 0.14404], // 63 mo
    [-0.4773, 18.7811, 0.14459], // 64 mo
    [-0.4803, 18.9545, 0.14514], // 65 mo
    [-0.4834, 19.1276, 0.14569], // 66 mo
    [-0.4864, 19.3004, 0.14624], // 67 mo
    [-0.4894, 19.473, 0.14679], // 68 mo
    [-0.4924, 19.6455, 0.14735], // 69 mo
    [-0.4954, 19.818, 0.1479], // 70 mo
    [-0.4984, 19.9908, 0.14845], // 71 mo
    [-0.5013, 20.1639, 0.149], // 72 mo
    [-0.5043, 20.3377, 0.14955], // 73 mo
    [-0.5072, 20.5124, 0.1501], // 74 mo
    [-0.51, 20.6885, 0.15065], // 75 mo
    [-0.5129, 20.8661, 0.1512], // 76 mo
    [-0.5157, 21.0457, 0.15175], // 77 mo
    [-0.5185, 21.2274, 0.1523], // 78 mo
    [-0.5213, 21.4113, 0.15284], // 79 mo
    [-0.524, 21.5979, 0.15339], // 80 mo
    [-0.5268, 21.7872, 0.15393], // 81 mo
    [-0.5294, 21.9795, 0.15448], // 82 mo
    [-0.5321, 22.1751, 0.15502], // 83 mo
    [-0.5347, 22.374, 0.15556], // 84 mo
    [-0.5372, 22.5762, 0.1561], // 85 mo
    [-0.5398, 22.7816, 0.15663], // 86 mo
    [-0.5423, 22.9904, 0.15717], // 87 mo
    [-0.5447, 23.2025, 0.1577], // 88 mo
    [-0.5471, 23.418, 0.15823], // 89 mo
    [-0.5495, 23.6369, 0.15876], // 90 mo
    [-0.5518, 23.8593, 0.15928], // 91 mo
    [-0.5541, 24.0853, 0.1598], // 92 mo
    [-0.5563, 24.3149, 0.16032], // 93 mo
    [-0.5585, 24.5482, 0.16084], // 94 mo
    [-0.5606, 24.7853, 0.16135], // 95 mo
    [-0.5627, 25.0262, 0.16186], // 96 mo
    [-0.5647, 25.271, 0.16237], // 97 mo
    [-0.5667, 25.5197, 0.16287], // 98 mo
    [-0.5686, 25.7721, 0.16337], // 99 mo
    [-0.5704, 26.0284, 0.16386], // 100 mo
    [-0.5722, 26.2883, 0.16435], // 101 mo
    [-0.574, 26.5519, 0.16483], // 102 mo
    [-0.5757, 26.819, 0.16532], // 103 mo
    [-0.5773, 27.0896, 0.16579], // 104 mo
    [-0.5789, 27.3635, 0.16626], // 105 mo
    [-0.5804, 27.6406, 0.16673], // 106 mo
    [-0.5819, 27.9208, 0.16719], // 107 mo
    [-0.5833, 28.204, 0.16764], // 108 mo
    [-0.5847, 28.4901, 0.16809], // 109 mo
    [-0.5859, 28.7791, 0.16854], // 110 mo
    [-0.5872, 29.0711, 0.16897], // 111 mo
    [-0.5883, 29.3663, 0.16941], // 112 mo
    [-0.5895, 29.6646, 0.16983], // 113 mo
    [-0.5905, 29.9663, 0.17025], // 114 mo
    [-0.5915, 30.2715, 0.17066], // 115 mo
    [-0.5925, 30.5805, 0.17107], // 116 mo
    [-0.5934, 30.8934, 0.17146], // 117 mo
    [-0.5942, 31.2105, 0.17186], // 118 mo
    [-0.595, 31.5319, 0.17224], // 119 mo
    [-0.5958, 31.8578, 0.17262], // 120 mo
  ],
} as const;

export function getInterpolatedLMS(
  ageMo: number,
  sex: 'male' | 'female'
): [l: number, m: number, s: number] {
  const table = sex === 'male' ? WHO_WFA_LMS.boys : WHO_WFA_LMS.girls;
  if (ageMo <= 0) return [table[0][0], table[0][1], table[0][2]];
  if (ageMo >= 120) return [table[120][0], table[120][1], table[120][2]];
  const low = Math.floor(ageMo);
  const upp = Math.min(120, low + 1);
  const diff = ageMo - low;
  const [l0, m0, s0] = table[low];
  const [l1, m1, s1] = table[upp];
  return [
    l0 + diff * (l1 - l0),
    m0 + diff * (m1 - m0),
    s0 + diff * (s1 - s0),
  ];
}

export function computeWhoWaz(
  weight: number,
  l: number,
  m: number,
  s: number
): number {
  let z: number;
  if (Math.abs(l) < 1e-5) {
    z = Math.log(weight / m) / s;
  } else {
    z = (Math.pow(weight / m, l) - 1) / (s * l);
  }

  const calcSD = (sd: number) => m * Math.pow(1 + l * s * sd, 1 / l);

  if (z > 3) {
    const sd3pos = calcSD(3);
    const sd2pos = calcSD(2);
    const sd23pos = sd3pos - sd2pos;
    z = 3 + (weight - sd3pos) / sd23pos;
  } else if (z < -3) {
    const sd3neg = calcSD(-3);
    const sd2neg = calcSD(-2);
    const sd23neg = sd2neg - sd3neg;
    z = -3 + (weight - sd3neg) / sd23neg;
  }

  return z;
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
    const [l, m, s] = getInterpolatedLMS(ageMo, sex);
    wMed = m;
    const rawWaz = computeWhoWaz(w, l, m, s);
    if (rawWaz < -3) {
      wazStatus = 'danger';
      wazLabel = 'Severe Underweight';
    } else if (rawWaz < -2) {
      wazStatus = 'warning';
      wazLabel = 'Underweight';
    } else if (rawWaz > 2) {
      wazStatus = 'warning';
      wazLabel = 'High Weight';
    } else {
      wazStatus = 'good';
      wazLabel = 'Normal';
    }
    const roundedWaz = +rawWaz.toFixed(1);
    waz = roundedWaz === 0 ? 0 : roundedWaz;
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

  // Raw BMI calculation when height is provided; suppress unvalidated ratio-based WFH/BMI-for-age
  // classifications because WHO sex-specific LMS reference tables for WFH/BMI-for-age are not included in dataset
  let bmi: number | null = null;
  if (Number.isFinite(h) && h > 0) {
    const heightM = h / 100;
    bmi = +(w / (heightM * heightM)).toFixed(1);
  }

  const nutritionIndicator: 'WFH' | 'BMI' | null = null;
  const nutritionLabel: string | null = null;
  const nutritionStatus: 'good' | 'warning' | 'danger' | null = null;

  // If age > 10y and no height was entered, no supported growth indicator can be computed
  if (waz === null && haz === null) {
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
