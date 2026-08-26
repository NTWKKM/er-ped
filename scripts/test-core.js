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
  'doseOut', 'nOut', 'atbOut', 'pOut', 'fOut', 'dripOut', 'seizureOut', 'dkaOut', 'psaOut', 'vitalsOut', 'asthmaOut', 'lyteOut',
  'doseDrug', 'atbDrug', 'dripDrug', 'weight', 'age', 'nW', 'fDegree', 'fPlan',
  'dkaSeverity', 'dkaPriorBolus', 'useIBW', 'ibwVal', 'vitalsQuickText', 'a2hsBtn',
  'lyteNa', 'lyteGlucose', 'lyteTotalCa', 'lyteAlbumin', 'lyteK', 'lytePH',
  'evidenceBackdrop', 'evidencePanel', 'evidenceSearchInput', 'evidenceCategorySelect', 'evidenceListContainer'
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
  assert.strictEqual(sections.length, 13, 'Must have 13 clinical tabpanel sections');
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
    assert.strictEqual(chip.textContent, 'v1.10.0', 'Footer chip must resolve to the latest cache version v1.10.0');
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

// --- ELECTROLYTE IMBALANCE & CLINICAL CALCULATORS SUITE ---

test('Electrolytes: Corrected Sodium (Katz vs ISPAD formulas)', () => {
  const katz = appExports.calcCorrectedNa(130, 350, 'katz');
  const ispad = appExports.calcCorrectedNa(130, 350, 'ispad');
  assert.strictEqual(katz, 134.0, 'Katz 1.6 factor: 130 + 1.6 * (250/100) = 134.0');
  assert.strictEqual(ispad, 135.0, 'ISPAD 2.0 factor: 130 + 2.0 * (250/100) = 135.0');
  // Normal glucose
  assert.strictEqual(appExports.calcCorrectedNa(135, 90), 135, 'Glucose <= 100 should not modify Na');
});

test('Electrolytes: Corrected Calcium for Hypoalbuminemia (Payne formula)', () => {
  const corrCa = appExports.calcCorrectedCa(7.2, 2.5);
  // 7.2 + 0.8 * (4.0 - 2.5) = 7.2 + 1.2 = 8.4 mg/dL
  assert.strictEqual(Math.round(corrCa * 10) / 10, 8.4, 'Payne formula: 7.2 + 0.8 * 1.5 = 8.4 mg/dL');
});

test('Electrolytes: Potassium pH shift baseline estimation', () => {
  const estK = appExports.calcKShift(4.0, 7.10);
  // pH 7.10 -> deltaPh = 0.30 -> estK = 4.0 - (0.30 * 6.0) = 4.0 - 1.8 = 2.2 mEq/L
  assert.strictEqual(Math.round(estK * 10) / 10, 2.2, 'pH 7.10 with K 4.0 shifts to baseline ~2.2 mEq/L at pH 7.40');
});

test('Electrolytes: Total Sodium Deficit in Hyponatremia', () => {
  // 10 kg child (TBW 60% = 6 L), Measured Na 120, Target Na 135
  const deficit = appExports.calcNaDeficit(10, 120, 135, 5);
  assert.strictEqual(deficit, 90, 'Na Deficit = 6 L * 15 mEq/L = 90 mEq');
});

test('Electrolytes: Free Water Deficit in Hypernatremia', () => {
  // 10 kg child (TBW 60% = 6 L), Measured Na 160, Target Na 140
  const deficit = appExports.calcFreeWaterDeficit(10, 160, 140, 5);
  // 6 * (160/140 - 1) = 6 * (20/140) = 6 * 0.142857 = 0.8571 L
  assert(deficit > 0.85 && deficit < 0.86, 'Free water deficit should be ~0.857 L');
});

