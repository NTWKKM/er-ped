// --- PWA: register service worker & A2HS prompt ---
if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      // Check for updates every 30 minutes
      setInterval(() => reg.update(), 30 * 60 * 1000);
      // Show banner on controller change (new SW detected)
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            const banner = document.getElementById('pwaUpdateBanner');
            if (banner) banner.style.display = 'flex';
          }
        });
      });
    }).catch(err => console.log('SW reg skipped/failed:', err));
  });
}

let deferredPrompt = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('a2hsBtn');
    if (btn) btn.style.display = 'inline-flex';
  });
}

async function triggerA2HS(){
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  const btn = document.getElementById('a2hsBtn');
  if (btn) btn.style.display = 'none';
}

// --- Global State ---
var DS = (typeof window !== 'undefined' && window.DS) ? window.DS : null;
if (typeof window !== 'undefined') window.DS = DS;
let gIBW = null;
let gUserABW = null;
let gIBWSource = null; // 'length', 'age', 'bw', or null
let gWeightSource = null; // 'manual' (real measured/reported ABW) or 'estimated' (Weech age-based)
let gFluidType = 'NS';
let gAgeUnit = 'yr'; // 'yr' or 'mo'
let activeTab = 'dose';

// --- Dataset Loading (Robust dual-mode for web server & offline file:// execution) ---
function loadDataset() {
  if (window.ER_PED_DATASET) {
    DS = window.ER_PED_DATASET;
    if (typeof window !== 'undefined') window.DS = DS;
    initUI();
  } else {
    fetch('dataset.json')
      .then(r => r.json())
      .then(j => {
        DS = j;
        if (typeof window !== 'undefined') window.DS = DS;
        initUI();
      })
      .catch(err => {
        console.error('Failed to load dataset.json via fetch:', err);
        if (window.ER_PED_DATASET) {
          DS = window.ER_PED_DATASET;
          if (typeof window !== 'undefined') window.DS = DS;
          initUI();
        } else {
          const app = document.getElementById('app');
          if (app) app.innerHTML = '<div class="card">Cannot load dataset.json</div>';
        }
      });
  }
}

const THEMES = ['light', 'dark', 'mono'];

function initTheme() {
  const saved = localStorage.getItem('er_ped_theme') || 'light';
  setTheme(saved);
}

function setTheme(t) {
  if (!THEMES.includes(t)) t = 'light';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('er_ped_theme', t);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    if (t === 'mono') btn.innerHTML = 'Mono';
    else if (t === 'dark') btn.innerHTML = 'Dark';
    else btn.innerHTML = 'Light';
  }
  if (typeof refreshBroselowChip === 'function') refreshBroselowChip();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const nextIndex = (THEMES.indexOf(current) + 1) % THEMES.length;
  setTheme(THEMES[nextIndex]);
}

function toggleRefPopover(e) {
  if (e) e.stopPropagation();
  const btn = document.getElementById('refPopoverBtn');
  const menu = document.getElementById('refPopoverMenu');
  const overflowBtn = document.getElementById('overflowBtn');
  const overflowMenu = document.getElementById('overflowMenu');
  if (overflowMenu) overflowMenu.classList.remove('open');
  if (overflowBtn) overflowBtn.setAttribute('aria-expanded', 'false');
  if (menu) {
    const isOpen = menu.classList.toggle('open');
    if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
}

function toggleOverflowMenu(e) {
  if (e) e.stopPropagation();
  const btn = document.getElementById('overflowBtn');
  const menu = document.getElementById('overflowMenu');
  const refBtn = document.getElementById('refPopoverBtn');
  const refMenu = document.getElementById('refPopoverMenu');
  if (refMenu) refMenu.classList.remove('open');
  if (refBtn) refBtn.setAttribute('aria-expanded', 'false');
  if (menu) {
    const isOpen = menu.classList.toggle('open');
    if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
}

function closeAllPopovers() {
  const refMenu = document.getElementById('refPopoverMenu');
  const overflowMenu = document.getElementById('overflowMenu');
  const refBtn = document.getElementById('refPopoverBtn');
  const overflowBtn = document.getElementById('overflowBtn');
  if (refMenu) refMenu.classList.remove('open');
  if (overflowMenu) overflowMenu.classList.remove('open');
  if (refBtn) refBtn.setAttribute('aria-expanded', 'false');
  if (overflowBtn) overflowBtn.setAttribute('aria-expanded', 'false');
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadDataset();
  });
}

// Publishes the fixed topbar's real height as --topbar-h so .container can
// clear it at any viewport. Hardcoded margins occluded content on every
// viewport under 900px once the bar wrapped to a taller stacked layout.
function syncTopbarHeight() {
  const bar = document.querySelector('.topbar');
  if (!bar || typeof document === 'undefined') return;
  const apply = () => {
    const h = bar.getBoundingClientRect().height;
    if (h > 0) document.documentElement.style.setProperty('--topbar-h', `${Math.ceil(h)}px`);
  };
  apply();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(apply).observe(bar);
  } else {
    window.addEventListener('resize', apply);
  }
  // Web fonts land after first paint and change the bar's height.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);
}

function initUI(){
  initTheme();
  populateDrugs();
  initComboboxes();
  setupKeyboardShortcuts();
  syncTopbarHeight();
  calculateIBW();
  updateBiometricUIState();

  if (typeof window !== 'undefined') {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.popover-wrapper')) {
        closeAllPopovers();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllPopovers();
      }
    });
  }
}

// --------- IBW / Age & Length Weight Engine ---------

