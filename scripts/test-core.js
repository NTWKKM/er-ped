const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

console.log('🧪 Running Core ER-PED Calculation & Clinical Unit Tests (JSDOM Environment)...\n');

// 1. Load index.html into JSDOM
const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const dom = new JSDOM(htmlContent, {
  url: 'http://localhost/',
  runScripts: 'dangerously'
});

const { window } = dom;
const { document } = window;
global.window = window;
global.document = document;

// Provide minimal mocks for browser globals required by app.js
window.matchMedia = window.matchMedia || function() {
  return { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
};
window.localStorage = window.localStorage || {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

// 2. Synchronous Context Loading: Load dataset.js and app.js into JSDOM context
const datasetJsPath = path.join(__dirname, '..', 'dataset.js');
const datasetJsContent = fs.readFileSync(datasetJsPath, 'utf8');
window.eval(datasetJsContent);

const appJsPath = path.join(__dirname, '..', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');
window.eval(appJsContent);

window.eval('if (typeof loadDataset === "function") loadDataset(); window.DS = DS;');

// Require app.js to test export integrity as well
const appExports = require('../app.js');

// 3. State Sanity Check
assert(window.ER_PED_DATASET !== undefined && window.ER_PED_DATASET !== null, 'Dataset failed to load into JSDOM window.ER_PED_DATASET');
const dataset = window.DS;
assert(dataset !== undefined && dataset !== null, 'Global DS failed to initialize in JSDOM context');

console.log('✅ JSDOM Environment & Dataset (DS) initialized synchronously.\n');

// 4. DOM Element Smoke Tests
const essentialIds = [
  'doseOut', 'nOut', 'atbOut', 'pOut', 'fOut', 'dripOut', 'seizureOut', 'dkaOut', 'psaOut', 'vitalsOut', 'asthmaOut',
  'doseDrug', 'atbDrug', 'dripDrug', 'weight', 'age', 'nW', 'fDegree', 'fPlan',
  'dkaSeverity', 'dkaPriorBolus', 'useIBW', 'ibwVal', 'vitalsQuickText', 'a2hsBtn'
];

essentialIds.forEach(id => {
  assert(document.getElementById(id) !== null, `CRITICAL: Element ID #${id} missing from index.html!`);
});
console.log('✅ DOM Element Smoke Tests Passed (All critical UI elements exist in index.html).\n');

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

// Ensure UI is populated for test DOM
window.eval('populateDrugs();');

// --- TEST SUITES USING PRODUCTION FUNCTIONS ---

// 0. Test Theme Cycling Engine (Light -> Dark -> Mono -> Light)
test('3-State Theme Cycling: Light -> Dark -> Mono -> Light', () => {
  window.eval('setTheme("light")');
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'light');
  
  window.eval('toggleTheme()');
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark');
  
  window.eval('toggleTheme()');
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'mono');
  
  window.eval('toggleTheme()');
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'light');
});

// 1. Test Weech Formula (estimateWeightFromAge exported from app.js)
test('Weech Formula: 6 months infant', () => {
  assert.strictEqual(appExports.estimateWeightFromAge(6, 'mo'), 7.5);
});

test('Weech Formula: 3 years child', () => {
  assert.strictEqual(appExports.estimateWeightFromAge(3, 'yr'), 14.0);
});

test('Weech Formula: 8 years child', () => {
  assert.strictEqual(appExports.estimateWeightFromAge(8, 'yr'), 26);
});

test('Weech Formula: 20 years patient capped at 15 years max (Weech 15 yr = 50 kg)', () => {
  assert.strictEqual(appExports.estimateWeightFromAge(20, 'yr'), 50);
});

test('getAgeInYears: caps input exceeding 15 years to 15 years max', () => {
  const ageInput = document.getElementById('age');
  ageInput.value = '18';
  assert.strictEqual(appExports.getAgeInYears(), 15);
  ageInput.value = '';
});