test('Electrolytes: Bicarbonate Deficit in Acidosis', () => {
  // 10 kg child, Measured HCO3 8, Target 15
  const deficit = appExports.calcBicarbonateDeficit(10, 8, 15);
  // 10 * 0.3 * (15 - 8) = 3 * 7 = 21 mEq
  assert.strictEqual(deficit, 21, 'HCO3 Deficit = 10 * 0.3 * 7 = 21 mEq');
});

test('Electrolytes: Anion Gap, Albumin-Corrected AG, and Delta Ratio', () => {
  // Na 140, Cl 100, HCO3 15 -> AG = 25
  const ag = appExports.calcAnionGap(140, 100, 15);
  assert.strictEqual(ag, 25, 'AG = 140 - (100 + 15) = 25 mEq/L');

  // Albumin 2.0 g/dL -> Corr AG = 25 + 2.5 * (4.0 - 2.0) = 30.0
  const corrAG = appExports.calcCorrectedAnionGap(ag, 2.0);
  assert.strictEqual(corrAG, 30.0, 'Corrected AG = 25 + 5.0 = 30.0 mEq/L');

  // Delta Ratio: (25 - 12) / (24 - 15) = 13 / 9 = 1.44 (Pure High AG)
  const deltaRatio = appExports.calcDeltaRatio(ag, 15);
  assert(deltaRatio > 1.43 && deltaRatio < 1.45, 'Delta ratio should be ~1.44');
});

test('Electrolytes: Osmolality, Effective Tonicity & Osmolar Gap', () => {
  // Na 140, Glucose 180, BUN 28 -> Calc Osm = 280 + 10 + 10 = 300
  const osm = appExports.calcOsmolality(140, 180, 28);
  assert.strictEqual(osm, 300, 'Calculated Osm = 280 + 10 + 10 = 300 mOsm/kg');

  const effTonicity = appExports.calcEffectiveTonicity(140, 180);
  assert.strictEqual(effTonicity, 290, 'Effective Tonicity = 280 + 10 = 290 mOsm/kg');

  // Measured Osm 325 -> Osm Gap = 25 (> 10 Toxic Alcohol risk)
  const gap = appExports.calcOsmolarGap(325, osm);
  assert.strictEqual(gap, 25, 'Osmolar Gap = 325 - 300 = 25 mOsm/kg');
});

test('Electrolytes: FeNa, FeUrea, UAG, and TTKG renal indices', () => {
  // FeNa: UNa 20, SNa 140, UCr 100, SCr 1.0 -> (20 * 1.0) / (140 * 100) * 100 = 0.1428% (Prerenal)
  const fena = appExports.calcFeNa(20, 140, 100, 1.0);
  assert(fena > 0.14 && fena < 0.15, 'FeNa should be ~0.14%');

  // UAG: UNa 30, UK 20, UCl 80 -> (30 + 20) - 80 = -30 (GI loss)
  const uag = appExports.calcUAG(30, 20, 80);
  assert.strictEqual(uag, -30, 'UAG = (30 + 20) - 80 = -30 mEq/L');

  // TTKG: UK 40, SK 3.5, UOsm 600, SOsm 300 -> (40 * 300) / (3.5 * 600) = 12000 / 2100 = 5.71
  const ttkg = appExports.calcTTKG(40, 3.5, 600, 300);
  assert(ttkg > 5.70 && ttkg < 5.72, 'TTKG should be ~5.71');
});

