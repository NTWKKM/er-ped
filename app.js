// --- PWA: register service worker & A2HS prompt ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
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

// --- Dataset loading (static JSON instead of google.script.run.getDataset) ---
let DS = null;
fetch('dataset.json')
  .then(r => r.json())
  .then(j => { DS = j; initUI(); })
  .catch(err => {
    console.error('Failed to load dataset.json', err);
    const app = document.getElementById('app');
    if (app) app.innerHTML = '<div class="card">Cannot load dataset.json</div>';
  });

function initUI(){
  populateDrugs();
  updateIBW();
  refreshBroselowChip();
  calcAll();
}

// --------- IBW / Age weight estimate ---------

// Weech weight estimate (ใช้เป็น IBW โดยประมาณเมื่อไม่มีข้อมูล BW จริง)
function estimateWeightFromAge(ageYr) {
  ageYr = Number(ageYr);
  if (!isFinite(ageYr) || ageYr <= 0) return null;
  if (ageYr < 1)  return 9;                      // ทารก ~9 kg (ดีฟอลต์)
  if (ageYr <= 6) return Math.round(ageYr * 2 + 8); // 1–6 yr: 2×age + 8
  return Math.round((7 * ageYr - 5) / 2);        // >6 yr: (7×age - 5)/2
}

// Holliday–Segar: mL/day → mL/h
function calcMaintenanceMlPerHr(weightKg) {
  weightKg = Number(weightKg);
  if (!weightKg || weightKg <= 0) return 0;
  let mlDay = 0;
  if (weightKg <= 10)      mlDay = weightKg * 100;
  else if (weightKg <= 20) mlDay = 1000 + (weightKg - 10) * 50;
  else                     mlDay = 1500 + (weightKg - 20) * 20;
  return +(mlDay / 24).toFixed(1);
}

// --------- UI bits ---------

// ── UI: tabs
function showTab(id, btn) {
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ['dose','atb','fluids','pals','ncpr'].forEach(x=>{
    const el = document.getElementById(x);
    if (el) el.style.display = (x===id)?'block':'none';
  });
}

function getWeight(){
  const el = document.getElementById('weight');
  const w = el ? parseFloat(el.value) : NaN;
  return (w>0)? w : null;
}

let gIBW = null;
let gFluidType = 'NS'; // ดีฟอลต์ให้ NS

function estimateFromAge(){
  const age = parseFloat(document.getElementById('age').value);
  if (!age && age!==0){ updateIBW(); return; }
  gIBW = estimateWeightFromAge(age) || null; // ใช้ local Weech
  updateIBWChip('age');
  if (document.getElementById('useIBW').checked) applyIBWToBW();
  refreshBroselowChip();
  calcAll();
}

function updateIBW(){
  const age = parseFloat(document.getElementById('age').value);
  const bw = getWeight();
  if (age>0){ estimateFromAge(); return; }
  gIBW = bw || null;
  updateIBWChip(bw? 'bw' : null);
  if (document.getElementById('useIBW').checked) applyIBWToBW();
  refreshBroselowChip();
}

function applyIBWToBW(){
  const box = document.getElementById('useIBW');
  if (box && box.checked && gIBW){
    document.getElementById('weight').value = gIBW;
    onWeightChange();
  }
}

function onWeightChange(){
  const w = getWeight();
  if (!document.getElementById('doseW').value) document.getElementById('doseW').value = w||'';
  if (!document.getElementById('atbW').value)  document.getElementById('atbW').value  = w||'';
  if (!document.getElementById('fW').value)    document.getElementById('fW').value    = w||'';
  if (!document.getElementById('pW').value)    document.getElementById('pW').value    = w||'';
  if (!document.getElementById('nW').value)    document.getElementById('nW').value    = w||'';
  refreshBroselowChip();
  calcAll();
}

function updateIBWChip(source){
  const el = document.getElementById('ibwVal');
  const src = document.getElementById('ibwSource');
  if (!gIBW){ if(el) el.textContent='—'; if(src) src.textContent=''; return; }
  if (el)  el.textContent  = `${Number(gIBW).toFixed(1)} kg`;
  if (src) src.textContent = source==='age' ? '(Weech estimate)' : source==='bw' ? '(=BW)' : '';
}

// Broselow helpers (subset)
function broselowColor(w){
  if (!w || !DS || !DS.broselow) return '—';
  for (const b of DS.broselow){ if (w>=b.min && w<=b.max) return b.color; }
  return '—';
}

