// --- PWA: register service worker & A2HS prompt ---
if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      setInterval(() => reg.update(), 30 * 60 * 1000);
      syncVersionFromSW();
      // Show banner on controller change (new SW detected)
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            const banner = document.getElementById('pwaUpdateBanner');
            if (banner) banner.style.display = 'flex';
            syncVersionFromSW();
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
var gSex = 'male';
if (typeof window !== 'undefined') window.gSex = gSex;
var gSepsisMode = 'phoenix';
if (typeof window !== 'undefined') window.gSepsisMode = gSepsisMode;
var gSeizureTimerInterval = null;
var gSeizureTimerSeconds = 0;
if (typeof window !== 'undefined') window.gSeizureTimerSeconds = gSeizureTimerSeconds;
var gSeizureTimerRunning = false;
if (typeof window !== 'undefined') window.gSeizureTimerRunning = gSeizureTimerRunning;
var gAppMode = 'v1';
if (typeof window !== 'undefined') window.gAppMode = gAppMode;
let activeTab = 'dose';

function initAppMode() {
  const saved = (typeof localStorage !== 'undefined') ? (localStorage.getItem('er_ped_app_mode') || 'v1') : 'v1';
  setAppMode(saved, false);
}

function setAppMode(mode, triggerVT = true) {
  if (mode !== 'v1' && mode !== 'v2') mode = 'v1';
  gAppMode = mode;
  if (typeof window !== 'undefined') window.gAppMode = mode;
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem('er_ped_app_mode', mode); } catch (_) {}
  }

  const applyDomChanges = () => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-app-mode', mode);
      
      // Update Topbar Mode Switcher Buttons
      const v1Btn = document.querySelector('.mode-switch-btn[data-mode="v1"]');
      const v2Btn = document.querySelector('.mode-switch-btn[data-mode="v2"]');
      if (v1Btn) {
        v1Btn.classList.toggle('active', mode === 'v1');
        v1Btn.setAttribute('aria-checked', mode === 'v1' ? 'true' : 'false');
      }
      if (v2Btn) {
        v2Btn.classList.toggle('active', mode === 'v2');
        v2Btn.setAttribute('aria-checked', mode === 'v2' ? 'true' : 'false');
      }

      // Update Overflow Menu Label
      const menuText = document.getElementById('modeSwitchMenuText');
      if (menuText) {
        menuText.textContent = mode === 'v1' ? 'Switch to V2' : 'Switch to V1';
      }
    }
  };

  if (triggerVT && typeof document !== 'undefined' && document.startViewTransition) {
    document.startViewTransition(() => {
      applyDomChanges();
      if (mode === 'v1') calcV1Mode();
    });
  } else {
    applyDomChanges();
    if (mode === 'v1') calcV1Mode();
  }
}

function toggleAppMode() {
  setAppMode(gAppMode === 'v1' ? 'v2' : 'v1');
}

function getAppMode() {
  return gAppMode;
}

function stepWeight(delta) {
  const current = getWeight() || 10;
  let next = Math.round((current + delta) * 10) / 10;
  if (next < 1) next = 1;
  if (next > 100) next = 100;
  applyQuickWeight(next);
}

function scrollToV1Section(secId, btn) {
  if (typeof document === 'undefined') return;
  const sec = document.getElementById(secId);
  if (sec && typeof sec.scrollIntoView === 'function') {
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (btn) {
    document.querySelectorAll('.v1-dock-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
}

function searchV1Items(query) {
  const q = (query || '').toLowerCase().trim();
  if (typeof document === 'undefined') return;
  const clearBtn = document.getElementById('v1SearchClear');
  if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

  const cards = document.querySelectorAll('.v1-card');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    const matches = !q || text.includes(q);
    card.style.display = matches ? 'flex' : 'none';
  });

  const sections = document.querySelectorAll('.v1-section');
  sections.forEach(sec => {
    const visibleCards = sec.querySelectorAll('.v1-card:not([style*="display: none"])');
    sec.style.display = (visibleCards.length > 0) ? 'block' : 'none';
  });
}

function clearV1Search() {
  if (typeof document === 'undefined') return;
  const inp = document.getElementById('v1SearchInput');
  if (inp) {
    inp.value = '';
    searchV1Items('');
    inp.focus();
  }
}

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

const THEMES = ['light', 'dark', 'mono', 'red'];

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
    else if (t === 'red') btn.innerHTML = 'Red';
    else if (t === 'dark') btn.innerHTML = 'Dark';
    else btn.innerHTML = 'Light';
  }
  if (typeof refreshBroselowChip === 'function') refreshBroselowChip();
  if (typeof renderBroselowMiniSpectrum === 'function') renderBroselowMiniSpectrum();
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
  initAppMode();
  populateDrugs();
  initComboboxes();
  setupKeyboardShortcuts();
  syncTopbarHeight();
  calculateIBW();
  updateBiometricUIState();
  syncVersionFromSW();

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

// --------- 🔄 Version Auto-Sync from sw.js / Cache API ---------
function applyVersionToUI(versionStr) {
  if (!versionStr) return;
  const rawVer = versionStr.toString().trim().replace(/^v/i, '');
  const ver = `v${rawVer}`;

  const chip = document.getElementById('footerVersionChip') || (typeof document !== 'undefined' ? document.querySelector('.version-chip') : null);
  if (chip) {
    chip.textContent = ver;
    chip.title = `ดูบันทึกการเปลี่ยนแปลง ${ver}`;
  }

  const titleVer = typeof document !== 'undefined' ? document.getElementById('changelogVersionNumber') : null;
  if (titleVer) titleVer.textContent = rawVer;

  const whatsNewVer = typeof document !== 'undefined' ? document.getElementById('changelogWhatsNewVersion') : null;
  if (whatsNewVer) whatsNewVer.textContent = rawVer;

  if (typeof document !== 'undefined') {
    document.querySelectorAll('.app-version-val').forEach(el => {
      el.textContent = ver;
    });
  }
}