test('Electrolytes: Hypokalemia IV and Oral KCl Replacement Calculators', () => {
  // 10 kg child
  const iv10 = appExports.calcIVKClReplacement(10, 0.5);
  assert.strictEqual(iv10.doseMeq, 5.0, '10 kg at 0.5 mEq/kg = 5.0 mEq');
  assert.strictEqual(iv10.kcl2MeqPerMl, 2.5, '5.0 mEq / 2 mEq/mL = 2.5 mL');
  assert.strictEqual(iv10.minVolPeripheralMl, 125, '5.0 mEq in 40 mEq/L conc = 125 mL');
  assert.strictEqual(iv10.minVolCentralMl, 63, '5.0 mEq in 80 mEq/L conc = 63 mL');
  assert.strictEqual(iv10.peripheralRateMlPerHr, 62.5, '125 mL / 2 hr = 62.5 mL/hr');
  assert.strictEqual(iv10.deliveryRateMeqPerKgPerHr, 0.25, 'Delivery rate 0.25 mEq/kg/hr');

  // 60 kg patient (safety ceiling cap at 20 mEq per dose for peripheral)
  const iv60 = appExports.calcIVKClReplacement(60, 0.5);
  assert.strictEqual(iv60.doseMeq, 20.0, '60 kg raw 30 mEq capped at 20 mEq max');
  assert.strictEqual(iv60.minVolPeripheralMl, 500, '20 mEq in 40 mEq/L conc = 500 mL');

  // Oral KCl: 10 kg child at 1.5 mEq/kg/day
  const oral10 = appExports.calcOralKClReplacement(10, 1.5);
  assert.strictEqual(oral10.dailyMeq, 15.0, '10 kg at 1.5 mEq/kg/day = 15.0 mEq/day');
  assert.strictEqual(oral10.tidDoseMeq, 5.0, '15 mEq / 3 = 5.0 mEq/dose');
  assert.strictEqual(oral10.kcl10PctSyrupMlPerDose, 3.7, '5.0 mEq / 1.34 mEq/mL = 3.7 mL');
});

test('Electrolytes UI Engine: 10 kg child with labs populated renders complete clinical cards and protocols', () => {
  document.getElementById('weight').value = '10';
  document.getElementById('age').value = '3';
  window.eval('onWeightChange()');

  document.getElementById('lyteNa').value = '130';
  document.getElementById('lyteGlucose').value = '350';
  document.getElementById('lyteTotalCa').value = '7.2';
  document.getElementById('lyteAlbumin').value = '2.5';
  document.getElementById('lyteK').value = '4.0';
  document.getElementById('lytePH').value = '7.10';
  document.getElementById('lyteCl').value = '98';
  document.getElementById('lyteHCO3').value = '12';

  window.eval('calcElectrolytes()');
  const out = document.getElementById('lyteOut').innerHTML;

  // 1. Quick Correctors
  assert(out.includes('134.0'), 'Corrected Na Katz 134.0 check');
  assert(out.includes('135.0'), 'Corrected Na ISPAD 135.0 check');
  assert(out.includes('8.4'), 'Corrected Ca 8.4 check');
  assert(out.includes('2.2'), 'Estimated Baseline K+ 2.2 check');

  // 2. Emergency 3% NaCl Bolus
  assert(out.includes('30–50 mL'), '3% NaCl bolus 30–50 mL check for 10 kg child');

  // 3. Hyperkalemia 3-Step Cocktail
  assert(out.includes('5.0 mL'), '10% Calcium Gluconate 5.0 mL check for 10 kg');
  assert(out.includes('RI 1.0 U'), 'Regular Insulin 1.0 U check for 10 kg');
  assert(out.includes('D10W 50 mL'), 'D10W 50 mL check for 10 kg');

  // 4. Hypokalemia Protocol & Recipe
  assert(out.includes('KCl 5 mEq (2.5 mL)') || out.includes('KCl 5.0 mEq (2.5 mL)'), 'Hypokalemia IV dose check');
  assert(out.includes('125 mL'), 'Peripheral dilution volume ≥ 125 mL check');
  assert(out.includes('62.5 mL/hr'), 'Peripheral rate 62.5 mL/hr check');
  assert(out.includes('3.7 mL (5 mEq) PO tid pc') || out.includes('3.7 mL (5.0 mEq) PO tid pc'), 'Oral KCl syrup dose check');

  // 5. Age reference table
  assert(out.includes('Child (1–12 years)'), 'Reference table row check');
});