function colorSwatch(colorLabel){
  const base = (colorLabel || '').toString().trim().split(/\s+/).pop(); // last token = "Pink"
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
  const panel = document.getElementById('broselowPanel');
  if (!panel) return;
  if (panel.classList.contains('hidden')){
    fillBroselowContent();
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

function joinArrow(arr){ return (arr||[]).filter(v=>v!=null).map(v=>Math.round(v)).join(' → '); }
function fmt(n){ return (Math.abs(n) >= 10 ? Number(n).toFixed(0) : Number(n).toFixed(2)); }
function fmtMg(n){ return (n>=100 ? n.toFixed(0) : n.toFixed(1)); }
function fmtMl(n){ return (n>=10 ? n.toFixed(1) : n.toFixed(2)); }

function fillBroselowContent(){
  const w   = getWeight() || gIBW || 0;
  const ageIn = parseFloat(document.getElementById('age')?.value)||null;
  const out = document.getElementById('broselowContent');
  if(!w){ if(out) out.textContent = 'กรอกน้ำหนักหรือ IBW ก่อน'; return; }

  const bands = (DS && DS.broselow) || [];
  const color = broselowColor(w);
  const entry = bands.find(b => typeof b.min==='number' && typeof b.max==='number' && w>=b.min && w<=b.max)
             ||  bands.find(b => b.color === color)
             ||  null;

  if (!entry){ if(out) out.textContent = 'ไม่พบช่วง Broselow ใน dataset'; return; }

  // ===== helpers =====
  const jArrow = (arr)=> Array.isArray(arr) && arr.length ? arr.map(x=>Math.round(x)).join(' → ') : '';
  const fmt    = (n, d=2)=> (typeof n==='number') ? Number(n.toFixed(d)) : n;
  const mg     = (v)=> (v===0 || v) ? `${fmt(v)} mg` : '';
  const mcg    = (v)=> (v===0 || v) ? `${fmt(v)} mcg` : '';
  const mEq    = (v)=> (v===0 || v) ? `${fmt(v)} mEq` : '';
  const mL     = (v, d=1)=> (v===0 || v) ? `${fmt(v,d)} mL` : '';
  const g      = (v)=> (v===0 || v) ? `${fmt(v)} g` : '';
  const show   = (label, val)=> val ? `• ${label}: ${val}` : null;

  // ===== fallback rules (เติมให้ครบ 3 หมวด + ยาอื่น ๆ ถ้า JSON ไม่มี) =====
  // Defib/Cardio
  const defibSeq  = (entry.defibJ && entry.defibJ.length) ? entry.defibJ
                    : [2,4,6,8,10].map(m=>m*w);
  const cardioSeq = (entry.cardioversionJ && entry.cardioversionJ.length) ? entry.cardioversionJ
                    : [0.5, 1].map(m=>m*w);

  // Fluid bolus (tape หรือ 20 mL/kg)
  const bolus = (typeof entry.fluidBolusMl === 'number') ? entry.fluidBolusMl : Math.round(20*w);

  // Airway/อุปกรณ์: ใช้ JSON ก่อน ถ้าไม่พอเติม APLS
  const airway = Object.assign({}, entry.airway || {});
  let estAge = ageIn;
  if (!estAge && w>8 && w<30) estAge = (w-8)/2; // inverse APLS ~ 1–10y
  if (estAge && estAge>0){
    if (!airway.ettCuffed)   airway.ettCuffed   = (estAge/4 + 3.5).toFixed(1);
    if (!airway.ettUncuffed) airway.ettUncuffed = (estAge/4 + 4.0).toFixed(1);
    if (!airway.depthCm)     airway.depthCm     = (estAge/2 + 12).toFixed(1);
  } else {
    if (!airway.ettCuffed)   airway.ettCuffed   = weightToETTCuffed(w);
    if (!airway.ettUncuffed) airway.ettUncuffed = weightToETTUncuffed(w);
    if (!airway.depthCm)     airway.depthCm     = weightToDepth(w);
  }
  const eq = Object.assign({}, entry.equipment || {});
  if (!eq.laryngoscopeBlade) eq.laryngoscopeBlade = suggestBlade(estAge, w);
  if (!entry.ngFr) entry.ngFr = suggestNG(w);
  if (!eq.opaMm)   eq.opaMm   = suggestOPA(w);
  if (!eq.npaFr)   eq.npaFr   = suggestNPA(w);
  if (!eq.suctionFr) eq.suctionFr = suggestSuction(w);

  // Fallback formulas (ยา/infusions/ICP/overdose)
  const FB = {
    epiET_1_1000_ml: ()=> 0.1*w,                 // 0.1 mg/kg @1 mg/mL
    epi_1_10000_ml  : ()=> 0.1*w,                 // 0.01 mg/kg @0.1 mg/mL
    atropine_mg     : ()=> Math.max(0.02*w, 0.1),
    atropine_ET_mg  : ()=> 0.03*w,
    bicarb_mEq      : ()=> 1*w,
    lidocaine_mg    : ()=> 1*w,
    lidocaine_ET_mg : ()=> 2*w,
    adeno_first_mg  : ()=> 0.1*w,
    adeno_second_mg : ()=> 0.2*w,
    amiodarone_mg   : ()=> 5*w,
    cagl10_ml       : ()=> 0.5*w,
    mgso4_mg        : ()=> 50*w,
    d10_ml          : ()=> 10*w,
    d25_ml          : ()=> null,
    naloxone_mg     : ()=> Math.min(0.1*w, 2),
    procainamide_mg : ()=> 15*w,

    pre_atropine_mg : ()=> Math.max(0.02*w, 0.1),
    pre_lido_mg     : ()=> 2*w,
    pre_fent_mcg    : ()=> 2*w,
    ind_eto_mg      : ()=> 0.3*w,
    ind_ket_mg      : ()=> 3*w,
    ind_thio_mg     : ()=> 3*w,
    par_rocu_mg     : ()=> 1*w,
    par_vecu_mg     : ()=> 0.2*w,
    par_succ_mg     : ()=> 3*w,

    anap_epiIM_ml   : ()=> 0.01*w,
    anap_alb_ml     : ()=> Math.max(0.3, Math.min(1.0, 0.03*w)),
    anap_chlor_mg   : ()=> 0.25*w,
    anap_mps_mg     : ()=> 2*w,
    anap_nss_ml     : ()=> 20*w,

    croup_epiNB_ml  : ()=> 0.05*w,
    croup_dexa_mg   : ()=> 0.6*w,

    dzp_iv_mg       : ()=> 0.25*w,
    dzp_rect_mg     : ()=> 0.5*w,
    pht_mg          : ()=> 15*w,
    fps_mgPE        : ()=> 15*w,
    phenob_mg       : ()=> 20*w,

    // Infusion in D5W 100 mL (map ให้ใกล้กับตัวเลขในภาพ)
    dop_mg_100ml    : ()=> nearest([30,40,50,60,80,100,125,160,200], 6*w),
    dob_mg_100ml    : ()=> nearest([30,40,50,60,80,100,125,160,200], 6*w),
    epi_mg_100ml    : ()=> nearest([3,4,5,6,8,10,12.5,16,20], 0.6*w),
    norepi_mg_100ml : ()=> nearest([1.5,2,2.5,3,4,5,6,8,10], 0.3*w),
    lido_mg_100ml   : ()=> nearest([10,13,17,20,26,33], 1*w),
    pge1_mg_100ml   : ()=> nearest([1.3,1.5,1.7,3,4,5,6.5,8,10], 0.3*w),
    nitro_mg_100ml  : ()=> nearest([2.6,3.4,6,8,10,12.5,16,20], 0.6*w),
    dop_rate        : '2–20', dob_rate:'2–20', epi_rate:'1–10', norepi_rate:'1–20',
    lido_rate:'20–50', pge1_rate:'1–2', nitro_rate:'5–80',

    mannitol_g      : ()=> 1*w,
    furosemide_mg   : ()=> 1*w,
    charcoal_g      : ()=> 1*w
  };
  function nearest(arr, target){
    return arr.reduce((a,b)=> Math.abs(b-target)<Math.abs(a-target)? b:a, arr[0]);
  }

  // ===== BUILD OUTPUT (สไตล์เดิม: หัวข้อ + bullets • หัวข้อหนา) =====
  const L = [];

  // HEADER
  L.push(
    `🎨 <strong>Color</strong> : ${entry.color || color}  |  ` +
    `Weight : <strong>${fmt(w,1)} kg</strong>` +
    `${entry.approxKg ? `  (tape ≈ ${entry.approxKg} kg)` : ''}` +
    `${entry.ageHint ? `  |  Age : ${entry.ageHint}` : ''}`
  );

  // FLUIDS
  {
    const mntVal = calcMaintenanceMlPerHr ? calcMaintenanceMlPerHr(w||0) : null;
    const parts = [`Bolus ${bolus} mL ${entry.fluidBolusMl!=null ? '(tape)' : '(20 mL/kg)'}`];
    if (mntVal != null) parts.push(`Maintenance ${fmt(mntVal,1)} mL/h (Holliday–Segar)`);
    L.push(`<strong>💧 Fluids</strong> : ${parts.join('  |  ')}`);
  } 

  // DEFIB / CARDIO
  L.push(`<strong>⚡ Defibrillation</strong> : ${jArrow(defibSeq)} J ⚠️ Max 200 J`);
  L.push(`<strong>❤️‍🔥 Cardioversion</strong> : ${jArrow(cardioSeq)} J`);
  L.push(''); 

  // AIRWAY
  L.push('<strong>🫁 Airway & equipment</strong>');
  const ettParts = [];
  if (airway.ettUncuffed) ettParts.push(`uncuffed ${airway.ettUncuffed}`);
  if (airway.ettCuffed)   ettParts.push(`cuffed ${airway.ettCuffed}`);
  if (airway.depthCm)     ettParts.push(`depth ~${airway.depthCm} cm`);
  L.push(`• ETT : ${ettParts.join(' | ')}`);
  const extras = [];
  if (entry.ngFr)                 extras.push(`NG/OG ${entry.ngFr} Fr`);
  if (eq.opaMm)                   extras.push(`OPA ${eq.opaMm} mm`);
  if (eq.npaFr)                   extras.push(`NPA ${eq.npaFr} Fr`);
  if (eq.laryngoscopeBlade)       extras.push(`Blade ${eq.laryngoscopeBlade}`);
  if (eq.king)                    extras.push(`King ${eq.king}`);
  if (eq.igel)                    extras.push(`i-gel ${eq.igel}`);
  if (eq.suctionFr)               extras.push(`Suction ${eq.suctionFr} Fr`);
  if (extras.length) L.push(`• ${extras.join(' | ')}`);
  L.push('');

  // DRUGS (อ่านจาก JSON; ถ้าขาดใช้ fallback)
  const D = entry.drugs || {};

  // --- Resuscitation ---
  {
    const R = D.resuscitation || {};
    L.push('<strong>💊 Resuscitation</strong>');
    L.push(show('Epinephrine (1:10,000)',  mL( R.epi_1_10000_ml   ?? FB.epi_1_10000_ml(), 1 )));
    L.push(show('Atropine',                mg( R.atropine_mg ?? FB.atropine_mg() )));
    const ad1 = R.adenosine_mg?.first ?? FB.adeno_first_mg();
    const ad2 = R.adenosine_mg?.second ?? FB.adeno_second_mg();
    L.push(show('Adenosine 1st/2nd', `${mg(ad1)} / ${mg(ad2)}`.trim()));
    {
      const parts = [];
      const vLi = mg( R.lidocaine_mg  ?? FB.lidocaine_mg() );
      const vAm = mg( R.amiodarone_mg ?? FB.amiodarone_mg() );
      if (vLi) parts.push(`Lidocaine : ${vLi}`);
      if (vAm) parts.push(`Amiodarone : ${vAm}`);
      if (parts.length) L.push(`• ${parts.join('  |  ')}`);
    }    
    {
      const parts = [];
      const vHCO3 = mEq( R.sodium_bicarb_mEq ?? FB.bicarb_mEq() );
      const vCaGlu = mL( R.calcium_gluconate10_pct_ml ?? FB.cagl10_ml(), 1 );
      if (vHCO3)  parts.push(`Sodium Bicarbonate : ${vHCO3}`);
      if (vCaGlu) parts.push(`10% Calcium gluconate : ${vCaGlu}`);
      if (parts.length) L.push(`• ${parts.join('  |  ')}`);
    }    
    L.push(show('Magnesium sulfate',       mg( R.magnesium_sulfate_mg ?? FB.mgso4_mg() )));
    const d10 = R.d10w_ml ?? FB.d10_ml();
    const d25 = R.d25w_ml ?? FB.d25_ml();
    const segs = [];
    if (d10 != null) segs.push(`D10W (infant/children) : ${mL(d10, 0)}`);
    if (d25 != null) segs.push(`D25W : ${mL(d25, 0)}`);
    if (segs.length) L.push(`• ${segs.join('  |  ')}`);
    L.push('');
  }

  // --- RSI ---
  {
    const RS = D.rsi || {};
    L.push('<strong>🛫 Rapid Sequence Induction</strong>');
    const PM = RS.premed || {};
    {
      const parts = [];
      const vAt  = mg( PM.atropine_mg   ?? FB.pre_atropine_mg() );
      const vLi  = mg( PM.lidocaine_mg  ?? FB.pre_lido_mg() );
      const vFe  = mcg( PM.fentanyl_mcg ?? FB.pre_fent_mcg() );
      if (vAt) parts.push(`Atropine ${vAt}`);
      if (vLi) parts.push(`Lidocaine ${vLi}`);
      if (vFe) parts.push(`Fentanyl ${vFe}`);
      L.push(`• Pre intubation : ${parts.join('  |  ')}`);
    }
    const IN = RS.induction || {};
    {
      const parts = [];
      const vEt = mg( IN.etomidate_mg  ?? FB.ind_eto_mg() );
      const vKe = mg( IN.ketamine_mg   ?? FB.ind_ket_mg() );
      const vTh = mg( IN.thiopental_mg ?? FB.ind_thio_mg() );
      if (vEt) parts.push(`Etomidate ${vEt}`);
      if (vKe) parts.push(`Ketamine ${vKe}`);
      if (vTh) parts.push(`Thiopental ${vTh}`);
      L.push(`• Induction : ${parts.join('  |  ')}`);
    }
    const PA = RS.paralytic || {};
    {
      const parts = [];
      const vRo = mg( PA.rocuronium_mg       ?? FB.par_rocu_mg() );
      const vVe = mg( PA.vecuronium_mg       ?? FB.par_vecu_mg() );
      const vSu = mg( PA.succinylcholine_mg  ?? FB.par_succ_mg() );
      if (vRo) parts.push(`Rocuronium ${vRo}`);
      if (vVe) parts.push(`Vecuronium ${vVe}`);
      if (vSu) parts.push(`Succinylcholine ${vSu}`);
      L.push(`• Paralytic : ${parts.join('  |  ')}`);
    }
    L.push('');
  }   

  // --- Infusion in D5W 100 mL ---
  {
    const I = D.infusion || {};
    L.push('<strong>💉 Infusion (in D5W 100 mL)</strong>');
    {
      const row1 = [];
      const dopa     = mg( I.dopamine_in100ml_mg    ?? FB.dop_mg_100ml() );
      const dopaRate =      I.dopamine_rate_ml_hr   ?? FB.dop_rate;
      if (dopa || dopaRate) row1.push(`Dopamine ${[dopa, dopaRate ? `${dopaRate} mL/hr` : ''].filter(Boolean).join('  |  ')}`);
    
      const dobu     = mg( I.dobutamine_in100ml_mg  ?? FB.dob_mg_100ml() );
      const dobuRate =      I.dobutamine_rate_ml_hr ?? FB.dob_rate;
      if (dobu || dobuRate) row1.push(`Dobutamine ${[dobu, dobuRate ? `${dobuRate} mL/hr` : ''].filter(Boolean).join('  |  ')}`);
    
      if (row1.length) L.push(`• ${row1.join('   ||   ')}`);
    }
    {
      const row2 = [];
      const epi     = mg( I.epinephrine_in100ml_mg     ?? FB.epi_mg_100ml() );
      const epiRate =      I.epinephrine_rate_ml_hr    ?? FB.epi_rate;
      if (epi || epiRate) row2.push(`Epinephrine ${[epi, epiRate ? `${epiRate} mL/hr` : ''].filter(Boolean).join('  |  ')}`);
    
      const nore     = mg( I.norepinephrine_in100ml_mg ?? FB.norepi_mg_100ml() );
      const noreRate =      I.norepinephrine_rate_ml_hr?? FB.norepi_rate;
      if (nore || noreRate) row2.push(`Norepinephrine ${[nore, noreRate ? `${noreRate} mL/hr` : ''].filter(Boolean).join('  |  ')}`);
    
      if (row2.length) L.push(`• ${row2.join('   ||   ')}`);
    }    
    L.push('');
  }

  // --- Anaphylaxis ---
  {
    const A = D.anaphylaxis || {};
    const parts = [];
    const vEpi = mL(A.epi_1_1000_IM_SC_ml ?? FB.anap_epiIM_ml(), 2);
    const vAlb = mL(A.albuterol_0_5pct_nb_5mgml_ml ?? FB.anap_alb_ml(), 2);
    const vChl = mg(A.chlorpheniramine_iv_mg ?? FB.anap_chlor_mg());
    if (vEpi) parts.push(`Epinephrine (1:1,000) IM/SC ${vEpi}`);
    if (vAlb) parts.push(`Albuterol 0.5% NB ${vAlb}`);
    if (vChl) parts.push(`CPM ${vChl}`);
    L.push(`<strong>🚑 Anaphylaxis</strong>: ${parts.join('  |  ')}`);
  }  

  // --- Croup ---
  {
    const C = D.croup || {};
    const parts = [];
    const vEpi = mL( C.epi_1_1000_nb_ml ?? FB.croup_epiNB_ml(), 2 );
    const vDex = mg( C.dexamethasone_im_mg ?? FB.croup_dexa_mg() );
    if (vEpi) parts.push(`Epinephrine (1:1,000) NB ${vEpi}`);
    if (vDex) parts.push(`Dexamethasone IM ${vDex}`);
    L.push(`<strong>🗣️ Croup</strong> : ${parts.join(' &nbsp;|&nbsp; ')}`);
  }

  // --- Epilepsy ---
  {
    const E = D.epilepsy || {};
    const segs = [];
    // Diazepam: รวม IV/Rectal ไว้ในคำเดียว
    {
      const dz = [];
      const iv   = mg(E.diazepam_iv_mg     ?? FB.dzp_iv_mg());
      const rect = mg(E.diazepam_rectal_mg ?? FB.dzp_rect_mg());
      if (iv)   dz.push(`IV ${iv}`);
      if (rect) dz.push(`Rectal ${rect}`);
      if (dz.length) segs.push(`Diazepam ${dz.join(' / ')}`);
    }
    const pht  = mg(E.phenytoin_mg      ?? FB.pht_mg());
    const phen = mg(E.phenobarbital_mg  ?? FB.phenob_mg());
    if (pht)  segs.push(`Phenytoin ${pht}`);
    if (phen) segs.push(`Phenobarbital ${phen}`);
  
    if (segs.length) L.push(`<strong>⚡ Epilepsy</strong> : ${segs.join(' &nbsp;|&nbsp; ')}`);
  } 

  // --- Increased ICP / Overdose (ถ้ามี)
  if (D.increasedICP){
    const X = D.increasedICP || {};
    {
      const vMan = g( (X && X.mannitol_g!=null) ? X.mannitol_g : FB.mannitol_g() );
      const vFur = mg( (X && X.furosemide_mg!=null) ? X.furosemide_mg : FB.furosemide_mg() );
      const parts = [];
      if (vMan) parts.push(`Mannitol ${vMan}`);
      if (vFur) parts.push(`Furosemide ${vFur}`);
      L.push(`<strong>🧠 Increased ICP</strong> : ${parts.join('  |  ')}`);
    }
  }
  if (D.overdose){
    const O = D.overdose || {};
    const R = D.resuscitation || {};
    {
      const vChar = g((O && O.charcoal_g!=null) ? O.charcoal_g : FB.charcoal_g());
      const vNal  = mg((R && R.naloxone_mg!=null) ? R.naloxone_mg : FB.naloxone_mg());
      L.push(`<strong>☠️ Overdose</strong> : Activated Charcoal ${vChar} &nbsp;|&nbsp; Naloxone ${vNal}`);
    }
    L.push('');
  }

  // render as HTML (ให้ตัวหนาแสดงผลได้)
  out.innerHTML = L.join('<br>');

  // ===== airway/equipment suggestors =====
  function weightToETTCuffed(kg){
    if (kg<6) return '3.0';
    if (kg<9) return '3.5';
    if (kg<12) return '4.0';
    if (kg<15) return '4.5';
    if (kg<19) return '5.0';
    if (kg<24) return '5.5';
    if (kg<30) return '6.0';
    if (kg<36) return '6.5';
    return '7.0';
  }
  function weightToETTUncuffed(kg){
    const c = Number(weightToETTCuffed(kg));
    return (c && !Number.isNaN(c)) ? (c+0.5).toFixed(1) : '';
  }
  function weightToDepth(kg){
    const c = Number(weightToETTCuffed(kg));
    return (c && !Number.isNaN(c)) ? (c*3).toFixed(1) : '';
  }
  function suggestBlade(age, kg){
    if (age!=null){
      if (age<0.5) return '0–1 straight';
      if (age<1)   return '1 straight';
      if (age<2)   return '1–1.5 straight';
      if (age<6)   return '2 straight/curved';
      if (age<10)  return '2–3';
    }
    if (kg<6)  return '0–1 straight';
    if (kg<10) return '0–1 straight';
    if (kg<12) return '1–1.5 straight';
    if (kg<24) return '2 straight/curved';
    return '3';
  }
  function suggestNG(kg){
    if (kg<10) return '6–8';
    if (kg<19) return '8–10';
    if (kg<24) return '10–12';
    if (kg<30) return '12–14';
    return '14–16';
  }
  function suggestOPA(kg){
    if (kg<10) return '40–50';
    if (kg<19) return '60';
    if (kg<24) return '70';
    return '80';
  }
  function suggestNPA(kg){
    if (kg<10) return 14;
    if (kg<19) return 18;
    if (kg<24) return 20;
    if (kg<30) return 24;
    return 26;
  }
  function suggestSuction(kg){
    if (kg<10) return '6–8';
    if (kg<19) return '8';
    if (kg<24) return '10';
    return '10–12';
  }
}

// ---- Populate drug lists & calculators (generic minimal logic) ----
function populateDrugs(){
  renderDoseList('');
  renderATBList('');

  const doseSel = document.getElementById('doseDrug');
  const atbSel  = document.getElementById('atbDrug');

  if (doseSel) doseSel.addEventListener('change', calcDose);
  if (atbSel)  atbSel.addEventListener('change',  calcATB);

  const doseSearch = document.getElementById('doseSearch');
  const atbSearch  = document.getElementById('atbSearch');
  if (doseSearch) doseSearch.addEventListener('input', filterDoseList);
  if (atbSearch)  atbSearch.addEventListener('input',  filterATBList);

  calcDose();
  calcATB();
}

function renderDoseList(q){
  const sel = document.getElementById('doseDrug');
  if (!sel) return;
  const arr = (DS?.pediatricDose)||[];
  const prev = sel.value;
  const lcq = (q||'').trim().toLowerCase();
  sel.innerHTML = '';
  arr
    .filter(d => {
      const name  = (d.name||'').toLowerCase();
      const alias = (d.alias||d.aliases||'').toString().toLowerCase();
      return !lcq || name.includes(lcq) || alias.includes(lcq);
    })
    .forEach(d=>{
      const o = document.createElement('option');
      o.value = d.key;
      o.textContent = d.name;
      sel.appendChild(o);
    });
  // keep previous selection if it still exists
  if ([...sel.options].some(o=>o.value===prev)) sel.value = prev;
  calcDose();
}

function renderATBList(q){
  const sel = document.getElementById('atbDrug');
  if (!sel) return;
  const arr = (DS?.pediatricATB)||[];
  const prev = sel.value;
  const lcq = (q||'').trim().toLowerCase();
  sel.innerHTML = '';
  arr
    .filter(d => {
      const name  = (d.name||'').toLowerCase();
      const alias = (d.alias||d.aliases||'').toString().toLowerCase();
      return !lcq || name.includes(lcq) || alias.includes(lcq);
    })
    .forEach(d=>{
      const o = document.createElement('option');
      o.value = d.key;
      o.textContent = d.name;
      sel.appendChild(o);
    });
  if ([...sel.options].some(o=>o.value===prev)) sel.value = prev;
  calcATB();
}

function filterDoseList(){
  const q = document.getElementById('doseSearch')?.value || '';
  renderDoseList(q);
}

function filterATBList(){
  const q = document.getElementById('atbSearch')?.value || '';
  renderATBList(q);
}

function calcAll(){ calcDose(); calcATB(); calcFluids(); calcPALS(); calcNCPR(); }

// ===== Dose calc (general) – รองรับช่วงโดส min/max, คุมเพดาน per dose/per day, แสดง mL/เม็ดอัตโนมัติ =====
function parseStrength(prepText){
  if (!prepText) return {};
  const s = String(prepText).replace(/\s+/g, ' ').trim();

  // mg / mL
  let m = s.match(/(\d+(?:\.\d+)?)\s*mg\s*\/\s*(\d+(?:\.\d+)?)\s*mL/i);
  if (m) {
    const mg = parseFloat(m[1]), ml = parseFloat(m[2]);
    if (mg>0 && ml>0) return { mgPerMl: mg/ml };
  }
  // mg / 5 mL
  m = s.match(/(\d+(?:\.\d+)?)\s*mg\s*\/\s*5\s*mL/i);
  if (m) {
    const mg = parseFloat(m[1]);
    if (mg>0) return { mgPerMl: mg/5 };
  }
  // mg / tab
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

function calcDose(){
  if (!DS) return;

  const key = document.getElementById('doseDrug').value;
  const bw = parseFloat(document.getElementById('doseW').value) || getWeight() || gIBW;

  const concOverride = parseFloat(document.getElementById('doseConc').value); // mg/mL override
  const drug = (DS.pediatricDose||[]).find(d=>d.key===key) || (DS.pediatricDose||[])[0];
  const outEl = document.getElementById('doseOut');
  if (!drug){ if(outEl) outEl.textContent='No dataset'; return; }

  const unit = drug.unit || 'mg/kg';
  let minPerKg = null, maxPerKg = null;

  if (drug.unitType === 'perDay' || /mg\/kg\/day/i.test(unit)) {
    minPerKg = drug.doseMinMgPerKg ?? drug.dose ?? null;
    maxPerKg = drug.doseMaxMgPerKg ?? drug.dose ?? null;
  } else {
    minPerKg = drug.doseMinMgPerKg ?? drug.dose ?? null;
    maxPerKg = drug.doseMaxMgPerKg ?? drug.dose ?? null;
  }

  const strength = parseStrength(drug.preparation || drug.name || '');
  const mgPerMl  = concOverride>0 ? concOverride : (strength.mgPerMl || null);
  const mgPerTab = strength.mgPerTab || null;

  let perDoseMinMg = null, perDoseMaxMg = null, perDayMinMg = null, perDayMaxMg = null;

  if (/mg\/kg\/day/i.test(unit) || drug.unitType === 'perDay') {
    if (bw && minPerKg!=null) perDayMinMg = bw * minPerKg;
    if (bw && maxPerKg!=null) perDayMaxMg = bw * maxPerKg;

    if (drug.maxPerDayMg){
      if (perDayMinMg!=null) perDayMinMg = Math.min(perDayMinMg, drug.maxPerDayMg);
      if (perDayMaxMg!=null) perDayMaxMg = Math.min(perDayMaxMg, drug.maxPerDayMg);
    }

    const nPerDay = dosesPerDayFromFreq(drug.freq);
    if (nPerDay){
      if (perDayMinMg!=null) perDoseMinMg = perDayMinMg / nPerDay;
      if (perDayMaxMg!=null) perDoseMaxMg = perDayMaxMg / nPerDay;
    }

    if (drug.maxPerDoseMg){
      if (perDoseMinMg!=null) perDoseMinMg = Math.min(perDoseMinMg, drug.maxPerDoseMg);
      if (perDoseMaxMg!=null) perDoseMaxMg = Math.min(perDoseMaxMg, drug.maxPerDoseMg);
    }
  } else {
    if (bw && minPerKg!=null) perDoseMinMg = bw * minPerKg;
    if (bw && maxPerKg!=null) perDoseMaxMg = bw * maxPerKg;

    if (drug.maxPerDoseMg){
      if (perDoseMinMg!=null) perDoseMinMg = Math.min(perDoseMinMg, drug.maxPerDoseMg);
      if (perDoseMaxMg!=null) perDoseMaxMg = Math.min(perDoseMaxMg, drug.maxPerDoseMg);
    }

    const nPerDay = dosesPerDayFromFreq(drug.freq);
    if (nPerDay){
      if (perDoseMinMg!=null) perDayMinMg = perDoseMinMg * nPerDay;
      if (perDoseMaxMg!=null) perDayMaxMg = perDoseMaxMg * nPerDay;
    }

    if (drug.maxPerDayMg){
      if (perDayMinMg!=null) perDayMinMg = Math.min(perDayMinMg, drug.maxPerDayMg);
      if (perDayMaxMg!=null) perDayMaxMg = Math.min(perDayMaxMg, drug.maxPerDayMg);
    }
  }

  let perDoseMlTxt = '', perDoseTabsTxt = '';
  function toRangeTxt(minVal, maxVal, fmtFn){
    if (minVal==null && maxVal==null) return '—';
    if (minVal!=null && maxVal!=null && Math.abs(maxVal-minVal) >= 0.5) {
      return `${fmtFn(minVal)}–${fmtFn(maxVal)}`;
    }
    const v = (maxVal!=null)? maxVal : minVal;
    return fmtFn(v);
  }

  if (mgPerMl){
    const minMl = (perDoseMinMg!=null)? perDoseMinMg / mgPerMl : null;
    const maxMl = (perDoseMaxMg!=null)? perDoseMaxMg / mgPerMl : null;
    const mlTxt = toRangeTxt(minMl, maxMl, n=>fmtMl(n));
    if (mlTxt !== '—') perDoseMlTxt = ` ≈ ${mlTxt} mL @ ${mgPerMl.toFixed(2)} mg/mL`;
  }
  if (mgPerTab){
    const minTab = (perDoseMinMg!=null)? perDoseMinMg / mgPerTab : null;
    const maxTab = (perDoseMaxMg!=null)? perDoseMaxMg / mgPerTab : null;
    const tabTxt = toRangeTxt(minTab, maxTab, n=> (n>=1 ? n.toFixed(1) : n.toFixed(2)));
    if (tabTxt !== '—') perDoseTabsTxt = ` ≈ ${tabTxt} tab @ ${mgPerTab.toFixed(0)} mg/tab`;
  }

  const age = parseFloat(document.getElementById('age').value);
  const warn = [];
  if (drug.minAgeYr!=null && age>0 && age<drug.minAgeYr) warn.push(`อายุต่ำกว่าเกณฑ์ (${drug.minAgeYr}+ yr)`);
  if (drug.maxAgeYr!=null && age>0 && age>drug.maxAgeYr) warn.push(`อายุมากกว่าเกณฑ์ (≤${drug.maxAgeYr} yr)`);
  if (drug.minWeightKg!=null && bw && bw<drug.minWeightKg) warn.push(`น้ำหนักต่ำกว่าเกณฑ์ (${drug.minWeightKg}+ kg)`);
  if (drug.maxWeightKg!=null && bw && bw>drug.maxWeightKg) warn.push(`น้ำหนักมากกว่าเกณฑ์ (≤${drug.maxWeightKg} kg)`);

  const perDoseMgTxt = toRangeTxt(perDoseMinMg, perDoseMaxMg, n=>`${fmtMg(n)} mg`);
  const perDayMgTxt  = toRangeTxt(perDayMinMg,  perDayMaxMg,  n=>`${fmtMg(n)} mg`);

  {
    const blocks = [];
    const title = (drug.name || drug.drug) || '—';
    const S = ()=> blocks.push(''); // spacer
  
    // ชื่อยา (ตัวหนา)
    blocks.push(`<strong>${title}</strong>`);
    S();
  
    // --- Dose ---
    const doseLine =
      (minPerKg != null || maxPerKg != null)
        ? toRangeTxt(minPerKg, maxPerKg, n => `${n} mg/kg`)
        : (drug.dose ? `${drug.dose} ${unit}` : '—');
  
    blocks.push(`<strong>💊 Dose</strong>`);
    blocks.push(`• ${doseLine}${drug.freq ? ' ' + drug.freq : ''}`);
    S();
  
    // --- Calculations ---
    // ทำ Per dose ให้ตัวหนา ถ้ามีค่า
    const perDoseParts = [perDoseMgTxt, perDoseMlTxt, perDoseTabsTxt]
      .filter(x => x && x !== '—');
    const perDayLine = (perDayMgTxt !== '—' || drug.maxPerDayMg) ? `Per day : ${perDayMgTxt}` : '';
  
    const calcItems = [];
    if (perDoseParts.length){
      calcItems.push(`Per dose : <strong>${perDoseParts.join('  |  ')}</strong>`);
    } else {
      calcItems.push(`Per dose : —`);
    }
    if (perDayLine) calcItems.push(perDayLine);
  
    if (calcItems.length) {
      blocks.push(`<strong>🧮 Calculations</strong>`);
      calcItems.forEach(x => blocks.push(`• ${x}`));
      S();
    }
  
    // --- Limits ---
    const limitItems = [
      (drug.maxPerDoseMg ? `Max per dose : ${drug.maxPerDoseMg} mg` : ''),
      (drug.maxPerDayMg  ? `Max per day : ${drug.maxPerDayMg} mg`  : '')
    ].filter(Boolean);
  
    if (limitItems.length) {
      blocks.push(`<strong>🚧 Limits</strong>`);
      limitItems.forEach(x => blocks.push(`• ${x}`));
      S();
    }
  
    // --- Form / Route ---
    const formItems = [
      (drug.route ? `Route : ${drug.route}` : ''),
      (drug.preparation ? `Form : ${drug.preparation}` : '')
    ].filter(Boolean);
  
    if (formItems.length) {
      blocks.push(`<strong>📦 Form / Route</strong>`);
      formItems.forEach(x => blocks.push(`• ${x}`));
      S();
    }
  
    // --- Note ---
    if (drug.note) {
      blocks.push(`<strong>📝 Note</strong>`);
      blocks.push(`• ${drug.note}`);
      S();
    }
  
    // --- Warning ---
    if (warn && warn.length) {
      blocks.push(`<strong>⚠️ Warning</strong>`);
      blocks.push(`• ${warn.join('<br>• ')}`);
      blocks.push('• (ตรวจสอบขนาดยาซ้ำก่อนสั่งทุกครั้ง)');
      S();
    }
  
    if (outEl) outEl.innerHTML = blocks.join('<br>');
  }  
}

// ── ATB calc (per kg per day or per dose)
function calcATB(){
  if (!DS) return;

  const key  = document.getElementById('atbDrug').value;
  const bw   = parseFloat(document.getElementById('atbW').value) || getWeight() || gIBW;
  const form = parseFloat(document.getElementById('atbForm').value); // mg/mL หรือ mg/tab
  const drug = (DS.pediatricATB||[]).find(d=>d.key===key) || (DS.pediatricATB||[])[0];
  const outEl = document.getElementById('atbOut');
  if (!drug){ if(outEl) outEl.textContent='No dataset'; return; }
  if (!bw){ if(outEl) outEl.textContent='กรุณากรอกน้ำหนัก'; return; }

  const unit = (drug.unit || 'mg/kg').toLowerCase();
  const isPerDay = unit.includes('mg/kg/day');

  const minPerKg = (drug.doseMinMgPerKg != null) ? Number(drug.doseMinMgPerKg) : null;
  const maxPerKg = (drug.doseMaxMgPerKg != null) ? Number(drug.doseMaxMgPerKg) : null;
  const fixedPerKg = (drug.dose != null) ? Number(drug.dose) : null;

  const fmtLocal = n => (Math.abs(n)>=10 ? n.toFixed(0) : n.toFixed(2));
  const cap = (v, m) => (m ? Math.min(v, m) : v);
  const dosesPerDay = (function infer(text){
    if (!text) return null;
    const t = String(text).toLowerCase().replace(/\s+/g,'');
    const m = t.match(/q(\d{1,2})h/);
    if (m){ const h = parseInt(m[1],10); if (h>0) return Math.max(1, Math.round(24/h)); }
    const m2 = t.match(/divq(\d{1,2})h/);
    if (m2){ const h = parseInt(m2[1],10); if (h>0) return Math.max(1, Math.round(24/h)); }
    if (t.includes('q6'))  return 4;
    if (t.includes('q8'))  return 3;
    if (t.includes('q12')) return 2;
    if (t.includes('q24')) return 1;
    return null;
  })(drug.split || drug.freq || '');

  const TO = (function(){
    return function toRangeTxtLocal(a,b,render){
      const f = render || (x=>String(x));
      if (a!=null && b!=null && a!==b) return `${f(a)}–${f(b)}`;
      if (a!=null && b==null) return `${f(a)}`;
      if (a==null && b!=null) return `${f(b)}`;
      return '—';
    };
  })();

  let perDayMgTxt = '—';
  let perDoseMgTxt = '—';
  let perDoseMlTxt = '';
  let perDayMlTxt  = '';
  let limitMaxDose = drug.maxPerDoseMg ? Number(drug.maxPerDoseMg) : null;
  let limitMaxDay  = drug.maxPerDayMg  ? Number(drug.maxPerDayMg)  : null;

  if (isPerDay){
    if (minPerKg!=null || maxPerKg!=null){
      const dMin = (minPerKg!=null)? bw*minPerKg : null;
      const dMax = (maxPerKg!=null)? bw*maxPerKg : null;
      const dMinC = (dMin!=null)? cap(dMin, limitMaxDay) : null;
      const dMaxC = (dMax!=null)? cap(dMax, limitMaxDay) : null;
      perDayMgTxt = TO(dMinC, dMaxC, n=>`${fmtLocal(n)} mg/day`);
      if (dosesPerDay){
        const pdMin = (dMinC!=null)? dMinC/dosesPerDay : null;
        const pdMax = (dMaxC!=null)? dMaxC/dosesPerDay : null;
        perDoseMgTxt = TO(pdMin, pdMax, n=>`${fmtLocal(n)} mg/dose`);
        if (form>0){
          perDoseMlTxt = `  ≈ ${TO(pdMin, pdMax, n=>fmtLocal(n/form))} mL/เม็ด ต่อครั้ง`;
          perDayMlTxt  = `  ≈ ${TO(dMinC, dMaxC, n=>fmtLocal(n/form))} mL/เม็ด ต่อวัน`;
        }
      } else {
        if (form>0) perDayMlTxt = `  ≈ ${TO(dMinC, dMaxC, n=>fmtLocal(n/form))} mL/เม็ด ต่อวัน`;
      }
    } else if (fixedPerKg!=null){
      const d = bw*fixedPerKg;
      const dC = cap(d, limitMaxDay);
      perDayMgTxt = `${fmtLocal(dC)} mg/day` + (limitMaxDay? ` (max ${limitMaxDay} mg)` : '');
      if (dosesPerDay){
        const pd = dC/dosesPerDay;
        perDoseMgTxt = `${fmtLocal(pd)} mg/dose`;
        if (form>0) perDoseMlTxt = `  ≈ ${fmtLocal(pd/form)} mL/เม็ด ต่อครั้ง`;
      }
      if (form>0) perDayMlTxt = `  ≈ ${fmtLocal(dC/form)} mL/เม็ด ต่อวัน`;
    }
  } else {
    if (minPerKg!=null || maxPerKg!=null){
      const pMin = (minPerKg!=null)? cap(bw*minPerKg, limitMaxDose) : null;
      const pMax = (maxPerKg!=null)? cap(bw*maxPerKg, limitMaxDose) : null;
      perDoseMgTxt = TO(pMin, pMax, n=>`${fmtLocal(n)} mg/dose`);
      if (form>0) perDoseMlTxt = `  ≈ ${TO(pMin, pMax, n=>fmtLocal(n/form))} mL/เม็ด ต่อครั้ง`;
      if (dosesPerDay){
        const dayMin = (pMin!=null)? pMin*dosesPerDay : null;
        const dayMax = (pMax!=null)? pMax*dosesPerDay : null;
        const dayMinC = (dayMin!=null)? cap(dayMin, limitMaxDay) : null;
        const dayMaxC = (dayMax!=null)? cap(dayMax, limitMaxDay) : null;
        perDayMgTxt = TO(dayMinC, dayMaxC, n=>`${fmtLocal(n)} mg/day`);
        if (form>0) perDayMlTxt = `  ≈ ${TO(dayMinC, dayMaxC, n=>fmtLocal(n/form))} mL/เม็ด ต่อวัน`;
      }
    } else if (fixedPerKg!=null){
      let per = bw*fixedPerKg;
      per = cap(per, limitMaxDose);
      perDoseMgTxt = `${fmtLocal(per)} mg/dose` + (limitMaxDose? ` (max ${limitMaxDose} mg)` : '');
      if (form>0) perDoseMlTxt = `  ≈ ${fmtLocal(per/form)} mL/เม็ด ต่อครั้ง`;
      if (dosesPerDay){
        const d = cap(per*dosesPerDay, limitMaxDay);
        perDayMgTxt = `${fmtLocal(d)} mg/day` + (limitMaxDay? ` (max ${limitMaxDay} mg)` : '');
        if (form>0) perDayMlTxt = `  ≈ ${fmtLocal(d/form)} mL/เม็ด ต่อวัน`;
      }
    }
  }

  const aliasTxt = Array.isArray(drug.aliases) && drug.aliases.length ? ` (${drug.aliases.join(', ')})` : '';
  const title = (drug.name || drug.drug || 'Antibiotic') + aliasTxt;

  const blocks = [];
  const S = ()=> blocks.push(''); // spacer

  // ชื่อยา
  blocks.push(`<strong>${title}</strong>`);
  S();

  // --- Dose ---
  const doseLine =
    (minPerKg != null || maxPerKg != null)
      ? TO(minPerKg, maxPerKg, n => `${n} mg/kg${isPerDay?'/day':''}`)
      : (fixedPerKg != null ? `${fixedPerKg} mg/kg${isPerDay?'/day':''}` : '—');

  blocks.push(`<strong>💊 Dose</strong>`);
  blocks.push(`• ${doseLine}${drug.split ? ' ' + drug.split : (drug.freq ? ' ' + drug.freq : '')}`);
  S();

  // --- Calculations (ทำ Per dose ให้ตัวหนา) ---
  const calcLines = [];
  {
    const perDoseParts = [];
    if (perDoseMgTxt && perDoseMgTxt !== '—') perDoseParts.push(perDoseMgTxt.trim());
    if (perDoseMlTxt && perDoseMlTxt !== '—') perDoseParts.push(perDoseMlTxt.trim());
    if (perDoseParts.length){
      calcLines.push(`Per dose : <strong>${perDoseParts.join('  |  ')}</strong>`);
    } else {
      calcLines.push(`Per dose : —`);
    }

    const perDayParts = [];
    if (perDayMgTxt && perDayMgTxt !== '—') perDayParts.push(perDayMgTxt.trim());
    if (perDayMlTxt && perDayMlTxt !== '—') perDayParts.push(perDayMlTxt.trim());
    if (perDayParts.length) calcLines.push(`Per day  : ${perDayParts.join('  |  ')}`);
  }
  if (calcLines.length){
    blocks.push(`<strong>🧮 Calculations</strong>`);
    calcLines.forEach(x => blocks.push(`• ${x}`));
    S();
  }

  // --- Limits ---
  const limits = [
    (limitMaxDose ? `Max per dose : ${limitMaxDose} mg` : ''),
    (limitMaxDay  ? `Max per day  : ${limitMaxDay} mg`  : '')
  ].filter(Boolean);
  if (limits.length){
    blocks.push(`<strong>🚧 Limits</strong>`);
    limits.forEach(x => blocks.push(`• ${x}`));
    S();
  }

  // --- Form / Route ---
  const formItems = [
    (drug.route ? `Route : ${drug.route}` : ''),
    (drug.preparation ? `Form  : ${drug.preparation}` : '')
  ].filter(Boolean);
  if (formItems.length){
    blocks.push(`<strong>📦 Form / Route</strong>`);
    formItems.forEach(x => blocks.push(`• ${x}`));
    S();
  }

  // --- Warning by age/weight ---
  const age = parseFloat(document.getElementById('age').value);
  const warn = [];
  if (drug.minAgeYr!=null && age>0 && age<drug.minAgeYr) warn.push(`อายุต่ำกว่าเกณฑ์ (${drug.minAgeYr}+ yr)`);
  if (drug.maxAgeYr!=null && age>0 && age>drug.maxAgeYr) warn.push(`อายุมากกว่าเกณฑ์ (≤${drug.maxAgeYr} yr)`);
  if (drug.minWeightKg!=null && bw && bw<drug.minWeightKg) warn.push(`น้ำหนักต่ำกว่าเกณฑ์ (${drug.minWeightKg}+ kg)`);
  if (drug.maxWeightKg!=null && bw && bw>drug.maxWeightKg) warn.push(`น้ำหนักมากกว่าเกณฑ์ (≤${drug.maxWeightKg} kg)`);

  if (drug.note){
    blocks.push(`<strong>📝 Note</strong>`);
    blocks.push(`• ${drug.note}`);
    S();
  }

  if (warn.length){
    blocks.push(`<strong>⚠️ Warning</strong>`);
    blocks.push(`• ${warn.join('<br>• ')}`);
    blocks.push('• (โปรดตรวจสอบขนาดยาตามแนวทาง TSH ก่อนสั่ง)');
    S();
  }

  if (outEl) outEl.innerHTML = blocks.join('<br>');
}

// ── Fluids (UI + คำนวณแบบหมวด/อิโมจิ)
function setFluidType(t){ gFluidType = t; highlightFluidChips(); calcFluids(); }
function highlightFluidChips(){
  (['ORS','NS','RL','D5-1/2NS','D5-NS']).forEach(k=>{
    const el = document.getElementById('fluid-'+k.replace(/\//g,'-'));
    if (!el) return;
    el.style.background = (k===gFluidType)? '#e0f2fe' : '#fff';
    el.style.borderColor = (k===gFluidType)? '#60a5fa' : '#e5e7eb';
    el.style.fontWeight = (k===gFluidType)? '700' : '400';
  });
}

function calcFluids(){
  const w    = parseFloat(document.getElementById('fW').value) || getWeight() || gIBW;
  const deg  = document.getElementById('fDegree').value;
  const plan = document.getElementById('fPlan').value; // 24 h หรือ 48 h
  const out  = document.getElementById('fOut');
  if (!w){ if(out) out.textContent='กรุณากรอกน้ำหนัก'; return; }

  const mnt = calcMaintenanceMlPerHr(w);

  const fmt0 = n => (Math.abs(n)>=10 ? n.toFixed(0) : n.toFixed(1));
  const fmt1 = n => n.toFixed(1);

  const pct = deg.includes('Mild') ? 4 : (deg.includes('Moderate') ? 8 : 10);
  const deficit = w * pct * 10; // mL

  const hours        = (plan==='24 h')? 24 : 48;
  const replaceRate  = deficit / hours;     // mL/h
  const shockBolus   = 20 * w;              // mL
  const rep24        = Math.min(deficit, replaceRate * 24);
  const rep48        = Math.min(deficit, replaceRate * 48);
  const total24      = (mnt*24) + rep24;
  const total48      = (mnt*48) + rep48;

  let recTxt = '';
  if (DS?.fluids?.plans){
    const p = DS.fluids.plans.find(x=>x.degree===deg) || DS.fluids.plans[0];
    if (p) recTxt = `• ${p.rec}  |  IV: ${p.ivOption}`;
  }

  const blocks = [];
  const S = ()=> blocks.push('&nbsp;'); // spacer between sections

  // Header
  blocks.push(`<strong>💧 Fluid</strong> : ${gFluidType}`);
  S();

  // Plan
  blocks.push(`<strong>📋 Plan</strong>`);
  blocks.push(`• Degree : ${deg}`);
  if (recTxt) blocks.push(recTxt);
  S();

  if (gFluidType === 'ORS'){
    let orsPerKg = null;
    if (deg.includes('Mild')) orsPerKg = 50;
    else if (deg.includes('Moderate')) orsPerKg = 75;

    if (orsPerKg){
      const orsVol  = orsPerKg * w;
      const orsRate = orsVol / 4;

      blocks.push(`<strong>🚰 ORS (rapid rehydration)</strong>`);
      blocks.push(`• Volume 4 h : ${fmt0(orsVol)} mL`);
      blocks.push(`• Rate : ${fmt0(orsRate)} mL/h`);
      S();

      blocks.push(`<strong>🧮 Calculations</strong>`);
      blocks.push(`• Maintenance : <strong>${fmt1(mnt)} mL/h</strong> (Holliday–Segar)`);
      blocks.push(`• Deficit (~${pct}%) : <strong>${fmt0(deficit)} mL</strong>  (สามารถครอบคลุมโดย ORS + maintenance ตามอาการ)`);
      blocks.push(`• After ORS, continue maintenance and replace ongoing losses`);
      S();

      blocks.push(`<strong>Σ Totals</strong>`);
      blocks.push(`• 24 h ≈ ${fmt0(mnt*24 + orsVol)} mL`);
      blocks.push(`• 48 h ≈ ${fmt0(mnt*48 + orsVol)} mL`);
    } else {
      blocks.push(`<strong>⚠️ Alerts</strong>`);
      blocks.push(`• ORS ไม่เหมาะในภาวะ shock/อาการรุนแรง เริ่ม IV (NS/RL) ก่อนจน stable`);
      S();

      blocks.push(`<strong>🧮 Calculations (IV replacement)</strong>`);
      blocks.push(`• Maintenance : <strong>${fmt1(mnt)} mL/h</strong>`);
      blocks.push(`• Deficit (~${pct}%) : <strong>${fmt0(deficit)} mL</strong>`);
      blocks.push(`• Replace rate : ${fmt0(replaceRate)} mL/h over ${hours} h`);
      blocks.push(`• Combined target (start) : <strong>${fmt0(mnt + replaceRate)} mL/h</strong>`);
      if (deg.includes('Shock')) blocks.push(`• ⛑️ Shock bolus : ${fmt0(shockBolus)} mL (20 mL/kg NS/RL), repeat as needed`);
      S();

      blocks.push(`<strong>Σ Totals</strong>`);
      blocks.push(`• 24 h ≈ ${fmt0(total24)} mL`);
      blocks.push(`• 48 h ≈ ${fmt0(total48)} mL`);
    }
  } else {
    blocks.push(`<strong>🧮 Calculations</strong>`);
    blocks.push(`• Selected IV : ${gFluidType}`);
    blocks.push(`• Maintenance : <strong>${fmt1(mnt)} mL/h</strong> (Holliday–Segar)`);
    blocks.push(`• Deficit (~${pct}%) : <strong>${fmt0(deficit)} mL</strong>`);
    blocks.push(`• Replace rate : ${fmt0(replaceRate)} mL/h over ${hours} h`);
    blocks.push(`• Combined target (start) : <strong>${fmt0(mnt + replaceRate)} mL/h</strong>`);
    if (deg.includes('Shock')) blocks.push(`• ⛑️ Shock bolus : ${fmt0(shockBolus)} mL (20 mL/kg NS/RL), repeat as needed`);
    S();

    blocks.push(`<strong>Σ Totals</strong>`);
    blocks.push(`• 24 h ≈ ${fmt0(total24)} mL`);
    blocks.push(`• 48 h ≈ ${fmt0(total48)} mL`);
  }

  S();
  blocks.push(`<strong>📝 Note</strong>`);
  blocks.push(`• ปรับความสารน้ำตามอาการ/ปริมาณปัสสาวะ/Na+/กลูโคส`);

  if (out) out.innerHTML = blocks.join('<br>');
}

// ── PALS
function calcPALS(){
  if (!DS) return;
  const out = document.getElementById('pOut');
  const w   = parseFloat(document.getElementById('pW').value) || getWeight() || gIBW;
  const age = parseFloat(document.getElementById('pAge').value) || parseFloat(document.getElementById('age').value);
  const P   = DS.pals || {};
  if (!w){ if(out) out.textContent='กรุณากรอกน้ำหนัก'; return; }

  const epiMg = (P.epiArrest?.dose_mgPerKg ?? 0.01) * w;
  const epiMl = epiMg / (P.epiArrest?.conc_mgPerMl ?? 0.1);
  const amio  = (P.amiodarone?.bolus_mgPerKg ?? 5) * w;
  const lido  = (P.lidocaine?.bolus_mgPerKg ?? 1) * w;
  const j1    = (P.defib?.first_JPerKg ?? 2) * w;
  const j2    = (P.defib?.next_JPerKg  ?? 4) * w;
  const jUp   = (P.defib?.upper_JPerKg ?? 4) * w;

  // Airway (age formula)
  let cuffed=null, uncuffed=null, depth=null;
  if (age && age>0){
    cuffed   = (age/4 + 3.5).toFixed(1);
    uncuffed = (age/4 + 4).toFixed(1);
    depth    = (age/2 + 12).toFixed(1);
  }

  const secArrestTitle = `🚨 Cardiac Arrest (Asytole/PEA/VF/pVT)`;

  let atrop = (P.atropine?.dose_mgPerKg ?? 0.02) * w;
  if (P.atropine){
    atrop = Math.max(P.atropine.minSingle_mg ?? 0.1, Math.min(P.atropine.maxSingle_mg_child ?? 0.5, atrop));
  }
  const epiInf = P.epiInfusion?.range_mcgPerKgPerMin || [0.01, 0.1];
  const dopaInf= P.dopamineInfusion?.range_mcgPerKgPerMin || [2, 20];

  const a = P.adenosine || {};
  const f1mg = Math.min((a.first_mgPerKg ?? 0.1) * w, a.first_max_mg ?? 6);
  const f2mg = Math.min((a.second_mgPerKg ?? 0.2) * w, a.second_max_mg ?? 12);
  const concA = a.defaultConc_mgPerMl ?? 3;
  const sync  = P.syncCardioversion || {};
  const sJ1lo = (sync.first_JPerKg?.[0] ?? 0.5) * w;
  const sJ1hi = (sync.first_JPerKg?.[1] ?? 1.0) * w;
  const sJ2   = (sync.next_JPerKg ?? 2) * w;

  const M = P.mgso4_tdp || {};
  const mgMin = (M.range_mgPerKg?.[0] ?? 25) * w;
  const mgMax = (M.range_mgPerKg?.[1] ?? 50) * w;
  const cap   = M.max_mg ?? 2000;

  // --- build pretty HTML output (หัวข้อหนา + เว้นบรรทัด) ---
  const blocks = [];
  const S = ()=> blocks.push('&nbsp;'); // spacer line that actually renders

  // Cardiac Arrest
  blocks.push(`<strong>${secArrestTitle}</strong>`);
  blocks.push(`• Epinephrine (1:10,000) : <strong>${epiMg.toFixed(2)} mg</strong>  (≈ <strong>${epiMl.toFixed(1)} mL IV/IO</strong>)  — repeat q <strong>${(P.epiArrest?.repeatMin||[3,5]).join('–')} min</strong>`);
  blocks.push(`• Amiodarone : <strong>${amio.toFixed(0)} mg</strong>  (max total <strong>${((P.amiodarone?.maxTotal_mgPerKg ?? 15)*w)|0} mg</strong>)`);
  blocks.push(`• Lidocaine : <strong>${lido.toFixed(0)} mg</strong>  (max total <strong>${((P.lidocaine?.maxTotal_mgPerKg ?? 3)*w)|0} mg</strong>)`);
  blocks.push(`• Defibrillation : <strong>${j1.toFixed(0)} J → ${j2.toFixed(0)} J</strong> (up to <strong>${jUp.toFixed(0)} J</strong>) ⚠️ Max 200 J`);
  if (cuffed){
    blocks.push(`• ETT cuffed ~ <strong>${cuffed}</strong> (uncuffed ~ <strong>${uncuffed}</strong>) ; depth ~ <strong>${depth} cm</strong>`);
  }
  S();

  // Bradycardia
  blocks.push(`<strong>🧊 Bradycardia</strong>`);
  blocks.push(`• Atropine : <strong>${atrop.toFixed(2)} mg</strong> IV/IO (0.02 mg/kg; min <strong>${P.atropine?.minSingle_mg ?? 0.1} mg</strong>, max <strong>${P.atropine?.maxSingle_mg_child ?? 0.5} mg</strong>)`);
  blocks.push(`• Epinephrine infusion : <strong>${epiInf[0]}–${epiInf[1]} mcg/kg/min</strong>`);
  blocks.push(`• Dopamine infusion : <strong>${dopaInf[0]}–${dopaInf[1]} mcg/kg/min</strong>`);
  S();

  // Tachycardia
  blocks.push(`<strong>⚡️ Tachycardia</strong>`);
  blocks.push(`• Adenosine : 1st <strong>${f1mg.toFixed(2)} mg</strong> → 2nd <strong>${f2mg.toFixed(2)} mg</strong>`);
  blocks.push(`  ↳ ≈ <strong>${(f1mg/concA).toFixed(2)} mL</strong> → <strong>${(f2mg/concA).toFixed(2)} mL</strong> @ ${concA} mg/mL, rapid IV push + NSS flush`);
  blocks.push(`• Synchronized cardioversion : <strong>${sJ1lo.toFixed(0)}–${sJ1hi.toFixed(0)} J</strong> → <strong>${sJ2.toFixed(0)} J</strong>`);
  S();

  // Torsades / MgSO4
  blocks.push(`<strong>🧲 Torsades (MgSO₄)</strong>`);
  blocks.push(`• <strong>${Math.min(mgMin,cap).toFixed(0)}–${Math.min(mgMax,cap).toFixed(0)} mg</strong> IV over <strong>${(M.overMin||[10,20]).join('–')} min</strong> (max <strong>${cap/1000} g</strong>)`);
  S();

  // Footer note
  blocks.push(`⚠️ ตรวจสอบความถูกต้องตาม PALS guideline ก่อนให้ยา/ทำหัตถการ`);

  if (out) out.innerHTML = blocks.join('<br>');
}

// ── NCPR
function calcNCPR(){
  if (!DS) return;
  const w  = parseFloat(document.getElementById('nW').value) || getWeight() || gIBW;
  const GA = parseFloat(document.getElementById('nGA').value);
  const nc = DS.ncpr || {};
  const out = document.getElementById('nOut');
  if (!w){ if(out) out.textContent = 'กรุณากรอกน้ำหนัก'; return; }

  const conc   = 0.1;
  const epiIVlo= (nc.epiIV_range_min || 0.01) * w;
  const epiIVhi= (nc.epiIV_range_max || 0.03) * w;
  const epiIV  = (nc.epiIV_mgPerKg   || 0.02) * w;
  const epiETT = (nc.epiETT_mgPerKg  || 0.10) * w;
  const repMin = nc.epiIntervalMin_min || 3;
  const repMax = nc.epiIntervalMax_min || 5;
  const flush  = nc.epiFlushMl || 3;

  const blocks = [];
  const S = () => blocks.push('&nbsp;'); // spacer บรรทัดว่างให้เห็นจริง ๆ

  // 💉 Epinephrine (1:10,000)
  blocks.push(`<strong>💉 Epinephrine (1:10,000)</strong>`);
  blocks.push(`• IV/IO : <strong>${epiIV.toFixed(3)} mg</strong> (range <strong>${epiIVlo.toFixed(3)}–${epiIVhi.toFixed(3)} mg</strong>)  ≈ <strong>${(epiIV/conc).toFixed(2)} mL</strong>`);
  blocks.push(`  ↳ NSS flush <strong>${flush}</strong> mL • repeat q <strong>${repMin}–${repMax} min</strong> if HR &lt; 60`);
  blocks.push(`• ETT : <strong>${epiETT.toFixed(3)} mg</strong>  ≈ <strong>${(epiETT/conc).toFixed(2)} mL</strong>  (ใช้เมื่อยังไม่มี IV/IO เท่านั้น)`);
  S();

  // 💧 Volume expander
  const bolusMl = w * (nc.fluidBolus_mlPerKg || 10);
  const over    = nc.fluidBolus_overMin || [5,10];
  blocks.push(`<strong>💧 Volume expander</strong>`);
  blocks.push(`• NS หรือ Gr O Rh neg PRC <strong>${bolusMl.toFixed(0)} mL</strong> over <strong>${over[0]}–${over[1]} min</strong>`);
  S();

  // 🫁 PPV & O₂
  const ppv = nc.ppv || {};
  const o2  = nc.o2  || {};
  const ppvFlow = ppv.flowLpm ?? 10;
  const ppvRateMin = ppv.ratePerMin_min ?? 40;
  const ppvRateMax = ppv.ratePerMin_max ?? 60;
  const ppvPIPmin  = ppv.pip_cmH2O_min ?? 20;
  const ppvPIPmax  = ppv.pip_cmH2O_max ?? 25;
  const ppvPEEP    = ppv.peep_cmH2O ?? 5;
  const maxPIPterm = ppv.maxPIP_term_cmH2O ?? 40;
  const maxPIPpre  = ppv.maxPIP_preterm_cmH2O ?? 30;

  const fiO2 = (GA)
    ? (GA >= (o2.gaCutoffWk || 35) ? (o2.geCutoff_FiO2 || '21%') : (o2.ltCutoff_FiO2 || '21–30%'))
    : null;

  blocks.push(`<strong>🫁 PPV & O₂</strong>`);
  blocks.push(`• Flow <strong>${ppvFlow} L/min</strong>, Rate <strong>${ppvRateMin}-${ppvRateMax}/min</strong>`);
  blocks.push(`• PIP <strong>${ppvPIPmin}-${ppvPIPmax} cmH₂O</strong>, PEEP <strong>${ppvPEEP} cmH₂O</strong>`);
  blocks.push(`• Max PIP : term <strong>${maxPIPterm}</strong> / preterm <strong>${maxPIPpre}</strong> cmH₂O`);
  if (fiO2) blocks.push(`• Initial FiO₂ by GA (<strong>${GA}</strong> wk) : <strong>${fiO2}</strong>`);
  S();

  // 🧪 Neonatal hypoglycemia (แสดงเมื่อมีค่า BG)
  const bgEl = document.getElementById('nBG');
  if (bgEl && bgEl.value){
    const BG  = parseFloat(bgEl.value);
    const hp  = nc.hypoglycemia || {};
    const thr = hp.thresholds || {};
    if (isFinite(BG)){
      if (BG < (thr.symptomatic ?? 40)){
        const bol = (hp.bolusD10_mlPerKg || 2) * w;
        const inf = (hp.infusionD10_mlPerKg_perHr || 3.5) * w;
        blocks.push(`<strong>🧪 Neonatal hypoglycemia</strong>`);
        blocks.push(`• BG <strong>${BG}</strong> mg/dL → D10 <strong>${bol.toFixed(0)} mL</strong> IV bolus`);
        blocks.push(`• then D10 <strong>${inf.toFixed(0)} mL/h</strong> (≈ 3.5 mL/kg/h)`);
        S();
      } else if (BG < (thr.atRisk_lt ?? 25)){
        const bol = (hp.bolusD10_mlPerKg || 2) * w;
        blocks.push(`<strong>🧪 Neonatal hypoglycemia (at risk)</strong>`);
        blocks.push(`• BG <strong>${BG}</strong> mg/dL → D10 <strong>${bol.toFixed(0)} mL</strong> IV bolus + close monitor`);
        S();
      }
    }
  }

  // 🍼 Airway (ถ้ามีข้อมูล)
  const sizeRules = nc.ett?.sizeRules || {};
  function pickSize(list, val){
    if(!Array.isArray(list) || val==null) return null;
    for (const r of list){
      if (r.max!=null && r.min==null && val <= r.max) return r.size;
      if (r.min!=null && r.max!=null && val >= r.min && val <= r.max) return r.size;
      if (r.min!=null && r.max==null && val >= r.min) return r.size;
    }
    return null;
  }
  const sizeW  = pickSize(sizeRules.byWeightKg, w);
  const sizeGA = pickSize(sizeRules.byGAWeeks, GA);
  const ettSize = sizeW ?? sizeGA ?? null;

  function pickDepthByGA(list, ga){
    if(!Array.isArray(list) || ga==null) return null;
    for (const r of list){ if (ga >= r.min && ga <= r.max) return r.depthCm; }
    return null;
  }
  const depth = pickDepthByGA(nc.ett?.depthByGAWeeks, GA);

  let suction = null;
  if (ettSize!=null && Array.isArray(nc.ett?.suctionCatheterF)){
    const row = nc.ett.suctionCatheterF.find(x=>Number(x.ettSize) === Number(ettSize));
    suction = row?.catheter || null;
  }

  if (ettSize || depth || suction){
    blocks.push(`<strong>🍼 Airway</strong>`);
    if (ettSize) blocks.push(`• ETT <strong>${Number(ettSize).toFixed(1)} mm</strong> ID`);
    if (depth)   blocks.push(`• Depth <strong>${Number(depth).toFixed(1)} cm</strong> @ upper lip`);
    if (suction) blocks.push(`• Suction catheter <strong>${suction}</strong>`);
    S();
  }

  // Footer
  blocks.push(`⚠️ ตรวจสอบความถูกต้องตาม NRP guideline ก่อนให้ยา/ทำหัตถการ`);

  // Render
  if (out) out.innerHTML = blocks.join('<br>');
}

// Simple refresh
function hardReload(){
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k=>caches.delete(k))).finally(()=>location.reload());
  } else {
    location.reload();
  }
}