// 2. Test Holliday-Segar Maintenance Fluid (calcMaintenanceMlPerHr exported from app.js)
test('Holliday-Segar Maintenance Fluid: 8 kg infant (800 mL/day -> 33.3 mL/hr)', () => {
  assert.strictEqual(appExports.calcMaintenanceMlPerHr(8), 33.3);
});

test('Holliday-Segar Maintenance Fluid: 15 kg child (1250 mL/day -> 52.1 mL/hr)', () => {
  assert.strictEqual(appExports.calcMaintenanceMlPerHr(15), 52.1);
});

test('Holliday-Segar Maintenance Fluid: 25 kg child (1600 mL/day -> 66.7 mL/hr)', () => {
  assert.strictEqual(appExports.calcMaintenanceMlPerHr(25), 66.7);
});

// 3. Test Procedural Sedation (PSA) Fentanyl Dosing from Dataset
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

// 4. Test PALS Epinephrine & Defibrillation
test('PALS Epinephrine: 10 kg child (0.01 mg/kg = 0.1 mg)', () => {
  const pals = dataset.pals;
  const doseMg = pals.epiArrest.dose_mgPerKg * 10;
  assert.strictEqual(doseMg, 0.1);
});

test('PALS Defibrillation: 10 kg child (2-4 J/kg initial, max 4 J/kg)', () => {
  const pals = dataset.pals;
  const minJ = pals.defib.first_JPerKg * 10;
  const maxJ = pals.defib.next_JPerKg * 10;
  assert.strictEqual(minJ, 20);
  assert.strictEqual(maxJ, 40);
});

// 5. Test Antibiotic (ATB) Dosing
test('ATB Ampicillin: 10 kg child, 25 mg/kg/day div q6h = 62.5 mg/dose', () => {
  const item = dataset.pediatricATB.find(d => d.key === 'ampicillin-iv-im-unasyn');
  const w = 10;
  const dailyMg = item.doseMinMgPerKg * w;
  const perDose = dailyMg / 4;
  assert.strictEqual(dailyMg, 250);
  assert.strictEqual(perDose, 62.5);
});

// 6. Test Vital Signs Age Bands
test('Vitals: 5 year old HR normal 80-140', () => {
  const vs = dataset.vitalSignsRef.find(v => v.maxAgeYr >= 5 && v.minAgeYr <= 5);
  assert.strictEqual(vs.hrMin, 80);
  assert.strictEqual(vs.hrMax, 140);
});

// 7. Test Toxicology Naloxone
test('Toxicology Naloxone: 10 kg child (0.1 mg/kg = 1 mg)', () => {
  const item = dataset.toxicologyAntidotes.find(d => d.key === 'naloxone-antidote');
  const w = 10;
  const doseMg = item.doseMgPerKg * w;
  assert.strictEqual(doseMg, 1);
});

// 8. Test Broselow Zone Matching
test('Broselow: 18 kg child -> White zone', () => {
  const weight = 18;
  const band = dataset.broselow.find(b => weight >= b.min && weight <= b.max);
  assert.strictEqual(band.color, '🤍 White');
});

test('Broselow: 9.1 kg and 9.9 kg child -> Red zone', () => {
  const b91 = dataset.broselow.find(b => 9.1 >= b.min && 9.1 <= b.max);
  assert.strictEqual(b91.color, '❤️ Red');
  const b99 = dataset.broselow.find(b => 9.9 >= b.min && 9.9 <= b.max);
  assert.strictEqual(b99.color, '❤️ Red');
});

// 9. Test General Pediatric Dosing Dataset Capping
test('General Pediatric Dose: Paracetamol 80 kg max per dose capping (capped at 1000 mg)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'paracetamol-syrup-120-mg-5-ml');
  const w = 80;
  let maxMg = item.doseMaxMgPerKg * w;
  if (item.maxPerDoseMg && maxMg > item.maxPerDoseMg) {
    maxMg = item.maxPerDoseMg;
  }
  assert.strictEqual(maxMg, 1000);
});