test('copyEHROrder("electrolytes"): Smart Context-Aware order strings for 10 kg patient', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');

  // Case 1: Symptomatic Hyponatremia (Na < 125) -> 3% NaCl order
  document.getElementById('lyteNa').value = '118';
  document.getElementById('lyteK').value = '4.0';
  window.eval('calcElectrolytes()');
  let orderStr = window.copyEHROrder('electrolytes');
  assert(orderStr.includes('[ER-PED Electrolyte] IV 3% NaCl 30–50 mL IV infusion over 20 min'), '3% NaCl emergency bolus order check');
  assert(orderStr.includes('[BW: 10.0 kg]'), 'Weight inclusion check');

  // Case 2: Severe Hypokalemia (K < 3.5) -> IV KCl Piggyback order
  document.getElementById('lyteNa').value = '136';
  document.getElementById('lyteK').value = '2.4';
  window.eval('calcElectrolytes()');
  orderStr = window.copyEHROrder('electrolytes');
  assert(orderStr.includes('[ER-PED Electrolyte] KCl 5 mEq (2.5 mL) in 0.9% NSS 125 mL IV slow piggyback @ 62.5 mL/hr over 2 hr') || orderStr.includes('[ER-PED Electrolyte] KCl 5.0 mEq (2.5 mL) in 0.9% NSS 125 mL IV slow piggyback @ 62.5 mL/hr over 2 hr'), 'IV KCl slow piggyback order check');

  // Case 3: Severe Hyperkalemia (K > 5.5) -> Hyperkalemia 3-Step Cocktail order
  document.getElementById('lyteK').value = '6.8';
  window.eval('calcElectrolytes()');
  orderStr = window.copyEHROrder('electrolytes');
  assert(orderStr.includes('[ER-PED Hyperkalemia] 10% Calcium Gluconate 5.0 mL IV over 5–10 min | Regular Insulin 1.0 U + D10W 50 mL IV over 30 min | Salbutamol neb 2.5 mg'), 'Hyperkalemia cocktail order check');
});

test('Electrolytes: interpretDeltaRatio logic correctly classifies mixed disorders and alkalosis', () => {
  const { interpretDeltaRatio } = appExports;
  
  // 1. High AG Acidosis + Metabolic Alkalosis (HCO3 >= 24)
  const alk = interpretDeltaRatio(20, 28);
  assert(alk.includes('Mixed High AG Acidosis + Metabolic Alkalosis'), 'HCO3 28 with AG 20 must classify as High AG + Metabolic Alkalosis');

  // 2. Pure Normal AG (Hyperchloremic) Acidosis (AG <= 12, HCO3 < 24)
  const normAG = interpretDeltaRatio(10, 14);
  assert(normAG.includes('Pure Normal AG (Hyperchloremic) Acidosis'), 'AG 10 with HCO3 14 must classify as Normal AG Acidosis');

  // 3. Pure High AG Acidosis (0.8 <= Ratio <= 2.0)
  const pureHigh = interpretDeltaRatio(25, 14);
  assert(pureHigh.includes('Pure High AG Metabolic Acidosis'), 'AG 25 (deltaAG 13) with HCO3 14 (deltaHCO3 10) -> ratio 1.3 -> Pure High AG');

  // 4. Mixed High AG + Normal AG Acidosis (Ratio < 0.8)
  const mixedLow = interpretDeltaRatio(18, 8);
  assert(mixedLow.includes('Mixed High AG + Normal AG Acidosis'), 'AG 18 (deltaAG 6) with HCO3 8 (deltaHCO3 16) -> ratio 0.375 -> Mixed High AG + Normal AG');
});