function toggleAgeUnit(){
  const prevUnit = gAgeUnit;
  gAgeUnit = (gAgeUnit === 'yr') ? 'mo' : 'yr';
  const btn = document.getElementById('ageUnitBtn');
  const input = document.getElementById('age');
  if (btn) btn.textContent = (gAgeUnit === 'yr') ? 'yr' : 'mo';
  if (input) {
    input.placeholder = 'Age';
    input.max = (gAgeUnit === 'yr') ? '15' : '180';
  }

  // Convert the raw numeric value into the new unit so the age it represents
  // doesn't silently change (e.g. "12" months becoming "12" years).
  if (input) {
    const raw = parseFloat(input.value);
    if (isFinite(raw) && raw > 0) {
      let converted;
      if (prevUnit === 'mo' && gAgeUnit === 'yr') {
        converted = raw / 12;
      } else if (prevUnit === 'yr' && gAgeUnit === 'mo') {
        converted = raw * 12;
      } else {
        converted = raw;
      }
      // Round to a sensible precision: whole months, 1 decimal for years.
      converted = (gAgeUnit === 'mo') ? Math.round(converted) : Math.round(converted * 10) / 10;
      input.value = converted;
    }
  }

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

  // Cap pediatric estimation at 15 years max
  if (ageYr > 15) {
    ageYr = 15;
    ageMo = 180;
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
  const lenVal = lenInput ? parseFloat(lenInput.value) : NaN;

  // IBW is derived from height alone. The useIBW toggle governs whether it is
  // USED for dosing, not whether it is COMPUTED — clinicians must be able to
  // read IBW next to ABW before committing the dose engine to it.
  if (isFinite(lenVal) && lenVal > 0) {
    gIBW = estimateWeightFromLength(lenVal);
    gIBWSource = 'length';
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
  if (src) src.textContent = '';
}

function getAgeInYears(){
  const input = document.getElementById('age');
  const val = input ? parseFloat(input.value) : NaN;
  if (!isFinite(val) || val <= 0) return null;
  const ageYr = (gAgeUnit === 'mo') ? (val / 12) : val;
  return Math.min(ageYr, 15);
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

  if (isIBWChecked && gIBW && gIBW > 0) {
    return gIBW;
  }
  if (gUserABW && gUserABW > 0) {
    return gUserABW;
  }

  return null;
}

// Resolves the human-readable provenance of the weight the dose engine is using.
// Returns { value, label, detail } — detail names the source AND its input value
// so a clinician can audit the number without hunting for another field.
function getWeightSourceLabel() {
  const isIBWChecked = document.getElementById('useIBW')?.checked || false;
  const lenInput = document.getElementById('length');
  const lenVal = lenInput ? parseFloat(lenInput.value) : NaN;
  const ageInput = document.getElementById('age');
  const ageVal = ageInput ? parseFloat(ageInput.value) : NaN;

  if (isIBWChecked && gIBW && gIBW > 0) {
    const ht = (isFinite(lenVal) && lenVal > 0) ? ` ${lenVal} cm` : '';
    return { value: gIBW, label: 'Wt for Ht', detail: `Wt-for-Ht${ht}` };
  }
  if (gUserABW && gUserABW > 0) {
    if (gWeightSource === 'estimated') {
      const unit = (gAgeUnit === 'mo') ? 'mo' : 'yr';
      const age = (isFinite(ageVal) && ageVal > 0) ? ` ${ageVal} ${unit}` : '';
      return { value: gUserABW, label: 'est', detail: `estimated · Weech${age}` };
    }
    return { value: gUserABW, label: '', detail: '' };
  }
  return { value: null, label: '', detail: 'enter BW or age' };
}

function updateBiometricUIState() {
  const lenInput = document.getElementById('length');
  const weightInput = document.getElementById('weight');

  // Height is always enterable: it is a measured biometric, not a mode. It is
  // never cleared by the IBW toggle — a patient's height does not change
  // because a checkbox moved.
  if (lenInput) {
    lenInput.disabled = false;
    lenInput.classList.remove('disabled-input', 'highlight-input');
  }

  // The BW field mirrors clinician-entered ABW ONLY. IBW is never written back
  // into it — overwriting a measured weight in place is silent data loss.
  if (weightInput && document.activeElement !== weightInput) {
    weightInput.value = gUserABW !== null ? String(gUserABW) : '';
  }

  const srcInfo = getWeightSourceLabel();
  const w = srcInfo.value;

  const boxVal = document.getElementById('activeWeightVal');
  const boxSrc = document.getElementById('activeWeightSrc');
  if (boxVal) boxVal.textContent = w ? `${w.toFixed(1)} kg` : '— kg';
  if (boxSrc) boxSrc.textContent = srcInfo.detail;

  const box = document.getElementById('activeWeightBox');
  if (box) {
    box.classList.toggle('is-empty', !w);
    box.classList.toggle('is-derived', !!w && srcInfo.label !== '');
  }

  const wTxt = w
    ? (srcInfo.label ? `${w.toFixed(1)} kg · ${srcInfo.label}` : `${w.toFixed(1)} kg`)
    : '— kg';

  ['doseWBadge', 'atbWBadge', 'fWBadge', 'pWBadge', 'dripWBadge', 'seizureWBadge', 'toxWBadge', 'psaWBadge', 'vitalsWBadge', 'dkaWBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = wTxt;
  });

  refreshBroselowChip();
  calcAll();
}

function onWeightChange() {
  const weightInput = document.getElementById('weight');
  const useIBWBox = document.getElementById('useIBW');
  const lenInput = document.getElementById('length');
  const val = weightInput ? parseFloat(weightInput.value) : NaN;

  // Typing a measured BW takes the dose engine off IBW, but the height reading
  // itself is preserved — IBW stays visible for comparison.
  if (useIBWBox && useIBWBox.checked) {
    useIBWBox.checked = false;
  }

  gUserABW = (isFinite(val) && val > 0) ? val : null;
  gWeightSource = gUserABW ? 'manual' : null;
  calculateIBW();
  updateBiometricUIState();
}

function estimateFromAge(fromPAge = false) {
  const ageInput = document.getElementById('age');
  const pAgeInput = document.getElementById('pAge');
  const useIBWBox = document.getElementById('useIBW');
  const lenInput = document.getElementById('length');

  if (fromPAge && pAgeInput && ageInput) {
    let pVal = parseFloat(pAgeInput.value);
    if (isFinite(pVal) && pVal > 15) {
      pVal = 15;
      pAgeInput.value = 15;
      showToast('จำกัดอายุสูงสุดไม่เกิน 15 ปี (Pediatric Limit 15 Years)');
    }
    if (gAgeUnit === 'mo') {
      ageInput.value = isFinite(pVal) && pVal > 0 ? Math.round(pVal * 12) : '';
    } else {
      ageInput.value = isFinite(pVal) && pVal > 0 ? pVal : '';
    }
  } else if (!fromPAge && ageInput && pAgeInput) {
    let rawAge = parseFloat(ageInput.value);
    const maxVal = (gAgeUnit === 'mo') ? 180 : 15;
    if (isFinite(rawAge) && rawAge > maxVal) {
      rawAge = maxVal;
      ageInput.value = maxVal;
      showToast('จำกัดอายุสูงสุดไม่เกิน 15 ปี (Pediatric Limit 15 Years)');
    }
    const ageYrVal = (gAgeUnit === 'mo') ? rawAge / 12 : rawAge;
    pAgeInput.value = isFinite(ageYrVal) && ageYrVal > 0 ? Math.round(ageYrVal * 10) / 10 : '';
  }

  // Entering age takes the dose engine off IBW, but the measured height is
  // retained so the IBW readout remains available for comparison.
  if (useIBWBox && useIBWBox.checked) {
    useIBWBox.checked = false;
  }

  const ageVal = ageInput ? parseFloat(ageInput.value) : NaN;
  if (isFinite(ageVal) && ageVal > 0) {
    if (gWeightSource === 'manual') {
      // A real measured/reported weight is on record — never let an age-based
      // estimate silently clobber it. Age still syncs (for ETT/PALS refs above);
      // just leave gUserABW untouched and tell the user why weight didn't change.
      showToast('ใช้น้ำหนักที่กรอกจริง (ไม่ auto-estimate ทับ) — ลบช่องน้ำหนักก่อนถ้าต้องการ estimate จากอายุ');
    } else {
      gUserABW = estimateWeightFromAge(ageVal, gAgeUnit);
      gWeightSource = 'estimated';
    }
  } else if (gWeightSource === 'estimated') {
    // Age was cleared and the current weight value was only an age-derived
    // estimate — clear it too rather than re-adopting the stale number as
    // if it were a real measured weight.
    gUserABW = null;
    gWeightSource = null;
  } else {
    const weightInput = document.getElementById('weight');
    const wVal = weightInput ? parseFloat(weightInput.value) : NaN;
    if (isFinite(wVal) && wVal > 0) {
      gUserABW = wVal;
    } else {
      gUserABW = null;
      gWeightSource = null;
    }
  }

  calculateIBW();
  updateBiometricUIState();
}

function onPALSAgeChange() {
  estimateFromAge(true);
}

function updateIBW() {
  const lenInput = document.getElementById('length');
  const useIBWBox = document.getElementById('useIBW');
  // Entering height computes and displays IBW but does NOT switch the dose
  // engine onto it — adopting IBW is an explicit clinician decision.
  calculateIBW();
  updateBiometricUIState();
}

function applyIBWToBW() {
  const useIBWBox = document.getElementById('useIBW');
  const lenInput = document.getElementById('length');
  const isChecked = useIBWBox?.checked || false;

  calculateIBW();
  updateBiometricUIState();

  // Adopting IBW without a height reading is a dead end — send the clinician
  // straight to the field that makes the toggle meaningful.
  if (isChecked && lenInput && !(parseFloat(lenInput.value) > 0)) {
    lenInput.focus();
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
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  const targetBtn = btn || document.querySelector(`.tab-btn[data-tab="${id}"]`);
  if (targetBtn) {
    targetBtn.classList.add('active');
    targetBtn.setAttribute('aria-selected', 'true');
  }
  
  ['dose','atb','fluids','pals','ncpr','drip','seizure','tox','psa','vitals','dka'].forEach(x => {
    const el = document.getElementById(x);
    if (el) el.style.display = (x === id) ? 'block' : 'none';
  });
  
  if (id === 'pals') {
    calcPALS();
  } else if (id === 'drip') {
    calcDrip();
  } else if (id === 'seizure') {
    calcSeizure();
  } else if (id === 'tox') {
    calcTox();
  } else if (id === 'psa') {
    calcPSA();
  } else if (id === 'vitals') {
    calcVitals();
  } else if (id === 'dka') {
    calcDKA();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupKeyboardShortcuts(){
  document.addEventListener('keydown', (e) => {
    if (e.altKey) {
      if (e.key === '1') { e.preventDefault(); showTab('dose'); }
      if (e.key === '2') { e.preventDefault(); showTab('atb'); }
      if (e.key === '3') { e.preventDefault(); showTab('fluids'); }
      if (e.key === '4') { e.preventDefault(); showTab('pals'); }
      if (e.key === '5') { e.preventDefault(); showTab('ncpr'); }
      if (e.key === '6') { e.preventDefault(); showTab('drip'); }
      if (e.key === '7') { e.preventDefault(); showTab('seizure'); }
      if (e.key === '8') { e.preventDefault(); showTab('tox'); }
      if (e.key === '9') { e.preventDefault(); showTab('psa'); }
      if (e.key === '0') { e.preventDefault(); showTab('vitals'); }
      if (e.key.toLowerCase() === 'k') { e.preventDefault(); showTab('dka'); }
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

const BROSELOW_COLOR_MAP = {
  'Grey':   { bg: '#E5E7EB', fg: '#374151' },
  'Pink':   { bg: '#FCE7F3', fg: '#9D174D' },
  'Red':    { bg: '#FEE2E2', fg: '#991B1B' },
  'Purple': { bg: '#F3E8FF', fg: '#6B21A8' },
  'Yellow': { bg: '#FEF3C7', fg: '#92400E' },
  'White':  { bg: '#FFFFFF', fg: '#1F2937' },
  'Blue':   { bg: '#DBEAFE', fg: '#1E40AF' },
  'Orange': { bg: '#FFEDD5', fg: '#9A3412' },
  'Green':  { bg: '#DCFCE7', fg: '#166534' }
};

function broselowColor(w){
  if (!w || !DS || !DS.broselow) return '—';
  for (const b of DS.broselow){ if (w>=b.min && w<=b.max) return b.color; }
  return '—';
}

function colorSwatch(colorLabel){
  const isMono = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'mono';
  if (isMono) return 'var(--panel)';
  const base = (colorLabel || '').toString().trim().split(/\s+/).pop();
  return (BROSELOW_COLOR_MAP[base] && BROSELOW_COLOR_MAP[base].bg) || '#f3f4f6';
}

function refreshBroselowChip(){
  const w = getWeight() || gIBW || 0;
  const color = broselowColor(w);
  const chip = document.getElementById('broselow');
  if (!chip) return;
  chip.textContent = color || '—';
  if (color && color !== '—') {
    const base = color.toString().trim().split(/\s+/).pop();
    const isMono = document.documentElement.getAttribute('data-theme') === 'mono';
    if (isMono) {
      chip.style.background = 'var(--panel)';
      chip.style.color = 'var(--ink)';
      chip.style.border = '1px solid var(--border-strong)';
    } else {
      const palette = BROSELOW_COLOR_MAP[base];
      chip.style.background = palette ? palette.bg : 'var(--panel)';
      chip.style.color = palette ? palette.fg : 'var(--ink)';
      chip.style.border = '1px solid var(--border)';
    }
  } else {
    chip.style.background = 'var(--panel)';
    chip.style.color = 'var(--ink)';
    chip.style.border = '1px solid var(--border)';
  }
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
  <strong style="font-size:16px; color:#1E1E1E;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px; margin-right:4px;"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0l12.6 12.6z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg> Broselow Zone: ${color} (${entry.min}–${entry.max} kg)</strong>
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
  <strong><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px; margin-right:4px;"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0l12.6 12.6z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg> Equipment & Resuscitation Specs:</strong>
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
  
  const dripArr = DS?.infusionDrips || [];
  const dripSel = document.getElementById('dripDrug');
  if (dripSel && dripArr.length) {
    dripSel.innerHTML = dripArr.map(d => `<option value="${d.key}">${d.drug} (${d.unit})</option>`).join('');
    dripSel.value = dripArr[0].key;
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
  document.getElementById('doseSearch')?.setAttribute('aria-expanded', 'true');
  renderDoseComboboxDropdown(document.getElementById('doseSearch').value);
}

function openATBCombobox(){
  closeAllComboboxes();
  const dropdown = document.getElementById('atbComboboxDropdown');
  if (dropdown) dropdown.classList.add('open');
  document.getElementById('atbSearch')?.setAttribute('aria-expanded', 'true');
  renderATBComboboxDropdown(document.getElementById('atbSearch').value);
}

function closeAllComboboxes(){
  document.querySelectorAll('.combobox-dropdown').forEach(d => d.classList.remove('open'));
  document.getElementById('doseSearch')?.setAttribute('aria-expanded', 'false');
  document.getElementById('atbSearch')?.setAttribute('aria-expanded', 'false');
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

function getRecentDrugs(kind) {
  try {
    const raw = localStorage.getItem('er_ped_recent_' + kind);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveRecentDrug(kind, key) {
  if (!key) return;
  try {
    let list = getRecentDrugs(kind).filter(k => k !== key);
    list.unshift(key);
    if (list.length > 8) list = list.slice(0, 8);
    localStorage.setItem('er_ped_recent_' + kind, JSON.stringify(list));
  } catch (e) {}
}

function selectDoseItem(key, name){
  saveRecentDrug('dose', key);
  const sel = document.getElementById('doseDrug');
  const input = document.getElementById('doseSearch');
  if (sel) sel.value = key;
  if (input) input.value = name;
  closeAllComboboxes();
  calcDose();
}

function selectATBItem(key, name){
  saveRecentDrug('atb', key);
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
  if (n.includes('diazepam') || n.includes('midazolam') || n.includes('phenobarbital') || n.includes('phenytoin')) return 'Anticonvulsant';
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

  let html = '';
  // Show RECENTLY USED if filter is empty and there are saved recent items
  if (!q) {
    const recentKeys = getRecentDrugs('dose');
    const recentItems = recentKeys.map(k => list.find(d => d.key === k)).filter(Boolean);
    if (recentItems.length > 0) {
      html += `<div style="padding:6px 10px; font-size:11px; font-weight:800; color:var(--accent); background:var(--accent-subtle); letter-spacing:0.05em;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px; margin-right:4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> RECENTLY USED</div>`;
      html += recentItems.map(d => {
        const selectedClass = (d.key === currentKey) ? 'selected' : '';
        const cat = getDrugCategory(d.name);
        return `
          <div class="combobox-item ${selectedClass}" role="option" data-key="${d.key}" data-name="${d.name.replace(/"/g, '&quot;')}" onclick="selectDoseItem('${d.key}', '${d.name.replace(/'/g, "\\'")}')">
            <div>
              <strong>${d.name}</strong>
              <div style="font-size:11px; color:var(--muted);">${d.preparation || ''}</div>
            </div>
            <span class="item-tag" style="background:var(--accent-subtle); color:var(--accent); border-color:var(--accent);">${cat}</span>
          </div>
        `;
      }).join('');
      html += `<div style="padding:6px 10px; font-size:11px; font-weight:800; color:var(--muted); background:var(--panel); letter-spacing:0.05em; border-top:1px solid var(--border);">ALL MEDICATIONS</div>`;
    }
  }

  html += filtered.map(d => {
    const selectedClass = (d.key === currentKey) ? 'selected' : '';
    const cat = getDrugCategory(d.name);
    return `
      <div class="combobox-item ${selectedClass}" role="option" data-key="${d.key}" data-name="${d.name.replace(/"/g, '&quot;')}" onclick="selectDoseItem('${d.key}', '${d.name.replace(/'/g, "\\'")}')">
        <div>
          <strong>${d.name}</strong>
          <div style="font-size:11px; color:var(--muted);">${d.preparation || ''}</div>
        </div>
        <span class="item-tag">${cat}</span>
      </div>
    `;
  }).join('');

  dropdown.innerHTML = html;
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

  let html = '';
  if (!q) {
    const recentKeys = getRecentDrugs('atb');
    const recentItems = recentKeys.map(k => list.find(d => d.key === k)).filter(Boolean);
    if (recentItems.length > 0) {
      html += `<div style="padding:6px 10px; font-size:11px; font-weight:800; color:var(--accent); background:var(--accent-subtle); letter-spacing:0.05em;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px; margin-right:4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> RECENTLY USED</div>`;
      html += recentItems.map(d => {
        const selectedClass = (d.key === currentKey) ? 'selected' : '';
        return `
          <div class="combobox-item ${selectedClass}" role="option" data-key="${d.key}" data-name="${d.name.replace(/"/g, '&quot;')}" onclick="selectATBItem('${d.key}', '${d.name.replace(/'/g, "\\'")}')">
            <div>
              <strong>${d.name}</strong>
              <div style="font-size:11px; color:var(--muted);">${d.preparation || ''}</div>
            </div>
            <span class="item-tag" style="background:var(--accent-subtle); color:var(--accent); border-color:var(--accent);">Antibiotic</span>
          </div>
        `;
      }).join('');
      html += `<div style="padding:6px 10px; font-size:11px; font-weight:800; color:var(--muted); background:var(--panel); letter-spacing:0.05em; border-top:1px solid var(--border);">ALL ANTIBIOTICS</div>`;
    }
  }

  html += filtered.map(d => {
    const selectedClass = (d.key === currentKey) ? 'selected' : '';
    return `
      <div class="combobox-item ${selectedClass}" role="option" data-key="${d.key}" data-name="${d.name.replace(/"/g, '&quot;')}" onclick="selectATBItem('${d.key}', '${d.name.replace(/'/g, "\\'")}')">
        <div>
          <strong>${d.name}</strong>
          <div style="font-size:11px; color:var(--muted);">${d.preparation || ''}</div>
        </div>
        <span class="item-tag">Antibiotic</span>
      </div>
    `;
  }).join('');

  dropdown.innerHTML = html;
}

// Keyboard navigation (ArrowUp/ArrowDown/Enter/Escape) for the dose/atb comboboxes
function onComboboxKeydown(e, kind){
  const dropdownId = (kind === 'dose') ? 'doseComboboxDropdown' : 'atbComboboxDropdown';
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  if (e.key === 'Escape') {
    closeAllComboboxes();
    e.target.setAttribute('aria-expanded', 'false');
    return;
  }

  if (!dropdown.classList.contains('open')) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (kind === 'dose') openDoseCombobox(); else openATBCombobox();
      e.target.setAttribute('aria-expanded', 'true');
    }
    return;
  }

  const items = Array.from(dropdown.querySelectorAll('.combobox-item[role="option"]'));
  if (!items.length) return;
  let idx = items.findIndex(it => it.classList.contains('kb-active'));

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    items.forEach(it => it.classList.remove('kb-active'));
    idx = (idx + 1) % items.length;
    items[idx].classList.add('kb-active');
    items[idx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    items.forEach(it => it.classList.remove('kb-active'));
    idx = (idx <= 0) ? items.length - 1 : idx - 1;
    items[idx].classList.add('kb-active');
    items[idx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const active = items[idx] || items[0];
    if (active) {
      const key = active.getAttribute('data-key');
      const name = active.getAttribute('data-name');
      if (kind === 'dose') selectDoseItem(key, name); else selectATBItem(key, name);
      e.target.setAttribute('aria-expanded', 'false');
    }
  }
}

// --------- Formatting & Helper Utilities ---------

function fmt(n){ return (Math.abs(n) >= 10 ? Number(n).toFixed(0) : Number(n).toFixed(2)); }
function fmtMg(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n === 0) return '0';
  if (n >= 100) return n.toFixed(0);
  if (n >= 1) return n.toFixed(1).replace(/\.0$/, '');
  if (n >= 0.1) return n.toFixed(2).replace(/0$/, '');
  return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
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
  // Composite strings like "bid/tid" or "bid-tid": use the first (lower, safer)
  // frequency term found, left-to-right, rather than failing entirely.
  const f = String(freq).trim().toLowerCase();

  // div N (e.g. "div 3", "divided q8h x3")
  let m = f.match(/div(?:ided)?\s*(\d+)/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0) return n;
  }

  // qXh / qX-Yh (e.g. "q8h", "q 6-8 h") — take the shorter (more frequent/safer) interval
  m = f.match(/q\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*h/);
  if (m) {
    const h1 = parseFloat(m[1]);
    const h2 = m[2] ? parseFloat(m[2]) : h1;
    const qh = Math.min(h1, h2);
    if (qh > 0) return Math.max(1, Math.round(24 / qh));
  }

  // Named frequencies, checked as whole-word-ish tokens to avoid false matches
  if (/\bqid\b/.test(f)) return 4;
  if (/\btid\b/.test(f)) return 3;
  if (/\bbid\b/.test(f)) return 2;
  if (/\b(od|qd|once\s*daily|once\s*a\s*day|daily)\b/.test(f)) return 1;

  return null;
}

function calcAll(){ calcDose(); calcATB(); calcFluids(); calcPALS(); calcNCPR(); calcDrip(); calcSeizure(); calcTox(); calcPSA(); calcVitals(); calcDKA(); }

// --------- 💊 Pediatric Dose Calculator ---------

function calcDose(){
  if (!DS) return;
  const key = document.getElementById('doseDrug')?.value;
  const bw = getWeight();
  const ageYr = getAgeInYears();
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
  let perDoseMinUnits = null, perDoseMaxUnits = null;
  let isCappedPerDose = false, isCappedPerDay = false;
  let bandNotice = '';

  // 1. Handle Fixed Dose (e.g. Albendazole 400 mg)
  if (drug.fixedDose) {
    if (drug.fixedDose.doseMg != null) {
      perDoseMinMg = perDoseMaxMg = drug.fixedDose.doseMg;
    }
  }
  // 2. Handle Dose Bands (e.g. Oseltamivir, Nystatin)
  else if (Array.isArray(drug.doseBands)) {
    const matchedBand = drug.doseBands.find(b => {
      if (b.minAgeYr != null && (ageYr == null || ageYr < b.minAgeYr)) return false;
      if (b.maxAgeYr != null && ageYr != null && ageYr > b.maxAgeYr) return false;
      if (b.minKg != null && (bw == null || bw < b.minKg)) return false;
      if (b.maxKg != null && bw != null && bw > b.maxKg) return false;
      return true;
    });

    if (matchedBand) {
      if (matchedBand.doseMg != null) {
        perDoseMinMg = perDoseMaxMg = matchedBand.doseMg;
      }
      if (matchedBand.doseUnits != null) {
        perDoseMinUnits = perDoseMaxUnits = matchedBand.doseUnits;
      }
      if (matchedBand.minUnits != null) perDoseMinUnits = matchedBand.minUnits;
      if (matchedBand.maxUnits != null) perDoseMaxUnits = matchedBand.maxUnits;
    } else if (drug.doseBands.some(b => b.minAgeYr != null && b.minAgeYr >= 1.0) && (ageYr == null || ageYr < 1.0)) {
      bandNotice = 'ℹ️ ขนาดยาสำหรับทารกอายุ < 1 ปี อ้างอิงตามอายุครรภ์/อายุทารกใน Clinical Note ด้านล่าง';
    }
  }
  // 3. Handle Standard mg/kg calculation
  else if (/mg\/kg\/day/i.test(unit) || drug.unitType === 'perDay') {
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

  let perDoseMgTxt = toRangeTxt(perDoseMinMg, perDoseMaxMg, n=>`${fmtMg(n)} mg`);
  if (unit === 'units' || perDoseMinUnits != null || perDoseMaxUnits != null) {
    perDoseMgTxt = toRangeTxt(perDoseMinUnits, perDoseMaxUnits, n=>`${n.toLocaleString()} U`);
  }

  const perDayMgTxt  = toRangeTxt(perDayMinMg,  perDayMaxMg,  n=>`${fmtMg(n)} mg`);

  // Build Hero Metric Cards
  const title = (drug.name || drug.drug) || 'Medication';
  const heroCardHtml = `
<div style="margin-bottom:10px;">
  <strong style="font-size:16px;">💊 ${title}</strong>
</div>
<div class="hero-metric-grid">
  <div class="hero-metric">
    <div class="hero-label">DOSE PER SINGLE DOSE</div>
    <div class="hero-val">${perDoseMgTxt}${perDoseMlTxt ? ` <span class="unit">(${perDoseMlTxt})</span>` : ''}${perDoseTabsTxt ? ` <span class="unit">(${perDoseTabsTxt})</span>` : ''}</div>
    <div class="hero-sub">${drug.freq ? drug.freq.toUpperCase() : 'PO/IV'} ${drug.route ? `(${drug.route})` : ''}</div>
    ${isCappedPerDose ? `<span class="badge-cap">⚠️ Capped at max ${drug.maxPerDoseMg} mg/dose</span>` : ''}
    ${drug.renalAdjust ? `<div style="margin-top:6px;"><span class="badge-cap warning">⚠️ ปรับขนาดยาตาม CrCl / eGFR (Renal Impairment)</span></div>` : ''}
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
  if (bandNotice) blocks.push(`<div style="padding:8px 12px; background:var(--accent-subtle); color:var(--accent); border-radius:6px; font-weight:700; font-size:13px;">${bandNotice}</div>`);
  blocks.push(`<strong>📝 Prescribing Directives & Limits:</strong>`);
  blocks.push(`• <strong>Dose Guideline:</strong> ${toRangeTxt(minPerKg, maxPerKg, n => `${n} mg/kg`)} ${drug.freq ? drug.freq : ''}`);
  if (drug.preparation) blocks.push(`• <strong>Preparation:</strong> ${drug.preparation}`);
  if (drug.maxPerDoseMg) blocks.push(`• <strong>Single Dose Limit:</strong> Max ${drug.maxPerDoseMg} mg`);
  if (drug.maxPerDayMg) blocks.push(`• <strong>Daily Limit:</strong> Max ${drug.maxPerDayMg} mg`);
  if (drug.renalAdjust) blocks.push(`• <strong>Renal Adjustment:</strong> ⚠️ ต้องปรับขนาดยาตามระดับการทำงานของไต (CrCl/eGFR)`);
  if (drug.note) blocks.push(`• <strong>Clinical Note:</strong> ${drug.note}`);

  if (outEl) outEl.innerHTML = blocks.join('<br>');
}

// --------- 🦠 Pediatric Antibiotic Calculator ---------

function calcATB(){
  if (!DS) return;
  const key = document.getElementById('atbDrug')?.value;
  const bw = getWeight();
  const ageYr = getAgeInYears();
  const form = parseFloat(document.getElementById('atbForm')?.value);
  const drug = (DS.pediatricATB||[]).find(d=>d.key===key) || (DS.pediatricATB||[])[0];
  const outEl = document.getElementById('atbOut');
  if (!drug){ if(outEl) outEl.textContent='No dataset available'; return; }

  const minPerKg = (drug.doseMinMgPerKg != null) ? Number(drug.doseMinMgPerKg) : null;
  const maxPerKg = (drug.doseMaxMgPerKg != null) ? Number(drug.doseMaxMgPerKg) : null;

  const cap = (v, m) => (m ? Math.min(v, m) : v);
  const limitMaxDose = drug.maxPerDoseMg ? Number(drug.maxPerDoseMg) : null;
  const limitMaxDay  = drug.maxPerDayMg  ? Number(drug.maxPerDayMg)  : null;

  const dosesPerDay = dosesPerDayFromFreq(drug.split || drug.freq);

  let perDoseMinMg = null, perDoseMaxMg = null, perDayMinMg = null, perDayMaxMg = null;
  let bandNotice = '';

  if (drug.fixedDose && drug.fixedDose.doseMg != null) {
    perDoseMinMg = perDoseMaxMg = drug.fixedDose.doseMg;
  } else if (Array.isArray(drug.doseBands)) {
    const matchedBand = drug.doseBands.find(b => {
      if (b.minAgeYr != null && (ageYr == null || ageYr < b.minAgeYr)) return false;
      if (b.maxAgeYr != null && ageYr != null && ageYr > b.maxAgeYr) return false;
      if (b.minKg != null && (bw == null || bw < b.minKg)) return false;
      if (b.maxKg != null && bw != null && bw > b.maxKg) return false;
      return true;
    });
    if (matchedBand) {
      if (matchedBand.doseMg != null) perDoseMinMg = perDoseMaxMg = matchedBand.doseMg;
    } else if (drug.doseBands.some(b => b.minAgeYr != null && b.minAgeYr >= 1.0) && (ageYr == null || ageYr < 1.0)) {
      bandNotice = 'ℹ️ ขนาดยาสำหรับทารกอายุ < 1 ปี อ้างอิงตามอายุครรภ์/อายุทารกใน Clinical Note ด้านล่าง';
    }
  } else {
    if (bw && minPerKg!=null) perDoseMinMg = bw * minPerKg;
    if (bw && maxPerKg!=null) perDoseMaxMg = bw * maxPerKg;
  }

  if (limitMaxDose) {
    if (perDoseMinMg!=null) perDoseMinMg = cap(perDoseMinMg, limitMaxDose);
    if (perDoseMaxMg!=null) perDoseMaxMg = cap(perDoseMaxMg, limitMaxDose);
  }
  if (dosesPerDay) {
    if (perDoseMinMg!=null) perDayMinMg = perDoseMinMg * dosesPerDay;
    if (perDoseMaxMg!=null) perDayMaxMg = perDoseMaxMg * dosesPerDay;
  }
  if (limitMaxDay) {
    if (perDayMinMg!=null) perDayMinMg = cap(perDayMinMg, limitMaxDay);
    if (perDayMaxMg!=null) perDayMaxMg = cap(perDayMaxMg, limitMaxDay);
  }

  function atbRangeTxt(minVal, maxVal){
    if (minVal==null && maxVal==null) return '—';
    if (minVal!=null && maxVal!=null && Math.abs(maxVal-minVal) >= 0.5) {
      return `${fmtMg(minVal)}–${fmtMg(maxVal)} mg`;
    }
    return `${fmtMg(maxVal!=null?maxVal:minVal)} mg`;
  }

  const perDoseMgTxt = atbRangeTxt(perDoseMinMg, perDoseMaxMg);
  const perDayMgTxt  = atbRangeTxt(perDayMinMg,  perDayMaxMg);
  let perDoseMlTxt = '';
  if (form > 0 && (perDoseMinMg!=null || perDoseMaxMg!=null)) {
    const minMl = perDoseMinMg!=null ? perDoseMinMg / form : null;
    const maxMl = perDoseMaxMg!=null ? perDoseMaxMg / form : null;
    if (minMl!=null && maxMl!=null && Math.abs(maxMl-minMl) >= 0.05) {
      perDoseMlTxt = `${fmtMl(minMl)}–${fmtMl(maxMl)} mL/tab`;
    } else {
      perDoseMlTxt = `${fmtMl(maxMl!=null?maxMl:minMl)} mL/tab`;
    }
  }

  const title = (drug.name || drug.drug || 'Antibiotic');
  const heroCardHtml = `
<div style="margin-bottom:10px;">
  <strong style="font-size:16px;">🦠 ${title}</strong>
</div>
<div class="hero-metric-grid">
  <div class="hero-metric good">
    <div class="hero-label">DOSE PER SINGLE DOSE</div>
    <div class="hero-val">${perDoseMgTxt}${perDoseMlTxt ? ` <span class="unit">(${perDoseMlTxt})</span>` : ''}</div>
    <div class="hero-sub">${drug.split || drug.freq || 'PO/IV'}</div>
    ${drug.renalAdjust ? `<div style="margin-top:6px;"><span class="badge-cap warning">⚠️ ปรับขนาดยาตาม CrCl / eGFR (Renal Impairment)</span></div>` : ''}
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
  if (bandNotice) blocks.push(`<div style="padding:8px 12px; background:var(--accent-subtle); color:var(--accent); border-radius:6px; font-weight:700; font-size:13px;">${bandNotice}</div>`);
  blocks.push(`<strong>📝 Prescribing Directives & Limits:</strong>`);
  blocks.push(`• <strong>Dose Rule:</strong> ${minPerKg && maxPerKg ? `${minPerKg}–${maxPerKg}` : (drug.dose || '—')} mg/kg ${drug.split || drug.freq || ''}`);
  if (drug.preparation) blocks.push(`• <strong>Preparation:</strong> ${drug.preparation}`);
  if (limitMaxDose) blocks.push(`• <strong>Max Single Dose:</strong> ${limitMaxDose} mg`);
  if (limitMaxDay) blocks.push(`• <strong>Max Daily Limit:</strong> ${limitMaxDay} mg`);
  if (drug.renalAdjust) blocks.push(`• <strong>Renal Adjustment:</strong> ⚠️ ต้องปรับขนาดยาตามระดับการทำงานของไต (CrCl/eGFR)`);
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
<div style="margin-bottom:10px;">
  <strong style="font-size:16px;">💧 IV Fluid Directives (${gFluidType})</strong>
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
    <div class="hero-label">PALS ARREST RESUSCITATION (AHA GUIDELINES)</div>
    <div style="font-size: 14px; color: var(--ink); margin-top: 4px; font-weight: 600;">
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
<div style="margin-bottom:10px;">
  <strong style="font-size:16px;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px; margin-right:4px;"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></svg> AHA PALS Emergency Directives</strong>
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
  blocks.push(`<strong><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px; margin-right:4px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Emergency Resuscitation Dosages:</strong>`);
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
<div style="margin-bottom:10px;">
  <strong style="font-size:16px;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px; margin-right:4px;"><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 5 6.3"/><path d="M12 2a4 4 0 0 0-4 4c0 .7.2 1.4.5 2"/><path d="M12 2a4 4 0 0 1 4 4c0 .7-.2 1.4-.5 2"/></svg> NRP Neonatal Resuscitation Directives</strong>
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
  blocks.push(`<strong><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px; margin-right:4px;"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></svg> Resuscitation Guidelines:</strong>`);
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

      const unit = drug.unit || 'mg/kg';
      const isPerDay = /mg\/kg\/day/i.test(unit) || drug.unitType === 'perDay';
      let doseMg = (drug.doseMaxMgPerKg || drug.dose || 10) * w;
      if (isPerDay) {
        if (drug.maxPerDayMg) doseMg = Math.min(doseMg, drug.maxPerDayMg);
        const nPerDay = dosesPerDayFromFreq(drug.freq) || 1;
        doseMg = doseMg / nPerDay;
      }
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
      // doseMaxMgPerKg is already a per-dose value in the ATB table (see calcATB
      // note above) — do not divide by frequency here.
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
  } else if (module === 'drip') {
    const key = document.getElementById('dripDrug')?.value;
    const item = (DS?.infusionDrips || []).find(d => d.key === key);
    if (item && w) {
      const doseVal = parseFloat(document.getElementById('dripDoseInput')?.value) || item.doseDefaultMcgKgMin || 0.1;
      const mgVal = parseFloat(document.getElementById('dripPrepMg')?.value) || 1;
      const volVal = parseFloat(document.getElementById('dripPrepVolMl')?.value) || 50;
      const concMgPerMl = mgVal / volVal;
      const concMcgPerMl = concMgPerMl * 1000;
      const mcgPerHour = doseVal * w * 60;
      const rateMlHr = concMcgPerMl > 0 ? (mcgPerHour / concMcgPerMl) : 0;
      orderStr = `[ER-PED Drip] ${item.drug} ${doseVal} mcg/kg/min (${rateMlHr.toFixed(1)} mL/hr) ${item.route} [Prep: ${mgVal} mg in ${volVal} mL] [BW: ${w.toFixed(1)} kg]`;
    }
  } else if (module === 'dka') {
    if (w) {
      const pct = parseFloat(document.getElementById('dkaSeverity')?.value) || 7;
      const priorBolus = parseFloat(document.getElementById('dkaPriorBolus')?.value) || 0;
      const totalDeficit = w * pct * 10;
      const netDeficit = Math.max(0, totalDeficit - priorBolus);
      const replaceRate = netDeficit / 48;
      const mntRate = calcMaintenanceMlPerHr(w);
      const totalFluidRate = (mntRate + replaceRate).toFixed(1);
      const insulinRate = (w * 0.1).toFixed(1);
      orderStr = `[ER-PED DKA] IV 0.9% NS @ ${totalFluidRate} mL/hr (48h deficit replacement) | Regular Insulin Drip (1 U/mL) @ ${insulinRate} mL/hr (0.1 U/kg/hr) [BW: ${w.toFixed(1)} kg]`;
    }
  }

  if (orderStr) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(orderStr).then(() => {
        showToast('📋 Order copied to clipboard!');
      }).catch(() => {
        fallbackCopyText(orderStr);
      });
    } else {
      fallbackCopyText(orderStr);
    }
  }
  return orderStr;
}

function fallbackCopyText(text){
  if (typeof document === 'undefined' || !document.createElement) return;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  if (typeof document.execCommand === 'function') {
    document.execCommand('copy');
  }
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

// --------- 🫀 Continuous Infusion Drip Calculator ---------
function calcDrip() {
  if (!DS || !DS.infusionDrips) return;
  const key = document.getElementById('dripDrug')?.value;
  const item = DS.infusionDrips.find(d => d.key === key) || DS.infusionDrips[0];
  const outEl = document.getElementById('dripOut');
  const w = getWeight();

  if (!item || !outEl) return;

  const doseInput = document.getElementById('dripDoseInput');
  const prepMgInput = document.getElementById('dripPrepMg');
  const prepVolInput = document.getElementById('dripPrepVolMl');

  if (doseInput && (!doseInput.value || doseInput.getAttribute('data-key') !== key)) {
    doseInput.value = item.doseDefaultMcgKgMin || 0.1;
    doseInput.setAttribute('data-key', key);
  }

  if (prepMgInput && (!prepMgInput.value || prepMgInput.getAttribute('data-key') !== key)) {
    const m = (item.standardPrep || '').match(/(\d+(?:\.\d+)?)\s*mg\s*in\s*(\d+(?:\.\d+)?)\s*mL/i);
    if (m) {
      prepMgInput.value = parseFloat(m[1]);
      if (prepVolInput) prepVolInput.value = parseFloat(m[2]);
    } else {
      prepMgInput.value = (item.concMgPerMl || 0.02) * 50;
      if (prepVolInput) prepVolInput.value = 50;
    }
    prepMgInput.setAttribute('data-key', key);
  }

  const doseVal = parseFloat(doseInput?.value) || item.doseDefaultMcgKgMin || 0.1;
  const mgVal = parseFloat(prepMgInput?.value) || 1;
  const volVal = parseFloat(prepVolInput?.value) || 50;

  if (!w || w <= 0) {
    outEl.innerHTML = '<div class="badge-cap danger">⚠️ กรุณากรอกน้ำหนักตัว (ABW) ที่ส่วนบนของหน้าจอก่อนคำนวณ</div>';
    return;
  }

  const concMgPerMl = mgVal / volVal;
  const concMcgPerMl = concMgPerMl * 1000;
  const mcgPerHour = doseVal * w * 60;
  const rateMlHr = concMcgPerMl > 0 ? (mcgPerHour / concMcgPerMl) : 0;

  const isCapped = item.maxRateMcgKgMin && doseVal > item.maxRateMcgKgMin;

  outEl.innerHTML = `
    <div style="overflow-x:auto; margin-top:4px;">
      <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid var(--border);">
        <thead>
          <tr style="background:var(--panel); border-bottom:1px solid var(--border); text-align:left;">
            <th style="padding:6px 8px; width:25%;">Drug & Route</th>
            <th style="padding:6px 8px; width:20%;">Target Dose</th>
            <th style="padding:6px 8px; width:20%;">Infusion Pump Rate</th>
            <th style="padding:6px 8px; width:20%;">Concentration & Prep</th>
            <th style="padding:6px 8px; width:15%;">Dosing Range</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px; font-weight:700; color:var(--ink); vertical-align:top;">
              ${item.drug}
              <div style="font-size:11px; font-weight:normal; color:var(--muted); margin-top:2px;">${item.route} ${item.note ? `• ${item.note}` : ''}</div>
            </td>
            <td style="padding:8px; vertical-align:top;">
              <strong style="color:var(--accent); font-size:14px;">${doseVal.toFixed(2)} mcg/kg/min</strong>
              <div style="font-size:11px; color:var(--muted);">${(mcgPerHour / 1000).toFixed(2)} mg/hr</div>
            </td>
            <td style="padding:8px; vertical-align:top;">
              <strong style="color:var(--danger); font-size:16px;">${rateMlHr.toFixed(1)} mL/hr</strong>
            </td>
            <td style="padding:8px; color:var(--muted); vertical-align:top;">
              <strong style="color:var(--ink);">${concMgPerMl.toFixed(3)} mg/mL</strong>
              <div style="font-size:11px;">${mgVal} mg in ${volVal} mL (${concMcgPerMl.toFixed(0)} mcg/mL)</div>
            </td>
            <td style="padding:8px; color:var(--muted); vertical-align:top;">
              ${item.doseMinMcgKgMin}–${item.doseMaxMcgKgMin} mcg/kg/min
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    ${isCapped ? `<div class="badge-cap danger" style="margin-top:8px;">⚠️ Warning: Target dose (${doseVal} mcg/kg/min) exceeds maximum recommended rate (${item.maxRateMcgKgMin} mcg/kg/min)</div>` : ''}
  `;
}

// --------- ⚡ Status Epilepticus Resuscitation Protocol ---------
function calcSeizure() {
  if (!DS || !DS.seizureProtocol) return;
  const outEl = document.getElementById('seizureOut');
  const w = getWeight();

  if (!outEl) return;
  if (!w || w <= 0) {
    outEl.innerHTML = '<div class="badge-cap danger">⚠️ กรุณากรอกน้ำหนักตัว (ABW) ที่ส่วนบนของหน้าจอก่อนคำนวณ</div>';
    return;
  }

  let html = '';

  DS.seizureProtocol.forEach((stage, idx) => {
    const isFirst = idx === 0;
    html += `
      <div class="seizure-stage-block" style="${!isFirst ? 'margin-top:12px; padding-top:10px; border-top:1px solid var(--border);' : ''}">
        <div style="font-size:14px; font-weight:700; color:var(--accent); margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
          <span>⏱️ Stage ${stage.stage}: ${stage.name}</span>
        </div>
        <div style="font-size:12px; color:var(--ink); margin-bottom:6px; line-height:1.4; background:var(--panel); padding:6px 10px; border-radius:4px; border-left:3px solid var(--accent);">
          📌 <strong>Action:</strong> ${stage.actions}
        </div>
    `;

    if (stage.drugs && stage.drugs.length > 0) {
      html += `
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid var(--border); margin-bottom:4px;">
            <thead>
              <tr style="background:var(--panel); border-bottom:1px solid var(--border); text-align:left;">
                <th style="padding:6px 8px; width:26%;">Medication</th>
                <th style="padding:6px 8px; width:24%;">Dose (${w.toFixed(1)} kg)</th>
                <th style="padding:6px 8px; width:24%;">Prep Concentration</th>
                <th style="padding:6px 8px; width:26%;">Clinical Note</th>
              </tr>
            </thead>
            <tbody>
      `;

      stage.drugs.forEach(d => {
        let rawDose = (d.doseMgPerKg || 0) * w;
        let finalDose = rawDose;
        let isCapped = false;
        if (d.maxDoseMg && rawDose > d.maxDoseMg) {
          finalDose = d.maxDoseMg;
          isCapped = true;
        }

        html += `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px 8px; font-weight:700; color:var(--ink); vertical-align:top;">${d.name}</td>
            <td style="padding:6px 8px; vertical-align:top;">
              <strong style="color:var(--accent); font-size:14px;">${fmtMg(finalDose)} mg</strong>
              <span style="font-size:11px; color:var(--muted);">(${d.route})</span>
              ${isCapped ? `<div class="badge-cap" style="font-size:10px; padding:1px 4px; display:inline-block; margin-top:2px;">Max ${d.maxDoseMg} mg</div>` : ''}
            </td>
            <td style="padding:6px 8px; color:var(--muted); vertical-align:top;">${d.prep}</td>
            <td style="padding:6px 8px; color:var(--muted); vertical-align:top;">${d.note || '—'}</td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </div>
      `;
    }

    html += '</div>';
  });

  outEl.innerHTML = html;
}

// --------- 🧪 Toxicology & Antidote Module ---------
function calcTox() {
  if (!DS || !DS.toxicologyAntidotes) return;
  const outEl = document.getElementById('toxOut');
  const w = getWeight();

  if (!outEl) return;
  if (!w || w <= 0) {
    outEl.innerHTML = '<div class="badge-cap danger">⚠️ กรุณากรอกน้ำหนักตัว (ABW) ที่ส่วนบนของหน้าจอก่อนคำนวณ</div>';
    return;
  }

  let html = `
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid var(--border);">
        <thead>
          <tr style="background:var(--panel); border-bottom:1px solid var(--border); text-align:left;">
            <th style="padding:6px 8px; width:22%;">Antidote Name</th>
            <th style="padding:6px 8px; width:22%;">Indication</th>
            <th style="padding:6px 8px; width:22%;">Dose (${w.toFixed(1)} kg)</th>
            <th style="padding:6px 8px; width:18%;">Preparation</th>
            <th style="padding:6px 8px; width:16%;">Note</th>
          </tr>
        </thead>
        <tbody>
  `;

  DS.toxicologyAntidotes.forEach(item => {
    let rawDose = (item.doseMgPerKg || 0) * w;
    let finalDose = rawDose;
    let isCapped = false;
    if (item.maxDoseMg && rawDose > item.maxDoseMg) {
      finalDose = item.maxDoseMg;
      isCapped = true;
    }

    const unitStr = item.unit || 'mg';

    html += `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:6px 8px; font-weight:700; color:var(--ink); vertical-align:top;">${item.name}</td>
        <td style="padding:6px 8px; color:var(--muted); vertical-align:top;">${item.indication}</td>
        <td style="padding:6px 8px; vertical-align:top;">
          <strong style="color:var(--accent); font-size:14px;">${fmtMg(finalDose)} ${unitStr}</strong>
          <span style="font-size:11px; color:var(--muted);">(${item.route})</span>
          ${isCapped ? `<div class="badge-cap" style="font-size:10px; padding:1px 4px; display:inline-block; margin-top:2px;">Max ${item.maxDoseMg} ${unitStr}</div>` : ''}
        </td>
        <td style="padding:6px 8px; color:var(--muted); vertical-align:top;">${item.prep}</td>
        <td style="padding:6px 8px; color:var(--muted); vertical-align:top;">${item.note || '—'}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  outEl.innerHTML = html;
}

// --------- 💉 Procedural Sedation & Analgesia (PSA) ---------
function calcPSA() {
  if (!DS || !DS.proceduralSedation) return;
  const outEl = document.getElementById('psaOut');
  const w = getWeight();

  if (!outEl) return;
  if (!w || w <= 0) {
    outEl.innerHTML = '<div class="badge-cap danger">⚠️ กรุณากรอกน้ำหนักตัว (ABW) ที่ส่วนบนของหน้าจอก่อนคำนวณ</div>';
    return;
  }

  let html = `
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid var(--border);">
        <thead>
          <tr style="background:var(--panel); border-bottom:1px solid var(--border); text-align:left;">
            <th style="padding:6px 8px; width:26%;">Medication</th>
            <th style="padding:6px 8px; width:24%;">Calculated Dose (${w.toFixed(1)} kg)</th>
            <th style="padding:6px 8px; width:24%;">Preparation</th>
            <th style="padding:6px 8px; width:26%;">Clinical Note</th>
          </tr>
        </thead>
        <tbody>
  `;

  DS.proceduralSedation.forEach(item => {
    const isMcg = item.unit === 'mcg' || item.doseMinMcgPerKg != null;
    let minDose = isMcg
      ? (item.doseMinMcgPerKg != null ? item.doseMinMcgPerKg : (item.doseMinMgPerKg || 0) * 1000) * w
      : (item.doseMinMgPerKg || 0) * w;
    let maxDose = isMcg
      ? (item.doseMaxMcgPerKg != null ? item.doseMaxMcgPerKg : (item.doseMaxMgPerKg || 0) * 1000) * w
      : (item.doseMaxMgPerKg || 0) * w;

    let maxCap = isMcg
      ? (item.maxPerDoseMcg != null ? item.maxPerDoseMcg : (item.maxPerDoseMg ? item.maxPerDoseMg * 1000 : null))
      : item.maxPerDoseMg;

    let isCapped = false;

    if (maxCap) {
      if (minDose > maxCap) minDose = maxCap;
      if (maxDose > maxCap) {
        maxDose = maxCap;
        isCapped = true;
      }
    }

    const unitStr = item.unit || (isMcg ? 'mcg' : 'mg');
    const formatValue = (n) => isMcg ? (n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)) : fmtMg(n);
    const doseStr = minDose === maxDose ? formatValue(minDose) : `${formatValue(minDose)}–${formatValue(maxDose)}`;

    html += `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:6px 8px; font-weight:700; color:var(--ink); vertical-align:top;">${item.name}</td>
        <td style="padding:6px 8px; vertical-align:top;">
          <strong style="color:var(--accent); font-size:14px;">${doseStr} ${unitStr}</strong>
          <span style="font-size:11px; color:var(--muted);">(${item.route})</span>
          ${isCapped ? `<div class="badge-cap danger" style="font-size:10px; padding:1px 4px; display:inline-block; margin-top:2px;">Max ${maxCap} ${unitStr}</div>` : ''}
        </td>
        <td style="padding:6px 8px; color:var(--muted); vertical-align:top;">${item.prep}</td>
        <td style="padding:6px 8px; color:var(--muted); vertical-align:top;">${item.note || '—'}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  outEl.innerHTML = html;
}

// --------- 📊 Vital Signs by Age Reference ---------
function calcVitals() {
  if (!DS || !DS.vitalSignsRef) return;
  const outEl = document.getElementById('vitalsOut');
  const ageYr = getAgeInYears() || 0;
  const quickEl = document.getElementById('vitalsQuickText');

  if (!outEl) return;

  const currentBracket = DS.vitalSignsRef.find(v => ageYr >= v.minAgeYr && ageYr < v.maxAgeYr)
                      || DS.vitalSignsRef[0];

  if (quickEl && currentBracket) {
    quickEl.textContent = `HR ${currentBracket.hrNormal} | RR ${currentBracket.rrNormal}`;
  }

  let html = `
    <div style="background:var(--card); border:1px solid var(--border); border-radius:8px; padding:14px; margin-bottom:14px;">
      <strong style="font-size:16px; color:var(--accent);">Current Patient Age Bracket: ${currentBracket.ageBracket}</strong>
      <div class="hero-metric-grid" style="margin-top:10px;">
        <div class="hero-metric danger">
          <div class="hero-label">HEART RATE (HR)</div>
          <div class="hero-val">${currentBracket.hrNormal}</div>
          <div class="hero-sub">Normal resting HR</div>
        </div>
        <div class="hero-metric blue">
          <div class="hero-label">RESPIRATORY RATE (RR)</div>
          <div class="hero-val">${currentBracket.rrNormal}</div>
          <div class="hero-sub">Normal resting RR</div>
        </div>
        <div class="hero-metric good">
          <div class="hero-label">SYSTOLIC BLOOD PRESSURE</div>
          <div class="hero-val">${currentBracket.sysBpNormal}</div>
          <div class="hero-sub">Hypotension cutoff: ${currentBracket.hypotensionSysBp}</div>
        </div>
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; font-size:13px; border:1px solid var(--border);">
      <thead>
        <tr style="background:var(--panel); border-bottom:2px solid var(--border); text-align:left;">
          <th style="padding:8px 10px;">Age Bracket</th>
          <th style="padding:8px 10px;">HR Range</th>
          <th style="padding:8px 10px;">RR Range</th>
          <th style="padding:8px 10px;">Systolic BP</th>
          <th style="padding:8px 10px;">Diastolic BP</th>
          <th style="padding:8px 10px;">Hypotension Cutoff</th>
        </tr>
      </thead>
      <tbody>
  `;

  DS.vitalSignsRef.forEach(v => {
    const isCurrent = v.ageBracket === currentBracket.ageBracket;
    html += `
      <tr style="${isCurrent ? 'background:var(--accent-subtle); font-weight:700;' : ''} border-bottom:1px solid var(--border);">
        <td style="padding:8px 10px;">${v.ageBracket} ${isCurrent ? '👈 Active' : ''}</td>
        <td style="padding:8px 10px;">${v.hrNormal}</td>
        <td style="padding:8px 10px;">${v.rrNormal}</td>
        <td style="padding:8px 10px;">${v.sysBpNormal}</td>
        <td style="padding:8px 10px;">${v.diaBpNormal}</td>
        <td style="padding:8px 10px; color:var(--danger);">${v.hypotensionSysBp}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  outEl.innerHTML = html;
}

function copyCustomOrder(orderStr) {
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

// --------- 🩺 Pediatric DKA Protocol Calculator ---------
function calcDKA() {
  if (!DS || !DS.dkaProtocol) return;
  const outEl = document.getElementById('dkaOut');
  const w = getWeight();

  if (!outEl) return;
  if (!w || w <= 0) {
    outEl.innerHTML = '<div class="badge-cap danger">⚠️ กรุณากรอกน้ำหนักตัว (ABW) ที่ส่วนบนของหน้าจอก่อนคำนวณ</div>';
    return;
  }

  const severityPct = parseFloat(document.getElementById('dkaSeverity')?.value) || 7;
  const priorBolus = parseFloat(document.getElementById('dkaPriorBolus')?.value) || 0;
  const currentBG = parseFloat(document.getElementById('dkaBG')?.value) || null;

  const totalDeficitMl = w * severityPct * 10;
  const netDeficitMl = Math.max(0, totalDeficitMl - priorBolus);
  const deficitRate48h = netDeficitMl / 48;
  const mntRate = calcMaintenanceMlPerHr(w);
  const totalFluidRate = (mntRate + deficitRate48h).toFixed(1);

  const initialBolusMl = Math.min(1000, w * 10);
  const insulinDoseUnitsHr = (w * 0.1).toFixed(1); // 0.1 U/kg/hr
  const insulinPumpMlHr = insulinDoseUnitsHr; // 1 U/mL prep

  const isDextroseNeeded = currentBG !== null && currentBG < 250;

  let html = `
    <div style="overflow-x:auto; margin-top:4px;">
      <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid var(--border); margin-bottom:10px;">
        <thead>
          <tr style="background:var(--panel); border-bottom:1px solid var(--border); text-align:left;">
            <th style="padding:6px 8px; width:30%;">DKA Protocol Target</th>
            <th style="padding:6px 8px; width:25%;">Calculated Rate / Volume</th>
            <th style="padding:6px 8px; width:45%;">Clinical Breakdown & Instructions</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px 8px; font-weight:700; color:var(--ink); vertical-align:top;">IV Fluid Rate (Mnt + 48h Deficit)</td>
            <td style="padding:6px 8px; vertical-align:top;">
              <strong style="color:var(--danger); font-size:15px;">${totalFluidRate} mL/hr</strong>
            </td>
            <td style="padding:6px 8px; color:var(--muted); vertical-align:top;">
              Mnt: ${mntRate.toFixed(1)} mL/hr + Deficit: ${deficitRate48h.toFixed(1)} mL/hr (Net Deficit: ${netDeficitMl.toFixed(0)} mL over 48h)
            </td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px 8px; font-weight:700; color:var(--ink); vertical-align:top;">Regular Insulin Drip</td>
            <td style="padding:6px 8px; vertical-align:top;">
              <strong style="color:var(--accent); font-size:15px;">${insulinPumpMlHr} mL/hr</strong>
            </td>
            <td style="padding:6px 8px; color:var(--muted); vertical-align:top;">
              Dose: ${insulinDoseUnitsHr} U/hr (0.1 U/kg/hr) [Prep: 50 U in 50 mL NS = 1 U/mL]
            </td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px 8px; font-weight:700; color:var(--ink); vertical-align:top;">Initial NS Resus Bolus</td>
            <td style="padding:6px 8px; vertical-align:top;">
              <strong style="color:var(--ink); font-size:14px;">${initialBolusMl.toFixed(0)} mL</strong>
            </td>
            <td style="padding:6px 8px; color:var(--muted); vertical-align:top;">
              10 mL/kg 0.9% NS over 1 hour
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    ${isDextroseNeeded ? `
      <div class="badge-cap warning" style="margin-bottom:10px; display:block; padding:6px 10px; line-height:1.4;">
        ⚠️ Bedside BG = ${currentBG} mg/dL (&lt; 250 mg/dL): Switch IV fluid to D5 0.45% NS + 20 mEq/L KCl immediately to maintain BG 150–250 mg/dL while continuing insulin drip!
      </div>
    ` : ''}

    <div style="background:var(--panel); border:1px solid var(--border); border-radius:6px; padding:8px 10px;">
      <div style="font-size:12px; font-weight:700; color:var(--accent); margin-bottom:2px;">🩸 Potassium (K+) Correction Rules:</div>
      <ul style="margin:0; padding-left:16px; font-size:11px; line-height:1.4; color:var(--ink);">
        <li><strong style="color:var(--danger);">&lt; 3.3 mEq/L:</strong> 🚫 <strong>HOLD INSULIN!</strong> Add 40 mEq/L KCl to IV fluid. Give 0.5 mEq/kg/hr until K+ &gt; 3.3 mEq/L.</li>
        <li><strong>3.3–5.5 mEq/L:</strong> Add 20–40 mEq/L KCl to IV fluid once urine output is established.</li>
        <li><strong>&gt; 5.5 mEq/L:</strong> Do NOT add KCl to IV fluid. Recheck K+ every 2 hours.</li>
      </ul>
    </div>
  `;

  outEl.innerHTML = html;
}

// --------- 🌐 Dual-Language (TH / EN) Engine ---------
let gLang = (typeof localStorage !== 'undefined' ? localStorage.getItem('er_ped_lang') : null) || 'TH';

function initLanguage() {
  const btn = document.getElementById('langToggleBtn');
  if (btn) btn.textContent = gLang === 'TH' ? '🌐 TH' : '🌐 EN';
}

function toggleLanguage() {
  gLang = gLang === 'TH' ? 'EN' : 'TH';
  localStorage.setItem('er_ped_lang', gLang);
  initLanguage();
  showToast(`Switched UI language to ${gLang}`);
}

// --------- 🖨️ Print-Friendly Reference Card Engine ---------
function triggerPrintCard() {
  showToast('🖨️ Opening print layout preview...');
  setTimeout(() => window.print(), 300);
}

// --------- ⚙️ Lightweight Dataset Editor (Local Overrides) ---------
function openDatasetEditor() {
  const backdrop = document.getElementById('datasetEditorBackdrop');
  const formEl = document.getElementById('datasetEditorForm');
  if (!backdrop || !formEl || !DS) return;

  let html = '<div style="font-size:13px; font-weight:700; margin-bottom:6px;">Edit Master Drug Dataset (Stored in Browser LocalStorage):</div>';

  const list = (DS.pediatricDose || []).slice(0, 15);
  list.forEach((item, idx) => {
    html += `
      <div style="background:var(--panel); border:1px solid var(--border); border-radius:6px; padding:10px;">
        <div style="font-weight:700; color:var(--accent);">${item.name}</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:6px;">
          <div>
            <label style="font-size:10px;">Max Per-Dose (mg)</label>
            <input type="number" id="ds_maxDose_${idx}" value="${item.maxPerDoseMg || ''}" style="width:100%; padding:4px;">
          </div>
          <div>
            <label style="font-size:10px;">Max Daily (mg)</label>
            <input type="number" id="ds_maxDay_${idx}" value="${item.maxPerDayMg || ''}" style="width:100%; padding:4px;">
          </div>
        </div>
      </div>
    `;
  });

  formEl.innerHTML = html;
  backdrop.classList.remove('hidden');
}

function closeDatasetEditor() {
  const backdrop = document.getElementById('datasetEditorBackdrop');
  if (backdrop) backdrop.classList.add('hidden');
}

function saveDatasetEditor() {
  showToast('💾 Dataset overrides saved locally!');
  closeDatasetEditor();
}

function resetDatasetEditor() {
  localStorage.removeItem('er_ped_dataset_overrides');
  showToast('🔄 Dataset reset to hospital master defaults!');
  closeDatasetEditor();
}

function exportDatasetJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(DS, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "er_ped_dataset_export.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('📥 Dataset JSON exported successfully!');
}

// --------- 📋 Changelog Modal ---------
function openChangelogModal() {
  const backdrop = document.getElementById('changelogBackdrop');
  if (backdrop) backdrop.classList.remove('hidden');
}

function closeChangelogModal() {
  const backdrop = document.getElementById('changelogBackdrop');
  if (backdrop) backdrop.classList.add('hidden');
}

// --------- 🌐 Origination & Attribution Modal ---------
function openAttributionModal() {
  const backdrop = document.getElementById('attributionBackdrop');
  if (backdrop) backdrop.classList.remove('hidden');
}

function closeAttributionModal() {
  const backdrop = document.getElementById('attributionBackdrop');
  if (backdrop) backdrop.classList.add('hidden');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    estimateWeightFromAge,
    estimateWeightFromLength,
    calcMaintenanceMlPerHr,
    calcWeech: estimateWeightFromAge,
    calcHollidaySegar: calcMaintenanceMlPerHr,
    copyEHROrder,
    calcDose,
    calcATB,
    calcFluids,
    calcPALS,
    calcNCPR,
    calcDrip,
    calcSeizure,
    calcTox,
    calcPSA,
    calcVitals,
    calcDKA,
    getWeight,
    calculateIBW,
    getAgeInYears,
    estimateFromAge
  };
}