test('General Pediatric Dose: Methylprednisolone loading dose (1–2 mg/kg, max 60 mg)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'methylprednisolone-iv-load');
  assert.strictEqual(item.doseMinMgPerKg, 1);
  assert.strictEqual(item.doseMaxMgPerKg, 2);
  assert.strictEqual(item.maxPerDoseMg, 60);
});

test('General Pediatric Dose: Methylprednisolone maintenance dose (0.5–1 mg/kg/dose q6h, max 60 mg, max 240 mg/day)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'methylprednisolone-iv-maint');
  assert.strictEqual(item.doseMinMgPerKg, 0.5);
  assert.strictEqual(item.doseMaxMgPerKg, 1);
  assert.strictEqual(item.freq, 'q 6 hr');
  assert.strictEqual(item.maxPerDoseMg, 60);
  assert.strictEqual(item.maxPerDayMg, 240);
});

test('General Pediatric Dose: Alum milk 20 kg child (0.5–1 mL/kg/dose -> 10–20 mL)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'aluminium-magnesium-hydroxide-susp');
  const w = 20;
  const minDose = item.doseMinMgPerKg * w;
  const maxDose = Math.min(item.doseMaxMgPerKg * w, item.maxPerDoseMg);
  assert.strictEqual(minDose, 10);
  assert.strictEqual(maxDose, 20);
  assert.strictEqual(item.unit, 'mL/kg');
});

test('General Pediatric Dose: Alum milk 40 kg child (0.5–1 mL/kg/dose -> capped at 30 mL/dose)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'aluminium-magnesium-hydroxide-susp');
  const w = 40;
  let minDose = item.doseMinMgPerKg * w;
  let maxDose = item.doseMaxMgPerKg * w;
  if (item.maxPerDoseMg) {
    minDose = Math.min(minDose, item.maxPerDoseMg);
    maxDose = Math.min(maxDose, item.maxPerDoseMg);
  }
  assert.strictEqual(minDose, 20);
  assert.strictEqual(maxDose, 30);
});

test('General Pediatric Dose: Lactulose 15 kg child (1–3 mL/kg/day -> 15–45 mL/day)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'lactulose-10g-5ml');
  const w = 15;
  const minDose = item.doseMinMgPerKg * w;
  const maxDose = Math.min(item.doseMaxMgPerKg * w, item.maxPerDayMg);
  assert.strictEqual(minDose, 15);
  assert.strictEqual(maxDose, 45);
  assert.strictEqual(item.unit, 'mL/kg');
});

test('General Pediatric Dose: Lactulose 25 kg child (1–3 mL/kg/day -> capped at 60 mL/day)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'lactulose-10g-5ml');
  const w = 25;
  let minDose = item.doseMinMgPerKg * w;
  let maxDose = item.doseMaxMgPerKg * w;
  if (item.maxPerDayMg) {
    minDose = Math.min(minDose, item.maxPerDayMg);
    maxDose = Math.min(maxDose, item.maxPerDayMg);
  }
  assert.strictEqual(minDose, 25);
  assert.strictEqual(maxDose, 60);
});

test('General Pediatric Dose: PEG Disimpaction 10 kg child (1 g/kg/day -> 10 g/day)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'peg-forlax-10g-sachet-disimpaction');
  const w = 10;
  const minDose = item.doseMinMgPerKg * w;
  const maxDose = item.doseMaxMgPerKg * w;
  assert.strictEqual(minDose, 10);
  assert.strictEqual(maxDose, 10);
  assert.strictEqual(item.unit, 'g/kg');
});