test('Electrolytes UI Engine: Non-blocking progressive disclosure with zero weight', () => {
  document.getElementById('weight').value = '';
  window.eval('onWeightChange()');

  document.getElementById('lyteNa').value = '130';
  document.getElementById('lyteGlucose').value = '350';
  document.getElementById('lyteTotalCa').value = '7.2';
  document.getElementById('lyteAlbumin').value = '2.5';
  document.getElementById('lyteK').value = '4.0';
  document.getElementById('lytePH').value = '7.10';
  document.getElementById('lyteCl').value = '98';
  document.getElementById('lyteHCO3').value = '12';

  window.eval('calcElectrolytes()');
  const out = document.getElementById('lyteOut').innerHTML;

  // Weight-independent calculations must render without screen wiping
  assert(out.includes('134.0'), 'Corrected Na Katz renders with zero weight');
  assert(out.includes('135.0'), 'Corrected Na ISPAD renders with zero weight');
  assert(out.includes('8.4'), 'Corrected Ca renders with zero weight');
  assert(out.includes('2.2'), 'Estimated Baseline K+ renders with zero weight');
  assert(out.includes('Normal Reference Ranges by Age'), 'Reference table renders with zero weight');

  // Weight-dependent sections must show localized prompts
  assert(out.includes('กรุณากรอกน้ำหนักตัว (ABW)'), 'Section 2 and 4 localized weight warning prompt check');
});

test('Electrolytes UI Engine: Section 4C Acute Hypocalcemia & Hypomagnesemia Resuscitation Protocols', () => {
  document.getElementById('weight').value = '10';
  window.eval('onWeightChange()');
  window.eval('calcElectrolytes()');
  let out = document.getElementById('lyteOut').innerHTML;

  // 10 kg child
  assert(out.includes('4C. Acute Hypocalcemia') && out.includes('Hypomagnesemia Crisis Protocols (10.0 kg)'), 'Section 4C header check');
  assert(out.includes('10.0 mL'), '10% Calcium Gluconate 10.0 mL check (1.0 mL/kg)');
  assert(out.includes('1.0 mL'), '50% MgSO4 1.0 mL check (0.1 mL/kg)');

  // 40 kg child (safety caps)
  document.getElementById('weight').value = '40';
  window.eval('onWeightChange()');
  window.eval('calcElectrolytes()');
  out = document.getElementById('lyteOut').innerHTML;
  assert(out.includes('20.0 mL'), '10% Calcium Gluconate capped at 20.0 mL max');
  assert(out.includes('4.0 mL'), '50% MgSO4 capped at 4.0 mL max');
});

test('Electrolytes UI Engine: Free Water Deficit combined 48h rate and Bicarb 50% initial dose', () => {
  document.getElementById('weight').value = '10';
  document.getElementById('lyteNa').value = '160';
  document.getElementById('lyteHCO3').value = '10';
  window.eval('onWeightChange()');
  window.eval('calcElectrolytes()');
  const out = document.getElementById('lyteOut').innerHTML;

  // Free Water Deficit combined rate check (10 kg: Mnt 41.7 mL/hr + Deficit ~17.9 mL/hr = ~59.5 mL/hr)
  assert(out.includes('Total Rate:'), 'Combined 48h total fluid rate check');
  assert(out.includes('Mnt: 41.7'), 'Maintenance component display check');

  // Bicarbonate 50% initial dose check (10 kg * 0.3 * (15 - 10) = 15 mEq total -> 7.5 mEq initial 50% = ~8.4 mL 7.5% NaHCO3)
  assert(out.includes('15.0 mEq Total'), 'Total bicarb deficit check');
  assert(out.includes('Initial 50%: 7.5 mEq (8.4 mL 7.5% NaHCO3)'), 'Initial 50% bicarb dose check');
});

