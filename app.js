// --- PWA: register service worker & A2HS prompt ---
if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW reg skipped/failed:', err));
  });
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('a2hsBtn');
  if (btn) btn.style.display = 'inline-flex';
});

async function triggerA2HS(){
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  const btn = document.getElementById('a2hsBtn');
  if (btn) btn.style.display = 'none';
}

// --- Global State ---
let DS = null;
let gIBW = null;
let gUserABW = null;
let gIBWSource = null; // 'length', 'age', 'bw', or null
let gFluidType = 'NS';
let gAgeUnit = 'yr'; // 'yr' or 'mo'
let activeTab = 'dose';

// --- Dataset Loading (Robust dual-mode for web server & offline file:// execution) ---
function loadDataset() {
  if (window.ER_PED_DATASET) {
    DS = window.ER_PED_DATASET;
    initUI();
  } else {
    fetch('dataset.json')
      .then(r => r.json())
      .then(j => { DS = j; initUI(); })
      .catch(err => {
        console.error('Failed to load dataset.json via fetch:', err);
        if (window.ER_PED_DATASET) {
          DS = window.ER_PED_DATASET;
          initUI();
        } else {
          const app = document.getElementById('app');
          if (app) app.innerHTML = '<div class="card">Cannot load dataset.json</div>';
        }
      });
  }
}

window.addEventListener('DOMContentLoaded', loadDataset);

function initUI(){
  populateDrugs();
  initComboboxes();
  setupKeyboardShortcuts();
  calculateIBW();
  updateBiometricUIState();
}

// --------- IBW / Age & Length Weight Engine ---------

function toggleAgeUnit(){
  gAgeUnit = (gAgeUnit === 'yr') ? 'mo' : 'yr';
  const btn = document.getElementById('ageUnitBtn');
  const input = document.getElementById('age');
  if (btn) btn.textContent = (gAgeUnit === 'yr') ? 'Yr' : 'Mo';
  if (input) input.placeholder = (gAgeUnit === 'yr') ? '0 (yr)' : '0 (mo)';
  estimateFromAge();
}

// Weech weight estimation formula (Age-based)
function estimateWeightFromAge(ageVal, unit) {
  ageVal = Number(ageVal);
  if (!isFinite(ageVal) || ageVal <= 0) return null;
  
  const u = unit || gAgeUnit;
  let ageYr = ageVal;
  let ageMo = ageVal;

  if (u === 'mo') {
    ageYr = ageMo / 12;
  } else {
    ageMo = ageYr * 12;
  }

  // < 1 yr: Weech formula = (mo + 9) / 2
  if (ageYr < 1) {
    return Math.round(((ageMo + 9) / 2) * 10) / 10;
  }
  // 1–6 yr: 2 × age + 8
  if (ageYr <= 6) {
    return Math.round(ageYr * 2 + 8);
  }
  // > 6 yr: (7 × age - 5) / 2
  return Math.round((7 * ageYr - 5) / 2);
}