test('General Pediatric Dose: PEG Maintenance 10 kg child (0.5–1 g/kg/day -> 5–10 g/day)', () => {
  const item = dataset.pediatricDose.find(d => d.key === 'peg-forlax-10g-sachet-maint');
  const w = 10;
  const minDose = item.doseMinMgPerKg * w;
  const maxDose = item.doseMaxMgPerKg * w;
  assert.strictEqual(minDose, 5);
  assert.strictEqual(maxDose, 10);
  assert.strictEqual(item.unit, 'g/kg');
});

// 10. Test Seizure Protocol Dosing
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

// --- 📋 CLINICAL EHR ORDER DIVERGENCE TESTS (copyEHROrder WITH PRE-SEEDED INPUTS) ---

test('copyEHROrder("dose"): Paracetamol 10 kg patient pre-seeded in JSDOM', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  document.getElementById('doseDrug').value = 'paracetamol-syrup-120-mg-5-ml';
  
  window.eval('calcDose()'); // Trigger UI calculation
  const orderStr = window.copyEHROrder('dose');
  
  assert(orderStr.includes('[ER-PED]'), 'EHR order must start with [ER-PED] header');
  assert(orderStr.includes('Paracetamol'), 'EHR order must contain drug name');
  assert(orderStr.includes('150 mg'), 'EHR order max dose for 10 kg paracetamol must be 150 mg');
  assert(orderStr.includes('[BW: 10.0 kg]'), 'EHR order must include correct patient weight');
});

test('copyEHROrder("atb"): Ampicillin 10 kg patient pre-seeded in JSDOM', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  document.getElementById('atbDrug').value = 'ampicillin-iv-im-unasyn';
  
  window.eval('calcATB()');
  const orderStr = window.copyEHROrder('atb');
  
  assert(orderStr.includes('[ER-PED]'), 'EHR order must start with [ER-PED]');
  assert(orderStr.includes('Ampicillin'), 'EHR order must contain Ampicillin');
  assert(orderStr.includes('500 mg'), 'EHR order for 10 kg ampicillin (50 mg/kg max) must be 500 mg');
  assert(orderStr.includes('[BW: 10.0 kg]'), 'EHR order must state weight');
});

test('copyEHROrder("ncpr"): 3.0 kg newborn pre-seeded in JSDOM', () => {
  document.getElementById('nW').value = '3.0';
  
  window.eval('calcNCPR()');
  const orderStr = window.copyEHROrder('ncpr');
  
  const expected = '[ER-PED] NCPR Epinephrine (1:10,000) 0.060 mg (0.60 mL) IV/IO + 3 mL NS flush [Birth BW: 3.00 kg]';
  assert.strictEqual(orderStr, expected);
});

test('copyEHROrder("pals"): 10 kg child pre-seeded in JSDOM', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  
  window.eval('calcPALS()');
  const orderStr = window.copyEHROrder('pals');
  
  assert(orderStr.includes('PALS Epinephrine (1:10,000) 0.10 mg (1.0 mL) IV/IO'), 'PALS Epi dose string check');
  assert(orderStr.includes('Defib: 20 J'), 'PALS Defib energy check');
  assert(orderStr.includes('[BW: 10.0 kg]'), 'PALS weight check');
});

test('copyEHROrder("fluids"): 10 kg child with mild dehydration', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  document.getElementById('fDegree').value = 'Mild (4-5%)';
  document.getElementById('fPlan').value = '24 h';
  
  window.eval('calcFluids()');
  const orderStr = window.copyEHROrder('fluids');
  
  assert(orderStr.includes('[ER-PED] IV NS @'), 'Fluids EHR string check');
  assert(orderStr.includes('(Mnt: 41.7 mL/hr + Deficit: 16.7 mL/hr over 24 h)'), 'Fluids breakdown check');
});

test('copyEHROrder("drip"): Epinephrine drip 10 kg child', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  document.getElementById('dripDrug').value = 'epinephrine-drip';
  
  window.eval('calcDrip()');
  const orderStr = window.copyEHROrder('drip');
  
  assert(orderStr.includes('[ER-PED Drip] Epinephrine Infusion'), 'Drip name check');
  assert(orderStr.includes('[BW: 10.0 kg]'), 'Drip weight check');
});