test('Evidence Registry: Structural & Clinical Integrity (AHA PALS 2025, GINA 2026, ISPAD 2024, NRP 9th Ed)', () => {
  const refs = dataset.evidenceReferences;
  assert(refs !== undefined && typeof refs === 'object', 'evidenceReferences object must exist in dataset');
  
  const expectedKeys = ['pals', 'ncpr', 'dka', 'asthma', 'seizure', 'fluids', 'electrolytes', 'toxicology', 'sedation', 'atb', 'dose', 'vitals', 'broselow', 'drips'];
  expectedKeys.forEach(k => {
    assert(refs[k], `Evidence registry missing key: ${k}`);
    assert(refs[k].title, `Evidence entry '${k}' missing title`);
    assert(refs[k].organization, `Evidence entry '${k}' missing organization`);
    assert(refs[k].year, `Evidence entry '${k}' missing year`);
    assert(refs[k].loe, `Evidence entry '${k}' missing LOE`);
    assert(refs[k].summary, `Evidence entry '${k}' missing summary`);
  });

  // Verify specific 2025/2026 guidelines
  assert(refs.pals.title.includes('2025') || String(refs.pals.year) === '2025', 'PALS must reference 2025 AHA Guidelines');
  assert(refs.asthma.title.includes('2026') || String(refs.asthma.year) === '2026', 'Asthma must reference GINA 2026 Guidelines');
  assert(refs.ncpr.title.includes('9th Edition') || refs.ncpr.organization.includes('AAP/AHA NRP'), 'NCPR must reference NRP 9th Edition');
  assert(refs.dka.organization.includes('ISPAD') && String(refs.dka.year) === '2024', 'DKA must reference ISPAD 2024 Guidelines');
  assert(refs.seizure.organization.includes('AES') && refs.seizure.title.includes('ESETT'), 'Seizure must reference AES / ESETT Guidelines');
  assert(refs.fluids.organization.includes('AAP') && (refs.fluids.title.includes('Intravenous Fluids') || refs.fluids.summary.includes('Isotonic')), 'Fluids must reference AAP Isotonic CPG');
});

test('PALS Resuscitation: Updated 2025 Defibrillation Cap & Atropine Ceilings', () => {
  assert(dataset.pals.defib.upper_JPerKg === 10, 'PALS Defibrillation upper limit must be 10 J/kg for refractory VF/pVT');
  assert(dataset.pals.atropine.maxSingle_mg_adolescent === 1, 'Adolescent single max dose for Atropine must be 1.0 mg');
  assert(dataset.pals.atropine.maxTotal_mg_adolescent === 2, 'Adolescent total max dose for Atropine must be 2.0 mg');
  assert(dataset.evidenceReferences.pals.summary.includes('20–30 bpm') || dataset.evidenceReferences.pals.summary.includes('2–3 sec'), 'PALS CPR ventilation rate updated to 20-30 bpm');
});

test('Evidence Modal UI Engine: openEvidenceModal, filterEvidenceList, and DOM Rendering', () => {
  // Test opening specific topic
  window.eval('openEvidenceModal("pals")');
  const backdrop = document.getElementById('evidenceBackdrop');
  assert(backdrop && !backdrop.classList.contains('hidden'), 'evidenceBackdrop must be visible after openEvidenceModal');
  
  const container = document.getElementById('evidenceListContainer');
  assert(container.innerHTML.includes('AHA PALS Guidelines') || container.innerHTML.includes('American Heart Association'), 'evidenceListContainer must render PALS evidence card');
  assert(container.innerHTML.includes('loe-badge'), 'LOE badge must be rendered');

  // Test category filtering
  const catSelect = document.getElementById('evidenceCategorySelect');
  catSelect.value = 'Respiratory Emergencies';
  window.eval('filterEvidenceList()');
  assert(container.innerHTML.includes('GINA 2026'), 'Filtered list must display GINA 2026 under Respiratory Emergencies');

  // Test keyword search
  const searchInput = document.getElementById('evidenceSearchInput');
  searchInput.value = 'ESETT';
  catSelect.value = 'all';
  window.eval('filterEvidenceList()');
  assert(container.innerHTML.includes('ESETT') && container.innerHTML.includes('Status Epilepticus'), 'Search must find ESETT trial card');

  // Test closing modal
  window.eval('closeEvidenceModal()');
  assert(backdrop.classList.contains('hidden'), 'evidenceBackdrop must have hidden class after closeEvidenceModal');
});

console.log(`\n----------------------------------------`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`----------------------------------------\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}