function syncVersionFromSW() {
  // 1. Try CacheStorage keys if available (offline-instant)
  if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
    caches.keys().then(keys => {
      const swCaches = keys.filter(k => k.startsWith('er-ped-v')).sort();
      const swCache = swCaches[swCaches.length - 1];
      if (swCache) {
        const m = swCache.match(/er-ped-v([0-9.]+)/);
        if (m && m[1]) applyVersionToUI(m[1]);
      }
    }).catch(() => {});
  }

  // 2. Fetch sw.js directly to read latest defined CACHE_NAME
  if (typeof fetch === 'function' && typeof location !== 'undefined' && (location.protocol === 'http:' || location.protocol === 'https:')) {
    fetch('sw.js', { cache: 'no-cache' })
      .then(res => res.ok ? res.text() : '')
      .then(text => {
        if (!text) return;
        const m = text.match(/CACHE_NAME\s*=\s*['"]er-ped-v([0-9.]+)/);
        if (m && m[1]) {
          applyVersionToUI(m[1]);
        }
      })
      .catch(() => {});
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

  refreshBroselowChip();
  if (typeof renderBroselowMiniSpectrum === 'function') renderBroselowMiniSpectrum();
  calcAll();
}

function getBroselowZone(w) {
  if (!w || typeof w !== 'number' || w <= 0 || !DS || !DS.broselow) return null;
  for (const b of DS.broselow) {
    if (w >= b.min && w <= b.max) return b;
  }
  return null;
}

function applyQuickWeight(kg) {
  if (typeof kg !== 'number' || kg <= 0) return;
  const weightInput = document.getElementById('weight');
  const useIBWBox = document.getElementById('useIBW');
  if (useIBWBox && useIBWBox.checked) useIBWBox.checked = false;
  
  gUserABW = kg;
  gWeightSource = 'manual';
  if (weightInput) weightInput.value = String(kg);

  // If age is not set or zero, derive an age estimate aligned with Broselow & Weech formula
  const ageInput = document.getElementById('age');
  if (ageInput && (!ageInput.value || parseFloat(ageInput.value) <= 0)) {
    if (kg <= 5.5) {
      gAgeUnit = 'mo';
      ageInput.value = '1';
    } else if (kg <= 7.9) {
      gAgeUnit = 'mo';
      ageInput.value = '4';
    } else if (kg <= 9.9) {
      gAgeUnit = 'mo';
      ageInput.value = '9';
    } else if (kg <= 11.9) {
      gAgeUnit = 'yr';
      ageInput.value = '1';
    } else if (kg <= 14.9) {
      gAgeUnit = 'yr';
      ageInput.value = '2.5';
    } else if (kg <= 18.9) {
      gAgeUnit = 'yr';
      ageInput.value = '4.5';
    } else if (kg <= 23.9) {
      gAgeUnit = 'yr';
      ageInput.value = '6.5';
    } else if (kg <= 29.9) {
      gAgeUnit = 'yr';
      ageInput.value = '8.5';
    } else if (kg <= 36) {
      gAgeUnit = 'yr';
      ageInput.value = '10';
    } else {
      gAgeUnit = 'yr';
      ageInput.value = '12';
    }
    const unitBtn = document.getElementById('ageUnitBtn');
    if (unitBtn) unitBtn.textContent = gAgeUnit;
  }

  calculateIBW();
  updateBiometricUIState();
}

function renderBroselowMiniSpectrum() {
  const w = getWeight();
  const zone = getBroselowZone(w);
  const zoneColor = zone ? (zone.color || '').toString().trim().split(/\s+/).pop() : null;
  
  // Highlight active mini segment in topbar
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.broselow-mini-seg').forEach(seg => {
      const title = seg.getAttribute('title') || '';
      const isActive = zoneColor && title.toLowerCase().startsWith(zoneColor.toLowerCase());
      seg.classList.toggle('active', !!isActive);
    });

    // Highlight active quick weight preset button by matching zone color or weight proximity
    document.querySelectorAll('.quick-weight-btn').forEach(btn => {
      const btnColor = btn.getAttribute('data-color');
      const onclickStr = btn.getAttribute('onclick') || '';
      const match = onclickStr.match(/applyQuickWeight\((\d+)\)/);
      const btnKg = match ? parseFloat(match[1]) : NaN;
      
      let isActive = false;
      if (zoneColor && btnColor && btnColor.toLowerCase() === zoneColor.toLowerCase()) {
        isActive = true;
      } else if (w !== null && !isNaN(btnKg) && Math.abs(w - btnKg) < 0.1) {
        isActive = true;
      }
      btn.classList.toggle('active', isActive);
    });
  }
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
  const updateDOM = () => {
    const targetBtn = btn || document.querySelector(`.tab-btn[data-tab="${id}"]`);
    if (targetBtn) {
      const tabCat = targetBtn.getAttribute('data-category');
      if (tabCat && gNavCategory !== 'all' && gNavCategory !== tabCat) {
        gNavCategory = tabCat;
        document.querySelectorAll('.category-pill').forEach(p => {
          p.classList.toggle('active', p.getAttribute('data-cat') === tabCat);
        });
        document.querySelectorAll('.tab-btn').forEach(t => {
          const tc = t.getAttribute('data-category');
          t.style.display = (tc === tabCat) ? 'inline-flex' : 'none';
        });
      }
    }

    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    if (targetBtn) {
      targetBtn.classList.add('active');
      targetBtn.setAttribute('aria-selected', 'true');
      if (typeof targetBtn.scrollIntoView === 'function') {
        targetBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
    
    // Update mobile bottom dock active states
    document.querySelectorAll('.dock-btn[data-dock-tab]').forEach(db => {
      db.classList.toggle('active', db.getAttribute('data-dock-tab') === id);
    });
    
    ['dose','atb','fluids','pals','ncpr','drip','seizure','tox','psa','vitals','dka','asthma','electrolytes','airway','sepsis','anaphylaxis','trauma','croup','transfusion'].forEach(x => {
      const el = document.getElementById(x);
      if (el) {
        const isActive = (x === id);
        el.style.display = isActive ? 'block' : 'none';
        el.classList.toggle('active-panel', isActive);
      }
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
    } else if (id === 'asthma') {
      calcAsthma();
    } else if (id === 'electrolytes') {
      calcElectrolytes();
    } else if (id === 'airway') {
      calcAirway();
    } else if (id === 'sepsis') {
      calcSepsis();
    } else if (id === 'anaphylaxis') {
      calcAnaphylaxis();
    } else if (id === 'trauma') {
      calcTrauma();
    } else if (id === 'croup') {
      calcCroup();
    } else if (id === 'transfusion') {
      calcTransfusion();
    }
  };

  if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function' && typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(() => {
      updateDOM();
    });
  } else {
    updateDOM();
  }
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
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
      if (e.key === '6') { e.preventDefault(); showTab('drip'); }
      if (e.key === '7') { e.preventDefault(); showTab('seizure'); }
      if (e.key === '8') { e.preventDefault(); showTab('tox'); }
      if (e.key === '9') { e.preventDefault(); showTab('psa'); }
      if (e.key === '0') { e.preventDefault(); showTab('vitals'); }
      if (e.key.toLowerCase() === 'k') { e.preventDefault(); showTab('dka'); }
      if (e.key.toLowerCase() === 'a') { e.preventDefault(); showTab('asthma'); }
      if (e.key.toLowerCase() === 'e') { e.preventDefault(); showTab('electrolytes'); }
      if (e.key.toLowerCase() === 'w') { e.preventDefault(); showTab('airway'); }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); showTab('sepsis'); }
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); showTab('anaphylaxis'); }
      if (e.key.toLowerCase() === 't') { e.preventDefault(); showTab('trauma'); }
      if (e.key.toLowerCase() === 'u') { e.preventDefault(); showTab('croup'); }
      if (e.key.toLowerCase() === 'b') { e.preventDefault(); showTab('transfusion'); }
    }
    if (e.key === 'Escape') {
      closeAllComboboxes();
      const backdrop = document.getElementById('broselowBackdrop') || document.getElementById('broselowPanel');
      if (backdrop && !backdrop.classList.contains('hidden')) backdrop.classList.add('hidden');
      const evBackdrop = document.getElementById('evidenceBackdrop');
      if (evBackdrop && !evBackdrop.classList.contains('hidden')) evBackdrop.classList.add('hidden');
      const clBackdrop = document.getElementById('changelogBackdrop');
      if (clBackdrop && !clBackdrop.classList.contains('hidden')) clBackdrop.classList.add('hidden');
      const atBackdrop = document.getElementById('attributionBackdrop');
      if (atBackdrop && !atBackdrop.classList.contains('hidden')) atBackdrop.classList.add('hidden');
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

function previewBroselowZone(colorName) {
  const bands = (DS && DS.broselow) || [];
  const cleanName = (colorName || '').toString().trim().toLowerCase();
  const entry = bands.find(b => b.color && b.color.toLowerCase().includes(cleanName));
  if (!entry) return;
  const approxKg = entry.approxKg || ((entry.min + entry.max) / 2);
  applyQuickWeight(approxKg);
  fillBroselowContent(approxKg, entry.color);
}

function fillBroselowContent(overrideW, overrideColor){
  const currentW = getWeight() || gIBW || 0;
  const w = overrideW || currentW || 10;
  const out = document.getElementById('broselowContent');
  if(!out) return;

  const bands = (DS && DS.broselow) || [];
  const color = overrideColor || (w > 0 ? broselowColor(w) : 'Grey');
  const cleanColor = (color || '').toString().trim().split(/\s+/).pop();
  const entry = bands.find(b => typeof b.min==='number' && typeof b.max==='number' && w>=b.min && w<=b.max)
             || bands.find(b => b.color && b.color.toLowerCase().includes(cleanColor.toLowerCase()))
             || bands[0];

  const BROSELOW_SPECTRUM = [
    { color: 'Grey', label: 'Grey', range: '3–5.9 kg', bg: '#BDBDBD', text: '#000' },
    { color: 'Pink', label: 'Pink', range: '6–7.9 kg', bg: '#F48FB1', text: '#000' },
    { color: 'Red', label: 'Red', range: '8–9.9 kg', bg: '#EF5350', text: '#FFF' },
    { color: 'Purple', label: 'Purple', range: '10–11.9 kg', bg: '#AB47BC', text: '#FFF' },
    { color: 'Yellow', label: 'Yellow', range: '12–14.9 kg', bg: '#FFEE58', text: '#000' },
    { color: 'White', label: 'White', range: '15–18.9 kg', bg: '#FFFFFF', text: '#000' },
    { color: 'Blue', label: 'Blue', range: '19–23.9 kg', bg: '#42A5F5', text: '#FFF' },
    { color: 'Orange', label: 'Orange', range: '24–29.9 kg', bg: '#FFA726', text: '#000' },
    { color: 'Green', label: 'Green', range: '30–36 kg', bg: '#66BB6A', text: '#FFF' }
  ];

  const spectrumHtml = `
    <div class="broselow-spectrum-bar" role="group" aria-label="Broselow Color Bands">
      ${BROSELOW_SPECTRUM.map(s => {
        const isActive = s.color.toLowerCase() === cleanColor.toLowerCase();
        return `
          <div class="broselow-spectrum-seg ${isActive ? 'active' : ''}" style="background:${s.bg}; color:${s.text};" onclick="previewBroselowZone('${s.color}')" title="Broselow ${s.label} (${s.range})">
            <span>${s.label}</span>
            <span style="font-size:8px; opacity:0.85;">${s.range}</span>
            ${isActive ? '<span style="font-size:8px;">▼</span>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  const bgSwatch = colorSwatch(color);
  const epiMg = (0.01 * w).toFixed(2);
  const epiMl = (0.01 * w / 0.1).toFixed(1);
  const defib1 = Math.round(2 * w);
  const defib2 = Math.round(4 * w);
  const fluidBolus = Math.round(20 * w);

  out.innerHTML = `
${spectrumHtml}
<div style="background:${bgSwatch}; padding:10px 14px; border-radius:var(--r-md); border:1px solid var(--border-strong); margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
  <div>
    <strong style="font-size:15.5px; color:#1E1E1E;">Broselow Zone: ${color} (${entry.min}–${entry.max} kg)</strong>
    <div style="font-size:12px; margin-top:2px; color:#1E1E1E;">Reference Weight for Zone: <strong>${w.toFixed(1)} kg</strong> ${overrideW ? '(Previewing Zone)' : '(Current Patient Weight)'}</div>
  </div>
  ${overrideW ? `<button class="btn" style="padding:4px 8px; font-size:11px;" onclick="fillBroselowContent()">Reset to Patient BW</button>` : ''}
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

<div class="protocol-table-wrapper" style="margin-top:10px;">
  <table class="protocol-table">
    <thead>
      <tr>
        <th style="width:45%;">Equipment / Parameter</th>
        <th style="width:55%;">Recommended Sizing & Clinical Setting</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>ETT Size (Cuffed / Uncuffed)</strong></td>
        <td><span class="dose-badge">${weightToETTCuffed(w)} mm</span> (Cuffed) | <strong>${weightToETTUncuffed(w)} mm</strong> (Uncuffed)</td>
      </tr>
      <tr>
        <td><strong>ETT Insertion Depth</strong></td>
        <td><strong>${weightToDepth(w)} cm</strong> at upper lip</td>
      </tr>
      <tr>
        <td><strong>Laryngoscope Blade</strong></td>
        <td><strong>${suggestBlade(w)}</strong></td>
      </tr>
      <tr>
        <td><strong>Airway (OPA / NPA / Suction)</strong></td>
        <td>OPA: <strong>${suggestOPA(w)} mm</strong> | NPA: <strong>${suggestNPA(w)} Fr</strong> | Suction: <strong>${suggestSuction(w)} Fr</strong></td>
      </tr>
      <tr>
        <td><strong>Tubes (NG / Foley)</strong></td>
        <td>NG Tube: <strong>${suggestNG(w)} Fr</strong> | Foley Catheter: <strong>${suggestFoley(w)} Fr</strong></td>
      </tr>
    </tbody>
  </table>
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
function suggestBlade(kg){
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
  const input = document.getElementById('doseSearch');
  const val = input ? input.value : '';
  const clearBtn = document.getElementById('doseSearchClear');
  if (clearBtn) {
    if (val && val.length > 0) clearBtn.classList.add('visible');
    else clearBtn.classList.remove('visible');
  }
  openDoseCombobox();
  renderDoseComboboxDropdown(val);
}

function onATBSearchInput(){
  const input = document.getElementById('atbSearch');
  const val = input ? input.value : '';
  const clearBtn = document.getElementById('atbSearchClear');
  if (clearBtn) {
    if (val && val.length > 0) clearBtn.classList.add('visible');
    else clearBtn.classList.remove('visible');
  }
  openATBCombobox();
  renderATBComboboxDropdown(val);
}

function clearDoseSearch(){
  const input = document.getElementById('doseSearch');
  const clearBtn = document.getElementById('doseSearchClear');
  if (input) {
    input.value = '';
    input.focus();
  }
  if (clearBtn) clearBtn.classList.remove('visible');
  renderDoseComboboxDropdown('');
  openDoseCombobox();
}

function clearATBSearch(){
  const input = document.getElementById('atbSearch');
  const clearBtn = document.getElementById('atbSearchClear');
  if (input) {
    input.value = '';
    input.focus();
  }
  if (clearBtn) clearBtn.classList.remove('visible');
  renderATBComboboxDropdown('');
  openATBCombobox();
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
  const clearBtn = document.getElementById('doseSearchClear');
  if (sel) sel.value = key;
  if (input) input.value = name;
  if (clearBtn) clearBtn.classList.add('visible');
  closeAllComboboxes();
  calcDose();
}

function selectATBItem(key, name){
  saveRecentDrug('atb', key);
  const sel = document.getElementById('atbDrug');
  const input = document.getElementById('atbSearch');
  const clearBtn = document.getElementById('atbSearchClear');
  if (sel) sel.value = key;
  if (input) input.value = name;
  if (clearBtn) clearBtn.classList.add('visible');
  closeAllComboboxes();
  calcATB();
}

let gDoseCategoryFilter = 'all';
let gATBCategoryFilter = 'all';
let gNavCategory = 'meds';

function setDoseCategoryFilter(cat, btn) {
  gDoseCategoryFilter = cat;
  const container = document.getElementById('doseCategoryFilter');
  if (container) {
    container.querySelectorAll('.drug-filter-pill').forEach(p => p.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');
  const input = document.getElementById('doseSearch');
  renderDoseComboboxDropdown(input ? input.value : '');
  openDoseCombobox();
}

function setATBCategoryFilter(cat, btn) {
  gATBCategoryFilter = cat;
  const container = document.getElementById('atbCategoryFilter');
  if (container) {
    container.querySelectorAll('.drug-filter-pill').forEach(p => p.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');
  const input = document.getElementById('atbSearch');
  renderATBComboboxDropdown(input ? input.value : '');
  openATBCombobox();
}

function filterNavCategory(cat, btn) {
  gNavCategory = cat;
  document.querySelectorAll('.category-pill').forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-cat') === cat);
  });
  if (btn) btn.classList.add('active');
  
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(t => {
    const tabCat = t.getAttribute('data-category');
    if (cat === 'all' || tabCat === cat) {
      t.style.display = 'inline-flex';
      t.style.opacity = '1';
    } else {
      t.style.display = 'none';
    }
  });

  const activeBtn = document.querySelector('.tab-btn.active');
  if (!activeBtn || activeBtn.style.display === 'none' || (cat !== 'all' && activeBtn.getAttribute('data-category') !== cat)) {
    const firstInCat = document.querySelector(`.tab-btn[data-category="${cat}"]`) || document.querySelector('.tab-btn');
    if (firstInCat) {
      const tabId = firstInCat.getAttribute('data-tab');
      if (tabId) showTab(tabId, firstInCat);
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatch(text, query) {
  if (!text) return '';
  if (!query) return escapeHtml(text);
  const q = query.trim();
  if (!q) return escapeHtml(text);
  const escaped = escapeRegex(q);
  const re = new RegExp(`(${escaped})`, 'gi');
  return escapeHtml(text).replace(re, '<mark class="search-match">$1</mark>');
}

function matchesDoseCategory(d, cat) {
  if (!cat || cat === 'all') return true;
  const n = ((d.name || '') + ' ' + (d.key || '') + ' ' + (d.drug || '')).toLowerCase();
  if (cat === 'antipyretic') return n.includes('paracetamol') || n.includes('ibuprofen') || n.includes('mefenamic') || n.includes('aspirin');
  if (cat === 'respiratory') return n.includes('salbutamol') || n.includes('budesonide') || n.includes('ipratropium') || n.includes('cetirizine') || n.includes('chlorpheniramine') || n.includes('loratadine') || n.includes('berodual');
  if (cat === 'gi') return n.includes('domperidone') || n.includes('ondansetron') || n.includes('ors') || n.includes('alum') || n.includes('lactulose') || n.includes('forlax') || n.includes('peg') || n.includes('hyoscine');
  if (cat === 'steroid') return n.includes('prednisolone') || n.includes('dexamethasone') || n.includes('hydrocortisone') || n.includes('methylprednisolone');
  if (cat === 'anticonvulsant') return n.includes('diazepam') || n.includes('midazolam') || n.includes('phenobarbital') || n.includes('phenytoin') || n.includes('valproate') || n.includes('levetiracetam');
  return true;
}

function matchesATBCategory(d, cat) {
  if (!cat || cat === 'all') return true;
  const n = ((d.name || '') + ' ' + (d.key || '') + ' ' + (d.drug || '')).toLowerCase();
  if (cat === 'penicillin') return n.includes('amoxicillin') || n.includes('augmentin') || n.includes('ampicillin') || n.includes('cloxacillin') || n.includes('cephalexin') || n.includes('cefdinir');
  if (cat === 'resus') return n.includes('ceftriaxone') || n.includes('cefotaxime') || n.includes('ceftazidime') || n.includes('meropenem') || n.includes('ertapenem') || n.includes('vancomycin');
  if (cat === 'macrolide') return n.includes('azithromycin') || n.includes('clarithromycin') || n.includes('erythromycin') || n.includes('roxithromycin');
  if (cat === 'amino') return n.includes('gentamicin') || n.includes('amikacin') || n.includes('vancomycin');
  return true;
}

function getDrugCategory(name){
  const n = (name || '').toLowerCase();
  if (n.includes('paracetamol') || n.includes('ibuprofen')) return 'Antipyretic / Analgesic';
  if (n.includes('diazepam') || n.includes('midazolam') || n.includes('phenobarbital') || n.includes('phenytoin')) return 'Anticonvulsant';
  if (n.includes('salbutamol') || n.includes('budesonide') || n.includes('prednisolone') || n.includes('dexamethasone')) return 'Respiratory / Steroid';
  if (n.includes('domperidone') || n.includes('ondansetron') || n.includes('ors') || n.includes('alum') || n.includes('lactulose') || n.includes('forlax')) return 'GI / Anti-emetic';
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
    if (!matchesDoseCategory(d, gDoseCategoryFilter)) return false;
    const name = (d.name || '').toLowerCase();
    const aliases = (d.aliases || []).join(' ').toLowerCase();
    return !q || name.includes(q) || aliases.includes(q);
  });

  if (!filtered.length) {
    dropdown.innerHTML = '<div class="combobox-item" style="color:var(--muted);">No matching medications in category</div>';
    return;
  }

  let html = '';
  // Show RECENTLY USED if filter is empty and there are saved recent items
  if (!q && gDoseCategoryFilter === 'all') {
    const recentKeys = getRecentDrugs('dose');
    const recentItems = recentKeys.map(k => list.find(d => d.key === k)).filter(Boolean);
    if (recentItems.length > 0) {
      html += `<div style="padding:6px 10px; font-size:11px; font-weight:800; color:var(--accent); background:var(--accent-subtle); letter-spacing:0.05em;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px; margin-right:4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> RECENTLY USED</div>`;
      html += recentItems.map(d => {
        const selectedClass = (d.key === currentKey) ? 'selected' : '';
        const cat = getDrugCategory(d.name);
        return `
          <div class="combobox-item ${selectedClass}" role="option" data-key="${d.key}" data-name="${escapeHtml(d.name)}" onclick="selectDoseItem('${d.key}', '${d.name.replace(/'/g, "\\'")}')">
            <div>
              <strong>${escapeHtml(d.name)}</strong>
              <div style="font-size:11px; color:var(--muted);">${escapeHtml(d.preparation || '')}</div>
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
    const highlightedName = highlightMatch(d.name, q);
    return `
      <div class="combobox-item ${selectedClass}" role="option" data-key="${d.key}" data-name="${escapeHtml(d.name)}" onclick="selectDoseItem('${d.key}', '${d.name.replace(/'/g, "\\'")}')">
        <div>
          <strong>${highlightedName}</strong>
          <div style="font-size:11px; color:var(--muted);">${escapeHtml(d.preparation || '')}</div>
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
    if (!matchesATBCategory(d, gATBCategoryFilter)) return false;
    const name = (d.name || '').toLowerCase();
    const aliases = (d.aliases || []).join(' ').toLowerCase();
    return !q || name.includes(q) || aliases.includes(q);
  });

  if (!filtered.length) {
    dropdown.innerHTML = '<div class="combobox-item" style="color:var(--muted);">No matching antibiotics in category</div>';
    return;
  }

  let html = '';
  if (!q && gATBCategoryFilter === 'all') {
    const recentKeys = getRecentDrugs('atb');
    const recentItems = recentKeys.map(k => list.find(d => d.key === k)).filter(Boolean);
    if (recentItems.length > 0) {
      html += `<div style="padding:6px 10px; font-size:11px; font-weight:800; color:var(--accent); background:var(--accent-subtle); letter-spacing:0.05em;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px; margin-right:4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> RECENTLY USED</div>`;
      html += recentItems.map(d => {
        const selectedClass = (d.key === currentKey) ? 'selected' : '';
        return `
          <div class="combobox-item ${selectedClass}" role="option" data-key="${d.key}" data-name="${escapeHtml(d.name)}" onclick="selectATBItem('${d.key}', '${d.name.replace(/'/g, "\\'")}')">
            <div>
              <strong>${escapeHtml(d.name)}</strong>
              <div style="font-size:11px; color:var(--muted);">${escapeHtml(d.preparation || '')}</div>
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
    const highlightedName = highlightMatch(d.name, q);
    return `
      <div class="combobox-item ${selectedClass}" role="option" data-key="${d.key}" data-name="${escapeHtml(d.name)}" onclick="selectATBItem('${d.key}', '${d.name.replace(/'/g, "\\'")}')">
        <div>
          <strong>${highlightedName}</strong>
          <div style="font-size:11px; color:var(--muted);">${escapeHtml(d.preparation || '')}</div>
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

function calcAll(){
  calcV1Mode();
  calcGrowthZScores();
  calcDose();
  calcATB();
  calcFluids();
  calcPALS();
  calcNCPR();
  calcDrip();
  calcSeizure();
  calcTox();
  calcPSA();
  calcVitals();
  calcDKA();
  calcAsthma();
  calcElectrolytes();
  calcAirway();
  calcSepsis();
  calcAnaphylaxis();
  calcTrauma();
  calcCroup();
  calcTransfusion();
}

// --------- ⚡ V1 Mode: Minimal Bedside Emergency Engine ---------

function calcV1Mode() {
  if (typeof document === 'undefined') return;
  const bw = getWeight();
  const ageYr = getAgeInYears();

  // 1. Update Weight Display in V1 Header
  const wDisp = document.getElementById('v1WeightDisplay');
  if (wDisp) {
    if (bw && bw > 0) {
      let ageStr = '';
      if (ageYr !== null && ageYr !== undefined && ageYr > 0) {
        ageStr = ageYr < 1 ? ` (${Math.round(ageYr * 12)} mo)` : ` (${ageYr >= 10 ? ageYr.toFixed(0) : ageYr.toFixed(1)} yr)`;
      }
      wDisp.textContent = `${bw.toFixed(1)} kg${ageStr}`;
      wDisp.style.color = 'var(--accent)';
      wDisp.style.background = 'var(--accent-soft)';
    } else {
      wDisp.textContent = '— kg';
      wDisp.style.color = 'var(--muted)';
      wDisp.style.background = 'var(--panel)';
    }
  }

  // Highlight active quick weight preset button in V1
  document.querySelectorAll('#v1QuickWeightStrip .quick-weight-btn').forEach(btn => {
    const btnText = btn.textContent || '';
    const num = parseFloat(btnText);
    const isActive = bw && num && Math.abs(bw - num) < 0.3;
    btn.classList.toggle('active', !!isActive);
  });

  const palsEl = document.getElementById('v1CardsPals');
  const airwayEl = document.getElementById('v1CardsAirway');
  const seizureEl = document.getElementById('v1CardsSeizure');
  const respEl = document.getElementById('v1CardsResp');
  const medsEl = document.getElementById('v1CardsMeds');
  const fluidsEl = document.getElementById('v1CardsFluids');

  if (!palsEl || !airwayEl || !seizureEl || !respEl || !medsEl || !fluidsEl) return;

  if (!bw || bw <= 0) {
    const emptyMsg = '<div style="grid-column: 1/-1; padding: 14px; text-align: center; color: var(--muted); background: var(--panel-subtle); border-radius: var(--r-sm); border: 1px dashed var(--border); font-size: 13px;">กรุณาระบุน้ำหนัก (BW) หรือกดปุ่มน้ำหนักด่วนด้านบนเพื่อคำนวณ</div>';
    palsEl.innerHTML = emptyMsg;
    airwayEl.innerHTML = emptyMsg;
    seizureEl.innerHTML = emptyMsg;
    respEl.innerHTML = emptyMsg;
    medsEl.innerHTML = emptyMsg;
    fluidsEl.innerHTML = emptyMsg;
    return;
  }

  const helper = (title, route, doseStr, volStr, prepStr, capStr, typeClass) => `
    <div class="v1-card ${typeClass}">
      <div class="v1-card-top">
        <div class="v1-card-title">${title}</div>
        <div class="v1-card-route">${route}</div>
      </div>
      <div class="v1-hero-dose">
        ${doseStr}
        ${volStr ? `<span class="v1-hero-vol">(${volStr})</span>` : ''}
      </div>
      <div class="v1-card-prep">${prepStr}</div>
      ${capStr ? `<div><span class="v1-cap-warning">⚠️ ${capStr}</span></div>` : ''}
    </div>
  `;

  // ----------------------------------------------------
  // SECTION 1: 🚨 Resuscitation & PALS
  // ----------------------------------------------------
  const epiVol = Math.min(bw * 0.1, 10.0);
  const epiDose = Math.min(bw * 0.01, 1.0);
  const epiCap = (bw * 0.1 >= 10.0) ? 'Max 10 mL (1.0 mg)' : '';

  const defib1 = Math.min(Math.round(bw * 2), 200);
  const defib2 = Math.min(Math.round(bw * 4), 200);

  const cardio1 = Math.min(Math.max(1, Math.round(bw * 0.5)), 100);
  const cardio2 = Math.min(Math.round(bw * 2), 200);

  const amioDose = Math.min(Math.round(bw * 5), 300);
  const amioVol = (amioDose / 50).toFixed(1);
  const amioCap = (bw * 5 >= 300) ? 'Max 300 mg' : '';

  const isAdol = (ageYr !== null && ageYr >= 12);
  const maxAtropine = isAdol ? 1.0 : 0.5;
  const atropineDose = Math.max(0.1, Math.min(bw * 0.02, maxAtropine));
  const atropineVol = (atropineDose / 0.6).toFixed(2);
  const atropineCap = (bw * 0.02 < 0.1) ? 'Min 0.1 mg' : ((bw * 0.02 >= maxAtropine) ? `Max ${maxAtropine} mg` : '');

  const aden1 = Math.min(bw * 0.1, 6.0);
  const aden2 = Math.min(bw * 0.2, 12.0);
  const adenCap = (bw * 0.1 >= 6.0) ? 'Max 1st 6 mg, 2nd 12 mg' : '';

  const shockBolus = Math.min(Math.round(bw * 20), 1000);
  const shockCap = (bw * 20 >= 1000) ? 'Max 1,000 mL' : '';

  const d10wVol = Math.min(Math.round(bw * 2), 100);

  palsEl.innerHTML = [
    helper('Adrenaline (Epi 1:10,000)', 'IV / IO', `${epiVol.toFixed(1)} mL IV push`, `${epiDose.toFixed(2)} mg`, '1:10,000 neat IV/IO push q 3–5 min + 5 mL NS flush', epiCap, 'v1-card-pals'),
    helper('Defibrillation (VF / pVT)', 'Defib', `Initial: ${defib1} J`, `2nd+: ${defib2} J`, 'Biphasic manual defib ; Max 10 J/kg or adult 200 J', '', 'v1-card-pals'),
    helper('Synchronized Cardioversion', 'Sync', `1st: ${cardio1} J`, `2nd: ${cardio2} J`, 'SVT / VT with pulse ; Turn SYNC ON ; Pre-sedate if stable', '', 'v1-card-pals'),
    helper('Amiodarone (50 mg/mL)', 'IV / IO', `${amioDose} mg`, `${amioVol} mL`, '5 mg/kg rapid IV push for shock-refractory VF/pVT', amioCap, 'v1-card-pals'),
    helper('Atropine (0.6 mg/mL)', 'IV / IO', `${atropineDose.toFixed(2)} mg`, `${atropineVol} mL`, '0.02 mg/kg IV push for symptomatic bradycardia', atropineCap, 'v1-card-pals'),
    helper('Adenosine (3 mg/mL)', 'IV Push', `1st: ${aden1.toFixed(1)} mg`, `2nd: ${aden2.toFixed(1)} mg`, 'Rapid IV push over 1–2 sec immediately followed by 5 mL NS flush', adenCap, 'v1-card-pals'),
    helper('Shock Fluid Bolus (NSS/Acetar)', 'IV Push', `${shockBolus} mL`, '20 mL/kg', 'Isotonic crystalloid push over 10–15 min ; Re-assess perfusion', shockCap, 'v1-card-pals'),
    helper('Hypoglycemia Bolus (D10W)', 'IV Push', `${d10wVol} mL`, '2 mL/kg', 'D10W (0.2 g/kg) IV push over 2–3 min ; Recheck glucose 15 min', '', 'v1-card-pals')
  ].join('');

  // ----------------------------------------------------
  // SECTION 2: 🫁 Airway & Intubation (RSI)
  // ----------------------------------------------------
  let cuffedETT = 4.0;
  let uncuffedETT = 4.5;
  if (ageYr !== null && ageYr !== undefined) {
    if (ageYr <= 1) {
      cuffedETT = bw <= 3.5 ? 3.0 : 3.5;
      uncuffedETT = bw <= 3.5 ? 3.5 : 4.0;
    } else {
      cuffedETT = Math.min(7.5, Math.round((ageYr / 4 + 3.5) * 2) / 2);
      uncuffedETT = Math.min(8.0, Math.round((ageYr / 4 + 4.0) * 2) / 2);
    }
  } else {
    cuffedETT = (typeof weightToETTCuffed === 'function') ? weightToETTCuffed(bw) : 4.0;
    uncuffedETT = (typeof weightToETTUncuffed === 'function') ? weightToETTUncuffed(bw) : 4.5;
  }
  const ettDepth = Math.round(cuffedETT * 3 * 10) / 10;
  const bladeStr = (typeof suggestBlade === 'function') ? suggestBlade(bw, ageYr) : (bw < 10 ? 'Miller 1' : 'Mac 2');
  const suctionFr = Math.round(cuffedETT * 2);
  const lmaSize = bw < 5 ? '1' : (bw < 10 ? '1.5' : (bw < 20 ? '2' : (bw < 30 ? '2.5' : (bw < 50 ? '3' : '4'))));

  const ketaMin = Math.round(bw * 1.5);
  const ketaMax = Math.min(Math.round(bw * 2.0), 200);
  const ketaVol = (ketaMax / 50).toFixed(1);
  const ketaCap = (bw * 2.0 >= 200) ? 'Max 200 mg' : '';

  const rocurDose = Math.min(Math.round(bw * 1.0 * 10) / 10, 100);
  const rocurVol = (rocurDose / 10).toFixed(1);
  const rocurCap = (bw >= 100) ? 'Max 100 mg' : '';

  const suxDose = Math.min(Math.round(bw * (bw < 10 ? 2.0 : 1.5)), 150);
  const suxVol = (suxDose / 50).toFixed(1);
  const suxCap = (bw * 1.5 >= 150) ? 'Max 150 mg' : '';

  const sugaDose = Math.min(Math.round(bw * 16), 1500);
  const sugaVol = (sugaDose / 100).toFixed(1);

  airwayEl.innerHTML = [
    helper('Endotracheal Tube (ETT)', 'ETT ID', `Cuffed: ${cuffedETT} mm`, `Uncuffed: ${uncuffedETT} mm`, `Lip Depth: ${ettDepth} cm (Depth = ETT ID × 3) ; เตรียมเบอร์ ±0.5 สำรอง`, '', 'v1-card-airway'),
    helper('Airway Equipment Sizing', 'Device', `Blade: ${bladeStr}`, `Suction: ${suctionFr} Fr`, `LMA: Size ${lmaSize} · BVM: ${bw < 10 ? 'Infant (500 mL)' : 'Child (750 mL)'}`, '', 'v1-card-airway'),
    helper('Ketamine (50 mg/mL)', 'IV Push', `${ketaMin}–${ketaMax} mg`, `${(ketaMin/50).toFixed(1)}–${ketaVol} mL`, '1.5–2.0 mg/kg IV push RSI Induction over 30–60 sec', ketaCap, 'v1-card-airway'),
    helper('Rocuronium (10 mg/mL)', 'IV Push', `${rocurDose} mg`, `${rocurVol} mL`, '1.0 mg/kg IV push RSI Paralytic (onset 45–60s, duration 40m)', rocurCap, 'v1-card-airway'),
    helper('Succinylcholine (50 mg/mL)', 'IV Push', `${suxDose} mg`, `${suxVol} mL`, `${bw < 10 ? '2.0 mg/kg' : '1.5 mg/kg'} IV push ; ระวัง hyperkalemia / MH`, suxCap, 'v1-card-airway'),
    helper('Sugammadex (100 mg/mL)', 'IV Push', `${sugaDose} mg`, `${sugaVol} mL`, '16 mg/kg IV push for immediate Rocuronium reversal (CICO Rescue)', '', 'v1-card-airway')
  ].join('');

  // ----------------------------------------------------
  // SECTION 3: ⚡ Seizure Protocol
  // ----------------------------------------------------
  const midazIv = Math.min(Math.round(bw * 0.2 * 10) / 10, 5.0);
  const midazIvVol = (midazIv / 5).toFixed(2);
  const midazIvCap = (bw * 0.2 >= 5.0) ? 'Max 5.0 mg' : '';

  const midazIn = Math.min(Math.round(bw * 0.2 * 10) / 10, 10.0);
  const midazInVol = (midazIn / 5).toFixed(2);
  const midazInCap = (bw * 0.2 >= 10.0) ? 'Max 10.0 mg' : '';

  const diaIv = Math.min(Math.round(bw * 0.3 * 10) / 10, 10.0);
  const diaIvVol = (diaIv / 5).toFixed(2);
  const diaRec = Math.min(Math.round(bw * 0.5 * 10) / 10, 10.0);
  const diaCap = (bw * 0.3 >= 10.0) ? 'Max 10.0 mg' : '';

  const kepDose = Math.min(Math.round(bw * 60), 4500);
  const kepVol = (kepDose / 100).toFixed(1);
  const kepCap = (bw * 60 >= 4500) ? 'Max 4,500 mg' : '';

  const phenyDose = Math.min(Math.round(bw * 20), 1000);
  const phenyVol = (phenyDose / 50).toFixed(1);
  const phenyCap = (bw * 20 >= 1000) ? 'Max 1,000 mg' : '';

  const phenoDose = Math.min(Math.round(bw * 20), 1000);
  const phenoVol = (phenoDose / 100).toFixed(1);
  const phenoCap = (bw * 20 >= 1000) ? 'Max 1,000 mg' : '';

  seizureEl.innerHTML = [
    helper('Midazolam (5 mg/mL) IV/IO', 'IV / IO', `${midazIv} mg`, `${midazIvVol} mL`, '0.1–0.2 mg/kg IV push over 1–2 min ; Repeat once at 5 min if seizure persists', midazIvCap, 'v1-card-seizure'),
    helper('Midazolam (5 mg/mL) IN/Buccal', 'IN / Buccal', `${midazIn} mg`, `${midazInVol} mL`, '0.2–0.3 mg/kg Buccal / IN (ผ่าน MAD) / IM หากยังไม่มีเส้น IV', midazInCap, 'v1-card-seizure'),
    helper('Diazepam (5 mg/mL) IV/Rectal', 'IV / Rectal', `IV: ${diaIv} mg (${diaIvVol} mL)`, `Rectal: ${diaRec} mg`, 'IV 0.2–0.3 mg/kg (rate 1–2 mg/min) ; Rectal tube 0.5 mg/kg', diaCap, 'v1-card-seizure'),
    helper('Levetiracetam / Keppra (100 mg/mL)', 'IV Infusion', `${kepDose} mg`, `${kepVol} mL`, '60 mg/kg ผสมใน NSS 20–50 mL หยดทาง IV ใน 10 นาที (1st-choice 2nd line)', kepCap, 'v1-card-seizure'),
    helper('Phenytoin (50 mg/mL)', 'IV Infusion', `${phenyDose} mg`, `${phenyVol} mL`, '20 mg/kg ผสมใน NSS เท่านั้น! (ห้าม D5W) หยดช้าๆ ใน 20–30 นาที (Max 50 mg/min)', phenyCap, 'v1-card-seizure'),
    helper('Phenobarbital (100 mg/mL)', 'IV Infusion', `${phenoDose} mg`, `${phenoVol} mL`, '20 mg/kg IV ช้าๆ (30–50 mg/min) — First-line ใน Neonatal Seizure', phenoCap, 'v1-card-seizure')
  ].join('');

  // ----------------------------------------------------
  // SECTION 4: 🐝 Anaphylaxis, Asthma & Croup
  // ----------------------------------------------------
  const maxEpiIm = (bw >= 30) ? 0.5 : 0.3;
  const epiImVol = Math.min(bw * 0.01, maxEpiIm);
  const epiImDose = epiImVol * 1.0;
  const epiImCap = (bw * 0.01 >= maxEpiIm) ? `Max ${maxEpiIm} mL (${maxEpiIm} mg)` : '';

  const salbStr = (bw < 20) ? '2.5 mg (0.5 mL)' : '5.0 mg (1.0 mL)';
  const ipraStr = (bw < 20) ? '250 mcg (1.0 mL)' : '500 mcg (2.0 mL)';

  const dexaDose = Math.min(Math.round(bw * 0.6 * 10) / 10, 16.0);
  const dexaVol = (dexaDose / 4).toFixed(2);
  const dexaCap = (bw * 0.6 >= 16.0) ? 'Max 16.0 mg' : '';

  const hydroDose = Math.min(Math.round(bw * 4), 200);
  const hydroCap = (bw * 4 >= 200) ? 'Max 200 mg' : '';

  const cpmDose = Math.min(Math.round(bw * 0.1 * 10) / 10, 5.0);
  const cpmVol = (cpmDose / 10).toFixed(2);
  const cpmCap = (bw * 0.1 >= 5.0) ? 'Max 5.0 mg' : '';

  respEl.innerHTML = [
    helper('Adrenaline (1:1,000 / 1 mg/mL) IM', 'IM Thigh', `${epiImVol.toFixed(2)} mL`, `${epiImDose.toFixed(2)} mg`, '0.01 mL/kg ฉีดเข้ากล้ามเนื้อหน้าขา (Anterolateral Thigh) ทันที! ซ้ำได้ q 5–15 min', epiImCap, 'v1-card-resp'),
    helper('Salbutamol (Ventolin 5 mg/mL)', 'Nebulize', salbStr, '+ 3 mL NSS', 'พ่นละอองยา q 20 min x 3 doses ในชั่วโมงแรกสำหรับ acute asthma', '', 'v1-card-resp'),
    helper('Ipratropium (Atrovent 250 mcg/mL)', 'Nebulize', ipraStr, 'Neb', 'พ่นร่วมกับ Salbutamol ใน Severe / Life-threatening asthma x 3 doses', '', 'v1-card-resp'),
    helper('Dexamethasone (4 mg/mL)', 'PO / IV / IM', `${dexaDose} mg`, `${dexaVol} mL`, '0.6 mg/kg single dose สำหรับ Croup / Acute Severe Asthma', dexaCap, 'v1-card-resp'),
    helper('Hydrocortisone (100 mg vial)', 'IV Push', `${hydroDose} mg`, '4 mg/kg', '4–5 mg/kg IV q 6 hr ใน severe anaphylaxis / asthma exacerbation', hydroCap, 'v1-card-resp'),
    helper('Chlorpheniramine / CPM (10 mg/mL)', 'IV / IM', `${cpmDose} mg`, `${cpmVol} mL`, '0.1 mg/kg IV/IM q 6–8 hr PRN สำหรับ allergic urticaria / itching', cpmCap, 'v1-card-resp')
  ].join('');

  // ----------------------------------------------------
  // SECTION 5: 💊 Fast Bedside Medications
  // ----------------------------------------------------
  const para15 = Math.min(Math.round(bw * 15), 1000);
  const para250Vol = (para15 / 50).toFixed(1);
  const para120Vol = (para15 / 24).toFixed(1);
  const paraIvVol = (para15 / 10).toFixed(1);
  const paraCap = (bw * 15 >= 1000) ? 'Max 1,000 mg/dose (4,000 mg/day)' : '';

  const ibuDose = Math.min(Math.round(bw * 10), 400);
  const ibuVol = (ibuDose / 20).toFixed(1);
  const ibuCap = (bw * 10 >= 400) ? 'Max 400 mg/dose' : '';

  const ondanDose = Math.min(Math.round(bw * 0.15 * 100) / 100, 8.0);
  const ondanVol = (ondanDose / 2).toFixed(2);
  const ondanCap = (bw * 0.15 >= 8.0) ? 'Max 8.0 mg' : '';

  const cefMin = Math.round(bw * 50);
  const cefMax = Math.min(Math.round(bw * 100), 2000);
  const cefCap = (bw * 100 >= 2000) ? 'Max 2,000 mg' : '';

  const morphDose = Math.min(Math.round(bw * 0.1 * 100) / 100, 5.0);
  const morphVol = (morphDose / 10).toFixed(2);
  const morphCap = (bw * 0.1 >= 5.0) ? 'Max 5.0 mg' : '';

  const fentDose = Math.min(Math.round(bw * 1.5), 100);
  const fentVol = (fentDose / 50).toFixed(2);
  const fentCap = (bw * 1.5 >= 100) ? 'Max 100 mcg' : '';

  medsEl.innerHTML = [
    helper('Paracetamol Syrup (250 mg / 5 mL)', 'PO q4–6h', `${para15} mg`, `${para250Vol} mL`, '10–15 mg/kg PO q 4–6 hr PRN fever/pain (10 kg ≈ 1/2 tsp = 3 mL)', paraCap, 'v1-card-meds'),
    helper('Paracetamol Syrup (120 mg / 5 mL)', 'PO q4–6h', `${para15} mg`, `${para120Vol} mL`, '10–15 mg/kg PO q 4–6 hr PRN fever/pain (10 kg ≈ 1 tsp = 6 mL)', paraCap, 'v1-card-meds'),
    helper('Paracetamol IV (10 mg/mL)', 'IV Infuse', `${para15} mg`, `${paraIvVol} mL`, '15 mg/kg IV drip in 15 min q 6 hr PRN (ห้าม push เร็ว)', paraCap, 'v1-card-meds'),
    helper('Ibuprofen Syrup (100 mg / 5 mL)', 'PO q6–8h', `${ibuDose} mg`, `${ibuVol} mL`, '10 mg/kg PO q 6–8 hr pc PRN (ห้ามใช้ในเด็ก <6 เดือน หรือสงสัยไข้เลือดออก)', ibuCap, 'v1-card-meds'),
    helper('Ondansetron (4 mg / 2 mL)', 'IV / PO', `${ondanDose} mg`, `${ondanVol} mL`, '0.15 mg/kg IV push over 2–5 min / PO สำหรับ acute gastroenteritis vomiting', ondanCap, 'v1-card-meds'),
    helper('Ceftriaxone IV (1st Dose)', 'IV Infuse', `${cefMin}–${cefMax} mg`, '50–100 mg/kg', 'First dose Sepsis / Meningitis / Severe Bacterial Infection หยดใน 30 min', cefCap, 'v1-card-meds'),
    helper('Morphine (10 mg/mL)', 'IV / SC', `${morphDose} mg`, `${morphVol} mL`, '0.05–0.1 mg/kg IV push ช้าๆ ใน 4–5 นาที สำหรับ severe pain', morphCap, 'v1-card-meds'),
    helper('Fentanyl (50 mcg/mL)', 'IV Push', `${fentDose} mcg`, `${fentVol} mL`, '1–2 mcg/kg IV push ช้าๆ ใน 2–3 นาที (onset เร็ว 1–2 นาที)', fentCap, 'v1-card-meds')
  ].join('');

  // ----------------------------------------------------
  // SECTION 6: 💧 Fluids & Vitals Reference
  // ----------------------------------------------------
  let maintRate = 0;
  if (bw <= 10) maintRate = bw * 4;
  else if (bw <= 20) maintRate = 40 + (bw - 10) * 2;
  else maintRate = 60 + (bw - 20) * 1;
  maintRate = Math.round(maintRate * 10) / 10;
  const maintDay = Math.round(maintRate * 24);

  let hrRange = '80–120';
  let rrRange = '20–30';
  let minSBP = 70;
  if (ageYr !== null && ageYr !== undefined) {
    if (ageYr < 1) { hrRange = '100–160'; rrRange = '30–60'; minSBP = 70; }
    else if (ageYr < 3) { hrRange = '90–150'; rrRange = '24–40'; minSBP = 70 + Math.round(ageYr * 2); }
    else if (ageYr < 6) { hrRange = '80–120'; rrRange = '20–30'; minSBP = 70 + Math.round(ageYr * 2); }
    else if (ageYr < 12) { hrRange = '70–110'; rrRange = '18–25'; minSBP = Math.min(90, 70 + Math.round(ageYr * 2)); }
    else { hrRange = '60–100'; rrRange = '12–20'; minSBP = 90; }
  } else {
    minSBP = bw <= 10 ? 70 : Math.min(90, 70 + Math.round((bw - 8) / 2));
  }

  fluidsEl.innerHTML = [
    helper('Holliday-Segar Maintenance Rate', 'IV Rate', `${maintRate} mL/hr`, `${maintDay} mL/day`, '4 mL/kg (1–10 kg) + 2 mL/kg (11–20 kg) + 1 mL/kg (>20 kg) ; D5/0.45% NaCl + KCl 20 mEq/L', '', 'v1-card-fluids'),
    helper('Bedside Normal Vitals Target', 'Reference', `HR: ${hrRange} bpm`, `RR: ${rrRange} /min`, `Hypotension SBP Floor: < ${minSBP} mmHg (70 + 2 × Age) · SpO2 target ≥ 94% (Asthma ≥ 92%)`, '', 'v1-card-fluids')
  ].join('');

  // If a search query is active, re-apply filter to updated cards
  const searchInp = document.getElementById('v1SearchInput');
  if (searchInp && searchInp.value) {
    searchV1Items(searchInp.value);
  }
}

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
  <strong style="font-size:16px; display:inline-flex; align-items:center; gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:var(--accent);"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg> ${title}</strong>
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

  const directivesHtml = `
<div style="margin-top:12px; padding:10px 14px; background:var(--panel); border:1px solid var(--border); border-radius:8px;">
  <div style="font-size:11px; font-weight:800; color:var(--muted); letter-spacing:0.06em; text-transform:uppercase; margin-bottom:6px; display:flex; align-items:center; gap:5px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
    Prescribing Directives & Limits
  </div>
  <div style="display:flex; flex-direction:column; gap:4px; font-size:12.5px; line-height:1.45; color:var(--ink);">
    <div>• <strong>Dose Guideline:</strong> ${toRangeTxt(minPerKg, maxPerKg, n => `${n} mg/kg`)} ${drug.freq ? drug.freq : ''}</div>
    ${drug.preparation ? `<div>• <strong>Preparation:</strong> ${drug.preparation}</div>` : ''}
    ${drug.maxPerDoseMg ? `<div>• <strong>Single Dose Limit:</strong> Max ${drug.maxPerDoseMg} mg</div>` : ''}
    ${drug.maxPerDayMg ? `<div>• <strong>Daily Limit:</strong> Max ${drug.maxPerDayMg} mg</div>` : ''}
    ${drug.renalAdjust ? `<div>• <strong>Renal Adjustment:</strong> <span style="color:var(--warning); font-weight:700;">⚠️ ปรับขนาดยาตามระดับการทำงานของไต (CrCl/eGFR)</span></div>` : ''}
    ${drug.note ? `<div>• <strong>Clinical Note:</strong> ${drug.note}</div>` : ''}
  </div>
</div>
  `;

  let outHtml = heroCardHtml;
  if (bandNotice) outHtml += `<div style="margin-top:10px; padding:8px 12px; background:var(--accent-subtle); color:var(--accent); border-radius:6px; font-weight:700; font-size:13px;">${bandNotice}</div>`;
  outHtml += directivesHtml;

  if (outEl) outEl.innerHTML = outHtml;
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
  <strong style="font-size:16px; display:inline-flex; align-items:center; gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:var(--accent);"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 9.8 3 11.4 3 14"/><path d="M6 17H2"/><path d="M17.47 9c1.93.8 3.53 2.4 3.53 5"/><path d="M18 17h4"/></svg> ${title}</strong>
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

  const directivesHtml = `
<div style="margin-top:12px; padding:10px 14px; background:var(--panel); border:1px solid var(--border); border-radius:8px;">
  <div style="font-size:11px; font-weight:800; color:var(--muted); letter-spacing:0.06em; text-transform:uppercase; margin-bottom:6px; display:flex; align-items:center; gap:5px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
    Prescribing Directives & Limits
  </div>
  <div style="display:flex; flex-direction:column; gap:4px; font-size:12.5px; line-height:1.45; color:var(--ink);">
    <div>• <strong>Dose Rule:</strong> ${minPerKg && maxPerKg ? `${minPerKg}–${maxPerKg}` : (drug.dose || '—')} mg/kg ${drug.split || drug.freq || ''}</div>
    ${drug.preparation ? `<div>• <strong>Preparation:</strong> ${drug.preparation}</div>` : ''}
    ${limitMaxDose ? `<div>• <strong>Max Single Dose:</strong> ${limitMaxDose} mg</div>` : ''}
    ${limitMaxDay ? `<div>• <strong>Max Daily Limit:</strong> ${limitMaxDay} mg</div>` : ''}
    ${drug.renalAdjust ? `<div>• <strong>Renal Adjustment:</strong> <span style="color:var(--warning); font-weight:700;">⚠️ ต้องปรับขนาดยาตามระดับการทำงานของไต (CrCl/eGFR)</span></div>` : ''}
    ${drug.note ? `<div>• <strong>Clinical Note:</strong> ${drug.note}</div>` : ''}
  </div>
</div>
  `;

  let outHtml = heroCardHtml;
  if (bandNotice) outHtml += `<div style="margin-top:10px; padding:8px 12px; background:var(--accent-subtle); color:var(--accent); border-radius:6px; font-weight:700; font-size:13px;">${bandNotice}</div>`;
  outHtml += directivesHtml;

  if (outEl) outEl.innerHTML = outHtml;
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
  const BG = parseFloat(document.getElementById('nBG')?.value);
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
  if (!isNaN(BG) && BG > 0) {
    if (BG < 40) {
      blocks.push(`• <strong style="color:var(--danger);">🚨 Hypoglycemia Alert (BG ${BG} mg/dL < 40 mg/dL):</strong> ${(2*w).toFixed(1)} mL D10W IV bolus over 2 min, then ${(3.5*w).toFixed(1)} mL/hr infusion`);
    } else {
      blocks.push(`• <strong>Blood Glucose (${BG} mg/dL):</strong> Normoglycemia (≥ 40 mg/dL) — continue monitoring`);
    }
  } else {
    blocks.push(`• <strong>Hypoglycemia Protocol:</strong> ${(2*w).toFixed(1)} mL D10W IV bolus over 2 min, then ${(3.5*w).toFixed(1)} mL/hr infusion if BG < 40 mg/dL`);
  }

  if (out) out.innerHTML = blocks.join('<br>');
}

// --------- Medical EHR Clipboard Order Copy Engine ---------

function copyEHROrder(module){
  const rawW = getWeight() || gIBW;
  if (!rawW || rawW <= 0) {
    showToast('กรุณากรอกน้ำหนักตัว (BW) ก่อนคัดลอกคำสั่งรักษา');
    return;
  }
  const w = Number(rawW);
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
  } else if (module === 'airway') {
    const ageYr = getAgeInYears() || (w ? (w < 10 ? 0.5 : (w < 20 ? 3 : 8)) : 1);
    const cuffed = ageYr >= 1 ? ((ageYr / 4) + 3.5).toFixed(1) : (w < 1 ? '2.5' : (w < 2 ? '3.0' : '3.5'));
    const depth = (parseFloat(cuffed) * 3).toFixed(1);
    const blade = suggestBlade(w);
    orderStr = `[ER-PED Airway/RSI] ETT Cuffed ${cuffed} mm ID @ depth ${depth} cm (oral) | Blade: ${blade} | Ketamine ${(w*1.5).toFixed(0)} mg IV + Rocuronium ${(w*1.0).toFixed(0)} mg IV [BW: ${w.toFixed(1)} kg]`;
  } else if (module === 'sepsis') {
    orderStr = `[ER-PED Sepsis 1h Bundle] Blood Culture x2 | IV Ceftriaxone ${Math.min(2000, w*80).toFixed(0)} mg | IV 0.9% NS Bolus ${(w*20).toFixed(0)} mL over 15 min [BW: ${w.toFixed(1)} kg]`;
  } else if (module === 'anaphylaxis') {
    const epiDoseMg = Math.min(w < 30 ? 0.3 : 0.5, w * 0.01).toFixed(2);
    const epiMl = (epiDoseMg * 1.0).toFixed(2);
    orderStr = `[ER-PED Anaphylaxis] Epinephrine 1:1,000 ${epiDoseMg} mg (${epiMl} mL) IM anterolateral thigh q 5-15 min PRN | Diphenhydramine ${Math.min(50, w*1).toFixed(0)} mg IV [BW: ${w.toFixed(1)} kg]`;
  } else if (module === 'trauma') {
    const ebv = (w * 75).toFixed(0);
    orderStr = `[ER-PED Trauma/Burns] xABCDE survey completed | EBV: ${ebv} mL | Modified Parkland: 3 mL x ${w.toFixed(1)}kg x %TBSA (LRS) + Maintenance D5 0.45% NS | Target UO >= 1.0 mL/kg/hr [BW: ${w.toFixed(1)} kg]`;
  } else if (module === 'croup') {
    const dexaMg = Math.min(16, Math.max(0.15 * w, 0.6 * w)).toFixed(1);
    orderStr = `[ER-PED Croup] Dexamethasone ${dexaMg} mg PO/IM/IV single dose | Nebulized Epinephrine 1:1,000 ${Math.min(5, w*0.5).toFixed(1)} mL [BW: ${w.toFixed(1)} kg]`;
  } else if (module === 'transfusion') {
    orderStr = `[ER-PED Transfusion] PRBC (CPDA-1) ${(w*10).toFixed(0)} mL IV over 3 hr (10 mL/kg) | Max rate: ${(w*5).toFixed(0)} mL/hr [BW: ${w.toFixed(1)} kg]`;
  } else if (module === 'electrolytes') {
    if (w) {
      const na = parseFloat(document.getElementById('lyteNa')?.value);
      const k = parseFloat(document.getElementById('lyteK')?.value);
      const na3PctMin = Math.min(w * 3, 100);
      const na3PctMax = Math.min(w * 5, 150);
      const ivKCl = calcIVKClReplacement(w, 0.5);

      if (!isNaN(na) && na < 125) {
        orderStr = `[ER-PED Electrolyte] IV 3% NaCl ${na3PctMin.toFixed(0)}–${na3PctMax.toFixed(0)} mL IV infusion over 20 min (3–5 mL/kg, max 100–150 mL) [Target Na: 135 mEq/L] [BW: ${w.toFixed(1)} kg]`;
      } else if (!isNaN(k) && k < 3.5 && ivKCl) {
        orderStr = `[ER-PED Electrolyte] KCl ${ivKCl.doseMeq} mEq (${ivKCl.kcl2MeqPerMl} mL) in 0.9% NSS ${ivKCl.minVolPeripheralMl} mL IV slow piggyback @ ${ivKCl.peripheralRateMlPerHr} mL/hr over 2 hr (0.25 mEq/kg/hr, conc <= 40 mEq/L) [BW: ${w.toFixed(1)} kg]`;
      } else if (!isNaN(k) && k > 5.5) {
        const caGlu = Math.min(w * 0.5, 10).toFixed(1);
        const ri = Math.min(w * 0.1, 10).toFixed(1);
        const d10w = Math.min(w * 5, 250).toFixed(0);
        const salbu = w <= 25 ? '2.5 mg' : '5.0 mg';
        orderStr = `[ER-PED Hyperkalemia] 10% Calcium Gluconate ${caGlu} mL IV over 5–10 min | Regular Insulin ${ri} U + D10W ${d10w} mL IV over 30 min | Salbutamol neb ${salbu} [BW: ${w.toFixed(1)} kg]`;
      } else {
        const defaultNa3 = Math.min(w * 3, 100).toFixed(0);
        const defaultKCl = ivKCl ? ` | IV KCl ${ivKCl.doseMeq} mEq in NSS ${ivKCl.minVolPeripheralMl} mL over 2 hr` : '';
        orderStr = `[ER-PED Electrolyte] 3% NaCl ${defaultNa3} mL IV over 20 min${defaultKCl} [BW: ${w.toFixed(1)} kg]`;
      }
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

  const doseVal = parseFloat(doseInput?.value) > 0 ? parseFloat(doseInput.value) : (item.doseDefaultMcgKgMin || 0.1);
  const mgVal = parseFloat(prepMgInput?.value) > 0 ? parseFloat(prepMgInput.value) : 1;
  const volVal = parseFloat(prepVolInput?.value) > 0 ? parseFloat(prepVolInput.value) : 50;

  if (!w || w <= 0) {
    outEl.innerHTML = '<div class="badge-cap danger">⚠️ กรุณากรอกน้ำหนักตัว (ABW) ที่ส่วนบนของหน้าจอก่อนคำนวณ</div>';
    return;
  }

  const concMgPerMl = volVal > 0 ? mgVal / volVal : 0;
  const concMcgPerMl = concMgPerMl * 1000;
  const mcgPerHour = doseVal * w * 60;
  const rateMlHr = concMcgPerMl > 0 ? (mcgPerHour / concMcgPerMl) : 0;

  const isCapped = item.maxRateMcgKgMin && doseVal > item.maxRateMcgKgMin;

  outEl.innerHTML = `
    <div class="protocol-table-wrapper">
      <table class="protocol-table">
        <thead>
          <tr>
            <th style="width:25%;">Drug & Route</th>
            <th style="width:20%;">Target Dose</th>
            <th style="width:20%;">Infusion Pump Rate</th>
            <th style="width:20%;">Concentration & Prep</th>
            <th style="width:15%;">Dosing Range</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong style="color:var(--ink); font-size:13px;">${item.drug}</strong>
              <div style="font-size:11px; color:var(--muted); margin-top:2px;">${item.route} ${item.note ? `• ${item.note}` : ''}</div>
            </td>
            <td>
              <span class="dose-badge">${doseVal.toFixed(2)} mcg/kg/min</span>
              <div style="font-size:11px; color:var(--muted); margin-top:2px;">${(mcgPerHour / 1000).toFixed(2)} mg/hr</div>
            </td>
            <td>
              <strong style="color:var(--danger); font-size:15px; font-family:'JetBrains Mono',monospace;">${rateMlHr.toFixed(1)} mL/hr</strong>
            </td>
            <td style="color:var(--muted);">
              <strong style="color:var(--ink);">${concMgPerMl.toFixed(3)} mg/mL</strong>
              <div style="font-size:11px;">${mgVal} mg in ${volVal} mL (${concMcgPerMl.toFixed(0)} mcg/mL)</div>
            </td>
            <td style="color:var(--muted);">
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
      <div class="stage-card" style="${!isFirst ? 'margin-top:8px;' : ''}">
        <div style="font-size:13px; font-weight:700; color:var(--accent); margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
          <span style="display:inline-flex; align-items:center; gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Stage ${stage.stage}: ${stage.name}</span>
        </div>
        <div style="font-size:12px; color:var(--ink); margin-bottom:6px; line-height:1.35; background:var(--panel); padding:6px 10px; border-radius:6px; border-left:3px solid var(--accent);">
          <strong>Action:</strong> ${stage.actions}
        </div>
    `;

    if (stage.drugs && stage.drugs.length > 0) {
      html += `
        <div class="protocol-table-wrapper">
          <table class="protocol-table">
            <thead>
              <tr>
                <th style="width:26%;">Medication</th>
                <th style="width:24%;">Dose (${w.toFixed(1)} kg)</th>
                <th style="width:24%;">Prep Concentration</th>
                <th style="width:26%;">Clinical Note</th>
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
          <tr>
            <td><strong>${d.name}</strong></td>
            <td>
              <span class="dose-badge">${fmtMg(finalDose)} mg</span>
              <span style="font-size:11px; color:var(--muted);">(${d.route})</span>
              ${isCapped ? `<div class="badge-cap warning" style="font-size:10px; padding:1px 4px; display:inline-block; margin-top:2px;">Max ${d.maxDoseMg} mg</div>` : ''}
            </td>
            <td style="color:var(--muted);">${d.prep}</td>
            <td style="color:var(--muted);">${d.note || '—'}</td>
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
    <div class="protocol-table-wrapper">
      <table class="protocol-table">
        <thead>
          <tr>
            <th style="width:22%;">Antidote Name</th>
            <th style="width:22%;">Indication</th>
            <th style="width:22%;">Dose (${w.toFixed(1)} kg)</th>
            <th style="width:18%;">Preparation</th>
            <th style="width:16%;">Note</th>
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
      <tr>
        <td><strong>${item.name}</strong></td>
        <td style="color:var(--muted);">${item.indication}</td>
        <td>
          <span class="dose-badge">${fmtMg(finalDose)} ${unitStr}</span>
          <span style="font-size:11px; color:var(--muted);">(${item.route})</span>
          ${isCapped ? `<div class="badge-cap warning" style="font-size:10px; padding:1px 4px; display:inline-block; margin-top:2px;">Max ${item.maxDoseMg} ${unitStr}</div>` : ''}
        </td>
        <td style="color:var(--muted);">${item.prep}</td>
        <td style="color:var(--muted);">${item.note || '—'}</td>
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
    <div class="protocol-table-wrapper">
      <table class="protocol-table">
        <thead>
          <tr>
            <th style="width:26%;">Medication</th>
            <th style="width:24%;">Calculated Dose (${w.toFixed(1)} kg)</th>
            <th style="width:24%;">Preparation</th>
            <th style="width:26%;">Clinical Note</th>
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
      <tr>
        <td><strong>${item.name}</strong></td>
        <td>
          <span class="dose-badge">${doseStr} ${unitStr}</span>
          <span style="font-size:11px; color:var(--muted);">(${item.route})</span>
          ${isCapped ? `<div class="badge-cap danger" style="font-size:10px; padding:1px 4px; display:inline-block; margin-top:2px;">Max ${maxCap} ${unitStr}</div>` : ''}
        </td>
        <td style="color:var(--muted);">${item.prep}</td>
        <td style="color:var(--muted);">${item.note || '—'}</td>
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
    <div style="background:var(--panel); border:1px solid var(--border); border-radius:var(--r-md); padding:12px; margin-bottom:12px;">
      <strong style="font-size:14.5px; color:var(--ink);">Current Patient Age Bracket: ${currentBracket.ageBracket}</strong>
      <div class="hero-metric-grid" style="margin-top:8px;">
        <div class="hero-metric blue">
          <div class="hero-label">HEART RATE (HR)</div>
          <div class="hero-val">${currentBracket.hrNormal}</div>
          <div class="hero-sub">Normal resting HR</div>
        </div>
        <div class="hero-metric blue">
          <div class="hero-label">RESPIRATORY RATE (RR)</div>
          <div class="hero-val">${currentBracket.rrNormal}</div>
          <div class="hero-sub">Normal resting RR</div>
        </div>
        <div class="hero-metric blue">
          <div class="hero-label">SYSTOLIC BLOOD PRESSURE</div>
          <div class="hero-val">${currentBracket.sysBpNormal}</div>
          <div class="hero-sub">Hypotension cutoff: <span style="color:var(--danger); font-weight:700;">${currentBracket.hypotensionSysBp}</span></div>
        </div>
      </div>
    </div>

    <div class="protocol-table-wrapper">
      <table class="protocol-table">
        <thead>
          <tr>
            <th>Age Bracket</th>
            <th>HR Range</th>
            <th>RR Range</th>
            <th>Systolic BP</th>
            <th>Diastolic BP</th>
            <th>Hypotension Cutoff</th>
          </tr>
        </thead>
        <tbody>
  `;

  DS.vitalSignsRef.forEach(v => {
    const isCurrent = v.ageBracket === currentBracket.ageBracket;
    html += `
      <tr style="${isCurrent ? 'background:var(--accent-soft); font-weight:700;' : ''}">
        <td><strong>${v.ageBracket}</strong> ${isCurrent ? '👈 Active' : ''}</td>
        <td>${v.hrNormal}</td>
        <td>${v.rrNormal}</td>
        <td>${v.sysBpNormal}</td>
        <td>${v.diaBpNormal}</td>
        <td style="color:var(--danger); font-weight:700;">${v.hypotensionSysBp}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  outEl.innerHTML = html;
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
    <div class="protocol-table-wrapper">
      <table class="protocol-table">
        <thead>
          <tr>
            <th style="width:30%;">DKA Protocol Target</th>
            <th style="width:25%;">Calculated Rate / Volume</th>
            <th style="width:45%;">Clinical Breakdown & Instructions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>IV Fluid Rate (Mnt + 48h Deficit)</strong></td>
            <td>
              <strong style="color:var(--danger); font-size:15px; font-family:'JetBrains Mono',monospace;">${totalFluidRate} mL/hr</strong>
            </td>
            <td style="color:var(--muted);">
              Mnt: ${mntRate.toFixed(1)} mL/hr + Deficit: ${deficitRate48h.toFixed(1)} mL/hr (Net Deficit: ${netDeficitMl.toFixed(0)} mL over 48h)
            </td>
          </tr>
          <tr>
            <td><strong>Regular Insulin Drip</strong></td>
            <td>
              <span class="dose-badge">${insulinPumpMlHr} mL/hr</span>
            </td>
            <td style="color:var(--muted);">
              Dose: ${insulinDoseUnitsHr} U/hr (0.1 U/kg/hr) [Prep: 50 U in 50 mL NS = 1 U/mL]
            </td>
          </tr>
          <tr>
            <td><strong>Initial NS Resus Bolus</strong></td>
            <td>
              <strong style="color:var(--ink); font-size:14px; font-family:'JetBrains Mono',monospace;">${initialBolusMl.toFixed(0)} mL</strong>
            </td>
            <td style="color:var(--muted);">
              10 mL/kg 0.9% NS over 1 hour
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    ${isDextroseNeeded ? `
      <div class="badge-cap warning" style="margin-bottom:6px; display:block; padding:4px 8px; line-height:1.3; font-size:11.5px;">
        ⚠️ Bedside BG = ${currentBG} mg/dL (&lt; 250 mg/dL): Switch IV fluid to D5 0.45% NS + 20 mEq/L KCl immediately to maintain BG 150–250 mg/dL while continuing insulin drip!
      </div>
    ` : ''}

    <div style="background:var(--panel); border:1px solid var(--border); border-radius:var(--r-sm); padding:8px 10px;">
      <div style="font-size:11.5px; font-weight:700; color:var(--accent); margin-bottom:4px; display:flex; align-items:center; gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg> Potassium (K+) Correction Rules:</div>
      <ul style="margin:0; padding-left:14px; font-size:11.5px; line-height:1.4; color:var(--ink);">
        <li><strong style="color:var(--danger);">&lt; 3.3 mEq/L:</strong> <strong>HOLD INSULIN!</strong> Add 40 mEq/L KCl to IV fluid. Give 0.5 mEq/kg/hr until K+ &gt; 3.3 mEq/L.</li>
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

// --------- 📚 Clinical Evidence & Reference Modal ---------
function openEvidenceModal(topicKey) {
  const backdrop = document.getElementById('evidenceBackdrop');
  if (!backdrop) return;

  const searchInput = document.getElementById('evidenceSearchInput');
  const catSelect = document.getElementById('evidenceCategorySelect');

  if (topicKey && DS && DS.evidenceReferences && DS.evidenceReferences[topicKey]) {
    const ref = DS.evidenceReferences[topicKey];
    if (searchInput) searchInput.value = '';
    if (catSelect) {
      catSelect.value = ref.category || 'all';
    }
    renderEvidenceList(topicKey, catSelect ? catSelect.value : 'all');
  } else {
    if (searchInput) searchInput.value = '';
    if (catSelect) catSelect.value = 'all';
    renderEvidenceList('', 'all');
  }

  backdrop.classList.remove('hidden');
  if (searchInput) {
    setTimeout(() => { try { searchInput.focus(); } catch (e) {} }, 50);
  }
}

function closeEvidenceModal() {
  const backdrop = document.getElementById('evidenceBackdrop');
  if (backdrop) backdrop.classList.add('hidden');
}

function filterEvidenceList() {
  const searchInput = document.getElementById('evidenceSearchInput');
  const catSelect = document.getElementById('evidenceCategorySelect');
  const query = (searchInput ? searchInput.value : '').trim();
  const category = catSelect ? catSelect.value : 'all';
  renderEvidenceList(query, category);
}

function renderEvidenceList(filterQuery, filterCategory) {
  const container = document.getElementById('evidenceListContainer');
  if (!container) return;

  if (!DS || !DS.evidenceReferences) {
    container.innerHTML = '<div style="color:var(--muted); font-size:13px; text-align:center; padding:16px;">กำลังโหลดฐานข้อมูลหลักฐานทางการแพทย์...</div>';
    return;
  }

  const refs = DS.evidenceReferences;
  const keys = Object.keys(refs);
  const q = (filterQuery || '').toLowerCase();
  const cat = filterCategory || 'all';

  const matches = keys.filter(k => {
    const r = refs[k];
    if (!r) return false;

    // Category match
    if (cat !== 'all' && r.category !== cat) {
      if (k !== filterQuery) return false;
    }

    // Query search
    if (!q) return true;
    if (k.toLowerCase().includes(q)) return true;
    if ((r.title || '').toLowerCase().includes(q)) return true;
    if ((r.organization || '').toLowerCase().includes(q)) return true;
    if ((r.journal || '').toLowerCase().includes(q)) return true;
    if ((r.summary || '').toLowerCase().includes(q)) return true;
    if ((r.loe || '').toLowerCase().includes(q)) return true;
    if ((r.category || '').toLowerCase().includes(q)) return true;
    return false;
  });

  if (matches.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:24px 12px; color:var(--muted); font-size:13px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-bottom:8px; opacity:0.6;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <div>ไม่พบหลักฐานทางการแพทย์หรือแนวทางที่ตรงกับคำค้นหา "<strong>${escapeHtml(filterQuery)}</strong>"</div>
        <button type="button" class="btn" style="margin-top:10px; font-size:12px; padding:4px 10px;" onclick="document.getElementById('evidenceSearchInput').value=''; document.getElementById('evidenceCategorySelect').value='all'; filterEvidenceList();">ล้างตัวกรองทั้งหมด</button>
      </div>
    `;
    return;
  }

  let html = '';
  matches.forEach(k => {
    const r = refs[k];
    const doiLink = r.doi ? `<a href="https://doi.org/${encodeURIComponent(r.doi)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-weight:600; text-decoration:underline; display:inline-flex; align-items:center; gap:3px;">DOI: ${escapeHtml(r.doi)} <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : '';
    const pmidLink = r.pmid ? `<a href="https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(r.pmid)}/" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-weight:600; text-decoration:underline; display:inline-flex; align-items:center; gap:3px;">PMID: ${escapeHtml(r.pmid)} <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : '';
    const isbnText = r.isbn ? `<span style="color:var(--muted); font-weight:600;">ISBN: ${escapeHtml(r.isbn)}</span>` : '';

    const identifiers = [doiLink, pmidLink, isbnText].filter(Boolean).join(' · ');

    html += `
      <div class="evidence-card" id="evidence-card-${k}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap;">
          <div style="font-weight:700; font-size:14px; color:var(--ink); line-height:1.35;">
            ${escapeHtml(r.title)}
          </div>
          <span class="loe-badge">${escapeHtml(r.loe || 'Standard Practice')}</span>
        </div>
        <div style="font-size:12px; color:var(--muted);">
          <strong>${escapeHtml(r.organization || '')}</strong> · <span>${escapeHtml(r.journal || '')}</span> (${r.year || '2026'})
        </div>
        ${identifiers ? `<div style="font-size:11.5px; margin-top:2px;">${identifiers}</div>` : ''}
        <div style="font-size:12.5px; color:var(--ink); background:var(--panel-subtle); border-radius:var(--r-sm); padding:8px 10px; margin-top:4px; line-height:1.45; border-left:3px solid var(--accent);">
          ${escapeHtml(r.summary || '')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// --------- 🫁 Acute Asthmatic Attack Protocol (GINA 2026) ---------
function calcAsthma() {
  if (!DS || !DS.asthmaProtocol) return;
  const outEl = document.getElementById('asthmaOut');
  const w = getWeight();

  if (!outEl) return;
  if (!w || w <= 0) {
    outEl.innerHTML = '<div class="badge-cap danger">⚠️ กรุณากรอกน้ำหนักตัว (ABW) ที่ส่วนบนของหน้าจอก่อนคำนวณ</div>';
    return;
  }

  const proto = DS.asthmaProtocol;
  let html = '';

  // ── HFNC Settings Card ──
  if (proto.hfncSettings) {
    const h = proto.hfncSettings;
    const flowStart = Math.min(h.flowRateLPerKgPerMin * w, h.flowRateMaxLPerMin);
    const flowMin = Math.min(h.flowRateMinLPerKgPerMin * w, h.flowRateMaxLPerMin);
    const nebFlow = Math.min(h.nebFlowMaxLPerKgPerMin * w, h.nebFlowMaxLPerMin);

    html += `
      <div class="stage-card" style="border-left:4px solid #0ea5e9; background:var(--panel); margin-bottom:12px;">
        <div style="font-size:13px; font-weight:700; color:#0ea5e9; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>
          <span>HFNC Settings (${w.toFixed(1)} kg)</span>
        </div>
        <div style="font-size:11.5px; color:var(--muted); margin-bottom:8px; font-style:italic;">
          Supportive only — ใช้เมื่อ SpO₂ &lt; 92% หรือ WOB สูงหลังรับ SABA แล้ว
        </div>
        <div class="protocol-table-wrapper">
          <table class="protocol-table">
            <thead>
              <tr>
                <th style="width:30%;">Parameter</th>
                <th style="width:35%;">Setting</th>
                <th style="width:35%;">Note</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Flow Rate</strong></td>
                <td><span class="dose-badge">${flowStart.toFixed(0)} L/min</span> <span style="font-size:11px; color:var(--muted);">(range ${flowMin.toFixed(0)}–${flowStart.toFixed(0)})</span></td>
                <td style="color:var(--muted);">2 L/kg/min, max ${h.flowRateMaxLPerMin} L/min</td>
              </tr>
              <tr>
                <td><strong>FiO₂</strong></td>
                <td><span class="dose-badge">${h.startFiO2Percent}%</span> <span style="font-size:11px; color:var(--muted);">start</span></td>
                <td style="color:var(--muted);">Titrate to SpO₂ ≥ ${h.targetSpO2Percent}%</td>
              </tr>
              <tr>
                <td><strong>Temperature</strong></td>
                <td><span class="dose-badge">${h.temperatureC}°C</span></td>
                <td style="color:var(--muted);">Full humidification</td>
              </tr>
              <tr>
                <td><strong>NEB during HFNC</strong></td>
                <td><span class="dose-badge">${nebFlow.toFixed(1)} L/min</span> <span style="font-size:11px; color:var(--muted);">(max)</span></td>
                <td style="color:var(--muted);">Reduce flow to ≤ 0.25 L/kg/min for medication deposition</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── Severity Assessment Table ──
  if (proto.severityAssessment && proto.severityAssessment.length > 0) {
    html += `
      <div class="stage-card" style="margin-bottom:12px;">
        <div style="font-size:13px; font-weight:700; color:var(--accent); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M17 12h-2l-2 5-3-10-2 5H7"/></svg>
          <span>Severity Assessment (GINA 2026 / PRAM)</span>
        </div>
        <div class="protocol-table-wrapper">
          <table class="protocol-table">
            <thead>
              <tr>
                <th style="width:22%;">Feature</th>
                <th style="width:26%; background:var(--good-soft); color:var(--good);">Mild–Moderate</th>
                <th style="width:26%; background:var(--warning-soft); color:var(--warning);">Severe</th>
                <th style="width:26%; background:var(--danger-soft); color:var(--danger);">Life-Threatening</th>
              </tr>
            </thead>
            <tbody>
    `;
    proto.severityAssessment.forEach(row => {
      html += `
              <tr>
                <td><strong>${row.feature}</strong></td>
                <td>${row.mildModerate}</td>
                <td>${row.severe}</td>
                <td>${row.lifeThreatening}</td>
              </tr>
      `;
    });
    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── Stepwise Protocol ──
  if (proto.steps && proto.steps.length > 0) {
    proto.steps.forEach((stage, idx) => {
      html += `
        <div class="stage-card" style="${idx > 0 ? 'margin-top:8px;' : ''}">
          <div style="font-size:13px; font-weight:700; color:var(--accent); margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
            <span style="display:inline-flex; align-items:center; gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Stage ${stage.stage}: ${stage.name}</span>
          </div>
          <div style="font-size:12px; color:var(--ink); margin-bottom:6px; line-height:1.35; background:var(--panel); padding:6px 10px; border-radius:6px; border-left:3px solid var(--accent);">
            <strong>Action:</strong> ${stage.actions}
          </div>
      `;

      if (stage.drugs && stage.drugs.length > 0) {
        html += `
          <div class="protocol-table-wrapper">
            <table class="protocol-table">
              <thead>
                <tr>
                  <th style="width:22%;">Medication</th>
                  <th style="width:26%;">Dose (${w.toFixed(1)} kg)</th>
                  <th style="width:24%;">Preparation</th>
                  <th style="width:28%;">Clinical Note</th>
                </tr>
              </thead>
              <tbody>
        `;

        stage.drugs.forEach(d => {
          let doseDisplay = '';

          if (d.fixedDose) {
            // Fixed dose (e.g., MDI puffs)
            doseDisplay = `<span class="dose-badge">${d.fixedDose}</span>`;
          } else if (d.fixedDoseLt20kg !== undefined) {
            // Weight-threshold dose (Ipratropium)
            const ipDose = w < 20 ? d.fixedDoseLt20kg : d.fixedDoseGte20kg;
            doseDisplay = `<span class="dose-badge">${ipDose * 1000} mcg</span>`;
            doseDisplay += ` <span style="font-size:11px; color:var(--muted);">(${w < 20 ? '<20kg' : '≥20kg'})</span>`;
          } else if (d.doseMcgPerKg) {
            // mcg/kg dosing (Terbutaline)
            let rawDose = d.doseMcgPerKg * w;
            let finalDose = rawDose;
            let isCapped = false;
            if (d.maxDoseMcg && rawDose > d.maxDoseMcg) {
              finalDose = d.maxDoseMcg;
              isCapped = true;
            }
            doseDisplay = `<span class="dose-badge">${finalDose.toFixed(0)} mcg</span>`;
            doseDisplay += ` <span style="font-size:11px; color:var(--muted);">(${d.route})</span>`;
            if (isCapped) doseDisplay += ` <div class="badge-cap warning" style="font-size:10px; padding:1px 4px; display:inline-block; margin-top:2px;">Max ${d.maxDoseMcg} mcg</div>`;
          } else if (d.doseMgPerKg) {
            // Standard mg/kg dosing
            let rawDose = d.doseMgPerKg * w;
            let finalDose = rawDose;
            let isCapped = false;
            if (d.minDoseMg && rawDose < d.minDoseMg) {
              finalDose = d.minDoseMg;
            }
            if (d.maxDoseMg && rawDose > d.maxDoseMg) {
              finalDose = d.maxDoseMg;
              isCapped = true;
            }
            doseDisplay = `<span class="dose-badge">${fmtMg(finalDose)} mg</span>`;
            doseDisplay += ` <span style="font-size:11px; color:var(--muted);">(${d.route})</span>`;
            if (isCapped) doseDisplay += ` <div class="badge-cap warning" style="font-size:10px; padding:1px 4px; display:inline-block; margin-top:2px;">Max ${d.maxDoseMg} mg</div>`;
          }

          html += `
                <tr>
                  <td><strong>${d.name}</strong></td>
                  <td>${doseDisplay}</td>
                  <td style="color:var(--muted);">${d.prep}</td>
                  <td style="color:var(--muted);">${d.note || '—'}</td>
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
  }

  // ── Disposition Criteria ──
  if (proto.dispositionCriteria) {
    const dc = proto.dispositionCriteria;
    html += `
      <div class="stage-card" style="margin-top:12px;">
        <div style="font-size:13px; font-weight:700; color:var(--accent); margin-bottom:8px;">
          🏥 Disposition Criteria
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
    `;

    if (dc.discharge) {
      html += `
          <div style="background:#dcfce7; border-radius:8px; padding:10px; border:1px solid #bbf7d0;">
            <div style="font-size:12px; font-weight:700; color:#166534; margin-bottom:6px;">✅ Discharge</div>
            <ul style="margin:0; padding-left:16px; font-size:11.5px; color:#166534; line-height:1.6;">
              ${dc.discharge.map(c => `<li>${c}</li>`).join('')}
            </ul>
          </div>
      `;
    }
    if (dc.admit) {
      html += `
          <div style="background:#fef9c3; border-radius:8px; padding:10px; border:1px solid #fde68a;">
            <div style="font-size:12px; font-weight:700; color:#854d0e; margin-bottom:6px;">🔶 Admit Ward</div>
            <ul style="margin:0; padding-left:16px; font-size:11.5px; color:#854d0e; line-height:1.6;">
              ${dc.admit.map(c => `<li>${c}</li>`).join('')}
            </ul>
          </div>
      `;
    }
    if (dc.picu) {
      html += `
          <div style="background:#fee2e2; border-radius:8px; padding:10px; border:1px solid #fecaca;">
            <div style="font-size:12px; font-weight:700; color:#991b1b; margin-bottom:6px;">🚨 PICU</div>
            <ul style="margin:0; padding-left:16px; font-size:11.5px; color:#991b1b; line-height:1.6;">
              ${dc.picu.map(c => `<li>${c}</li>`).join('')}
            </ul>
          </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  outEl.innerHTML = html;
}

// --------- 🧪 Pediatric Electrolytes & Corrected Imbalance Module ---------

function calcCorrectedNa(measuredNa, glucose, formula = 'katz') {
  if (typeof measuredNa !== 'number' || isNaN(measuredNa) || measuredNa <= 0) return null;
  if (typeof glucose !== 'number' || isNaN(glucose) || glucose <= 0) return measuredNa;
  const factor = (formula === 'ispad' || formula === 'hillier') ? 2.0 : 1.6;
  if (glucose <= 100) return measuredNa;
  const delta = factor * ((glucose - 100) / 100);
  return measuredNa + delta;
}

function calcCorrectedCa(totalCa, albumin) {
  if (typeof totalCa !== 'number' || isNaN(totalCa) || totalCa <= 0) return null;
  if (typeof albumin !== 'number' || isNaN(albumin) || albumin <= 0) return totalCa;
  return totalCa + 0.8 * (4.0 - albumin);
}

function calcKShift(measuredK, ph) {
  if (typeof measuredK !== 'number' || isNaN(measuredK) || measuredK <= 0) return null;
  if (typeof ph !== 'number' || isNaN(ph) || ph <= 0) return measuredK;
  const deltaPh = 7.40 - ph;
  return measuredK - (deltaPh * 6.0);
}

function calcIVKClReplacement(weightKg, doseMeqPerKg = 0.5) {
  if (!weightKg || isNaN(weightKg) || weightKg <= 0) return null;
  const rawDoseMeq = weightKg * doseMeqPerKg;
  const doseMeq = Math.min(rawDoseMeq, 20); // capped at 20 mEq per peripheral piggyback dose
  const kcl2MeqPerMl = doseMeq / 2; // 2 mEq/mL injection
  // Peripheral line max conc: 40 mEq/L -> (doseMeq / 40) * 1000 mL
  const minVolPeripheralMl = Math.round((doseMeq / 40) * 1000);
  // Central line max conc: 80 mEq/L -> (doseMeq / 80) * 1000 mL
  const minVolCentralMl = Math.round((doseMeq / 80) * 1000);
  // Infusion rates
  const peripheralRateMlPerHr = +(minVolPeripheralMl / 2).toFixed(1); // over 2 hours
  const centralRateMlPerHr = +(minVolCentralMl / 1).toFixed(1); // over 1 hour
  const deliveryRateMeqPerKgPerHr = +(doseMeq / weightKg / 2).toFixed(2); // delivery rate mEq/kg/hr over 2 hr
  return {
    doseMeq: +doseMeq.toFixed(1),
    rawDoseMeq: +rawDoseMeq.toFixed(1),
    kcl2MeqPerMl: +kcl2MeqPerMl.toFixed(1),
    minVolPeripheralMl,
    minVolCentralMl,
    peripheralRateMlPerHr,
    centralRateMlPerHr,
    deliveryRateMeqPerKgPerHr
  };
}

function calcOralKClReplacement(weightKg, doseMeqPerKgPerDay = 1.5) {
  if (!weightKg || isNaN(weightKg) || weightKg <= 0) return null;
  const dailyMeq = Math.min(weightKg * doseMeqPerKgPerDay, 80);
  const tidDoseMeq = +(dailyMeq / 3).toFixed(1);
  const kcl10PctSyrupMlPerDose = +(tidDoseMeq / 1.34).toFixed(1); // 10% KCl syrup ~ 1.34 mEq/mL
  return {
    dailyMeq: +dailyMeq.toFixed(1),
    tidDoseMeq,
    kcl10PctSyrupMlPerDose
  };
}

function getTBWFactor(ageYr, isFemale = false) {
  if (ageYr === null || ageYr === undefined || isNaN(ageYr)) return 0.60;
  if (ageYr < 1 / 12) return 0.70;
  if (ageYr < 1) return 0.65;
  if (ageYr >= 12 && isFemale) return 0.50;
  return 0.60;
}

function calcNaDeficit(weightKg, measuredNa, targetNa = 135, ageYr = 5, isFemale = false) {
  if (!weightKg || weightKg <= 0 || !measuredNa || measuredNa <= 0) return null;
  if (measuredNa >= targetNa) return 0;
  const tbwFactor = getTBWFactor(ageYr, isFemale);
  const tbw = weightKg * tbwFactor;
  return tbw * (targetNa - measuredNa);
}

function calcFreeWaterDeficit(weightKg, measuredNa, targetNa = 140, ageYr = 5, isFemale = false) {
  if (!weightKg || weightKg <= 0 || !measuredNa || measuredNa <= 0) return null;
  if (measuredNa <= targetNa) return 0;
  const tbwFactor = getTBWFactor(ageYr, isFemale);
  const tbw = weightKg * tbwFactor;
  return tbw * ((measuredNa / targetNa) - 1);
}

function calcBicarbonateDeficit(weightKg, measuredHCO3, targetHCO3 = 15) {
  if (!weightKg || weightKg <= 0 || measuredHCO3 === null || isNaN(measuredHCO3)) return null;
  if (measuredHCO3 >= targetHCO3) return 0;
  return weightKg * 0.3 * (targetHCO3 - measuredHCO3);
}

function calcAnionGap(na, cl, hco3) {
  if (na === null || isNaN(na) || cl === null || isNaN(cl) || hco3 === null || isNaN(hco3)) return null;
  return na - (cl + hco3);
}

function calcCorrectedAnionGap(ag, albumin) {
  if (ag === null || isNaN(ag)) return null;
  if (albumin === null || isNaN(albumin) || albumin <= 0) return ag;
  return ag + 2.5 * (4.0 - albumin);
}

function calcDeltaRatio(ag, hco3) {
  if (ag === null || isNaN(ag) || hco3 === null || isNaN(hco3)) return null;
  const deltaAG = ag - 12;
  const deltaHCO3 = 24 - hco3;
  if (deltaHCO3 === 0) return null;
  return deltaAG / deltaHCO3;
}

function interpretDeltaRatio(ag, hco3) {
  if (ag === null || isNaN(ag) || hco3 === null || isNaN(hco3)) return 'ใช้ประเมิน Mixed acid-base disorders';
  if (hco3 >= 24) {
    if (ag > 12) {
      return '<strong style="color:var(--warning);">Mixed High AG Acidosis + Metabolic Alkalosis</strong> (HCO3 ≥ 24: มีภาวะด่างเกินร่วม เช่น อาเจียน/เสียกรด)';
    }
    return '<strong style="color:var(--good);">Normal AG & Normal/High HCO3</strong> (ไม่มี High AG Acidosis)';
  }
  if (ag <= 12) {
    return '<strong style="color:var(--warning);">Pure Normal AG (Hyperchloremic) Acidosis</strong> (AG ปกติแต่ HCO3 ต่ำ เช่น ท้องเสีย/RTA)';
  }
  const deltaAG = ag - 12;
  const deltaHCO3 = 24 - hco3;
  const ratio = deltaAG / deltaHCO3;
  if (ratio < 0.8) {
    return `<strong>< 0.8 (${ratio.toFixed(2)}):</strong> <strong style="color:var(--warning);">Mixed High AG + Normal AG Acidosis</strong> (HCO3 ลดลงมากกว่า AG ที่เพิ่ม เช่น DKA + Diarrhea/Saline)`;
  }
  if (ratio <= 2.0) {
    return `<strong>0.8–2.0 (${ratio.toFixed(2)}):</strong> <strong style="color:var(--danger);">Pure High AG Metabolic Acidosis</strong> (DKA, Lactic Acidosis, Uremia, Toxins)`;
  }
  return `<strong>> 2.0 (${ratio.toFixed(2)}):</strong> <strong style="color:var(--warning);">Mixed High AG Acidosis + Metabolic Alkalosis</strong> (หรือ Compensated Chronic Resp Acidosis)`;
}

function calcOsmolality(na, glucose, bun) {
  if (na === null || isNaN(na) || na <= 0) return null;
  const g = (glucose && !isNaN(glucose) && glucose > 0) ? glucose / 18 : 0;
  const b = (bun && !isNaN(bun) && bun > 0) ? bun / 2.8 : 0;
  return (2 * na) + g + b;
}

function calcEffectiveTonicity(na, glucose) {
  if (na === null || isNaN(na) || na <= 0) return null;
  const g = (glucose && !isNaN(glucose) && glucose > 0) ? glucose / 18 : 0;
  return (2 * na) + g;
}

function calcOsmolarGap(measuredOsm, calcOsm) {
  if (measuredOsm === null || isNaN(measuredOsm) || calcOsm === null || isNaN(calcOsm)) return null;
  return measuredOsm - calcOsm;
}

function calcFeNa(uNa, sNa, uCr, sCr) {
  if (uNa === null || sNa === null || uCr === null || sCr === null || isNaN(uNa) || isNaN(sNa) || isNaN(uCr) || isNaN(sCr) || sNa <= 0 || uCr <= 0) return null;
  return ((uNa * sCr) / (sNa * uCr)) * 100;
}

function calcFeUrea(uUrea, sBUN, uCr, sCr) {
  if (uUrea === null || sBUN === null || uCr === null || sCr === null || isNaN(uUrea) || isNaN(sBUN) || isNaN(uCr) || isNaN(sCr) || sBUN <= 0 || uCr <= 0) return null;
  return ((uUrea * sCr) / (sBUN * uCr)) * 100;
}

function calcUAG(uNa, uK, uCl) {
  if (uNa === null || uK === null || uCl === null || isNaN(uNa) || isNaN(uK) || isNaN(uCl)) return null;
  return (uNa + uK) - uCl;
}

function calcTTKG(uK, sK, uOsm, sOsm) {
  if (uK === null || sK === null || uOsm === null || sOsm === null || isNaN(uK) || isNaN(sK) || isNaN(uOsm) || isNaN(sOsm) || sK <= 0 || uOsm <= 0) return null;
  return (uK * sOsm) / (sK * uOsm);
}

function getActiveElectrolyteAgeKey(ageYr) {
  if (ageYr === null || ageYr === undefined || isNaN(ageYr)) return 'child';
  const ageMonths = ageYr * 12;
  if (ageMonths < 1) return 'neonate';
  if (ageMonths < 12) return 'infant';
  if (ageYr < 12) return 'child';
  return 'adolescent';
}

function calcElectrolytes() {
  const outEl = document.getElementById('lyteOut');
  if (!outEl) return;
  const w = getWeight();
  const ageYr = getAgeInYears();

  // Parse lab inputs
  const na = parseFloat(document.getElementById('lyteNa')?.value);
  const glucose = parseFloat(document.getElementById('lyteGlucose')?.value);
  const totalCa = parseFloat(document.getElementById('lyteTotalCa')?.value);
  const albumin = parseFloat(document.getElementById('lyteAlbumin')?.value);
  const k = parseFloat(document.getElementById('lyteK')?.value);
  const ph = parseFloat(document.getElementById('lytePH')?.value);
  const cl = parseFloat(document.getElementById('lyteCl')?.value);
  const hco3 = parseFloat(document.getElementById('lyteHCO3')?.value);
  const bun = parseFloat(document.getElementById('lyteBUN')?.value);
  const sCr = parseFloat(document.getElementById('lyteSCr')?.value);
  const measOsm = parseFloat(document.getElementById('lyteMeasOsm')?.value);
  const targetNa = parseFloat(document.getElementById('lyteTargetNa')?.value) || 135;

  const uNa = parseFloat(document.getElementById('lyteUNa')?.value);
  const uK = parseFloat(document.getElementById('lyteUK')?.value);
  const uCl = parseFloat(document.getElementById('lyteUCl')?.value);
  const uCr = parseFloat(document.getElementById('lyteUCr')?.value);
  const uUrea = parseFloat(document.getElementById('lyteUUrea')?.value);
  const uOsm = parseFloat(document.getElementById('lyteUOsm')?.value);

  // Compute diagnostic values (weight-independent)
  const corrNaKatz = (!isNaN(na) && !isNaN(glucose)) ? calcCorrectedNa(na, glucose, 'katz') : null;
  const corrNaISPAD = (!isNaN(na) && !isNaN(glucose)) ? calcCorrectedNa(na, glucose, 'ispad') : null;
  const corrCa = (!isNaN(totalCa) && !isNaN(albumin)) ? calcCorrectedCa(totalCa, albumin) : null;
  const estKShift = (!isNaN(k) && !isNaN(ph)) ? calcKShift(k, ph) : null;

  const ag = (!isNaN(na) && !isNaN(cl) && !isNaN(hco3)) ? calcAnionGap(na, cl, hco3) : null;
  const corrAG = (ag !== null && !isNaN(albumin)) ? calcCorrectedAnionGap(ag, albumin) : ag;
  const deltaRatio = (ag !== null && !isNaN(hco3)) ? calcDeltaRatio(ag, hco3) : null;

  const calcOsm = !isNaN(na) ? calcOsmolality(na, glucose, bun) : null;
  const effTonicity = !isNaN(na) ? calcEffectiveTonicity(na, glucose) : null;
  const osmGap = (measOsm && calcOsm) ? calcOsmolarGap(measOsm, calcOsm) : null;

  const fena = (!isNaN(uNa) && !isNaN(na) && !isNaN(uCr) && !isNaN(sCr)) ? calcFeNa(uNa, na, uCr, sCr) : null;
  const feUrea = (!isNaN(uUrea) && !isNaN(bun) && !isNaN(uCr) && !isNaN(sCr)) ? calcFeUrea(uUrea, bun, uCr, sCr) : null;
  const uag = (!isNaN(uNa) && !isNaN(uK) && !isNaN(uCl)) ? calcUAG(uNa, uK, uCl) : null;
  const ttkg = (!isNaN(uK) && !isNaN(k) && !isNaN(uOsm) && calcOsm) ? calcTTKG(uK, k, uOsm, calcOsm) : null;

  // Weight-dependent values
  const hasWeight = (typeof w === 'number' && !isNaN(w) && w > 0);
  const naDeficit = (hasWeight && !isNaN(na) && na < targetNa) ? calcNaDeficit(w, na, targetNa, ageYr) : null;
  const freeWaterDeficit = (hasWeight && !isNaN(na) && na > 140) ? calcFreeWaterDeficit(w, na, 140, ageYr) : null;
  const hco3Deficit = (hasWeight && !isNaN(hco3) && hco3 < 15) ? calcBicarbonateDeficit(w, hco3, 15) : null;

  const na3PctMinMl = hasWeight ? Math.min(w * 3, 100) : null;
  const na3PctMaxMl = hasWeight ? Math.min(w * 5, 150) : null;
  const ivKCl = hasWeight ? calcIVKClReplacement(w, 0.5) : null;
  const oralKCl = hasWeight ? calcOralKClReplacement(w, 1.5) : null;

  let html = '';

  // ── SECTION 1: Quick Clinical Correctors Display ──
  html += `
    <div style="margin-bottom:12px;">
      <div style="font-size:13px; font-weight:700; color:var(--accent); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
        <span>1. Corrected Electrolyte Values & Transcellular Shifts</span>
      </div>
      <div class="grid">
        <!-- Corrected Sodium Card -->
        <div class="col-4">
          <div style="background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:10px 12px; height:100%;">
            <div style="font-size:11.5px; color:var(--muted); font-weight:600; margin-bottom:4px;">CORRECTED SODIUM (HYPERGLYCEMIA)</div>
            ${corrNaKatz !== null ? `
              <div style="font-size:18px; font-weight:800; color:var(--ink); font-family:var(--font-mono); margin-bottom:4px;">
                ${corrNaKatz.toFixed(1)} <span style="font-size:12px; font-weight:600; color:var(--muted);">mEq/L (Katz 1.6)</span>
              </div>
              <div style="font-size:12.5px; font-weight:700; color:var(--accent); font-family:var(--font-mono);">
                ${corrNaISPAD.toFixed(1)} <span style="font-size:11px; font-weight:500; color:var(--muted);">mEq/L (ISPAD 2.0)</span>
              </div>
              <div style="font-size:11px; color:var(--muted); margin-top:6px; line-height:1.4;">
                Measured Na: <strong>${na}</strong> | Glucose: <strong>${glucose} mg/dL</strong>
                ${glucose >= 250 ? '<br><span style="color:var(--warning); font-weight:700;">⚠️ ใน DKA เมื่อน้ำตาลลด Na ต้องค่อยๆ เพิ่มขึ้น หาก Corrected Na ลดลงให้ระวัง Cerebral Edema</span>' : ''}
              </div>
            ` : `
              <div style="font-size:12px; color:var(--muted); font-style:italic;">กรอก Serum Na และ Glucose เพื่อคำนวณ</div>
            `}
          </div>
        </div>

        <!-- Corrected Calcium Card -->
        <div class="col-4">
          <div style="background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:10px 12px; height:100%;">
            <div style="font-size:11.5px; color:var(--muted); font-weight:600; margin-bottom:4px;">CORRECTED CALCIUM (PAYNE)</div>
            ${corrCa !== null ? `
              <div style="font-size:18px; font-weight:800; color:var(--ink); font-family:var(--font-mono); margin-bottom:4px;">
                ${corrCa.toFixed(1)} <span style="font-size:12px; font-weight:600; color:var(--muted);">mg/dL</span>
              </div>
              <div style="margin-bottom:6px;">
                ${corrCa < 8.8 ? '<span class="dose-badge" style="background:var(--warning-soft); color:var(--warning);">▲ Hypocalcemia</span>' : (corrCa > 10.8 ? '<span class="dose-badge" style="background:var(--danger-soft); color:var(--danger);">✕ Hypercalcemia</span>' : '<span class="dose-badge" style="background:var(--good-soft); color:var(--good);">✓ Normal Ca</span>')}
              </div>
              <div style="font-size:11px; color:var(--muted); line-height:1.4;">
                Total Ca: <strong>${totalCa}</strong> | Albumin: <strong>${albumin} g/dL</strong><br>
                <span>สูตร: Ca + 0.8 × (4.0 - Albumin)</span>
              </div>
            ` : `
              <div style="font-size:12px; color:var(--muted); font-style:italic;">กรอก Total Ca และ Albumin เพื่อคำนวณ</div>
            `}
          </div>
        </div>

        <!-- Estimated Baseline K+ Card -->
        <div class="col-4">
          <div style="background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:10px 12px; height:100%;">
            <div style="font-size:11.5px; color:var(--muted); font-weight:600; margin-bottom:4px;">ESTIMATED BASELINE K+ (AT pH 7.40)</div>
            ${estKShift !== null ? `
              <div style="font-size:18px; font-weight:800; color:var(--ink); font-family:var(--font-mono); margin-bottom:4px;">
                ${estKShift.toFixed(1)} <span style="font-size:12px; font-weight:600; color:var(--muted);">mEq/L</span>
              </div>
              <div style="font-size:11px; color:var(--muted); line-height:1.4;">
                Measured K+: <strong>${k}</strong> | Blood pH: <strong>${ph}</strong><br>
                ${ph < 7.30 && k <= 4.5 ? '<span style="color:var(--danger); font-weight:700;">⚠️ ระวัง Hidden Hypokalemia รุนแรง! เมื่อแก้กรด K+ จะลดลงอีกมาก</span>' : '<span>ปรับตาม Internal shift: Δ0.1 pH ≈ 0.6 mEq/L</span>'}
              </div>
            ` : `
              <div style="font-size:12px; color:var(--muted); font-style:italic;">กรอก Serum K+ และ Blood pH เพื่อคำนวณ</div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;

  // ── SECTION 2: Deficit & Replacement Table ──
  html += `
    <div class="stage-card" style="margin-bottom:12px;">
      <div style="font-size:13px; font-weight:700; color:var(--accent); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
        <span>2. Fluid & Electrolyte Deficit Calculations ${hasWeight ? `(${w.toFixed(1)} kg)` : ''}</span>
      </div>
  `;

  if (hasWeight) {
    const freeWaterMl = (freeWaterDeficit !== null) ? freeWaterDeficit * 1000 : null;
    const freeWaterHourly = (freeWaterMl !== null) ? (freeWaterMl / 48) : null;
    const mntHourly = calcMaintenanceMlPerHr(w);
    const combinedTotalFluidRate = (freeWaterHourly !== null) ? (mntHourly + freeWaterHourly) : null;

    const init50Meq = (hco3Deficit !== null) ? (hco3Deficit * 0.5) : null;
    const init50Ml = (init50Meq !== null) ? (init50Meq / 0.89) : null;

    html += `
      <div class="protocol-table-wrapper">
        <table class="protocol-table">
          <thead>
            <tr>
              <th style="width:25%;">Parameter / Protocol</th>
              <th style="width:35%;">Calculated Amount</th>
              <th style="width:40%;">Clinical Directives & Safety Caps</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>3% NaCl Emergency Bolus</strong><br><span style="font-size:11px; color:var(--muted);">Symptomatic Hyponatremia</span></td>
              <td><span class="dose-badge" style="background:var(--danger-soft); color:var(--danger); font-weight:800;">${na3PctMinMl.toFixed(0)}–${na3PctMaxMl.toFixed(0)} mL</span></td>
              <td style="color:var(--muted);">3–5 mL/kg IV over 10–20 min (Max 100–150 mL). คาดหวัง Na เพิ่มขึ้น +2–3 mEq/L เพื่อหยุดชัก</td>
            </tr>
            <tr>
              <td><strong>Total Sodium Deficit</strong><br><span style="font-size:11px; color:var(--muted);">Target Na ${targetNa} mEq/L</span></td>
              <td>${naDeficit !== null ? `<span class="dose-badge">${naDeficit.toFixed(1)} mEq</span>` : '<span style="color:var(--muted); font-style:italic;">กรอก Na < ' + targetNa + '</span>'}</td>
              <td style="color:var(--muted);">TBW × (Target - Current). ⚠️ <strong>Max Correction:</strong> ≤ 8–10 mEq/L ใน 24 ชม. (≤ 0.5 mEq/L/hr) ป้องกัน ODS / CPM</td>
            </tr>
            <tr>
              <td><strong>Free Water Deficit</strong><br><span style="font-size:11px; color:var(--muted);">Hypernatremia (Target 140)</span></td>
              <td>${freeWaterDeficit !== null ? `
                <span class="dose-badge">${freeWaterDeficit.toFixed(2)} L (${freeWaterMl.toFixed(0)} mL)</span><br>
                <span style="font-size:11.5px; font-weight:700; color:var(--accent);">Total Rate: ${combinedTotalFluidRate.toFixed(1)} mL/hr</span> <span style="font-size:11px; color:var(--muted);">(Mnt: ${mntHourly.toFixed(1)} + Deficit: ${freeWaterHourly.toFixed(1)} mL/hr)</span>
              ` : '<span style="color:var(--muted); font-style:italic;">กรอก Na > 140</span>'}</td>
              <td style="color:var(--muted);">TBW × (Na/140 - 1). ⚠️ ให้สารน้ำ (D5 0.2% หรือ 0.45% NaCl) ช้าๆ ภายใน <strong>48 ชั่วโมง</strong> (ลด Na ≤ 0.5 mEq/L/hr) ป้องกัน Cerebral Edema</td>
            </tr>
            <tr>
              <td><strong>IV KCl Slow Piggyback</strong><br><span style="font-size:11px; color:var(--muted);">Symptomatic / Severe Hypokalemia</span></td>
              <td><span class="dose-badge" style="background:var(--warning-soft); color:var(--warning); font-weight:800;">${ivKCl.doseMeq} mEq (${ivKCl.kcl2MeqPerMl} mL)</span> in NSS ≥ ${ivKCl.minVolPeripheralMl} mL</td>
              <td style="color:var(--muted);">0.5 mEq/kg (Max 20 mEq) IV over 2 hr (Rate ${ivKCl.peripheralRateMlPerHr} mL/hr, conc ≤ 40 mEq/L). ⚠️ <strong>ห้าม IV Push เด็ดขาด!</strong></td>
            </tr>
            <tr>
              <td><strong>Oral KCl Replacement</strong><br><span style="font-size:11px; color:var(--muted);">Mild–Moderate Hypokalemia</span></td>
              <td><span class="dose-badge">${oralKCl.tidDoseMeq} mEq/dose (${oralKCl.kcl10PctSyrupMlPerDose} mL 10% syrup)</span></td>
              <td style="color:var(--muted);">1.5 mEq/kg/day (${oralKCl.dailyMeq} mEq/day) แบ่งให้ tid หลังอาหารพร้อมน้ำ/น้ำผลไม้ (Max 40 mEq/dose)</td>
            </tr>
            <tr>
              <td><strong>Bicarbonate Deficit</strong><br><span style="font-size:11px; color:var(--muted);">Target HCO3 15 mEq/L</span></td>
              <td>${hco3Deficit !== null ? `
                <span class="dose-badge">${hco3Deficit.toFixed(1)} mEq Total</span><br>
                <span style="font-size:11.5px; font-weight:700; color:var(--accent);">Initial 50%: ${init50Meq.toFixed(1)} mEq (${init50Ml.toFixed(1)} mL 7.5% NaHCO3)</span>
              ` : '<span style="color:var(--muted); font-style:italic;">กรอก HCO3 < 15</span>'}</td>
              <td style="color:var(--muted);">BW × 0.3 × (15 - HCO3). Drip over 1–2 ชม. หลีกเลี่ยงใน DKA/Lactic acidosis ยกเว้นมี Severe collapse</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  } else {
    html += `
      <div style="background:var(--warning-soft); color:var(--warning); border:1px solid var(--warning); border-radius:6px; padding:10px 12px; font-size:12px; font-weight:600;">
        ⚠️ กรุณากรอกน้ำหนักตัว (ABW) ที่ส่วนบนของหน้าจอเพื่อคำนวณ 3% NaCl Bolus, Sodium/Free Water Deficits, และขนาดยา KCl Replacement
      </div>
    `;
  }

  html += `</div>`;

  // ── SECTION 3: Diagnostic Acid-Base & Renal Indices ──
  html += `
    <div class="stage-card" style="margin-bottom:12px;">
      <div style="font-size:13px; font-weight:700; color:var(--accent); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>3. Advanced Acid-Base, Osmolality & Renal Indices</span>
      </div>
      <div class="protocol-table-wrapper">
        <table class="protocol-table">
          <thead>
            <tr>
              <th style="width:25%;">Diagnostic Index</th>
              <th style="width:25%;">Calculated Value</th>
              <th style="width:50%;">Clinical Interpretation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Serum Anion Gap (AG)</strong></td>
              <td>${ag !== null ? `<span class="dose-badge">${ag.toFixed(1)} mEq/L</span> ${corrAG !== ag ? `<br><span style="font-size:11px; color:var(--accent);">Corr AG: ${corrAG.toFixed(1)}</span>` : ''}` : '<span style="color:var(--muted); font-style:italic;">กรอก Na, Cl, HCO3</span>'}</td>
              <td style="color:var(--muted);">Normal: 8–12 mEq/L. ${ag > 12 ? '<strong style="color:var(--danger);">✕ High AG Metabolic Acidosis</strong> (DKA, Lactic, Toxins, Uremia)' : '<strong style="color:var(--good);">✓ Normal Anion Gap</strong>'}</td>
            </tr>
            <tr>
              <td><strong>Delta Ratio (ΔAG / ΔHCO3)</strong></td>
              <td>${deltaRatio !== null && !isNaN(deltaRatio) && deltaRatio >= 0 && hco3 < 24 ? `<span class="dose-badge">${deltaRatio.toFixed(2)}</span>` : (ag !== null && hco3 !== null ? '<span class="dose-badge" style="font-size:11px;">Categorized</span>' : '<span style="color:var(--muted); font-style:italic;">กรอก AG และ HCO3</span>')}</td>
              <td style="color:var(--muted);">${interpretDeltaRatio(ag, hco3)}</td>
            </tr>
            <tr>
              <td><strong>Serum Osmolality & Gap</strong></td>
              <td>${calcOsm !== null ? `<span class="dose-badge">${calcOsm.toFixed(1)} mOsm/kg</span>` : '<span style="color:var(--muted); font-style:italic;">กรอก Na, Glucose, BUN</span>'}${osmGap !== null ? `<br><span style="font-size:11px; color:${osmGap > 10 ? 'var(--danger)' : 'var(--good)'}; font-weight:700;">Gap: ${osmGap.toFixed(1)}</span>` : ''}</td>
              <td style="color:var(--muted);">${effTonicity ? `Effective Tonicity: <strong>${effTonicity.toFixed(1)}</strong> mOsm/kg. ` : ''}${osmGap !== null ? (osmGap > 10 ? '<strong style="color:var(--danger);">⚠️ High Osmolar Gap (>10):</strong> สงสัย Toxic Alcohols (Methanol, Ethylene Glycol) หรือ Mannitol' : '<strong style="color:var(--good);">✓ Osmolar gap ปกติ (< 10 mOsm/kg)</strong>') : 'Calculated = 2Na + Glu/18 + BUN/2.8'}</td>
            </tr>
            <tr>
              <td><strong>FeNa (%) & FeUrea (%)</strong></td>
              <td>${fena !== null ? `<span class="dose-badge">FeNa: ${fena.toFixed(2)}%</span>` : ''}${feUrea !== null ? `<br><span class="dose-badge" style="margin-top:2px;">FeUrea: ${feUrea.toFixed(1)}%</span>` : ''}${fena === null && feUrea === null ? '<span style="color:var(--muted); font-style:italic;">กรอก Urine Na/Cr, Serum Na/Cr</span>' : ''}</td>
              <td style="color:var(--muted);">${fena !== null ? (fena < 1.0 ? '<strong style="color:var(--good);">✓ FeNa < 1.0%: Prerenal Azotemia</strong> (ท่อไตดูด Na กลับได้ดี)' : '<strong style="color:var(--danger);">✕ FeNa > 2.0%: Intrinsic AKI / ATN</strong> (ท่อไตสูญเสียการดูดกลับ)') : ''}${feUrea !== null ? (feUrea < 35 ? '<br>FeUrea < 35%: Prerenal (แม่นยำแม้ได้ยาขับปัสสาวะ)' : '<br>FeUrea > 50%: Intrinsic AKI') : ''}</td>
            </tr>
            <tr>
              <td><strong>Urine Anion Gap (UAG)</strong></td>
              <td>${uag !== null ? `<span class="dose-badge">${uag > 0 ? '+' : ''}${uag.toFixed(1)} mEq/L</span>` : '<span style="color:var(--muted); font-style:italic;">กรอก Urine Na, K, Cl</span>'}</td>
              <td style="color:var(--muted);">${uag !== null ? (uag < 0 ? '<strong style="color:var(--good);">✓ UAG ลบ: GI Loss of HCO3-</strong> (Diarrhea — ไตขับ NH4+ ได้ดี)' : '<strong style="color:var(--danger);">✕ UAG บวก/ศูนย์: Renal Tubular Acidosis (RTA)</strong> (ไตขับกรดบกพร่อง)') : 'UAG = (UNa + UK) - UCl (แยกสาเหตุ Normal AG Acidosis)'}</td>
            </tr>
            <tr>
              <td><strong>TTKG</strong></td>
              <td>${ttkg !== null ? `<span class="dose-badge">${ttkg.toFixed(2)}</span>` : '<span style="color:var(--muted); font-style:italic;">กรอก Urine K/Osm, Serum K/Osm</span>'}</td>
              <td style="color:var(--muted);">${ttkg !== null ? (ttkg < 2 ? 'TTKG < 2: Extrarenal K+ loss' : (ttkg > 7 ? 'TTKG > 7: Intact Aldosterone response' : 'TTKG 2–7: Intermediate')) : 'ประเมิน Aldosterone response ที่ Distal nephron'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // ── SECTION 4: Emergency Resuscitation Protocols ──
  const currentDS = (typeof DS !== 'undefined' && DS) || (typeof window !== 'undefined' && (window.DS || window.ER_PED_DATASET)) || (typeof ER_PED_DATASET !== 'undefined' && ER_PED_DATASET) || {};
  const proto = currentDS.electrolyteProtocols;
  if (proto) {
    // 4A. Hyperkalemia 3-Step Cocktail Card
    html += `
      <div class="stage-card" style="border-left:4px solid var(--danger); margin-bottom:12px;">
        <div style="font-size:13px; font-weight:700; color:var(--danger); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>4A. Emergency Hyperkalemia 3-Step Protocol ${hasWeight ? `(${w.toFixed(1)} kg)` : ''}</span>
        </div>
        ${hasWeight ? `
          <div class="protocol-table-wrapper">
            <table class="protocol-table">
              <thead>
                <tr>
                  <th style="width:12%;">Step</th>
                  <th style="width:28%;">Medication</th>
                  <th style="width:30%;">Calculated Dose</th>
                  <th style="width:30%;">Clinical Instructions & Safety</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span class="dose-badge" style="background:var(--danger-soft); color:var(--danger);">Step 1</span></td>
                  <td><strong>10% Calcium Gluconate</strong><br><span style="font-size:11px; color:var(--muted);">Membrane Stabilization</span></td>
                  <td><span class="dose-badge" style="font-weight:800;">${Math.min(w * 0.5, 10).toFixed(1)} mL</span> <span style="font-size:11px; color:var(--muted);">(${Math.min(w * 50, 1000).toFixed(0)} mg)</span></td>
                  <td style="color:var(--muted);">0.5 mL/kg IV over 5–10 min (Max 10 mL / 1 g). ติด EKG Monitor ป้องกัน Arrhythmia (ไม่ลด K+)</td>
                </tr>
                <tr>
                  <td><span class="dose-badge" style="background:var(--warning-soft); color:var(--warning);">Step 2</span></td>
                  <td><strong>RI + D10W</strong><br><span style="font-size:11px; color:var(--muted);">Intracellular Shift</span></td>
                  <td><span class="dose-badge">RI ${Math.min(w * 0.1, 10).toFixed(1)} U</span> + <span class="dose-badge">D10W ${Math.min(w * 5, 250).toFixed(0)} mL</span></td>
                  <td style="color:var(--muted);">RI 0.1 U/kg + D10W 5 mL/kg IV over 30 min (Max 10 U). เจาะ DTX ทุก 15–30 นาที</td>
                </tr>
                <tr>
                  <td><span class="dose-badge" style="background:var(--warning-soft); color:var(--warning);">Step 2</span></td>
                  <td><strong>Salbutamol Nebulizer</strong><br><span style="font-size:11px; color:var(--muted);">Intracellular Shift</span></td>
                  <td><span class="dose-badge">${w <= 25 ? '2.5 mg (0.5 mL)' : '5.0 mg (1.0 mL)'}</span></td>
                  <td style="color:var(--muted);">Nebulize over 10–15 min. พ่นซ้ำได้ทุก 20 นาที เสริมฤทธิ์กับ Insulin ดึง K+ เข้าเซลล์</td>
                </tr>
                <tr>
                  <td><span class="dose-badge" style="background:var(--warning-soft); color:var(--warning);">Step 2</span></td>
                  <td><strong>7.5% NaHCO3 (if Acidosis)</strong><br><span style="font-size:11px; color:var(--muted);">Intracellular Shift</span></td>
                  <td><span class="dose-badge">${Math.min(w * 1, 50).toFixed(0)} mEq (${Math.min(w * 1.12, 56).toFixed(0)} mL)</span></td>
                  <td style="color:var(--muted);">1–2 mEq/kg IV over 10–20 min. ให้เฉพาะเมื่อมี Severe Metabolic Acidosis ร่วมด้วย</td>
                </tr>
                <tr>
                  <td><span class="dose-badge" style="background:var(--good-soft); color:var(--good);">Step 3</span></td>
                  <td><strong>Furosemide (Lasix)</strong><br><span style="font-size:11px; color:var(--muted);">Total Elimination</span></td>
                  <td><span class="dose-badge">${Math.min(w * 1, 40).toFixed(1)} mg (${Math.min(w * 0.1, 4).toFixed(1)} mL)</span></td>
                  <td style="color:var(--muted);">1 mg/kg IV push (Max 40 mg). ขับ K+ ออกทางไต (ต้องมี Urine Output)</td>
                </tr>
                <tr>
                  <td><span class="dose-badge" style="background:var(--good-soft); color:var(--good);">Step 3</span></td>
                  <td><strong>Kalimate / Kayexalate</strong><br><span style="font-size:11px; color:var(--muted);">Total Elimination</span></td>
                  <td><span class="dose-badge">${Math.min(w * 1, 30).toFixed(0)} g</span></td>
                  <td style="color:var(--muted);">1 g/kg PO หรือ PR enema (Max 30 g). Cation exchange resin ขับทางเดินอาหาร (ออกฤทธิ์ 2–4 ชม.)</td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : `
          <div style="background:var(--warning-soft); color:var(--warning); border:1px solid var(--warning); border-radius:6px; padding:8px 12px; font-size:12px; font-weight:600;">
            ⚠️ กรุณากรอกน้ำหนักตัว (ABW) ที่ส่วนบนของหน้าจอเพื่อคำนวณขนาดยาใน Hyperkalemia 3-Step Protocol
          </div>
        `}
      </div>

      <!-- 4B. Hypokalemia Replacement Protocol & Dilution Recipe Card -->
      <div class="stage-card" style="border-left:4px solid var(--accent); margin-bottom:12px;">
        <div style="font-size:13px; font-weight:700; color:var(--accent); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="M2 12h20"/></svg>
          <span>4B. Hypokalemia Correction & Potassium Replacement Protocol ${hasWeight ? `(${w.toFixed(1)} kg)` : ''}</span>
        </div>
        ${hasWeight ? `
          <div class="protocol-table-wrapper">
            <table class="protocol-table">
              <thead>
                <tr>
                  <th style="width:15%;">Indication / Severity</th>
                  <th style="width:25%;">Route & Regimen</th>
                  <th style="width:30%;">Calculated Dose & Dilution</th>
                  <th style="width:30%;">Safety Directives & Rate Limits</th>
                </tr>
              </thead>
              <tbody>
                <tr style="background:var(--accent-subtle);">
                  <td><strong>Prerequisites</strong><br><span style="font-size:11px; color:var(--muted);">Urine & Mg Check</span></td>
                  <td colspan="2">
                    <div style="font-size:12px; line-height:1.5;">
                      1. <strong>Urine Output:</strong> ต้องมั่นใจว่ามีปัสสาวะออก ≥ 0.5–1 mL/kg/hr ก่อนให้ K+ ป้องกัน Anuric Hyperkalemia<br>
                      2. <strong>Serum Magnesium:</strong> หาก Mg &lt; 1.7 mg/dL ให้ <strong>50% MgSO4 ${Math.min(w * 0.1, 4).toFixed(1)} mL</strong> (${Math.min(w * 50, 2000).toFixed(0)} mg) IV over 30–60 min เพื่อหยุด Refractory Renal K+ leak
                    </div>
                  </td>
                  <td style="color:var(--danger); font-weight:700; font-size:11.5px;">⚠️ ห้ามให้ IV Push KCl เด็ดขาด (Fatal Cardiac Arrest)</td>
                </tr>
                <tr>
                  <td><strong style="color:var(--danger);">Severe / Symptomatic</strong><br><span style="font-size:11px; color:var(--muted);">K+ &lt; 2.5 หรือมี EKG change</span></td>
                  <td><strong>IV KCl Piggyback (Peripheral Line)</strong><br><span style="font-size:11px; color:var(--muted);">Max conc ≤ 40 mEq/L</span></td>
                  <td>
                    <span class="dose-badge" style="font-weight:800;">KCl ${ivKCl.doseMeq} mEq (${ivKCl.kcl2MeqPerMl} mL)</span><br>
                    <span style="font-size:11.5px; color:var(--ink);">ผสมใน NSS/D5W <strong>≥ ${ivKCl.minVolPeripheralMl} mL</strong></span><br>
                    <span style="font-size:11px; color:var(--accent);">Drip over <strong>2 ชั่วโมง</strong> (${ivKCl.peripheralRateMlPerHr} mL/hr)</span>
                  </td>
                  <td style="color:var(--muted);">
                    อัตราส่งมอบ <strong>0.25 mEq/kg/hr</strong> (Safety cap ≤ 0.5 mEq/kg/hr). ติด EKG Monitor ตลอดเวลา เจาะซ้ำหลังหมด 1–2 ชม.
                  </td>
                </tr>
                <tr>
                  <td><strong style="color:var(--danger);">Severe (Central Line)</strong><br><span style="font-size:11px; color:var(--muted);">ICU / Central line</span></td>
                  <td><strong>IV KCl Piggyback (Central Line)</strong><br><span style="font-size:11px; color:var(--muted);">Max conc ≤ 80 mEq/L</span></td>
                  <td>
                    <span class="dose-badge" style="font-weight:800;">KCl ${ivKCl.doseMeq} mEq (${ivKCl.kcl2MeqPerMl} mL)</span><br>
                    <span style="font-size:11.5px; color:var(--ink);">ผสมใน NSS <strong>≥ ${ivKCl.minVolCentralMl} mL</strong></span><br>
                    <span style="font-size:11px; color:var(--accent);">Drip over <strong>1–2 ชั่วโมง</strong> (${ivKCl.centralRateMlPerHr} mL/hr)</span>
                  </td>
                  <td style="color:var(--muted);">
                    อัตราส่งมอบ <strong>0.50 mEq/kg/hr</strong>. ให้เฉพาะทาง Central line เท่านั้นเพื่อป้องกัน Severe Phlebitis
                  </td>
                </tr>
                <tr>
                  <td><strong style="color:var(--warning);">Moderate Hypokalemia</strong><br><span style="font-size:11px; color:var(--muted);">K+ 2.5–3.4 mEq/L</span></td>
                  <td><strong>IV Fluid Maintenance Additive</strong><br><span style="font-size:11px; color:var(--muted);">Ongoing replacement</span></td>
                  <td>
                    <span class="dose-badge">20–40 mEq KCl / 1,000 mL IV Fluid</span><br>
                    <span style="font-size:11px; color:var(--muted);">(เช่น เติม KCl 2 mEq/mL จำนวน 5–10 mL ในขวด 500 mL)</span>
                  </td>
                  <td style="color:var(--muted);">
                    ให้ตามอัตรา Maintenance ของสารน้ำ (Holliday-Segar). สารน้ำทั่วไปไม่ควรเกิน 40 mEq/L ทาง peripheral
                  </td>
                </tr>
                <tr>
                  <td><strong style="color:var(--good);">Mild / Asymptomatic</strong><br><span style="font-size:11px; color:var(--muted);">K+ 3.0–3.5 mEq/L (กินได้)</span></td>
                  <td><strong>Oral KCl Syrup (10%)</strong><br><span style="font-size:11px; color:var(--muted);">1.34 mEq/mL syrup</span></td>
                  <td>
                    <span class="dose-badge">${oralKCl.kcl10PctSyrupMlPerDose} mL (${oralKCl.tidDoseMeq} mEq) PO tid pc</span><br>
                    <span style="font-size:11px; color:var(--muted);">รวมทั้งวัน: ${oralKCl.dailyMeq} mEq/day (1.5 mEq/kg/day)</span>
                  </td>
                  <td style="color:var(--muted);">
                    รับประทานพร้อมอาหารหรือน้ำผลไม้เพื่อลดการระคายเคืองกระเพาะอาหาร (Max 40 mEq/dose)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : `
          <div style="background:var(--warning-soft); color:var(--warning); border:1px solid var(--warning); border-radius:6px; padding:8px 12px; font-size:12px; font-weight:600;">
            ⚠️ กรุณากรอกน้ำหนักตัว (ABW) ที่ส่วนบนของหน้าจอเพื่อคำนวณขนาดยาและอัตราหยด Potassium Replacement
          </div>
        `}
      </div>

      <!-- 4C. Acute Hypocalcemia & Hypomagnesemia Resuscitation Card (Decision Q4-B) -->
      <div class="stage-card" style="border-left:4px solid #8b5cf6; margin-bottom:12px;">
        <div style="font-size:13px; font-weight:700; color:#7c3aed; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="M2 12h20"/></svg>
          <span>4C. Acute Hypocalcemia & Hypomagnesemia Crisis Protocols ${hasWeight ? `(${w.toFixed(1)} kg)` : ''}</span>
        </div>
        ${hasWeight ? `
          <div class="protocol-table-wrapper">
            <table class="protocol-table">
              <thead>
                <tr>
                  <th style="width:25%;">Indication / Crisis</th>
                  <th style="width:25%;">Medication & Preparation</th>
                  <th style="width:25%;">Calculated Dose</th>
                  <th style="width:25%;">Clinical Instructions & Safety</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong style="color:var(--danger);">Acute Symptomatic Hypocalcemia</strong><br><span style="font-size:11px; color:var(--muted);">Tetany, Laryngospasm, Seizure, Long QTc</span></td>
                  <td><strong>10% Calcium Gluconate</strong><br><span style="font-size:11px; color:var(--muted);">100 mg/mL (0.465 mEq Ca/mL)</span></td>
                  <td><span class="dose-badge" style="font-weight:800; background:var(--danger-soft); color:var(--danger);">${Math.min(w * 1.0, 20).toFixed(1)} mL</span> <span style="font-size:11px; color:var(--muted);">(${Math.min(w * 100, 2000).toFixed(0)} mg)</span></td>
                  <td style="color:var(--muted);">1.0 mL/kg (100 mg/kg) IV slow over 10–20 min (Max 20 mL / 2 g). ติด EKG Monitor ป้องกัน Bradycardia / Arrhythmia ระวัง Extravasation</td>
                </tr>
                <tr>
                  <td><strong style="color:var(--warning);">Acute Hypomagnesemia</strong><br><span style="font-size:11px; color:var(--muted);">Mg &lt; 1.7 mg/dL, Refractory K+ leak, Torsades</span></td>
                  <td><strong>50% Magnesium Sulfate</strong><br><span style="font-size:11px; color:var(--muted);">500 mg/mL (4 mEq Mg/mL)</span></td>
                  <td><span class="dose-badge" style="font-weight:800; background:var(--warning-soft); color:var(--warning);">${Math.min(w * 0.1, 4).toFixed(1)} mL</span> <span style="font-size:11px; color:var(--muted);">(${Math.min(w * 50, 2000).toFixed(0)} mg)</span></td>
                  <td style="color:var(--muted);">0.1 mL/kg (50 mg/kg) IV infusion in D5W/NSS over 20–30 min (Max 4 mL / 2 g). *ถ้า Pulseless Torsades ให้ IV push ใน 1–2 นาที*</td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : `
          <div style="background:var(--warning-soft); color:var(--warning); border:1px solid var(--warning); border-radius:6px; padding:8px 12px; font-size:12px; font-weight:600;">
            ⚠️ กรุณากรอกน้ำหนักตัว (ABW) ที่ส่วนบนของหน้าจอเพื่อคำนวณขนาดยาฉุกเฉิน 10% Calcium Gluconate และ 50% MgSO4
          </div>
        `}
      </div>
    `;
  }

  // ── SECTION 5: Interactive Age-Specific Reference Table ──
  const ageKey = getActiveElectrolyteAgeKey(ageYr);
  const refList = currentDS.electrolyteRef || [];

  html += `
    <div class="stage-card">
      <div style="font-size:13px; font-weight:700; color:var(--accent); margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
        <span style="display:inline-flex; align-items:center; gap:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M17 12h-2l-2 5-3-10-2 5H7"/></svg>
          <span>5. Pediatric Electrolyte Normal Reference Ranges by Age (Harriet Lane / Nelson)</span>
        </span>
        <span style="font-size:11.5px; font-weight:600; color:var(--muted);">Active Bracket: <strong style="color:var(--accent);">${ageKey.toUpperCase()}</strong></span>
      </div>
      <div class="protocol-table-wrapper">
        <table class="protocol-table">
          <thead>
            <tr>
              <th style="width:16%;">Age Group</th>
              <th style="width:8%;">Na+</th>
              <th style="width:8%;">K+</th>
              <th style="width:8%;">Cl-</th>
              <th style="width:8%;">HCO3-</th>
              <th style="width:10%;">Total Ca</th>
              <th style="width:8%;">Mg2+</th>
              <th style="width:9%;">PO4</th>
              <th style="width:9%;">Serum Osm</th>
              <th style="width:8%;">AG</th>
              <th style="width:8%;">FeNa</th>
            </tr>
          </thead>
          <tbody>
  `;

  refList.forEach(r => {
    const isActive = (r.ageKey === ageKey);
    const rowStyle = isActive ? 'style="background:var(--accent-soft); font-weight:700;"' : '';
    html += `
      <tr ${rowStyle}>
        <td><strong>${r.ageLabel}</strong> ${isActive ? '<span style="color:var(--accent);">★</span>' : ''}</td>
        <td>${r.na}</td>
        <td>${r.k}</td>
        <td>${r.cl}</td>
        <td>${r.hco3}</td>
        <td>${r.totalCa}</td>
        <td>${r.mg}</td>
        <td>${r.po4}</td>
        <td>${r.osmolality}</td>
        <td>${r.anionGap}</td>
        <td>${r.fena}</td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
      <div style="font-size:11px; color:var(--muted); margin-top:6px; line-height:1.4;">
        * หน่วย: Na, K, Cl, HCO3, Anion Gap (mEq/L) | Total Ca, Mg, PO4 (mg/dL) | Serum Osmolality (mOsm/kg). ทารกแรกเกิดมีระดับ K+ และ PO4 สูงกว่าผู้ใหญ่เป็นปกติ
      </div>
    </div>
  `;

  outEl.innerHTML = html;
}


// ==========================================
// WHO GROWTH STANDARDS Z-SCORE ENGINE
// ==========================================
function toggleSex() {
  gSex = (gSex === 'male') ? 'female' : 'male';
  const btn = document.getElementById('sexToggleBtn');
  if (btn) {
    btn.innerHTML = (gSex === 'male') ? '♂' : '♀';
    btn.title = (gSex === 'male') ? 'เพศ: ชาย ♂ (คลิกเพื่อเปลี่ยนเป็นหญิง ♀)' : 'เพศ: หญิง ♀ (คลิกเพื่อเปลี่ยนเป็นชาย ♂)';
  }
  calcGrowthZScores();
}

function calcGrowthZScores() {
  const badge = document.getElementById('growthZScoreBadge');
  if (!badge) return;
  const ageYr = getAgeInYears();
  const weightKg = getWeight();
  const htCm = parseFloat(document.getElementById('length')?.value) || 0;
  
  if (!ageYr || ageYr <= 0 || !weightKg || weightKg <= 0 || !DS || !DS.whoGrowth) {
    badge.innerHTML = 'WAZ: — · HAZ: —';
    badge.className = 'bio-derived-src';
    return;
  }
  
  const ageMo = Math.min(180, Math.round(ageYr * 12));
  const table = (gSex === 'male' ? DS.whoGrowth.boys.table : DS.whoGrowth.girls.table);
  
  let closestRow = table[0];
  let minDiff = 999;
  for (let i = 0; i < table.length; i++) {
    const diff = Math.abs(table[i][0] - ageMo);
    if (diff < minDiff) {
      minDiff = diff;
      closestRow = table[i];
    }
  }
  
  const [rowMo, wMed, wSD, hMed, hSD] = closestRow;
  const waz = (weightKg - wMed) / wSD;
  let wazClass = 'good';
  let wazLabel = 'Normal';
  if (waz < -3) { wazClass = 'danger'; wazLabel = 'Severe Underweight'; }
  else if (waz < -2) { wazClass = 'warning'; wazLabel = 'Underweight'; }
  else if (waz > 3) { wazClass = 'danger'; wazLabel = 'Obese'; }
  else if (waz > 2) { wazClass = 'warning'; wazLabel = 'Overweight'; }
  
  let hazText = 'HAZ: —';
  if (htCm > 0) {
    const haz = (htCm - hMed) / hSD;
    let hazClass = 'good';
    let hazLabel = 'Normal';
    if (haz < -3) { hazClass = 'danger'; hazLabel = 'Severe Stunting'; }
    else if (haz < -2) { hazClass = 'warning'; hazLabel = 'Stunted'; }
    else if (haz > 2) { hazClass = 'warning'; hazLabel = 'Tall'; }
    hazText = `HAZ: ${haz >= 0 ? '+' : ''}${haz.toFixed(1)} (${hazLabel})`;
  }
  
  badge.innerHTML = `WAZ: ${waz >= 0 ? '+' : ''}${waz.toFixed(1)} (${wazLabel}) · ${hazText}`;
  badge.title = `WHO Growth Standards (${gSex === 'male' ? 'Boy' : 'Girl'}, ${ageMo} mo): Weight Median ${wMed}kg (±${wSD}), Height Median ${hMed}cm (±${hSD})`;
}

// ==========================================
// SEIZURE STOPWATCH TIMER ENGINE
// ==========================================
function formatSeizureTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function getSeizureStageText(sec) {
  if (sec < 300) return '⚡ Stage 1 (0–5 min): Emergent BZD (Midazolam IN/IM or Lorazepam/Diazepam IV)';
  if (sec < 600) return '⚡ Stage 1 repeat (5–10 min): Repeat 2nd BZD dose if seizure persists';
  if (sec < 1200) return '⚡ Stage 2 (10–20 min): Urgent Control (Levetiracetam 60 mg/kg or Fosphenytoin/Valproate)';
  if (sec < 2400) return '🚨 Stage 3 (20–40 min): Refractory SE (PICU / Midazolam or Ketamine Infusion)';
  return '🚨 Super-Refractory SE (> 40 min): Anesthetic Infusions, Intubation, Continuous EEG';
}

function updateSeizureTimerUI() {
  const timeEl = document.getElementById('seizureTimerTime');
  const stageEl = document.getElementById('seizureTimerStage');
  const barEl = document.getElementById('seizureTimerProgress');
  if (timeEl) timeEl.textContent = formatSeizureTime(gSeizureTimerSeconds);
  if (stageEl) stageEl.textContent = getSeizureStageText(gSeizureTimerSeconds);
  if (barEl) {
    const pct = Math.min(100, (gSeizureTimerSeconds / 1800) * 100);
    barEl.style.width = `${pct}%`;
    if (gSeizureTimerSeconds >= 600) {
      barEl.style.backgroundColor = 'var(--danger)';
    } else if (gSeizureTimerSeconds >= 300) {
      barEl.style.backgroundColor = 'var(--warning)';
    } else {
      barEl.style.backgroundColor = 'var(--accent)';
    }
  }
}

function toggleSeizureTimer() {
  const btn = document.getElementById('seizureTimerToggleBtn');
  if (gSeizureTimerRunning) {
    clearInterval(gSeizureTimerInterval);
    gSeizureTimerRunning = false;
    if (btn) btn.innerHTML = '▶ Start';
  } else {
    gSeizureTimerRunning = true;
    if (btn) btn.innerHTML = '⏸ Pause';
    gSeizureTimerInterval = setInterval(() => {
      gSeizureTimerSeconds++;
      updateSeizureTimerUI();
      if (gSeizureTimerSeconds === 300 || gSeizureTimerSeconds === 600 || gSeizureTimerSeconds === 1200) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([200, 100, 200]); } catch (_) {}
        }
        showToast(`⏱️ Seizure Milestone: ${Math.round(gSeizureTimerSeconds/60)} นาที — ${getSeizureStageText(gSeizureTimerSeconds)}`);
      }
    }, 1000);
  }
}

function resetSeizureTimer() {
  clearInterval(gSeizureTimerInterval);
  gSeizureTimerRunning = false;
  gSeizureTimerSeconds = 0;
  const btn = document.getElementById('seizureTimerToggleBtn');
  if (btn) btn.innerHTML = '▶ Start';
  updateSeizureTimerUI();
}

// ==========================================
// 1. PEDIATRIC AIRWAY & RSI ENGINE
// ==========================================
function calcAirway() {
  const outEl = document.getElementById('airwayOut');
  if (!outEl) return;
  const w = getWeight();
  const rawAge = getAgeInYears();
  const ageYr = (rawAge !== null && !isNaN(rawAge) && rawAge > 0) ? rawAge : (w ? (w < 10 ? 0.5 : (w < 20 ? 3 : 8)) : 1);

  if (w <= 0) {
    outEl.innerHTML = '<div style="color:var(--muted); padding:16px; text-align:center; font-style:italic;">กรุณาระบุน้ำหนักหรืออายุผู้ป่วยที่แถบด้านบน เพื่อคำนวณขนาดอุปกรณ์ทางเดินหายใจและยา RSI</div>';
    return;
  }

  // Calculate ETT sizes
  let cuffedETT = '3.5';
  let uncuffedETT = '4.0';
  let ettDepth = (w * 3).toFixed(1);
  let blade = suggestBlade(w);
  let lma = '1.5';
  let suction = '8 Fr';

  if (ageYr >= 1) {
    cuffedETT = ((ageYr / 4) + 3.5).toFixed(1);
    uncuffedETT = ((ageYr / 4) + 4.0).toFixed(1);
    ettDepth = (parseFloat(cuffedETT) * 3).toFixed(1);
    suction = `${Math.round(parseFloat(cuffedETT) * 2)} Fr`;
    if (w < 5) lma = '1';
    else if (w < 10) lma = '1.5';
    else if (w < 20) lma = '2';
    else if (w < 30) lma = '2.5';
    else if (w < 50) lma = '3';
    else lma = '4';
  } else {
    if (w < 1) { cuffedETT = '2.5'; uncuffedETT = '2.5'; ettDepth = '6.0'; blade = 'Miller 0'; suction = '5 Fr'; lma = '1'; }
    else if (w < 2) { cuffedETT = '3.0'; uncuffedETT = '3.0'; ettDepth = '7.0'; blade = 'Miller 0'; suction = '6 Fr'; lma = '1'; }
    else if (w < 3) { cuffedETT = '3.0'; uncuffedETT = '3.5'; ettDepth = '8.5'; blade = 'Miller 0/1'; suction = '6 Fr'; lma = '1'; }
    else if (w < 5) { cuffedETT = '3.5'; uncuffedETT = '3.5'; ettDepth = '9.5'; blade = 'Miller 1'; suction = '6 Fr'; lma = '1'; }
    else { cuffedETT = '3.5'; uncuffedETT = '4.0'; ettDepth = '11.0'; blade = 'Miller 1'; suction = '8 Fr'; lma = '1.5'; }
  }

  // RSI Drugs Calculations
  const atropineDose = Math.min(ageYr > 12 ? 1.0 : 0.5, Math.max(0.1, w * 0.02)).toFixed(2);
  const atropineVol = (atropineDose / 0.6).toFixed(2);

  const ketamineDose = Math.min(100, w * 1.5).toFixed(0);
  const ketamineVol = (ketamineDose / 50).toFixed(2);

  const propofolDose = Math.min(150, w * 2.5).toFixed(0);
  const propofolVol = (propofolDose / 10).toFixed(1);

  const etomidateDose = Math.min(20, w * 0.3).toFixed(1);
  const etomidateVol = (etomidateDose / 2).toFixed(1);

  const midazolamDose = Math.min(10, w * 0.2).toFixed(1);
  const midazolamVol = (midazolamDose / 5).toFixed(2);

  const rocuroniumDose = Math.min(100, w * 1.0).toFixed(1);
  const rocuroniumVol = (rocuroniumDose / 10).toFixed(2);

  const succinylDose = Math.min(150, w * (ageYr < 1 ? 2.0 : 1.5)).toFixed(1);
  const succinylVol = (succinylDose / 50).toFixed(2);

  const sugammadexRescueDose = Math.min(1500, w * 16.0).toFixed(0);
  const sugammadexRescueVol = (sugammadexRescueDose / 100).toFixed(1);

  const bZone = getBroselowZone(w);
  const broselowColor = (bZone && bZone.color) ? bZone.color : '—';

  let html = `
    <!-- Airway Equipment Sizing Hero Grid -->
    <div style="font-weight:700; font-size:13px; color:var(--accent); margin-bottom:8px;">1. Airway & Intubation Equipment Sizing (อุปกรณ์ช่วยหายใจ)</div>
    <div class="hero-grid" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-bottom:14px;">
      <div class="hero-metric">
        <div class="hero-metric-label">Cuffed ETT (ID)</div>
        <div class="hero-metric-value">${cuffedETT} <span style="font-size:13px;">mm</span></div>
        <div class="hero-metric-sub">Uncuffed: ${uncuffedETT} mm</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">ETT Depth (Oral)</div>
        <div class="hero-metric-value">${ettDepth} <span style="font-size:13px;">cm</span></div>
        <div class="hero-metric-sub">ที่ริมฝีปาก (3 × ID)</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">Laryngoscope Blade</div>
        <div class="hero-metric-value" style="font-size:18px;">${blade}</div>
        <div class="hero-metric-sub">Broselow: ${broselowColor}</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">LMA / Suction</div>
        <div class="hero-metric-value" style="font-size:18px;">Size ${lma}</div>
        <div class="hero-metric-sub">Suction: ${suction}</div>
      </div>
    </div>

    <!-- RSI Medications Protocol Table -->
    <div style="font-weight:700; font-size:13px; color:var(--accent); margin-bottom:8px;">2. Rapid Sequence Intubation (RSI) Medications</div>
    <div class="protocol-table-wrapper" style="margin-bottom:14px;">
      <table class="protocol-table">
        <thead>
          <tr>
            <th>Role / Medication</th>
            <th>Calculated Dose</th>
            <th>Volume to Draw</th>
            <th>Prep & Route</th>
            <th>Clinical Indication / Guardrails</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Atropine</strong><br><span style="font-size:10.5px; color:var(--muted);">Premedication</span></td>
            <td><span class="dose-badge">${atropineDose} mg</span></td>
            <td><strong>${atropineVol} mL</strong></td>
            <td>0.6 mg/mL amp<br>IV/IO slow</td>
            <td>เด็ก &lt;1 ปี หรือให้ร่วมกับ Succinylcholine (min 0.1 mg, max 0.5 mg)</td>
          </tr>
          <tr>
            <td><strong>Ketamine</strong><br><span style="font-size:10.5px; color:var(--muted);">Induction (Preferred)</span></td>
            <td><span class="dose-badge">${ketamineDose} mg</span> (1.5 mg/kg)</td>
            <td><strong>${ketamineVol} mL</strong></td>
            <td>50 mg/mL vial<br>IV/IO 1 min</td>
            <td>ยานำสลบ 1st-line ใน Asthma / Shock / Hemodynamic instability</td>
          </tr>
          <tr>
            <td><strong>Propofol</strong><br><span style="font-size:10.5px; color:var(--muted);">Induction (1%)</span></td>
            <td><span class="dose-badge">${propofolDose} mg</span> (2.5 mg/kg)</td>
            <td><strong>${propofolVol} mL</strong></td>
            <td>10 mg/mL amp<br>IV/IO slow</td>
            <td>Status epilepticus / Head trauma (BP ปกติ). ห้ามใช้ในภาวะ Shock</td>
          </tr>
          <tr>
            <td><strong>Etomidate</strong><br><span style="font-size:10.5px; color:var(--muted);">Induction</span></td>
            <td><span class="dose-badge">${etomidateDose} mg</span> (0.3 mg/kg)</td>
            <td><strong>${etomidateVol} mL</strong></td>
            <td>2 mg/mL amp<br>IV/IO slow</td>
            <td>ไม่กระทบความดันโลหิต (ระวัง Adrenal suppression ใน Sepsis)</td>
          </tr>
          <tr>
            <td><strong>Midazolam</strong><br><span style="font-size:10.5px; color:var(--muted);">Induction</span></td>
            <td><span class="dose-badge">${midazolamDose} mg</span> (0.2 mg/kg)</td>
            <td><strong>${midazolamVol} mL</strong></td>
            <td>5 mg/mL amp<br>IV/IO slow</td>
            <td>ยาทางเลือก ระวังความดันตกในผู้ป่วยขาดสารน้ำ</td>
          </tr>
          <tr style="background:rgba(158,61,36,0.06);">
            <td><strong>Rocuronium</strong><br><span style="font-size:10.5px; color:var(--accent); font-weight:700;">1st-Line Paralytic</span></td>
            <td><span class="dose-badge" style="background:var(--accent); color:#fff;">${rocuroniumDose} mg</span> (1.0 mg/kg)</td>
            <td><strong>${rocuroniumVol} mL</strong></td>
            <td>10 mg/mL vial<br>IV/IO push</td>
            <td>ออกฤทธิ์ใน 45–60 วินาที นาน 30–60 นาที <em>(แก้ฤทธิ์ได้ด้วย Sugammadex)</em></td>
          </tr>
          <tr>
            <td><strong>Succinylcholine</strong><br><span style="font-size:10.5px; color:var(--muted);">Depolarizing NMBA</span></td>
            <td><span class="dose-badge">${succinylDose} mg</span></td>
            <td><strong>${succinylVol} mL</strong></td>
            <td>50 mg/mL vial<br>IV/IO push</td>
            <td>ออกฤทธิ์ 30 วินาที ห้ามใช้ใน Hyperkalemia, Crush/Burn &gt;24h, กล้ามเนื้ออ่อนแรง</td>
          </tr>
          <tr style="background:rgba(220,38,38,0.06);">
            <td><strong>Sugammadex</strong><br><span style="font-size:10.5px; color:var(--danger); font-weight:700;">🚨 CICO Rescue Reversal</span></td>
            <td><span class="dose-badge" style="background:var(--danger); color:#fff;">${sugammadexRescueDose} mg</span> (16 mg/kg)</td>
            <td><strong>${sugammadexRescueVol} mL</strong></td>
            <td>100 mg/mL vial<br>IV bolus</td>
            <td><strong>แก้ฤทธิ์ Rocuronium ทันที</strong> กรณี 'Cannot Intubate, Cannot Oxygenate'</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- "Show Math" Explainable Details -->
    <details class="math-breakdown">
      <summary><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Show Math & Formula Breakdown</summary>
      <div class="math-breakdown-content">
        • Cuffed ETT: (Age ${typeof ageYr === 'number' ? ageYr.toFixed(1) : '1.0'} yr / 4) + 3.5 = ${cuffedETT} mm ID<br>
        • Uncuffed ETT: (Age ${typeof ageYr === 'number' ? ageYr.toFixed(1) : '1.0'} yr / 4) + 4.0 = ${uncuffedETT} mm ID<br>
        • Depth at Lip: 3 × ${cuffedETT} mm = ${ettDepth} cm (or Age/2 + 12 = ${(ageYr/2 + 12).toFixed(1)} cm)<br>
        • Rocuronium 1.0 mg/kg × ${w.toFixed(1)} kg = ${rocuroniumDose} mg ÷ 10 mg/mL = ${rocuroniumVol} mL<br>
        • Sugammadex CICO Rescue 16 mg/kg × ${w.toFixed(1)} kg = ${sugammadexRescueDose} mg ÷ 100 mg/mL = ${sugammadexRescueVol} mL
      </div>
    </details>
  `;

  outEl.innerHTML = html;
}

// ==========================================
// 2. PEDIATRIC SEPSIS & PHOENIX SCORE ENGINE
// ==========================================
function setSepsisMode(mode) {
  gSepsisMode = mode;
  const pBtn = document.getElementById('sepsisModePhoenixBtn');
  const sBtn = document.getElementById('sepsisModeSimpleBtn');
  const pForm = document.getElementById('phoenixScoreForm');
  const sForm = document.getElementById('simpleSepsisForm');
  if (pBtn) pBtn.classList.toggle('active', mode === 'phoenix');
  if (sBtn) sBtn.classList.toggle('active', mode === 'simple');
  if (pForm) pForm.style.display = (mode === 'phoenix') ? 'flex' : 'none';
  if (sForm) sForm.style.display = (mode === 'simple') ? 'block' : 'none';
  calcSepsis();
}

function calcSepsis() {
  const outEl = document.getElementById('sepsisOut');
  if (!outEl) return;
  const w = getWeight();
  const ageYr = getAgeInYears();

  if (w <= 0) {
    outEl.innerHTML = '<div style="color:var(--muted); padding:16px; text-align:center; font-style:italic;">กรุณาระบุน้ำหนักหรืออายุผู้ป่วยที่แถบด้านบน เพื่อคำนวณคะแนน Phoenix Sepsis Score และปริมาตรสารน้ำ 1h Bundle</div>';
    return;
  }

  // Phoenix Score calculation
  const respPts = parseInt(document.getElementById('sepsisResp')?.value || '0', 10);
  const cardioPts = parseInt(document.getElementById('sepsisCardio')?.value || '0', 10);
  const coagPts = parseInt(document.getElementById('sepsisCoag')?.value || '0', 10);
  const neuroPts = parseInt(document.getElementById('sepsisNeuro')?.value || '0', 10);
  const totalPhoenix = respPts + cardioPts + coagPts + neuroPts;

  // Simple checklist calculation
  let simpleCount = 0;
  ['chkSepsisTemp', 'chkSepsisHR', 'chkSepsisRR', 'chkSepsisMental', 'chkSepsisCRT', 'chkSepsisPulse'].forEach(id => {
    if (document.getElementById(id)?.checked) simpleCount++;
  });

  // Interpretation
  let statusClass = 'good';
  let statusTitle = '✓ Low Sepsis Probability / Normal Organ Function';
  let statusDesc = 'Phoenix Score < 2: ยังไม่เข้าเกณฑ์ Sepsis ตาม Phoenix Criteria 2024';

  if (gSepsisMode === 'phoenix') {
    if (totalPhoenix >= 2 && cardioPts >= 1) {
      statusClass = 'danger';
      statusTitle = '🚨 SEPTIC SHOCK (ภาวะช็อกจากการติดเชื้อ)';
      statusDesc = `Phoenix Score ${totalPhoenix} คะแนน (≥ 2 + Cardiovascular ≥ 1 pt) — เริ่ม Vasoactive และให้สารน้ำด่วน`;
    } else if (totalPhoenix >= 2) {
      statusClass = 'danger';
      statusTitle = '🚨 PEDIATRIC SEPSIS (ภาวะติดเชื้อในกระแสเลือด)';
      statusDesc = `Phoenix Score ${totalPhoenix} คะแนน (≥ 2) — มีอวัยวะทำงานล้มเหลว (Organ Dysfunction) ต้องเริ่ม 1-Hour Bundle`;
    }
  } else {
    if (simpleCount >= 2) {
      statusClass = 'danger';
      statusTitle = '⚠️ POSSIBLY SEVERE INFECTION / SEPSIS ALERT';
      statusDesc = `พบสัญญาณเตือน ${simpleCount}/6 ข้อ ร่วมกับสงสัยการติดเชื้อ — ส่งตรวจ Lab และประเมิน 1-Hour Bundle ทันที`;
    } else {
      statusTitle = '✓ Screening Negative';
      statusDesc = `พบสัญญาณเตือน ${simpleCount}/6 ข้อ`;
    }
  }

  // Fluid bolus calculations (SSC 2026)
  const bolus10 = (w * 10).toFixed(0);
  const bolus20 = (w * 20).toFixed(0);
  const bolus40 = (w * 40).toFixed(0);
  const bolus60 = (w * 60).toFixed(0);
  const ceftriaxoneDose = Math.min(2000, w * 80).toFixed(0);
  const vancoDose = Math.min(1000, w * 15).toFixed(0);

  let html = `
    <!-- Sepsis Score Status Banner -->
    <div style="background:var(--${statusClass}-soft); border:1.5px solid var(--${statusClass}); border-radius:var(--r-md); padding:12px 16px; margin-bottom:14px;">
      <div style="font-weight:800; font-size:15px; color:var(--${statusClass}); margin-bottom:4px;">${statusTitle}</div>
      <div style="font-size:12.5px; color:var(--ink);">${statusDesc}</div>
      ${gSepsisMode === 'phoenix' ? `<div style="font-size:11.5px; color:var(--muted); margin-top:6px; font-family:'JetBrains Mono',monospace;">คะแนนย่อย: หายใจ ${respPts} | ไหลเวียน ${cardioPts} | การแข็งตัว ${coagPts} | ระบบประสาท ${neuroPts} = รวม ${totalPhoenix}/13 pts</div>` : ''}
    </div>

    <!-- SSC 2026 1-Hour Bundle & Fluid Resuscitation Targets -->
    <div style="font-weight:700; font-size:13px; color:var(--accent); margin-bottom:8px;">Surviving Sepsis Campaign (SSC 2026) 1-Hour Bundle Guidelines</div>
    <div class="hero-grid" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-bottom:14px;">
      <div class="hero-metric">
        <div class="hero-metric-label">1st Fluid Bolus (20 mL/kg)</div>
        <div class="hero-metric-value">${bolus20} <span style="font-size:13px;">mL</span></div>
        <div class="hero-metric-sub">0.9% NS / Plasmalyte in 15m</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">Max Fluid (40–60 mL/kg)</div>
        <div class="hero-metric-value">${bolus40}–${bolus60} <span style="font-size:13px;">mL</span></div>
        <div class="hero-metric-sub">เกินนี้เริ่ม Vasoactive ทันที</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">IV Ceftriaxone (80 mg/kg)</div>
        <div class="hero-metric-value">${ceftriaxoneDose} <span style="font-size:13px;">mg</span></div>
        <div class="hero-metric-sub">ให้ภายใน 1 ชม. (max 2g)</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">IV Vancomycin (15 mg/kg)</div>
        <div class="hero-metric-value">${vancoDose} <span style="font-size:13px;">mg</span></div>
        <div class="hero-metric-sub">MRSA coverage (max 1g)</div>
      </div>
    </div>

    <!-- Stepwise Sepsis Bundle Action Plan -->
    <div class="protocol-table-wrapper" style="margin-bottom:14px;">
      <table class="protocol-table">
        <thead>
          <tr>
            <th style="width:70px;">Step</th>
            <th>Action Item (ภายใน 60 นาที)</th>
            <th>Clinical Directive & Targets</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Step 1</strong></td>
            <td><strong>Hemoculture x 2 Sites</strong></td>
            <td>เจาะเพาะเชื้อเลือดก่อนให้ยาปฏิชีวนะ (ห้ามดีเลย์ยาเกิน 1 ชม. หากเจาะยาก)</td>
          </tr>
          <tr>
            <td><strong>Step 2</strong></td>
            <td><strong>Empiric IV Antibiotics</strong></td>
            <td>ให้ <strong>Ceftriaxone ${ceftriaxoneDose} mg</strong> (หรือ Cefotaxime) ± Vancomycin ${vancoDose} mg ทันที</td>
          </tr>
          <tr>
            <td><strong>Step 3</strong></td>
            <td><strong>Isotonic Crystalloid Bolus</strong></td>
            <td>ให้ <strong>0.9% NS หรือ Balanced Crystalloid ${bolus20} mL</strong> ใน 10–20 นาที และประเมินซ้ำ</td>
          </tr>
          <tr style="background:rgba(220,38,38,0.06);">
            <td><strong>Step 4</strong></td>
            <td><strong>Vasoactive Escalation</strong></td>
            <td>หากได้รับสารน้ำครบ ${bolus40}–${bolus60} mL แล้วยัง Shock → <strong>เริ่ม Epinephrine หรือ Norepinephrine 0.05–0.3 mcg/kg/min</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <details class="math-breakdown">
      <summary><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Show Math & Formula Breakdown</summary>
      <div class="math-breakdown-content">
        • Initial Bolus 20 mL/kg × ${w.toFixed(1)} kg = ${bolus20} mL (Isotonic Crystalloid)<br>
        • Cumulative Cap 40 mL/kg = ${bolus40} mL | 60 mL/kg = ${bolus60} mL<br>
        • Ceftriaxone: 80 mg/kg × ${w.toFixed(1)} kg = ${(w*80).toFixed(0)} mg (clamped to max 2000 mg -> ${ceftriaxoneDose} mg)
      </div>
    </details>
  `;

  outEl.innerHTML = html;
}

// ==========================================
// 3. PEDIATRIC ANAPHYLAXIS PROTOCOL ENGINE
// ==========================================
function calcAnaphylaxis() {
  const outEl = document.getElementById('anaphylaxisOut');
  if (!outEl) return;
  const w = getWeight();

  if (w <= 0) {
    outEl.innerHTML = '<div style="color:var(--muted); padding:16px; text-align:center; font-style:italic;">กรุณาระบุน้ำหนักผู้ป่วยที่แถบด้านบน เพื่อคำนวณขนาดยา Epinephrine IM และยาร่วมใน Anaphylaxis</div>';
    return;
  }

  // 1st Line Epinephrine IM (1:1,000 / 1 mg/mL)
  const maxEpiMg = w < 30 ? 0.3 : 0.5;
  const epiDoseMg = Math.min(maxEpiMg, w * 0.01).toFixed(2);
  const epiDoseMl = (epiDoseMg * 1.0).toFixed(2); // 1 mg/mL -> mL = mg

  // 2nd Line Medications
  const diphenDose = Math.min(50, w * 1.0).toFixed(1);
  const diphenVol = (diphenDose / 50).toFixed(2);

  const famotidineDose = Math.min(20, w * 0.5).toFixed(1);
  const famotidineVol = (famotidineDose / 10).toFixed(2);

  const methylpredDose = Math.min(125, w * 1.5).toFixed(1);
  const methylpredVol = (methylpredDose / 40).toFixed(2);

  const nsBolus = Math.min(1000, w * 20).toFixed(0);

  let html = `
    <!-- 1st-Line Epinephrine Hero Grid -->
    <div style="font-weight:700; font-size:13px; color:var(--danger); margin-bottom:8px;">1. First-Line Life-Saving Treatment (ฉีดทันที ห้ามรีรอ)</div>
    <div class="hero-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:8px; margin-bottom:14px;">
      <div class="hero-metric" style="border-color:var(--danger);">
        <div class="hero-metric-label">Epinephrine 1:1,000 (IM)</div>
        <div class="hero-metric-value" style="color:var(--danger);">${epiDoseMg} <span style="font-size:13px;">mg</span></div>
        <div class="hero-metric-sub">0.01 mg/kg (max ${maxEpiMg} mg)</div>
      </div>
      <div class="hero-metric" style="border-color:var(--danger);">
        <div class="hero-metric-label">Syringe Volume (1 mg/mL)</div>
        <div class="hero-metric-value" style="color:var(--danger);">${epiDoseMl} <span style="font-size:13px;">mL</span></div>
        <div class="hero-metric-sub">ดูดด้วย Syringe 1 mL (Tuberculin)</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">Injection Site & Repeat</div>
        <div class="hero-metric-value" style="font-size:16px;">IM ต้นขาด้านนอก</div>
        <div class="hero-metric-sub">ซ้ำได้ทุก 5–15 นาที หากไม่ดีขึ้น</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">IV Fluid Bolus (20 mL/kg)</div>
        <div class="hero-metric-value">${nsBolus} <span style="font-size:13px;">mL</span></div>
        <div class="hero-metric-sub">0.9% NS สำหรับ Hypotension</div>
      </div>
    </div>

    <!-- 2nd-Line Adjunctive Therapy Table -->
    <div style="font-weight:700; font-size:13px; color:var(--accent); margin-bottom:8px;">2. Second-Line Adjunctive Medications (ให้หลังฉีด Epinephrine แล้ว)</div>
    <div class="protocol-table-wrapper" style="margin-bottom:14px;">
      <table class="protocol-table">
        <thead>
          <tr>
            <th>Medication</th>
            <th>Calculated Dose</th>
            <th>Volume</th>
            <th>Prep & Route</th>
            <th>Clinical Role</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Diphenhydramine</strong><br><span style="font-size:10.5px; color:var(--muted);">H1-Antihistamine</span></td>
            <td><span class="dose-badge">${diphenDose} mg</span> (1 mg/kg)</td>
            <td><strong>${diphenVol} mL</strong></td>
            <td>50 mg/mL amp<br>IV slow / IM</td>
            <td>ลดผื่น คัน ลมพิษ (ห้ามใช้แทน Epinephrine ใน Anaphylaxis)</td>
          </tr>
          <tr>
            <td><strong>Famotidine</strong><br><span style="font-size:10.5px; color:var(--muted);">H2-Blocker</span></td>
            <td><span class="dose-badge">${famotidineDose} mg</span> (0.5 mg/kg)</td>
            <td><strong>${famotidineVol} mL</strong></td>
            <td>10 mg/mL amp<br>IV over 2 min</td>
            <td>เสริมฤทธิ์ H1-antihistamine ในการควบคุมอาการทางผิวหนัง</td>
          </tr>
          <tr>
            <td><strong>Methylprednisolone</strong><br><span style="font-size:10.5px; color:var(--muted);">Corticosteroid</span></td>
            <td><span class="dose-badge">${methylpredDose} mg</span> (1.5 mg/kg)</td>
            <td><strong>${methylpredVol} mL</strong></td>
            <td>40 mg/mL vial<br>IV slow</td>
            <td>ป้องกัน Biphasic Reaction (เริ่มออกฤทธิ์หลังฉีด 4–6 ชม.)</td>
          </tr>
          <tr style="background:rgba(220,38,38,0.06);">
            <td><strong>Epinephrine IV Drip</strong><br><span style="font-size:10.5px; color:var(--danger); font-weight:700;">Refractory Shock</span></td>
            <td><span class="dose-badge" style="background:var(--danger); color:#fff;">0.05–1.0 mcg/kg/min</span></td>
            <td><strong>Rate by pump</strong></td>
            <td>1 mg in 100 mL D5W<br>(10 mcg/mL)</td>
            <td>สำหรับเคสที่ฉีด IM 2–3 ครั้งและให้สารน้ำแล้วยังความดันตก / Shock</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Observation and Discharge Warning -->
    <div class="note" style="border-left:3px solid var(--warning);">
      <strong>⏱️ การเฝ้าระวัง Biphasic Reaction (EAACI 2025):</strong> ผู้ป่วย Anaphylaxis ต้องสังเกตอาการที่ห้องฉุกเฉินอย่างน้อย <strong>4–6 ชั่วโมง</strong> (หรือ 24 ชม. หากอาการรุนแรงมาก) ก่อนจำหน่าย และต้องจ่ายยา Epinephrine Auto-Injector หรือนัดตรวจคลินิกภูมิแพ้เสมอ
    </div>

    <details class="math-breakdown">
      <summary><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Show Math & Formula Breakdown</summary>
      <div class="math-breakdown-content">
        • Epinephrine IM 1:1000: 0.01 mg/kg × ${w.toFixed(1)} kg = ${(w*0.01).toFixed(3)} mg (capped at ${maxEpiMg} mg -> ${epiDoseMg} mg = ${epiDoseMl} mL of 1 mg/mL)<br>
        • Diphenhydramine: 1.0 mg/kg × ${w.toFixed(1)} kg = ${diphenDose} mg ÷ 50 mg/mL = ${diphenVol} mL<br>
        • NS Bolus: 20 mL/kg × ${w.toFixed(1)} kg = ${nsBolus} mL
      </div>
    </details>
  `;

  outEl.innerHTML = html;
}

// ==========================================
// 4. PEDIATRIC TRAUMA & BURNS PROTOCOL ENGINE
// ==========================================
function calcTrauma() {
  const outEl = document.getElementById('traumaOut');
  if (!outEl) return;
  const w = getWeight();
  const tbsa = parseFloat(document.getElementById('burnTBSA')?.value) || 0;
  const hoursElapsed = parseFloat(document.getElementById('burnHoursElapsed')?.value) || 0;

  if (w <= 0) {
    outEl.innerHTML = '<div style="color:var(--muted); padding:16px; text-align:center; font-style:italic;">กรุณาระบุน้ำหนักผู้ป่วยที่แถบด้านบน เพื่อคำนวณปริมาตรสารน้ำแผลไฟไหม้ (Parkland) และปริมาตรเลือด (EBV)</div>';
    return;
  }

  // Modified Parkland Burn Calculation: 3 mL * kg * %TBSA (LRS)
  const parklandTotal24h = (3 * w * tbsa);
  const parklandFirst8h = parklandTotal24h * 0.5;
  const parklandNext16h = parklandTotal24h * 0.5;

  // Rate in remaining first 8h
  const hoursRemainingFirst8h = Math.max(0.5, 8 - hoursElapsed);
  const rateFirst8h = (parklandFirst8h / hoursRemainingFirst8h).toFixed(1);
  const rateNext16h = (parklandNext16h / 16).toFixed(1);

  // Holliday-Segar Maintenance Fluid
  const maintHourlyRate = calcMaintenanceMlPerHr(w);

  // Target Urine Output (1.0 mL/kg/hr)
  const targetUO = (w * 1.0).toFixed(0);

  // Estimated Blood Volume
  const ebvTotal = (w * 75).toFixed(0);
  const prbc10ml = (w * 10).toFixed(0);

  let html = `
    <!-- ATLS 11th Ed xABCDE Survey Checklist -->
    <div style="font-weight:700; font-size:13px; color:var(--accent); margin-bottom:8px;">1. ATLS 11th Ed (2025) xABCDE Primary Trauma Survey</div>
    <div class="protocol-table-wrapper" style="margin-bottom:14px;">
      <table class="protocol-table">
        <thead>
          <tr>
            <th style="width:50px;">Priority</th>
            <th style="width:160px;">Survey Focus</th>
            <th>Immediate Resuscitative Interventions</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background:rgba(220,38,38,0.06);">
            <td><strong style="color:var(--danger); font-size:16px;">x</strong></td>
            <td><strong style="color:var(--danger);">eXsanguinating Hemorrhage</strong></td>
            <td>ขัน Tourniquet แขน/ขาที่เลือดพุ่ง, แพ็คแผลด้วย Hemostatic Gauze และกดทันที</td>
          </tr>
          <tr>
            <td><strong>A</strong></td>
            <td><strong>Airway + C-Spine</strong></td>
            <td>Manual in-line stabilization, Rigid collar, ดูดเสมหะ/เลือด, Intubation หาก GCS ≤ 8</td>
          </tr>
          <tr>
            <td><strong>B</strong></td>
            <td><strong>Breathing & O2</strong></td>
            <td>ระบาย Tension Pneumothorax (Needle 2nd ICS MCL / 5th ICS AAL), Chest tube, High-flow O2</td>
          </tr>
          <tr>
            <td><strong>C</strong></td>
            <td><strong>Circulation & Shock</strong></td>
            <td>เปิด IV/IO เบอร์ใหญ่ 2 สาย, ใส่ Pelvic Binder, ตรวจ eFAST, ให้ <strong>PRBC ${prbc10ml} mL</strong> หาก hemorrhagic shock</td>
          </tr>
          <tr>
            <td><strong>D</strong></td>
            <td><strong>Disability (Neuro)</strong></td>
            <td>ประเมิน Pediatric GCS, รูม่านตา (Pupils), ตรวจระดับน้ำตาลในเลือด (Dextrostix)</td>
          </tr>
          <tr>
            <td><strong>E</strong></td>
            <td><strong>Exposure & Warmth</strong></td>
            <td>ถอดเสื้อผ้าตรวจบาดแผลทั้งตัว, Log roll, ห่มผ้าอุ่น ป้องกัน Hypothermia Triad of Death</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modified Parkland Pediatric Burn Calculator -->
    <div style="font-weight:700; font-size:13px; color:var(--accent); margin-bottom:8px;">2. Modified Parkland Pediatric Burn Fluid Resuscitation (แผลไฟไหม้)</div>
    ${tbsa > 0 ? `
    <div class="hero-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:8px; margin-bottom:14px;">
      <div class="hero-metric">
        <div class="hero-metric-label">Total 24h Parkland (LRS)</div>
        <div class="hero-metric-value">${parklandTotal24h.toFixed(0)} <span style="font-size:13px;">mL</span></div>
        <div class="hero-metric-sub">3 mL × ${w.toFixed(1)}kg × ${tbsa}% TBSA</div>
      </div>
      <div class="hero-metric" style="border-color:var(--accent);">
        <div class="hero-metric-label">1st 8h Rate (เหลือนม ${hoursRemainingFirst8h}h)</div>
        <div class="hero-metric-value" style="color:var(--accent);">${rateFirst8h} <span style="font-size:13px;">mL/hr</span></div>
        <div class="hero-metric-sub">ยอด 50%: ${parklandFirst8h.toFixed(0)} mL LRS</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">Next 16h Rate</div>
        <div class="hero-metric-value">${rateNext16h} <span style="font-size:13px;">mL/hr</span></div>
        <div class="hero-metric-sub">ยอด 50%: ${parklandNext16h.toFixed(0)} mL LRS</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">+ Maintenance Fluid Rate</div>
        <div class="hero-metric-value">${maintHourlyRate.toFixed(1)} <span style="font-size:13px;">mL/hr</span></div>
        <div class="hero-metric-sub">D5 0.45% NS วิ่งคู่ LRS</div>
      </div>
      <div class="hero-metric" style="border-color:var(--good);">
        <div class="hero-metric-label">Target Urine Output</div>
        <div class="hero-metric-value" style="color:var(--good);">≥ ${targetUO} <span style="font-size:13px;">mL/hr</span></div>
        <div class="hero-metric-sub">เป้าหมาย 1.0 mL/kg/hr</div>
      </div>
    </div>
    ` : `
    <div style="background:var(--panel-subtle); border:1px solid var(--border); border-radius:var(--r-md); padding:10px 14px; margin-bottom:14px; font-size:12.5px;">
      ระบุ <strong>% TBSA Burn</strong> ด้านบนเพื่อคำนวณอัตราหยดสารน้ำ Lactated Ringer's ตามสูตร Modified Parkland
    </div>
    `}

    <details class="math-breakdown">
      <summary><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Show Math & Formula Breakdown</summary>
      <div class="math-breakdown-content">
        • Estimated Blood Volume (EBV): ${w.toFixed(1)} kg × 75 mL/kg = ${ebvTotal} mL<br>
        • Standard Initial Blood Bolus: 10 mL/kg × ${w.toFixed(1)} kg = ${prbc10ml} mL PRBC<br>
        ${tbsa > 0 ? `• Parkland 24h: 3 mL × ${w.toFixed(1)} kg × ${tbsa}% = ${parklandTotal24h.toFixed(0)} mL LRS (First 8h: ${parklandFirst8h.toFixed(0)} mL @ ${rateFirst8h} mL/hr + Next 16h: ${parklandNext16h.toFixed(0)} mL @ ${rateNext16h} mL/hr)<br>• Maintenance Fluid: ${maintHourlyRate.toFixed(1)} mL/hr` : ''}
      </div>
    </details>
  `;

  outEl.innerHTML = html;
}

// ==========================================
// 5. CROUP & STRIDOR PROTOCOL ENGINE
// ==========================================
function calcCroup() {
  const outEl = document.getElementById('croupOut');
  if (!outEl) return;
  const w = getWeight();

  if (w <= 0) {
    outEl.innerHTML = '<div style="color:var(--muted); padding:16px; text-align:center; font-style:italic;">กรุณาระบุน้ำหนักผู้ป่วยที่แถบด้านบน เพื่อคำนวณขนาดยา Dexamethasone และ Epinephrine พ่นสำหรับ Croup</div>';
    return;
  }

  // Westley Score Calculation
  const stridorPts = parseInt(document.getElementById('croupStridor')?.value || '0', 10);
  const retractPts = parseInt(document.getElementById('croupRetract')?.value || '0', 10);
  const airEntryPts = parseInt(document.getElementById('croupAirEntry')?.value || '0', 10);
  const cyanosisPts = parseInt(document.getElementById('croupCyanosis')?.value || '0', 10);
  const consciousPts = parseInt(document.getElementById('croupConscious')?.value || '0', 10);
  const totalWestley = stridorPts + retractPts + airEntryPts + cyanosisPts + consciousPts;

  // Severity classification
  let severityClass = 'good';
  let severityLabel = 'Mild Croup (คะแนน 0–2)';
  let severityPlan = 'Dexamethasone รับประทานครั้งเดียว + กลับบ้านสังเกตอาการ';

  if (totalWestley >= 12) {
    severityClass = 'danger';
    severityLabel = 'Impending Respiratory Failure (คะแนน ≥ 12)';
    severityPlan = '🚨 เตรียมใส่ท่อช่วยหายใจด่วน + พ่น Epinephrine ทันที + Admit PICU';
  } else if (totalWestley >= 8) {
    severityClass = 'danger';
    severityLabel = 'Severe Croup (คะแนน 8–11)';
    severityPlan = 'Dexamethasone + พ่นยา Epinephrine ทันที + Admit Ward/PICU';
  } else if (totalWestley >= 3) {
    severityClass = 'warning';
    severityLabel = 'Moderate Croup (คะแนน 3–7)';
    severityPlan = 'Dexamethasone + พิจารณาพ่น Epinephrine + สังเกตอาการที่ ER 2–4 ชม.';
  }

  // Medication Dosing
  const dexaDoseMg = Math.min(16, w * 0.6).toFixed(1);
  const dexaLowMg = Math.min(16, w * 0.15).toFixed(1);
  const dexaInjVol = (dexaDoseMg / 4).toFixed(2);
  const dexaSyrupVol = (dexaDoseMg / 0.1).toFixed(1);

  const epiRacemicMl = Math.min(0.5, w * 0.05).toFixed(2);
  const epiLMl = Math.min(5.0, w * 0.5).toFixed(1);

  let html = `
    <!-- Westley Score Severity Banner -->
    <div style="background:var(--${severityClass}-soft); border:1.5px solid var(--${severityClass}); border-radius:var(--r-md); padding:12px 16px; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
        <div style="font-weight:800; font-size:15px; color:var(--${severityClass});">Westley Croup Score: ${totalWestley} / 17 คะแนน — ${severityLabel}</div>
      </div>
      <div style="font-size:12.5px; color:var(--ink); margin-top:4px;"><strong>แผนการรักษา:</strong> ${severityPlan}</div>
      <div style="font-size:11.5px; color:var(--muted); margin-top:6px; font-family:'JetBrains Mono',monospace;">คะแนนย่อย: Stridor ${stridorPts} | Retraction ${retractPts} | Air entry ${airEntryPts} | Cyanosis ${cyanosisPts} | Consciousness ${consciousPts}</div>
    </div>

    <!-- Croup Medications Hero Grid -->
    <div style="font-weight:700; font-size:13px; color:var(--accent); margin-bottom:8px;">Croup Medications & Dosing (ยารักษาโรค Croup)</div>
    <div class="hero-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:8px; margin-bottom:14px;">
      <div class="hero-metric" style="border-color:var(--good);">
        <div class="hero-metric-label">Dexamethasone (0.6 mg/kg)</div>
        <div class="hero-metric-value" style="color:var(--good);">${dexaDoseMg} <span style="font-size:13px;">mg</span></div>
        <div class="hero-metric-sub">Single dose (max 16 mg)</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">Dexa Injection (4 mg/mL)</div>
        <div class="hero-metric-value">${dexaInjVol} <span style="font-size:13px;">mL</span></div>
        <div class="hero-metric-sub">IV / IM หรือกินได้</div>
      </div>
      <div class="hero-metric" style="border-color:var(--accent);">
        <div class="hero-metric-label">Nebulized L-Epi (1:1,000)</div>
        <div class="hero-metric-value" style="color:var(--accent);">${epiLMl} <span style="font-size:13px;">mL</span></div>
        <div class="hero-metric-sub">0.5 mL/kg (max 5 mL) พ่น 15m</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">Racemic Epi (2.25%)</div>
        <div class="hero-metric-value">${epiRacemicMl} <span style="font-size:13px;">mL</span></div>
        <div class="hero-metric-sub">+ NSS 3 mL (max 0.5 mL)</div>
      </div>
    </div>

    <div class="note" style="border-left:3px solid var(--warning);">
      <strong>⏱️ ข้อควรระวัง Rebound Stridor:</strong> ฤทธิ์ยาพ่น Epinephrine จะหมดลงใน 2 ชั่วโมง หากพ่นยาแล้วต้องสังเกตอาการที่ ER อย่างน้อย <strong>2–4 ชั่วโมง</strong> หากยังมี Stridor at rest หลังพ่นยา 2 ครั้งควรรับไว้รักษาในโรงพยาบาล
    </div>

    <details class="math-breakdown">
      <summary><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Show Math & Formula Breakdown</summary>
      <div class="math-breakdown-content">
        • Dexamethasone Standard 0.6 mg/kg × ${w.toFixed(1)} kg = ${(w*0.6).toFixed(2)} mg (clamped to max 16 mg -> ${dexaDoseMg} mg = ${dexaInjVol} mL of 4 mg/mL)<br>
        • Dexamethasone Low-Dose 0.15 mg/kg × ${w.toFixed(1)} kg = ${dexaLowMg} mg<br>
        • Nebulized L-Epinephrine 1:1000: 0.5 mL/kg × ${w.toFixed(1)} kg = ${epiLMl} mL (max 5.0 mL)
      </div>
    </details>
  `;

  outEl.innerHTML = html;
}

// ==========================================
// 6. BLOOD TRANSFUSION & MTP ENGINE
// ==========================================
function calcTransfusion() {
  const outEl = document.getElementById('transfusionOut');
  if (!outEl) return;
  const w = getWeight();
  const currentHb = parseFloat(document.getElementById('txCurrentHb')?.value) || 0;
  const targetHb = parseFloat(document.getElementById('txTargetHb')?.value) || 10.0;
  const prbcType = document.getElementById('txPrbcType')?.value || 'cpda';

  if (w <= 0) {
    outEl.innerHTML = '<div style="color:var(--muted); padding:16px; text-align:center; font-style:italic;">กรุณาระบุน้ำหนักผู้ป่วยที่แถบด้านบน เพื่อคำนวณปริมาตรเม็ดเลือดแดงเข้มข้น (PRBC), เกล็ดเลือด, FFP และสูตร MTP</div>';
    return;
  }

  // PRBC Calculation
  const factor = (prbcType === 'sagm') ? 4 : 3;
  const deltaHb = Math.max(0, targetHb - currentHb);
  let prbcVol = (w * deltaHb * factor);
  if (currentHb <= 0) {
    // Default bolus if current Hb not entered
    prbcVol = (w * 10);
  }
  const maxInfusionRate = (w * 5).toFixed(0);

  // Platelet, FFP, Cryo
  const pltVol = (w * 10).toFixed(0);
  const ffpVol = (w * 12.5).toFixed(0);
  const cryoVol = (w * 5).toFixed(0);
  const txaLoadingMg = Math.min(1000, w * 15).toFixed(0);
  const txaInfusionRate = (w * 2).toFixed(1);

  let html = `
    <!-- PRBC Transfusion Hero Grid -->
    <div style="font-weight:700; font-size:13px; color:var(--accent); margin-bottom:8px;">1. Packed Red Blood Cells (PRBC) Calculation</div>
    <div class="hero-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:8px; margin-bottom:14px;">
      <div class="hero-metric" style="border-color:var(--danger);">
        <div class="hero-metric-label">Calculated PRBC Volume</div>
        <div class="hero-metric-value" style="color:var(--danger);">${prbcVol.toFixed(0)} <span style="font-size:13px;">mL</span></div>
        <div class="hero-metric-sub">${currentHb > 0 ? `เพิ่ม Hb จาก ${currentHb} -> ${targetHb} g/dL` : 'ขนาดมาตรฐาน 10 mL/kg'}</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">Max Safe Infusion Rate</div>
        <div class="hero-metric-value">${maxInfusionRate} <span style="font-size:13px;">mL/hr</span></div>
        <div class="hero-metric-sub">5 mL/kg/hr (ป้องกัน TACO)</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">Transfusion Duration</div>
        <div class="hero-metric-value" style="font-size:18px;">2–4 <span style="font-size:13px;">ชั่วโมง</span></div>
        <div class="hero-metric-sub">ห้ามเกิน 4 ชม. ต่อถุง</div>
      </div>
      <div class="hero-metric">
        <div class="hero-metric-label">Expected Hb Rise</div>
        <div class="hero-metric-value" style="font-size:18px;">+ ${deltaHb > 0 ? deltaHb.toFixed(1) : '2–3'} <span style="font-size:13px;">g/dL</span></div>
        <div class="hero-metric-sub">Hct เพิ่มขึ้น ~6–9%</div>
      </div>
    </div>

    <!-- Blood Components & MTP Protocol Table -->
    <div style="font-weight:700; font-size:13px; color:var(--accent); margin-bottom:8px;">2. Pediatric Blood Components & Massive Transfusion Protocol (MTP 1:1:1)</div>
    <div class="protocol-table-wrapper" style="margin-bottom:14px;">
      <table class="protocol-table">
        <thead>
          <tr>
            <th>Blood Component</th>
            <th>Calculated Dose</th>
            <th>Standard Rule</th>
            <th>Clinical Target</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>PRBC</strong><br><span style="font-size:10.5px; color:var(--muted);">Packed Red Cells</span></td>
            <td><span class="dose-badge">${(w*10).toFixed(0)}–${(w*15).toFixed(0)} mL</span></td>
            <td>10–15 mL/kg</td>
            <td>เพิ่ม Hb 2–3 g/dL (รักษา Shock / Severe Anemia)</td>
          </tr>
          <tr>
            <td><strong>Platelet Concentrate</strong><br><span style="font-size:10.5px; color:var(--muted);">เกล็ดเลือด</span></td>
            <td><span class="dose-badge">${pltVol} mL</span></td>
            <td>10 mL/kg (หรือ 1 unit/10 kg)</td>
            <td>เพิ่มเกล็ดเลือด ~30,000–50,000 /mcL (เป้าหมาย ≥ 50k ในเลือดออก)</td>
          </tr>
          <tr>
            <td><strong>Fresh Frozen Plasma (FFP)</strong><br><span style="font-size:10.5px; color:var(--muted);">พลาสมาสดแช่แข็ง</span></td>
            <td><span class="dose-badge">${ffpVol} mL</span></td>
            <td>10–15 mL/kg</td>
            <td>เพิ่มระดับ Coagulation Factors 15–20% (INR &gt; 1.5)</td>
          </tr>
          <tr>
            <td><strong>Cryoprecipitate</strong><br><span style="font-size:10.5px; color:var(--muted);">ไครโอพรีซิพิเทต</span></td>
            <td><span class="dose-badge">${cryoVol} mL</span></td>
            <td>5–10 mL/kg (หรือ 1 unit/5 kg)</td>
            <td>รักษา Fibrinogen &lt; 100–150 mg/dL</td>
          </tr>
          <tr style="background:rgba(158,61,36,0.06);">
            <td><strong>Tranexamic Acid (TXA)</strong><br><span style="font-size:10.5px; color:var(--accent); font-weight:700;">Antifibrinolytic</span></td>
            <td><span class="dose-badge" style="background:var(--accent); color:#fff;">${txaLoadingMg} mg</span> Load</td>
            <td>15 mg/kg IV in 10m (max 1g)<br>then ${txaInfusionRate} mg/hr</td>
            <td>ยับยั้งการสลายลิ่มเลือดใน Major Trauma / MTP ภายใน 3 ชม.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <details class="math-breakdown">
      <summary><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Show Math & Formula Breakdown</summary>
      <div class="math-breakdown-content">
        • PRBC Formula: Weight ${w.toFixed(1)} kg × (Target ${targetHb} - Current ${currentHb} g/dL) × factor ${factor} = ${prbcVol.toFixed(0)} mL<br>
        • Maximum Safe Infusion Rate: 5 mL/kg/hr × ${w.toFixed(1)} kg = ${maxInfusionRate} mL/hr<br>
        • Tranexamic Acid (TXA): 15 mg/kg × ${w.toFixed(1)} kg = ${(w*15).toFixed(0)} mg (clamped to max 1000 mg -> ${txaLoadingMg} mg)
      </div>
    </details>
  `;

  outEl.innerHTML = html;
}

// ==========================================
// 7. BEDSIDE SUMMARY POCKET CARD PRINT ENGINE
// ==========================================
function printBedsideSummaryCard() {
  const w = getWeight();
  const ageYr = getAgeInYears();
  if (w <= 0) {
    showToast('กรุณาระบุน้ำหนักผู้ป่วยก่อนพิมพ์ Bedside Pocket Card');
    return;
  }
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
  }
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
    calcAsthma,
    calcElectrolytes,
    calcAirway,
    calcSepsis,
    calcAnaphylaxis,
    calcTrauma,
    calcCroup,
    calcTransfusion,
    calcGrowthZScores,
    toggleSex,
    toggleSeizureTimer,
    resetSeizureTimer,
    setSepsisMode,
    printBedsideSummaryCard,
    formatSeizureTime,
    getSeizureStageText,
    calcCorrectedNa,
    calcCorrectedCa,
    calcKShift,
    calcIVKClReplacement,
    calcOralKClReplacement,
    calcNaDeficit,
    calcFreeWaterDeficit,
    calcBicarbonateDeficit,
    calcAnionGap,
    calcCorrectedAnionGap,
    calcDeltaRatio,
    interpretDeltaRatio,
    calcOsmolality,
    calcEffectiveTonicity,
    calcOsmolarGap,
    calcFeNa,
    calcFeUrea,
    calcUAG,
    calcTTKG,
    getActiveElectrolyteAgeKey,
    getWeight,
    calculateIBW,
    getAgeInYears,
    estimateFromAge,
    getBroselowZone,
    applyQuickWeight,
    previewBroselowZone,
    renderBroselowMiniSpectrum,
    setTheme,
    THEMES,
    suggestBlade,
    weightToETTCuffed,
    weightToETTUncuffed,
    weightToDepth,
    applyVersionToUI,
    syncVersionFromSW,
    openEvidenceModal,
    closeEvidenceModal,
    filterEvidenceList,
    renderEvidenceList,
    setAppMode,
    getAppMode,
    toggleAppMode,
    calcV1Mode,
    stepWeight,
    scrollToV1Section,
    searchV1Items,
    clearV1Search
  };
}