test('copyEHROrder("dka"): 10 kg child DKA protocol', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  document.getElementById('dkaSeverity').value = '7';
  document.getElementById('dkaPriorBolus').value = '0';
  
  window.eval('calcDKA()');
  const orderStr = window.copyEHROrder('dka');
  
  assert(orderStr.includes('[ER-PED DKA] IV 0.9% NS @'), 'DKA EHR header check');
  assert(orderStr.includes('Regular Insulin Drip (1 U/mL) @ 1.0 mL/hr'), 'DKA insulin drip rate check');
  assert(orderStr.includes('[BW: 10.0 kg]'), 'DKA weight check');
});

// --- UI/UX UPGRADE SUITES ---

test('Category Jump Navigation: filterNavCategory filters visibility and switches tab', () => {
  window.eval('filterNavCategory("resus")');
  const palsBtn = document.querySelector('.tab-btn[data-tab="pals"]');
  const doseBtn = document.querySelector('.tab-btn[data-tab="dose"]');
  assert.strictEqual(palsBtn.style.display, 'inline-flex', 'PALS button should be visible in resus category');
  assert.strictEqual(doseBtn.style.display, 'none', 'Dose button should be hidden in resus category');

  // Reset to all
  window.eval('filterNavCategory("all")');
  assert.strictEqual(doseBtn.style.display, 'inline-flex', 'Dose button should be visible in all category');
});

test('Combobox Category Filtering: Dose & ATB category filter updates dropdown options', () => {
  window.eval('setDoseCategoryFilter("antipyretic")');
  const dropdown = document.getElementById('doseComboboxDropdown');
  assert(dropdown.innerHTML.includes('Paracetamol') || dropdown.innerHTML.includes('Ibuprofen'), 'Dropdown should contain antipyretics');
  assert(!dropdown.innerHTML.includes('Salbutamol'), 'Dropdown should NOT contain Salbutamol under antipyretic category');

  window.eval('setDoseCategoryFilter("all")');
});

test('Search Match Highlighting: highlightMatch escapes HTML and wraps matches with mark', () => {
  const res = window.highlightMatch('Paracetamol Syrup', 'para');
  assert(res.includes('<mark class="search-match">Para</mark>cetamol Syrup'), 'Match should be wrapped in mark.search-match');
  
  const xssTest = window.highlightMatch('<script>alert(1)</script> Paracetamol', 'para');
  assert(!xssTest.includes('<script>'), 'HTML must be escaped to prevent XSS');
  assert(xssTest.includes('&lt;script&gt;'), 'Raw HTML must be entity encoded');
});

test('Broselow 9-Band Spectrum: previewBroselowZone updates preview weight and color', () => {
  window.eval('fillBroselowContent(10, "Purple")');
  const out = document.getElementById('broselowContent');
  assert(out.innerHTML.includes('Broselow Zone: Purple (10–11.9 kg)'), 'Broselow zone title check');
  assert(out.innerHTML.includes('EPINEPHRINE ARREST'), 'Hero metric check');
  assert(out.innerHTML.includes('broselow-spectrum-bar'), 'Spectrum bar check');
});

test('Asthma Protocol: HFNC calculations for 10 kg child', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  window.eval('calcAsthma()');
  
  const out = document.getElementById('asthmaOut');
  assert(out.innerHTML.includes('HFNC Settings (10.0 kg)'), 'HFNC title check');
  assert(out.innerHTML.includes('20 L/min'), 'Flow rate 2 L/kg/min = 20 L/min check');
  assert(out.innerHTML.includes('40%'), 'FiO2 start check');
  assert(out.innerHTML.includes('37°C'), 'Temperature 37C check');
  assert(out.innerHTML.includes('2.5 L/min'), 'NEB during HFNC 0.25 L/kg/min = 2.5 L/min check');
});