// Length-based weight estimation (Broselow length bands & McLaren formula)
function estimateWeightFromLength(lengthVal) {
  const len = Number(lengthVal);
  if (!isFinite(len) || len <= 0) return null;

  if (len < 46) {
    return Math.round((len * len * 1.65 / 1000) * 10) / 10;
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

function calculateIBW() {
  const lenInput = document.getElementById('length');
  const ageInput = document.getElementById('age');
  const lenVal = lenInput ? parseFloat(lenInput.value) : NaN;
  const ageVal = ageInput ? parseFloat(ageInput.value) : NaN;

  if (isFinite(lenVal) && lenVal > 0) {
    gIBW = estimateWeightFromLength(lenVal);
    gIBWSource = 'length';
  } else if (isFinite(ageVal) && ageVal > 0) {
    gIBW = estimateWeightFromAge(ageVal, gAgeUnit);
    gIBWSource = 'age';
  } else if (gUserABW && gUserABW > 0) {
    gIBW = gUserABW;
    gIBWSource = 'bw';
  } else {
    gIBW = null;
    gIBWSource = null;
  }

  updateIBWChipUI();
}

function updateIBWChipUI() {
  const el = document.getElementById('ibwVal');
  const src = document.getElementById('ibwSource');
  if (!gIBW) {
    if (el) el.textContent = '—';
    if (src) src.textContent = '';
    return;
  }
  if (el) el.textContent = `${Number(gIBW).toFixed(1)} kg`;
  if (src) {
    if (gIBWSource === 'length') src.textContent = '(Wt-for-Ht)';
    else if (gIBWSource === 'age') src.textContent = '(Weech est)';
    else if (gIBWSource === 'bw') src.textContent = '(=BW)';
    else src.textContent = '';
  }
}

function getAgeInYears(){
  const input = document.getElementById('age');
  const val = input ? parseFloat(input.value) : NaN;
  if (!isFinite(val) || val <= 0) return null;
  return (gAgeUnit === 'mo') ? (val / 12) : val;
}

// Holliday–Segar Maintenance Fluid Calculator (mL/hr)
function calcMaintenanceMlPerHr(weightKg) {
  weightKg = Number(weightKg);
  if (!weightKg || weightKg <= 0) return 0;
  let mlDay = 0;
  if (weightKg <= 10)      mlDay = weightKg * 100;
  else if (weightKg <= 20) mlDay = 1000 + (weightKg - 10) * 50;
  else                     mlDay = 1500 + (weightKg - 20) * 20;
  return +(mlDay / 24).toFixed(1);
}

// --------- Single Source of Truth Weight Engine ---------

function getWeight() {
  const isIBWChecked = document.getElementById('useIBW')?.checked || false;

  if (isIBWChecked) {
    if (gIBW && gIBW > 0) return gIBW;
    if (gUserABW && gUserABW > 0) return gUserABW;
  } else {
    if (gUserABW && gUserABW > 0) return gUserABW;
    if (gIBW && gIBW > 0) return gIBW;
  }

  return null;
}

function updateBiometricUIState() {
  const isIBWChecked = document.getElementById('useIBW')?.checked || false;
  const lenInput = document.getElementById('length');
  const weightInput = document.getElementById('weight');

  if (lenInput) {
    if (isIBWChecked) {
      lenInput.disabled = false;
      lenInput.classList.remove('disabled-input');
      lenInput.classList.add('highlight-input');
    } else {
      lenInput.disabled = true;
      lenInput.classList.remove('highlight-input');
      lenInput.classList.add('disabled-input');
    }
  }

  if (weightInput) {
    if (isIBWChecked && gIBW) {
      weightInput.value = Number(gIBW).toFixed(1);
    } else {
      weightInput.value = gUserABW !== null ? gUserABW.toString() : '';
    }
  }

  const w = getWeight();
  let wTxt = '— kg';
  if (w) {
    wTxt = isIBWChecked ? `${w.toFixed(1)} kg (IBW)` : `${w.toFixed(1)} kg`;
  }

  ['doseWBadge', 'atbWBadge', 'fWBadge', 'pWBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = wTxt;
  });

  refreshBroselowChip();
  calcAll();
}

function onWeightChange() {
  const weightInput = document.getElementById('weight');
  const useIBWBox = document.getElementById('useIBW');
  const val = weightInput ? parseFloat(weightInput.value) : NaN;

  // Auto OFF IBW if user types in Weight field
  if (useIBWBox && useIBWBox.checked) {
    useIBWBox.checked = false;
  }

  gUserABW = (isFinite(val) && val > 0) ? val : null;
  calculateIBW();
  updateBiometricUIState();
}

function estimateFromAge() {
  const useIBWBox = document.getElementById('useIBW');
  // Auto OFF IBW if user types in Age field
  if (useIBWBox && useIBWBox.checked) {
    useIBWBox.checked = false;
  }

  calculateIBW();
  updateBiometricUIState();
}

function updateIBW() {
  const lenInput = document.getElementById('length');
  const useIBWBox = document.getElementById('useIBW');
  const lenVal = lenInput ? parseFloat(lenInput.value) : NaN;

  // Auto ON IBW if user types in Length field
  if (isFinite(lenVal) && lenVal > 0) {
    if (useIBWBox && !useIBWBox.checked) {
      useIBWBox.checked = true;
    }
  }

  calculateIBW();
  updateBiometricUIState();
}

function applyIBWToBW() {
  const useIBWBox = document.getElementById('useIBW');
  const isChecked = useIBWBox?.checked || false;

  calculateIBW();
  updateBiometricUIState();

  if (isChecked) {
    const lenInput = document.getElementById('length');
    if (lenInput) lenInput.focus();
  }
}

function syncNCPRWithABW(){
  const w = getWeight();
  if (w) {
    const nWInput = document.getElementById('nW');
    if (nWInput) nWInput.value = w;
    calcNCPR();
    showToast(`Synced Birth Weight: ${w} kg`);
  } else {
    showToast('Please enter ABW in topbar first');
  }
}

// --------- Navigation & Shortcuts ---------

function showTab(id, btn) {
  activeTab = id;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const targetBtn = btn || document.querySelector(`.tab-btn[data-tab="${id}"]`);
  if (targetBtn) targetBtn.classList.add('active');
  
  ['dose','atb','fluids','pals','ncpr'].forEach(x => {
    const el = document.getElementById(x);
    if (el) el.style.display = (x === id) ? 'block' : 'none';
  });
  
  if (id === 'pals') {
    calcPALS();
    const palsEl = document.getElementById('pals');
    if (palsEl) palsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function setupKeyboardShortcuts(){
  document.addEventListener('keydown', (e) => {
    if (e.altKey) {
      if (e.key === '1') { e.preventDefault(); showTab('dose'); }
      if (e.key === '2') { e.preventDefault(); showTab('atb'); }
      if (e.key === '3') { e.preventDefault(); showTab('fluids'); }
      if (e.key === '4') { e.preventDefault(); showTab('pals'); }
      if (e.key === '5') { e.preventDefault(); showTab('ncpr'); }
      if (e.key.toLowerCase() === 'p') { e.preventDefault(); showTab('pals'); }
    }
    if (e.key === 'Escape') {
      closeAllComboboxes();
      const backdrop = document.getElementById('broselowBackdrop') || document.getElementById('broselowPanel');
      if (backdrop && !backdrop.classList.contains('hidden')) backdrop.classList.add('hidden');
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.combobox-wrapper')) {
      closeAllComboboxes();
    }
  });
}

// --------- Broselow Tape Reference Panel ---------

function broselowColor(w){
  if (!w || !DS || !DS.broselow) return '—';
  for (const b of DS.broselow){ if (w>=b.min && w<=b.max) return b.color; }
  return '—';
}

function colorSwatch(colorLabel){
  const base = (colorLabel || '').toString().trim().split(/\s+/).pop();
  const m = {
    'Grey':'#e5e7eb','Pink':'#ffd1dc','Red':'#fecaca','Purple':'#e9d5ff','Yellow':'#fef3c7',
    'White':'#ffffff','Blue':'#dbeafe','Orange':'#ffedd5','Green':'#dcfce7'
  };
  return m[base] || '#f3f4f6';
}

function refreshBroselowChip(){
  const w = getWeight() || gIBW || 0;
  const color = broselowColor(w);
  const chip = document.getElementById('broselow');
  if (!chip) return;
  chip.textContent = color || '—';
  chip.style.background = colorSwatch(color);
}

function toggleBroselowPanel(){
  const target = document.getElementById('broselowBackdrop') || document.getElementById('broselowPanel');
  if (!target) return;
  if (target.classList.contains('hidden')){
    fillBroselowContent();
    target.classList.remove('hidden');
  } else {
    target.classList.add('hidden');
  }
}

function handleBroselowBackdropClick(e){
  if (e.target && (e.target.id === 'broselowBackdrop' || e.target.classList.contains('drawer-backdrop'))){
    toggleBroselowPanel();
  }
}

function fillBroselowContent(){
  const w = getWeight() || gIBW || 0;
  const out = document.getElementById('broselowContent');
  if(!w){ if(out) out.textContent = 'กรอกน้ำหนักหรือ IBW ก่อนดูข้อมูล Broselow'; return; }

  const bands = (DS && DS.broselow) || [];
  const color = broselowColor(w);
  const entry = bands.find(b => typeof b.min==='number' && typeof b.max==='number' && w>=b.min && w<=b.max)
             || bands.find(b => b.color === color)
             || null;

  if (!entry){ if(out) out.textContent = 'ไม่พบช่วง Broselow ใน dataset'; return; }

  const bgSwatch = colorSwatch(color);
  const epiMg = (0.01 * w).toFixed(2);
  const epiMl = (0.01 * w / 0.1).toFixed(1);
  const defib1 = Math.round(2 * w);
  const defib2 = Math.round(4 * w);
  const fluidBolus = Math.round(20 * w);

  out.innerHTML = `
<div style="background:${bgSwatch}; padding:12px; border-radius:8px; border:1px solid var(--border-dark); margin-bottom:12px;">
  <strong style="font-size:16px; color:#1E1E1E;">🎨 Broselow Zone: ${color} (${entry.min}–${entry.max} kg)</strong>
  <div style="font-size:13px; margin-top:4px;">Patient Weight: <strong>${w.toFixed(1)} kg</strong></div>
</div>

<div class="hero-metric-grid">
  <div class="hero-metric danger">
    <div class="hero-label">EPINEPHRINE ARREST (1:10,000)</div>
    <div class="hero-val">${epiMg}<span class="unit">mg</span> (${epiMl}<span class="unit">mL IV/IO</span>)</div>
    <div class="hero-sub">Dose: 0.01 mg/kg q 3-5 min</div>
  </div>
  <div class="hero-metric blue">
    <div class="hero-label">DEFIBRILLATION DOSE</div>
    <div class="hero-val">${defib1} → ${defib2}<span class="unit">Joules</span></div>
    <div class="hero-sub">1st Shock: 2 J/kg | 2nd: 4 J/kg</div>
  </div>
  <div class="hero-metric good">
    <div class="hero-label">FLUID BOLUS (NS / RL)</div>
    <div class="hero-val">${fluidBolus}<span class="unit">mL</span></div>
    <div class="hero-sub">20 mL/kg rapid IV push</div>
  </div>
</div>

<div style="background:#FFFFFF; padding:14px; border-radius:8px; border:1px solid var(--border); margin-top:10px;">
  <strong>📐 Equipment & Resuscitation Specs:</strong>
  <ul style="margin:6px 0 0 18px; padding:0; line-height:1.7;">
    <li>ETT Size (Cuffed): <strong>${weightToETTCuffed(w)} mm</strong> | Uncuffed: <strong>${weightToETTUncuffed(w)} mm</strong></li>
    <li>ETT Insertion Depth: <strong>${weightToDepth(w)} cm</strong> at upper lip</li>
    <li>Laryngoscope Blade: <strong>${suggestBlade(null, w)}</strong></li>
    <li>OPA: <strong>${suggestOPA(w)} mm</strong> | NPA: <strong>${suggestNPA(w)} Fr</strong> | Suction: <strong>${suggestSuction(w)} Fr</strong></li>
    <li>NG Tube: <strong>${suggestNG(w)} Fr</strong> | Foley Catheter: <strong>${suggestFoley(w)} Fr</strong></li>
  </ul>
</div>
  `;
}

function weightToETTCuffed(kg){
  if (kg<6) return '3.0'; if (kg<9) return '3.5'; if (kg<12) return '4.0';
  if (kg<15) return '4.5'; if (kg<19) return '5.0'; if (kg<24) return '5.5';
  if (kg<30) return '6.0'; if (kg<36) return '6.5'; return '7.0';
}
function weightToETTUncuffed(kg){ const c = Number(weightToETTCuffed(kg)); return c ? (c+0.5).toFixed(1) : ''; }
function weightToDepth(kg){ const c = Number(weightToETTCuffed(kg)); return c ? (c*3).toFixed(1) : ''; }
function suggestBlade(age, kg){
  if (kg<10) return '0–1 straight'; if (kg<12) return '1–1.5 straight';
  if (kg<24) return '2 straight/curved'; return '3';
}
function suggestNG(kg){ if (kg<10) return '6–8'; if (kg<19) return '8–10'; if (kg<24) return '10–12'; return '12–14'; }
function suggestFoley(kg){ if (kg<10) return '6–8'; if (kg<19) return '8–10'; return '10–12'; }
function suggestOPA(kg){ if (kg<10) return '40–50'; if (kg<19) return '60'; if (kg<24) return '70'; return '80'; }
function suggestNPA(kg){ if (kg<10) return 14; if (kg<19) return 18; if (kg<24) return 20; return 24; }
function suggestSuction(kg){ if (kg<10) return '6–8'; if (kg<19) return '8'; return '10'; }

// --------- Integrated Braun Combobox Search Logic ---------

function populateDrugs(){
  renderDoseComboboxDropdown('');
  renderATBComboboxDropdown('');
  
  const doseArr = DS?.pediatricDose || [];
  const atbArr = DS?.pediatricATB || [];
  
  const doseSel = document.getElementById('doseDrug');
  const atbSel = document.getElementById('atbDrug');
  
  if (doseSel && doseArr.length) {
    doseSel.innerHTML = doseArr.map(d => `<option value="${d.key}">${d.name}</option>`).join('');
    doseSel.value = doseArr[0].key;
    document.getElementById('doseSearch').value = doseArr[0].name;
  }
  if (atbSel && atbArr.length) {
    atbSel.innerHTML = atbArr.map(d => `<option value="${d.key}">${d.name}</option>`).join('');
    atbSel.value = atbArr[0].key;
    document.getElementById('atbSearch').value = atbArr[0].name;
  }
}

function initComboboxes(){
  const doseInput = document.getElementById('doseSearch');
  const atbInput = document.getElementById('atbSearch');

  if (doseInput) {
    doseInput.addEventListener('input', () => onDoseSearchInput());
    doseInput.addEventListener('focus', () => openDoseCombobox());
  }
  if (atbInput) {
    atbInput.addEventListener('input', () => onATBSearchInput());
    atbInput.addEventListener('focus', () => openATBCombobox());
  }
}

function openDoseCombobox(){
  closeAllComboboxes();
  const dropdown = document.getElementById('doseComboboxDropdown');
  if (dropdown) dropdown.classList.add('open');
  renderDoseComboboxDropdown(document.getElementById('doseSearch').value);
}

function openATBCombobox(){
  closeAllComboboxes();
  const dropdown = document.getElementById('atbComboboxDropdown');
  if (dropdown) dropdown.classList.add('open');
  renderATBComboboxDropdown(document.getElementById('atbSearch').value);
}

function closeAllComboboxes(){
  document.querySelectorAll('.combobox-dropdown').forEach(d => d.classList.remove('open'));
}

function onDoseSearchInput(){
  const val = document.getElementById('doseSearch').value;
  openDoseCombobox();
  renderDoseComboboxDropdown(val);
}

function onATBSearchInput(){
  const val = document.getElementById('atbSearch').value;
  openATBCombobox();
  renderATBComboboxDropdown(val);
}

function selectDoseItem(key, name){
  const sel = document.getElementById('doseDrug');
  const input = document.getElementById('doseSearch');
  if (sel) sel.value = key;
  if (input) input.value = name;
  closeAllComboboxes();
  calcDose();
}

function selectATBItem(key, name){
  const sel = document.getElementById('atbDrug');
  const input = document.getElementById('atbSearch');
  if (sel) sel.value = key;
  if (input) input.value = name;
  closeAllComboboxes();
  calcATB();
}

function getDrugCategory(name){
  const n = (name || '').toLowerCase();
  if (n.includes('paracetamol') || n.includes('ibuprofen')) return 'Antipyretic / Analgesic';
  if (n.includes('diazepam') || n.includes('midazolam') || n.includes('phenobarbital')) return 'Anticonvulsant';
  if (n.includes('salbutamol') || n.includes('budesonide') || n.includes('prednisolone') || n.includes('dexamethasone')) return 'Respiratory';
  if (n.includes('domperidone') || n.includes('ondansetron') || n.includes('ors')) return 'GI / Anti-emetic';
  if (n.includes('cetirizine') || n.includes('chlorpheniramine') || n.includes('loratadine')) return 'Antihistamine';
  if (n.includes('amoxicillin') || n.includes('ceftriaxone') || n.includes('azithromycin') || n.includes('ampicillin')) return 'Antibiotic';
  return 'Medication';
}

function renderDoseComboboxDropdown(filterTxt){
  const dropdown = document.getElementById('doseComboboxDropdown');
  if (!dropdown) return;
  const list = DS?.pediatricDose || [];
  const q = (filterTxt || '').trim().toLowerCase();
  const currentKey = document.getElementById('doseDrug')?.value;

  const filtered = list.filter(d => {
    const name = (d.name || '').toLowerCase();
    const aliases = (d.aliases || []).join(' ').toLowerCase();
    return !q || name.includes(q) || aliases.includes(q);
  });

  if (!filtered.length) {
    dropdown.innerHTML = '<div class="combobox-item" style="color:var(--muted);">No matching medications</div>';
    return;
  }

  dropdown.innerHTML = filtered.map(d => {
    const selectedClass = (d.key === currentKey) ? 'selected' : '';
    const cat = getDrugCategory(d.name);
    return `
      <div class="combobox-item ${selectedClass}" onclick="selectDoseItem('${d.key}', '${d.name.replace(/'/g, "\\'")}')">
        <div>
          <strong>${d.name}</strong>
          <div style="font-size:11px; color:var(--muted);">${d.preparation || ''}</div>
        </div>
        <span class="item-tag">${cat}</span>
      </div>
    `;
  }).join('');
}

function renderATBComboboxDropdown(filterTxt){
  const dropdown = document.getElementById('atbComboboxDropdown');
  if (!dropdown) return;
  const list = DS?.pediatricATB || [];
  const q = (filterTxt || '').trim().toLowerCase();
  const currentKey = document.getElementById('atbDrug')?.value;

  const filtered = list.filter(d => {
    const name = (d.name || '').toLowerCase();
    const aliases = (d.aliases || []).join(' ').toLowerCase();
    return !q || name.includes(q) || aliases.includes(q);
  });

  if (!filtered.length) {
    dropdown.innerHTML = '<div class="combobox-item" style="color:var(--muted);">No matching antibiotics</div>';
    return;
  }

  dropdown.innerHTML = filtered.map(d => {
    const selectedClass = (d.key === currentKey) ? 'selected' : '';
    return `
      <div class="combobox-item ${selectedClass}" onclick="selectATBItem('${d.key}', '${d.name.replace(/'/g, "\\'")}')">
        <div>
          <strong>${d.name}</strong>
          <div style="font-size:11px; color:var(--muted);">${d.preparation || ''}</div>
        </div>
        <span class="item-tag">Antibiotic</span>
      </div>
    `;
  }).join('');
}

// --------- Formatting & Helper Utilities ---------

function fmt(n){ return (Math.abs(n) >= 10 ? Number(n).toFixed(0) : Number(n).toFixed(2)); }
function fmtMg(n){ return (n>=100 ? n.toFixed(0) : n.toFixed(1)); }
function fmtMl(n){ return (n>=10 ? n.toFixed(1) : n.toFixed(2)); }

function parseStrength(prepText){
  if (!prepText) return {};
  const s = String(prepText).replace(/\s+/g, ' ').trim();

  let m = s.match(/(\d+(?:\.\d+)?)\s*mg\s*\/\s*(\d+(?:\.\d+)?)\s*mL/i);
  if (m) {
    const mg = parseFloat(m[1]), ml = parseFloat(m[2]);
    if (mg>0 && ml>0) return { mgPerMl: mg/ml };
  }
  m = s.match(/(\d+(?:\.\d+)?)\s*mg\s*\/\s*5\s*mL/i);
  if (m) {
    const mg = parseFloat(m[1]);
    if (mg>0) return { mgPerMl: mg/5 };
  }
  m = s.match(/(\d+(?:\.\d+)?)\s*mg\s*\/\s*(?:tab|tablet|cap)/i);
  if (m) {
    const mg = parseFloat(m[1]);
    if (mg>0) return { mgPerTab: mg };
  }
  return {};
}

function dosesPerDayFromFreq(freq){
  if (!freq) return null;
  const m = String(freq).match(/q\s*(\d+)(?:[–-]\d+)?\s*h/i);
  if (!m) return null;
  const qh = parseFloat(m[1]);
  if (!(qh>0)) return null;
  return Math.max(1, Math.round(24 / qh));
}

function calcAll(){ calcDose(); calcATB(); calcFluids(); calcPALS(); calcNCPR(); }

// --------- 💊 Pediatric Dose Calculator ---------

function calcDose(){
  if (!DS) return;
  const key = document.getElementById('doseDrug')?.value;
  const bw = getWeight();
  const concOverride = parseFloat(document.getElementById('doseConc')?.value);
  const drug = (DS.pediatricDose||[]).find(d=>d.key===key) || (DS.pediatricDose||[])[0];
  const outEl = document.getElementById('doseOut');
  if (!drug){ if(outEl) outEl.textContent='No dataset available'; return; }

  const unit = drug.unit || 'mg/kg';
  let minPerKg = drug.doseMinMgPerKg ?? drug.dose ?? null;
  let maxPerKg = drug.doseMaxMgPerKg ?? drug.dose ?? null;

  const strength = parseStrength(drug.preparation || drug.name || '');
  const mgPerMl  = concOverride > 0 ? concOverride : (strength.mgPerMl || null);
  const mgPerTab = strength.mgPerTab || null;

  let perDoseMinMg = null, perDoseMaxMg = null, perDayMinMg = null, perDayMaxMg = null;
  let isCappedPerDose = false, isCappedPerDay = false;

  if (/mg\/kg\/day/i.test(unit) || drug.unitType === 'perDay') {
    if (bw && minPerKg!=null) perDayMinMg = bw * minPerKg;
    if (bw && maxPerKg!=null) perDayMaxMg = bw * maxPerKg;

    if (drug.maxPerDayMg && perDayMaxMg > drug.maxPerDayMg){
      isCappedPerDay = true;
      if (perDayMinMg!=null) perDayMinMg = Math.min(perDayMinMg, drug.maxPerDayMg);
      if (perDayMaxMg!=null) perDayMaxMg = Math.min(perDayMaxMg, drug.maxPerDayMg);
    }

    const nPerDay = dosesPerDayFromFreq(drug.freq);
    if (nPerDay){
      if (perDayMinMg!=null) perDoseMinMg = perDayMinMg / nPerDay;
      if (perDayMaxMg!=null) perDoseMaxMg = perDayMaxMg / nPerDay;
    }

    if (drug.maxPerDoseMg && perDoseMaxMg > drug.maxPerDoseMg){
      isCappedPerDose = true;
      if (perDoseMinMg!=null) perDoseMinMg = Math.min(perDoseMinMg, drug.maxPerDoseMg);
      if (perDoseMaxMg!=null) perDoseMaxMg = Math.min(perDoseMaxMg, drug.maxPerDoseMg);
    }
  } else {
    if (bw && minPerKg!=null) perDoseMinMg = bw * minPerKg;
    if (bw && maxPerKg!=null) perDoseMaxMg = bw * maxPerKg;

    if (drug.maxPerDoseMg && perDoseMaxMg > drug.maxPerDoseMg){
      isCappedPerDose = true;
      if (perDoseMinMg!=null) perDoseMinMg = Math.min(perDoseMinMg, drug.maxPerDoseMg);
      if (perDoseMaxMg!=null) perDoseMaxMg = Math.min(perDoseMaxMg, drug.maxPerDoseMg);
    }

    const nPerDay = dosesPerDayFromFreq(drug.freq);
    if (nPerDay){
      if (perDoseMinMg!=null) perDayMinMg = perDoseMinMg * nPerDay;
      if (perDoseMaxMg!=null) perDayMaxMg = perDoseMaxMg * nPerDay;
    }

    if (drug.maxPerDayMg && perDayMaxMg > drug.maxPerDayMg){
      isCappedPerDay = true;
      if (perDayMinMg!=null) perDayMinMg = Math.min(perDayMinMg, drug.maxPerDayMg);
      if (perDayMaxMg!=null) perDayMaxMg = Math.min(perDayMaxMg, drug.maxPerDayMg);
    }
  }

  function toRangeTxt(minVal, maxVal, fmtFn){
    if (minVal==null && maxVal==null) return '—';
    if (minVal!=null && maxVal!=null && Math.abs(maxVal-minVal) >= 0.5) {
      return `${fmtFn(minVal)}–${fmtFn(maxVal)}`;
    }
    const v = (maxVal!=null)? maxVal : minVal;
    return fmtFn(v);
  }

  let perDoseMlTxt = '', perDoseTabsTxt = '';

  if (mgPerMl){
    const minMl = (perDoseMinMg!=null)? perDoseMinMg / mgPerMl : null;
    const maxMl = (perDoseMaxMg!=null)? perDoseMaxMg / mgPerMl : null;
    const mlTxt = toRangeTxt(minMl, maxMl, n=>fmtMl(n));
    if (mlTxt !== '—') perDoseMlTxt = `${mlTxt} mL`;
  }
  if (mgPerTab){
    const minTab = (perDoseMinMg!=null)? perDoseMinMg / mgPerTab : null;
    const maxTab = (perDoseMaxMg!=null)? perDoseMaxMg / mgPerTab : null;
    const tabTxt = toRangeTxt(minTab, maxTab, n=> (n>=1 ? n.toFixed(1) : n.toFixed(2)));
    if (tabTxt !== '—') perDoseTabsTxt = `${tabTxt} tab`;
  }

  const perDoseMgTxt = toRangeTxt(perDoseMinMg, perDoseMaxMg, n=>`${fmtMg(n)} mg`);
  const perDayMgTxt  = toRangeTxt(perDayMinMg,  perDayMaxMg,  n=>`${fmtMg(n)} mg`);

  // Build Hero Metric Cards
  const title = (drug.name || drug.drug) || 'Medication';
  const heroCardHtml = `
<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
  <strong style="font-size:16px;">💊 ${title}</strong>
  <button class="btn-copy" onclick="copyEHROrder('dose')">📋 Copy EHR Order</button>
</div>
<div class="hero-metric-grid">
  <div class="hero-metric">
    <div class="hero-label">DOSE PER SINGLE DOSE</div>
    <div class="hero-val">${perDoseMgTxt}${perDoseMlTxt ? ` <span class="unit">(${perDoseMlTxt})</span>` : ''}${perDoseTabsTxt ? ` <span class="unit">(${perDoseTabsTxt})</span>` : ''}</div>
    <div class="hero-sub">${drug.freq ? drug.freq.toUpperCase() : 'PO/IV'} ${drug.route ? `(${drug.route})` : ''}</div>
    ${isCappedPerDose ? `<span class="badge-cap">⚠️ Capped at max ${drug.maxPerDoseMg} mg/dose</span>` : ''}
  </div>
  <div class="hero-metric blue">
    <div class="hero-label">TOTAL DAILY DOSE</div>
    <div class="hero-val">${perDayMgTxt}</div>
    <div class="hero-sub">Target for 24h period</div>
    ${isCappedPerDay ? `<span class="badge-cap">⚠️ Capped at max ${drug.maxPerDayMg} mg/day</span>` : ''}
  </div>
</div>
  `;

  const blocks = [];
  blocks.push(heroCardHtml);
  blocks.push(`<strong>📝 Prescribing Directives & Limits:</strong>`);
  blocks.push(`• <strong>Dose Guideline:</strong> ${toRangeTxt(minPerKg, maxPerKg, n => `${n} mg/kg`)} ${drug.freq ? drug.freq : ''}`);
  if (drug.preparation) blocks.push(`• <strong>Preparation:</strong> ${drug.preparation}`);
  if (drug.maxPerDoseMg) blocks.push(`• <strong>Single Dose Limit:</strong> Max ${drug.maxPerDoseMg} mg`);
  if (drug.maxPerDayMg) blocks.push(`• <strong>Daily Limit:</strong> Max ${drug.maxPerDayMg} mg`);
  if (drug.note) blocks.push(`• <strong>Clinical Note:</strong> ${drug.note}`);

  if (outEl) outEl.innerHTML = blocks.join('<br>');
}

// --------- 🦠 Pediatric Antibiotic Calculator ---------

function calcATB(){
  if (!DS) return;
  const key = document.getElementById('atbDrug')?.value;
  const bw = getWeight();
  const form = parseFloat(document.getElementById('atbForm')?.value);
  const drug = (DS.pediatricATB||[]).find(d=>d.key===key) || (DS.pediatricATB||[])[0];
  const outEl = document.getElementById('atbOut');
  if (!drug){ if(outEl) outEl.textContent='No dataset available'; return; }

  const unit = (drug.unit || 'mg/kg').toLowerCase();
  const isPerDay = unit.includes('mg/kg/day');
  const minPerKg = (drug.doseMinMgPerKg != null) ? Number(drug.doseMinMgPerKg) : null;
  const maxPerKg = (drug.doseMaxMgPerKg != null) ? Number(drug.doseMaxMgPerKg) : null;

  const cap = (v, m) => (m ? Math.min(v, m) : v);
  const limitMaxDose = drug.maxPerDoseMg ? Number(drug.maxPerDoseMg) : null;
  const limitMaxDay  = drug.maxPerDayMg  ? Number(drug.maxPerDayMg)  : null;

  const dosesPerDay = dosesPerDayFromFreq(drug.split || drug.freq);

  let perDoseMg = null, perDayMg = null;
  if (isPerDay) {
    if (bw && maxPerKg!=null) perDayMg = bw * maxPerKg;
    if (perDayMg && limitMaxDay) perDayMg = cap(perDayMg, limitMaxDay);
    if (perDayMg && dosesPerDay) perDoseMg = perDayMg / dosesPerDay;
  } else {
    if (bw && maxPerKg!=null) perDoseMg = bw * maxPerKg;
    if (perDoseMg && limitMaxDose) perDoseMg = cap(perDoseMg, limitMaxDose);
    if (perDoseMg && dosesPerDay) perDayMg = perDoseMg * dosesPerDay;
  }

  const perDoseMgTxt = perDoseMg ? `${fmtMg(perDoseMg)} mg` : '—';
  const perDayMgTxt  = perDayMg ? `${fmtMg(perDayMg)} mg` : '—';
  let perDoseMlTxt = '';
  if (form > 0 && perDoseMg) {
    perDoseMlTxt = `${fmtMl(perDoseMg / form)} mL/tab`;
  }

  const title = (drug.name || drug.drug || 'Antibiotic');
  const heroCardHtml = `
<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
  <strong style="font-size:16px;">🦠 ${title}</strong>
  <button class="btn-copy" onclick="copyEHROrder('atb')">📋 Copy EHR Order</button>
</div>
<div class="hero-metric-grid">
  <div class="hero-metric good">
    <div class="hero-label">DOSE PER SINGLE DOSE</div>
    <div class="hero-val">${perDoseMgTxt}${perDoseMlTxt ? ` <span class="unit">(${perDoseMlTxt})</span>` : ''}</div>
    <div class="hero-sub">${drug.split || drug.freq || 'PO/IV'}</div>
  </div>
  <div class="hero-metric blue">
    <div class="hero-label">TOTAL DAILY DOSE</div>
    <div class="hero-val">${perDayMgTxt}</div>
    <div class="hero-sub">24-hour total target</div>
  </div>
</div>
  `;

  const blocks = [];
  blocks.push(heroCardHtml);
  blocks.push(`<strong>📝 Prescribing Directives & Limits:</strong>`);
  blocks.push(`• <strong>Dose Rule:</strong> ${minPerKg && maxPerKg ? `${minPerKg}–${maxPerKg}` : (drug.dose || '—')} mg/kg${isPerDay?'/day':''} ${drug.split || drug.freq || ''}`);
  if (drug.preparation) blocks.push(`• <strong>Preparation:</strong> ${drug.preparation}`);
  if (limitMaxDose) blocks.push(`• <strong>Max Single Dose:</strong> ${limitMaxDose} mg`);
  if (limitMaxDay) blocks.push(`• <strong>Max Daily Limit:</strong> ${limitMaxDay} mg`);
  if (drug.note) blocks.push(`• <strong>Clinical Note:</strong> ${drug.note}`);

  if (outEl) outEl.innerHTML = blocks.join('<br>');
}

// --------- 💧 IV Fluids Calculator ---------

function setFluidType(t){ gFluidType = t; highlightFluidChips(); calcFluids(); }
function highlightFluidChips(){
  (['ORS','NS','RL','D5-1/2NS','D5-NS']).forEach(k=>{
    const el = document.getElementById('fluid-'+k.replace(/\//g,'-'));
    if (!el) return;
    el.classList.toggle('active', k === gFluidType);
  });
}

function calcFluids(){
  const w = getWeight();
  const deg = document.getElementById('fDegree')?.value || 'Mild';
  const plan = document.getElementById('fPlan')?.value || '24 h';
  const out = document.getElementById('fOut');
  if (!w){ if(out) out.textContent='Please enter patient weight in topbar ABW'; return; }

  const mnt = calcMaintenanceMlPerHr(w);
  const pct = deg.includes('Mild') ? 4 : (deg.includes('Moderate') ? 8 : 10);
  const deficit = w * pct * 10;
  const hours = (plan === '24 h') ? 24 : 48;
  const replaceRate = deficit / hours;
  const shockBolus = 20 * w;
  const totalCombinedRate = mnt + replaceRate;

  const heroCardHtml = `
<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
  <strong style="font-size:16px;">💧 IV Fluid Directives (${gFluidType})</strong>
  <button class="btn-copy" onclick="copyEHROrder('fluids')">📋 Copy EHR Order</button>
</div>
<div class="hero-metric-grid">
  <div class="hero-metric blue">
    <div class="hero-label">MAINTENANCE RATE</div>
    <div class="hero-val">${mnt.toFixed(1)}<span class="unit">mL/hr</span></div>
    <div class="hero-sub">Holliday–Segar formula</div>
  </div>
  <div class="hero-metric warning">
    <div class="hero-label">DEFICIT VOLUME (~${pct}%)</div>
    <div class="hero-val">${deficit.toFixed(0)}<span class="unit">mL</span></div>
    <div class="hero-sub">Replace over ${hours} hrs (${replaceRate.toFixed(1)} mL/hr)</div>
  </div>
  <div class="hero-metric good">
    <div class="hero-label">COMBINED INITIAL RATE</div>
    <div class="hero-val">${totalCombinedRate.toFixed(1)}<span class="unit">mL/hr</span></div>
    <div class="hero-sub">Maintenance + Deficit replacement</div>
  </div>
</div>
  `;

  const blocks = [];
  blocks.push(heroCardHtml);
  blocks.push(`<strong>📋 Protocol Summary:</strong>`);
  blocks.push(`• <strong>Fluid Selected:</strong> ${gFluidType}`);
  blocks.push(`• <strong>Dehydration Level:</strong> ${deg}`);
  if (deg.includes('Severe') || deg.includes('Shock')) {
    blocks.push(`• <strong>⛑️ Emergency Shock Bolus:</strong> ${shockBolus.toFixed(0)} mL (20 mL/kg NS/RL rapid IV bolus)`);
  }
  blocks.push(`• <strong>24-Hour Total Target:</strong> ${(mnt * 24 + (hours === 24 ? deficit : deficit / 2)).toFixed(0)} mL`);
  blocks.push(`• <strong>Clinical Note:</strong> Adjust rate according to clinical status, urine output (target > 1 mL/kg/hr), and serum electrolytes.`);

  if (out) out.innerHTML = blocks.join('<br>');
}

// --------- 🧒🏻 PALS Emergency Resuscitation ---------

function calcPALS(){
  if (!DS) return;
  const out = document.getElementById('pOut');
  const w = getWeight();
  const age = getAgeInYears();

  if (!w){ 
    if(out) out.innerHTML = `
<div class="hero-metric danger">
  <div>
    <div class="hero-label">🚨 PALS ARREST RESUSCITATION (AHA GUIDELINES)</div>
    <div style="font-size: 14px; color: #FFFFFF; margin-top: 4px; font-weight: 600;">
      Please enter patient weight (kg) in topbar ABW to compute Epinephrine, Defib Joules, Amiodarone, and ETT sizes.
    </div>
  </div>
</div>
    `; 
    return; 
  }

  const epiMg = 0.01 * w;
  const epiMl = epiMg / 0.1; // 1:10,000 conc (0.1 mg/mL)
  const amio  = 5 * w;
  const lido  = 1 * w;
  const j1    = 2 * w;
  const j2    = 4 * w;

  let cuffed = weightToETTCuffed(w);
  let uncuffed = weightToETTUncuffed(w);
  let depth = weightToDepth(w);

  if (age && age > 0){
    cuffed   = (age/4 + 3.5).toFixed(1);
    uncuffed = (age/4 + 4).toFixed(1);
    depth    = (age/2 + 12).toFixed(1);
  }

  const heroCardHtml = `
<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
  <strong style="font-size:16px;">🚨 AHA PALS Emergency Directives</strong>
  <button class="btn-copy" onclick="copyEHROrder('pals')">📋 Copy EHR Order</button>
</div>
<div class="hero-metric-grid">
  <div class="hero-metric danger">
    <div class="hero-label">EPINEPHRINE ARREST (1:10,000)</div>
    <div class="hero-val">${epiMg.toFixed(2)}<span class="unit">mg</span> (${epiMl.toFixed(1)}<span class="unit">mL IV/IO</span>)</div>
    <div class="hero-sub">0.01 mg/kg IV/IO repeat q 3–5 min</div>
  </div>
  <div class="hero-metric blue">
    <div class="hero-label">DEFIBRILLATION DOSE</div>
    <div class="hero-val">${j1.toFixed(0)} → ${j2.toFixed(0)}<span class="unit">Joules</span></div>
    <div class="hero-sub">1st shock 2 J/kg | 2nd shock 4 J/kg</div>
  </div>
  <div class="hero-metric warning">
    <div class="hero-label">AIRWAY & ETT SIZE</div>
    <div class="hero-val">${cuffed}<span class="unit">mm (Cuffed)</span></div>
    <div class="hero-sub">Uncuffed: ${uncuffed} mm | Depth: ${depth} cm</div>
  </div>
</div>
  `;

  const blocks = [];
  blocks.push(heroCardHtml);
  blocks.push(`<strong>⚡ Emergency Resuscitation Dosages:</strong>`);
  blocks.push(`• <strong>Epinephrine (1:10,000):</strong> ${epiMg.toFixed(2)} mg (${epiMl.toFixed(1)} mL IV/IO) repeat q 3-5 min`);
  blocks.push(`• <strong>Amiodarone (VF/pVT):</strong> ${amio.toFixed(0)} mg IV/IO bolus (max total 15 mg/kg)`);
  blocks.push(`• <strong>Lidocaine (VF/pVT):</strong> ${lido.toFixed(0)} mg IV/IO bolus`);
  blocks.push(`• <strong>Defibrillation (VF/pVT):</strong> 1st ${j1.toFixed(0)} J → 2nd ${j2.toFixed(0)} J (max 10 J/kg or adult max 200 J)`);
  blocks.push(`• <strong>Atropine (Symptomatic Bradycardia):</strong> ${(0.02*w).toFixed(2)} mg IV/IO (min 0.1 mg, max 0.5 mg)`);
  blocks.push(`• <strong>Adenosine (SVT):</strong> 1st dose ${(0.1*w).toFixed(2)} mg (${(0.1*w/3).toFixed(1)} mL) → 2nd dose ${(0.2*w).toFixed(2)} mg rapid IV push`);
  blocks.push(`• <strong>Synchronized Cardioversion (SVT/VT):</strong> ${(0.5*w).toFixed(0)}–${(1.0*w).toFixed(0)} J → 2nd shock ${(2.0*w).toFixed(0)} J`);

  if (out) out.innerHTML = blocks.join('<br>');
}

// --------- 👶🏻 NCPR Neonatal Resuscitation ---------

function calcNCPR(){
  if (!DS) return;
  const w = parseFloat(document.getElementById('nW')?.value) || getWeight() || gIBW;
  const GA = parseFloat(document.getElementById('nGA')?.value);
  const out = document.getElementById('nOut');
  if (!w){ if(out) out.textContent = 'Please enter birth weight (kg)'; return; }

  const epiIV = 0.02 * w;
  const epiIVml = epiIV / 0.1;
  const epiETT = 0.10 * w;
  const epiETTml = epiETT / 0.1;
  const bolusMl = 10 * w;

  const heroCardHtml = `
<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
  <strong style="font-size:16px;">👶🏻 NRP Neonatal Resuscitation Directives</strong>
  <button class="btn-copy" onclick="copyEHROrder('ncpr')">📋 Copy EHR Order</button>
</div>
<div class="hero-metric-grid">
  <div class="hero-metric danger">
    <div class="hero-label">EPINEPHRINE IV/IO (1:10,000)</div>
    <div class="hero-val">${epiIV.toFixed(3)}<span class="unit">mg</span> (${epiIVml.toFixed(2)}<span class="unit">mL</span>)</div>
    <div class="hero-sub">0.02 mg/kg IV/IO + 3 mL NS flush</div>
  </div>
  <div class="hero-metric warning">
    <div class="hero-label">EPINEPHRINE ETT (FALLBACK)</div>
    <div class="hero-val">${epiETT.toFixed(3)}<span class="unit">mg</span> (${epiETTml.toFixed(2)}<span class="unit">mL</span>)</div>
    <div class="hero-sub">0.10 mg/kg ETT (while awaiting IV)</div>
  </div>
  <div class="hero-metric good">
    <div class="hero-label">VOLUME EXPANDER (NS/PRC)</div>
    <div class="hero-val">${bolusMl.toFixed(0)}<span class="unit">mL</span></div>
    <div class="hero-sub">10 mL/kg over 5–10 min</div>
  </div>
</div>
  `;

  const blocks = [];
  blocks.push(heroCardHtml);
  blocks.push(`<strong>🫁 Resuscitation Guidelines:</strong>`);
  blocks.push(`• <strong>PPV Settings:</strong> Flow 10 L/min, Rate 40–60/min, PIP 20–25 cmH₂O, PEEP 5 cmH₂O`);
  if (GA) blocks.push(`• <strong>Initial FiO₂ (${GA} wk):</strong> ${GA >= 35 ? '21% (Room Air)' : '21–30%'}`);
  blocks.push(`• <strong>Hypoglycemia (D10W Bolus):</strong> ${(2*w).toFixed(1)} mL D10W IV bolus over 2 min, then ${(3.5*w).toFixed(1)} mL/hr infusion if BG < 40 mg/dL`);

  if (out) out.innerHTML = blocks.join('<br>');
}

// --------- Medical EHR Clipboard Order Copy Engine ---------

function copyEHROrder(module){
  const w = getWeight() || gIBW || 0;
  let orderStr = '';

  if (module === 'dose') {
    const key = document.getElementById('doseDrug')?.value;
    const drug = (DS?.pediatricDose||[]).find(d=>d.key===key);
    if (drug) {
      const concOverride = parseFloat(document.getElementById('doseConc')?.value);
      const strength = parseStrength(drug.preparation || drug.name || '');
      const mgPerMl = concOverride > 0 ? concOverride : (strength.mgPerMl || null);
      
      let doseMg = (drug.doseMaxMgPerKg || drug.dose || 10) * w;
      if (drug.maxPerDoseMg) doseMg = Math.min(doseMg, drug.maxPerDoseMg);
      
      let doseMlStr = '';
      if (mgPerMl) {
        const ml = doseMg / mgPerMl;
        doseMlStr = ` (${fmtMl(ml)} mL)`;
      }
      
      orderStr = `[ER-PED] ${drug.drug || drug.name} ${fmtMg(doseMg)} mg${doseMlStr} ${drug.route || 'PO'} ${drug.freq || 'PRN'} [BW: ${w.toFixed(1)} kg]`;
    }
  } else if (module === 'atb') {
    const key = document.getElementById('atbDrug')?.value;
    const drug = (DS?.pediatricATB||[]).find(d=>d.key===key);
    if (drug) {
      const form = parseFloat(document.getElementById('atbForm')?.value);
      let doseMg = (drug.doseMaxMgPerKg || drug.dose || 10) * w;
      if (drug.maxPerDoseMg) doseMg = Math.min(doseMg, drug.maxPerDoseMg);
      
      let doseMlStr = '';
      if (form > 0) {
        doseMlStr = ` (${fmtMl(doseMg / form)} mL)`;
      }
      orderStr = `[ER-PED] ${drug.name || drug.drug} ${fmtMg(doseMg)} mg${doseMlStr} ${drug.route || 'IV'} ${drug.split || drug.freq || ''} [BW: ${w.toFixed(1)} kg]`;
    }
  } else if (module === 'fluids') {
    const mnt = calcMaintenanceMlPerHr(w);
    const deg = document.getElementById('fDegree')?.value || 'Mild';
    const pct = deg.includes('Mild') ? 4 : (deg.includes('Moderate') ? 8 : 10);
    const deficit = w * pct * 10;
    const plan = document.getElementById('fPlan')?.value || '24 h';
    const replaceRate = deficit / (plan === '24 h' ? 24 : 48);
    const totalRate = mnt + replaceRate;
    
    orderStr = `[ER-PED] IV ${gFluidType} @ ${totalRate.toFixed(1)} mL/hr (Mnt: ${mnt.toFixed(1)} mL/hr + Deficit: ${replaceRate.toFixed(1)} mL/hr over ${plan}) [BW: ${w.toFixed(1)} kg]`;
  } else if (module === 'pals') {
    const epiMg = (0.01 * w).toFixed(2);
    const epiMl = (0.01 * w / 0.1).toFixed(1);
    const defib1 = Math.round(2 * w);
    orderStr = `[ER-PED] PALS Epinephrine (1:10,000) ${epiMg} mg (${epiMl} mL) IV/IO q 3-5 min | Defib: ${defib1} J [BW: ${w.toFixed(1)} kg]`;
  } else if (module === 'ncpr') {
    const nW = parseFloat(document.getElementById('nW')?.value) || w;
    const epiIV = (0.02 * nW).toFixed(3);
    const epiMl = (0.02 * nW / 0.1).toFixed(2);
    orderStr = `[ER-PED] NCPR Epinephrine (1:10,000) ${epiIV} mg (${epiMl} mL) IV/IO + 3 mL NS flush [Birth BW: ${nW.toFixed(2)} kg]`;
  }

  if (orderStr) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(orderStr).then(() => {
        showToast('📋 Order copied to clipboard!');
      }).catch(() => {
        fallbackCopyText(orderStr);
      });
    } else {
      fallbackCopyText(orderStr);
    }
  }
}

function fallbackCopyText(text){
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showToast('📋 Order copied to clipboard!');
}

function showToast(msg){
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.querySelector('span').textContent = msg;
  toast.classList.remove('show');
  void toast.offsetWidth; // trigger reflow
  toast.classList.add('show');
}

function hardReload(){
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k=>caches.delete(k))).finally(()=>location.reload());
  } else {
    location.reload();
  }
}