test('Asthma Protocol: Weight-based drug dosing for 10 kg child', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  window.eval('calcAsthma()');
  
  const out = document.getElementById('asthmaOut');
  assert(out.innerHTML.includes('Salbutamol Nebulization'), 'Salbutamol NEB check');
  assert(out.innerHTML.includes('2.5 mg'), 'Salbutamol min floor 2.5 mg check for 10 kg');
  assert(out.innerHTML.includes('250 mcg'), 'Ipratropium <20kg threshold check (250 mcg)');
  assert(out.innerHTML.includes('10 mg'), 'Prednisolone 1 mg/kg = 10 mg check');
  assert(out.innerHTML.includes('500 mg'), 'MgSO4 50 mg/kg = 500 mg check');
  assert(out.innerHTML.includes('0.1 mg'), 'Epinephrine 0.01 mg/kg = 0.1 mg check');
});

test('Standalone Footer Integrity: footer is direct child of container and not trapped inside tab sections', () => {
  const footer = document.querySelector('footer.app-footer');
  assert(footer !== null, 'Footer element footer.app-footer must exist');
  assert.strictEqual(footer.parentElement.classList.contains('container'), true, 'Footer must be a direct child of .container');
  
  const sections = Array.from(document.querySelectorAll('section[role="tabpanel"]'));
  assert.strictEqual(sections.length, 12, 'Must have 12 clinical tabpanel sections');
  sections.forEach(section => {
    assert.strictEqual(section.contains(footer), false, `Section #${section.id} must NOT contain the footer`);
  });
  
  // Verify footer content contains credit and attribution links
  assert(footer.innerHTML.includes('ER-PED Workstation'), 'Footer must contain ER-PED Workstation branding');
  assert(footer.innerHTML.includes('ped-tsh.web.app'), 'Footer must contain ped-tsh.web.app attribution');
  assert(footer.innerHTML.includes('openChangelogModal'), 'Footer must have changelog button');
  assert(footer.innerHTML.includes('openDatasetEditor'), 'Footer must have dataset editor button');
  assert(footer.innerHTML.includes('triggerPrintCard'), 'Footer must have printable card button');
});

// --- ADVANCED CLINICAL ENGINE & EDGE CASE TEST SUITES ---

test('Airway Sizing: ETT, blade, depth for various pediatric weights', () => {
  const { suggestBlade, weightToETTCuffed, weightToETTUncuffed, weightToDepth } = appExports;
  
  // 3 kg neonate
  assert.strictEqual(weightToETTCuffed(3), '3.0');
  assert.strictEqual(weightToETTUncuffed(3), '3.5');
  assert.strictEqual(weightToDepth(3), '9.0');
  assert.strictEqual(suggestBlade(3), '0–1 straight');

  // 10 kg toddler
  assert.strictEqual(weightToETTCuffed(10), '4.0');
  assert.strictEqual(weightToETTUncuffed(10), '4.5');
  assert.strictEqual(weightToDepth(10), '12.0');
  assert.strictEqual(suggestBlade(10), '1–1.5 straight');

  // 20 kg child
  assert.strictEqual(weightToETTCuffed(20), '5.5');
  assert.strictEqual(suggestBlade(20), '2 straight/curved');

  // 40 kg adolescent
  assert.strictEqual(weightToETTCuffed(40), '7.0');
  assert.strictEqual(suggestBlade(40), '3');
});

test('DKA Calculation: 10 kg child 7% dehydration, 0 prior bolus, BG 350', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  document.getElementById('dkaSeverity').value = '7';
  document.getElementById('dkaPriorBolus').value = '0';
  document.getElementById('dkaBG').value = '350';
  
  window.eval('calcDKA()');
  const out = document.getElementById('dkaOut');
  
  // Total deficit = 10 * 7 * 10 = 700 mL / 48h = 14.58 mL/hr
  // Mnt = 41.67 mL/hr (1000 mL/day)
  // Total fluid = 41.67 + 14.58 = 56.3 mL/hr
  assert(out.innerHTML.includes('56.3 mL/hr'), 'Total fluid rate check (56.3 mL/hr)');
  assert(out.innerHTML.includes('1.0 mL/hr'), 'Regular insulin drip rate (1.0 U/hr)');
  assert(out.innerHTML.includes('100 mL'), 'Initial NS resus bolus 10 mL/kg = 100 mL');
  assert(!out.innerHTML.includes('Switch IV fluid to D5'), 'Should not trigger dextrose warning at BG 350');
});

test('DKA Dextrose Alert: BG 180 (<250 mg/dL) triggers D5 0.45% NS warning', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  document.getElementById('dkaBG').value = '180';
  
  window.eval('calcDKA()');
  const out = document.getElementById('dkaOut');
  assert(out.innerHTML.includes('Switch IV fluid to D5 0.45% NS + 20 mEq/L KCl immediately'), 'Dextrose warning must appear');
});

test('Drip Calculator: Epinephrine infusion 10 kg, dose 0.1 mcg/kg/min', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  document.getElementById('dripDrug').value = 'epinephrine-drip';
  
  window.eval('calcDrip()');
  const out = document.getElementById('dripOut');
  
  // 0.1 mcg/kg/min * 10 kg = 1 mcg/min = 60 mcg/hr
  // Standard prep: 1 mg (1000 mcg) in 50 mL = 20 mcg/mL
  // Rate: 60 / 20 = 3.0 mL/hr
  assert(out.innerHTML.includes('3.0 mL/hr'), 'Infusion rate check 3.0 mL/hr');
  assert(out.innerHTML.includes('0.10 mcg/kg/min'), 'Dose readout check');
});

test('Drip Calculator: Zero or invalid volume inputs do not crash or produce Infinity', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  document.getElementById('dripDrug').value = 'epinephrine-drip';
  document.getElementById('dripPrepVolMl').value = '0';
  
  window.eval('calcDrip()');
  const out = document.getElementById('dripOut');
  assert(!out.innerHTML.includes('Infinity'), 'Drip calculator must never produce Infinity');
  assert(!out.innerHTML.includes('NaN'), 'Drip calculator must never produce NaN');
});

test('Vital Signs Quick Text & Age Bracket Summary syncs correctly', () => {
  document.getElementById('age').value = '5';
  window.eval('estimateFromAge()');
  window.eval('calcVitals()');
  
  const quick = document.getElementById('vitalsQuickText');
  assert(quick.textContent.includes('HR 80–140'), 'Quick text HR check');
  assert(quick.textContent.includes('RR 22–34'), 'Quick text RR check');
});

test('Navigation showTab() toggles active-panel class on section panels for print isolation', () => {
  window.eval('showTab("asthma")');
  const asthmaSection = document.getElementById('asthma');
  const doseSection = document.getElementById('dose');
  
  assert.strictEqual(asthmaSection.classList.contains('active-panel'), true, 'Asthma section must have .active-panel');
  assert.strictEqual(doseSection.classList.contains('active-panel'), false, 'Dose section must NOT have .active-panel');
  
  // Switch back to dose
  window.eval('showTab("dose")');
  assert.strictEqual(doseSection.classList.contains('active-panel'), true, 'Dose section must have .active-panel');
  assert.strictEqual(asthmaSection.classList.contains('active-panel'), false, 'Asthma section must NOT have .active-panel');
});

test('Edge Case: Zero weight triggers prompt across all clinical modules', () => {
  document.getElementById('weight').value = '';
  window.eval('onWeightChange()');
  
  ['calcDose', 'calcATB', 'calcFluids', 'calcPALS', 'calcDrip', 'calcSeizure', 'calcTox', 'calcPSA', 'calcDKA', 'calcAsthma'].forEach(fn => {
    window.eval(`${fn}()`);
  });
  
  assert(document.getElementById('dripOut').innerHTML.includes('กรุณากรอกน้ำหนักตัว'), 'Drip zero weight guard');
  assert(document.getElementById('dkaOut').innerHTML.includes('กรุณากรอกน้ำหนักตัว'), 'DKA zero weight guard');
  assert(document.getElementById('psaOut').innerHTML.includes('กรุณากรอกน้ำหนักตัว'), 'PSA zero weight guard');
  assert(document.getElementById('seizureOut').innerHTML.includes('กรุณากรอกน้ำหนักตัว'), 'Seizure zero weight guard');
});

test('Version Auto-Sync: applyVersionToUI dynamically updates footer badge and changelog version targets', () => {
  const { applyVersionToUI } = appExports;
  
  applyVersionToUI('1.9.5');
  
  const chip = document.getElementById('footerVersionChip');
  const titleVer = document.getElementById('changelogVersionNumber');
  const whatsNewVer = document.getElementById('changelogWhatsNewVersion');
  
  assert.strictEqual(chip.textContent, 'v1.9.5', 'Footer chip must reflect version v1.9.5');
  assert.strictEqual(titleVer.textContent, '1.9.5', 'Changelog title must reflect version 1.9.5');
  assert.strictEqual(whatsNewVer.textContent, '1.9.5', 'Whats new header must reflect version 1.9.5');
  
  // Revert back to 1.9.2
  applyVersionToUI('1.9.2');
  assert.strictEqual(chip.textContent, 'v1.9.2', 'Reverted footer chip must be v1.9.2');
});

test('Version Auto-Sync: syncVersionFromSW picks highest/latest version when multiple cache keys exist', () => {
  const { syncVersionFromSW } = appExports;
  
  global.caches = {
    keys: () => Promise.resolve(['er-ped-v1.7.0-20260815', 'er-ped-v1.9.2-20260821', 'er-ped-v1.8.0-20260818'])
  };

  syncVersionFromSW();
  
  // Test using Promise microtask resolution
  return Promise.resolve().then(() => {
    const chip = document.getElementById('footerVersionChip');
    assert.strictEqual(chip.textContent, 'v1.9.2', 'Footer chip must resolve to the latest cache version v1.9.2');
    delete global.caches;
  });
});

test('NCPR Calculator: Blood Glucose (nBG) input dynamically guides hypoglycemia vs normoglycemia', () => {
  document.getElementById('nW').value = '3.0';
  document.getElementById('nGA').value = '38';
  
  // 1. Hypoglycemia (< 40 mg/dL)
  document.getElementById('nBG').value = '28';
  window.eval('calcNCPR()');
  let out = document.getElementById('nOut').innerHTML;
  assert(out.includes('🚨 Hypoglycemia Alert (BG 28 mg/dL &lt; 40 mg/dL)'), 'Hypoglycemia alert check');
  assert(out.includes('6.0 mL D10W IV bolus over 2 min'), 'D10W bolus 2 mL/kg check');
  assert(out.includes('10.5 mL/hr infusion'), 'D10W infusion 3.5 mL/kg/hr check');

  // 2. Normoglycemia (>= 40 mg/dL)
  document.getElementById('nBG').value = '55';
  window.eval('calcNCPR()');
  out = document.getElementById('nOut').innerHTML;
  assert(out.includes('Blood Glucose (55 mg/dL):</strong> Normoglycemia (≥ 40 mg/dL)'), 'Normoglycemia check');

  // 3. Unspecified (empty)
  document.getElementById('nBG').value = '';
  window.eval('calcNCPR()');
  out = document.getElementById('nOut').innerHTML;
  assert(out.includes('Hypoglycemia Protocol:</strong> 6.0 mL D10W IV bolus over 2 min, then 10.5 mL/hr infusion if BG &lt; 40 mg/dL'), 'Default protocol check');
});

console.log(`\n----------------------------------------`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`----------------------------------------\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

