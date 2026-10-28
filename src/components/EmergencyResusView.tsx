import React, { useState } from 'react';
import { DATASET } from '../data/dataset';
import {
  weightToETTCuffed,
  weightToETTUncuffed,
  weightToDepth,
  suggestBlade,
  fmtMg,
  calcParklandBurn,
  BOLUS_20_CAP_ML,
} from '../utils/clinicalCalculations';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { OrderItem, createOrderId } from './ModalsAndDrawers';

export type ResusTopic =
  | 'pals'
  | 'airway'
  | 'anaphylaxis'
  | 'seizure'
  | 'sepsis'
  | 'ncpr'
  | 'trauma';

interface EmergencyResusViewProps {
  activeSubTab: ResusTopic;
  activeWeight: number | null;
  ageYears: number | null;
  seizureSeconds: number;
  seizureRunning: boolean;
  onToggleSeizureTimer: () => void;
  onResetSeizureTimer: () => void;
  onChangeTopic: (topic: ResusTopic) => void;
  onAddOrder?: (order: OrderItem) => void;
}

export const EmergencyResusView: React.FC<EmergencyResusViewProps> = ({
  activeSubTab,
  activeWeight,
  ageYears,
  seizureSeconds,
  seizureRunning,
  onToggleSeizureTimer,
  onResetSeizureTimer,
  onChangeTopic,
  onAddOrder,
}) => {
  const [ncprWeight, setNcprWeight] = useState<string>('');
  const [burnTBSA, setBurnTBSA] = useState<string>('15');
  const [sepsisResp, setSepsisResp] = useState<number>(0);
  const [sepsisCardio, setSepsisCardio] = useState<number>(0);
  const [sepsisCoag, setSepsisCoag] = useState<number>(0);
  const [sepsisNeuro, setSepsisNeuro] = useState<number>(0);

  const w = activeWeight || 0;
  const effAgeYr = ageYears ?? (w ? (w < 10 ? 0.5 : w < 20 ? 3 : 8) : 1);

  const palsEpiMg = Math.min(1, 0.01 * w).toFixed(2);
  const palsEpiMl = (Math.min(1, 0.01 * w) / 0.1).toFixed(1);
  const anaEpiDose = Math.min(w < 30 ? 0.3 : 0.5, w * 0.01).toFixed(2);
  const sepsisBolusMl = Math.min(BOLUS_20_CAP_ML, Math.round(w * 20));
  const sepsisCefMg = Math.min(2000, Math.round(w * 80));

  const renderOrderButton = (ariaLabel: string, idPrefix: string, module: string, text: string) =>
    onAddOrder ? (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() =>
          onAddOrder({
            id: createOrderId(idPrefix),
            module,
            text,
            timestamp: new Date().toLocaleTimeString('th-TH', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          })
        }
        className="min-h-[28px] px-2.5 py-1 text-[11px] font-bold rounded-md border border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-soft)] hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
        title="Add to Active Patient Order Sheet"
      >
        + Order Sheet
      </button>
    ) : null;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="clinical-card p-4 sm:p-5 space-y-4 sm:space-y-5">
      {/* Simple Topic Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--border)]">
        <label htmlFor="resusTopicSelect" className="text-xs font-bold text-[var(--muted)]">
          Emergency Resuscitation Protocol
        </label>
        <select
          id="resusTopicSelect"
          value={activeSubTab}
          onChange={(e) => onChangeTopic(e.target.value as ResusTopic)}
          className="clinical-input w-full sm:w-80 md:w-96 font-bold"
        >
          <option value="pals">PALS — Pediatric Advanced Life Support</option>
          <option value="airway">Airway &amp; RSI — Intubation</option>
          <option value="anaphylaxis">Anaphylaxis — Acute Allergic Emergency</option>
          <option value="seizure">Status Epilepticus — Seizure Pathway</option>
          <option value="sepsis">Sepsis — Phoenix Score &amp; 1h Bundle</option>
          <option value="ncpr">NCPR — Neonatal Resuscitation (NRP)</option>
          <option value="trauma">Trauma &amp; Burns — Parkland Resuscitation</option>
        </select>
      </div>

      {!w && activeSubTab !== 'ncpr' ? (
        <div className="clinical-panel-subtle p-5 sm:p-6 text-center text-sm text-[var(--muted)]">
          Enter patient Weight (BW) above to calculate emergency resuscitation doses
        </div>
      ) : (
        <>
          {/* 1. PALS */}
          {activeSubTab === 'pals' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="clinical-panel-subtle p-4">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="text-xs font-semibold text-[var(--muted)]">
                      Epinephrine Arrest (1:10,000)
                    </div>
                    {renderOrderButton(
                      'Add Epinephrine arrest dose to Order Sheet',
                      'resus-pals-epi',
                      'Emergency Resus (PALS)',
                      `Epinephrine (1:10,000) ${palsEpiMg} mg (${palsEpiMl} mL) IV/IO push q 3–5 min during cardiac arrest`
                    )}
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--danger-text)] mt-1 flex flex-wrap items-baseline gap-1.5">
                    <span>{palsEpiMg} mg</span>
                    <span className="text-sm font-bold whitespace-nowrap">
                      ({palsEpiMl} mL IV)
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">0.01 mg/kg q 3–5 min</div>
                </div>

                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Defibrillation (VF / pVT)
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                    {Math.min(200, Math.round(2 * w))} J → {Math.min(200, Math.round(4 * w))} J
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    1st shock: 2 J/kg · 2nd shock: 4 J/kg
                  </div>
                </div>

                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Endotracheal Tube (Cuffed ETT)
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--accent-text)] mt-1">
                    {weightToETTCuffed(w)} mm
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    Depth {weightToDepth(w)} cm · Blade {suggestBlade(w)}
                  </div>
                </div>
              </div>

              <div
                className="clinical-table-container"
                tabIndex={0}
                role="region"
                aria-label="PALS medication reference table"
              >
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>PALS Medication</th>
                      <th>Calculated Dose ({w.toFixed(1)} kg)</th>
                      <th>Administration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-bold whitespace-nowrap">Amiodarone (VF/pVT)</td>
                      <td className="font-mono-tabular font-bold text-[var(--accent-text)] whitespace-nowrap">
                        {Math.min(300, 5 * w).toFixed(0)} mg ({(Math.min(300, 5 * w) / 50).toFixed(1)} mL)
                      </td>
                      <td className="text-xs text-[var(--muted)]">5 mg/kg IV/IO bolus (Max 300 mg)</td>
                    </tr>
                    <tr>
                      <td className="font-bold whitespace-nowrap">Lidocaine (VF/pVT)</td>
                      <td className="font-mono-tabular font-bold text-[var(--accent-text)] whitespace-nowrap">
                        {Math.min(100, 1 * w).toFixed(0)} mg
                      </td>
                      <td className="text-xs text-[var(--muted)]">1 mg/kg IV/IO bolus</td>
                    </tr>
                    <tr>
                      <td className="font-bold whitespace-nowrap">Adenosine (SVT)</td>
                      <td className="font-mono-tabular font-bold text-[var(--accent-text)] whitespace-nowrap">
                        1st: {Math.min(6, 0.1 * w).toFixed(2)} mg → 2nd:{' '}
                        {Math.min(12, 0.2 * w).toFixed(2)} mg
                      </td>
                      <td className="text-xs text-[var(--muted)]">
                        Rapid IV push + immediate NSS flush (3 mg/mL)
                      </td>
                    </tr>
                    <tr>
                      <td className="font-bold whitespace-nowrap">Atropine (Bradycardia)</td>
                      <td className="font-mono-tabular font-bold text-[var(--accent-text)] whitespace-nowrap">
                        {Math.min(0.5, Math.max(0.1, 0.02 * w)).toFixed(2)} mg
                      </td>
                      <td className="text-xs text-[var(--muted)]">
                        0.02 mg/kg IV/IO (Min 0.1 mg, Max 0.5 mg)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. AIRWAY & RSI */}
          {activeSubTab === 'airway' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="clinical-panel-subtle p-3.5">
                  <div className="text-xs text-[var(--muted)]">Cuffed ETT</div>
                  <div className="text-lg sm:text-xl font-extrabold font-mono-tabular text-[var(--accent-text)] mt-0.5">
                    {weightToETTCuffed(w)} mm
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Uncuffed: {weightToETTUncuffed(w)} mm
                  </div>
                </div>
                <div className="clinical-panel-subtle p-3.5">
                  <div className="text-xs text-[var(--muted)]">Oral Depth at Lip</div>
                  <div className="text-lg sm:text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-0.5">
                    {weightToDepth(w)} cm
                  </div>
                </div>
                <div className="clinical-panel-subtle p-3.5">
                  <div className="text-xs text-[var(--muted)]">Ketamine (Induction)</div>
                  <div className="text-lg sm:text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-0.5">
                    {Math.min(100, w * 1.5).toFixed(0)} mg IV
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">1.5 mg/kg (50 mg/mL)</div>
                </div>
                <div className="clinical-panel-subtle p-3.5">
                  <div className="text-xs text-[var(--muted)]">Rocuronium (Paralytic)</div>
                  <div className="text-lg sm:text-xl font-extrabold font-mono-tabular text-[var(--danger-text)] mt-0.5">
                    {Math.min(100, w * 1.0).toFixed(1)} mg IV
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">1.0 mg/kg (10 mg/mL)</div>
                </div>
              </div>

              <div
                className="clinical-table-container"
                tabIndex={0}
                role="region"
                aria-label="RSI medication reference table"
              >
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>RSI Agent</th>
                      <th>Calculated Dose ({w.toFixed(1)} kg)</th>
                      <th>Concentration / Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-bold whitespace-nowrap">Midazolam</td>
                      <td className="font-mono-tabular font-bold text-[var(--accent-text)] whitespace-nowrap">
                        {Math.min(10, w * 0.2).toFixed(1)} mg IV
                      </td>
                      <td className="text-xs text-[var(--muted)]">0.2 mg/kg (5 mg/mL)</td>
                    </tr>
                    <tr>
                      <td className="font-bold whitespace-nowrap">Etomidate</td>
                      <td className="font-mono-tabular font-bold text-[var(--accent-text)] whitespace-nowrap">
                        {Math.min(20, w * 0.3).toFixed(1)} mg IV
                      </td>
                      <td className="text-xs text-[var(--muted)]">0.3 mg/kg (2 mg/mL)</td>
                    </tr>
                    <tr>
                      <td className="font-bold whitespace-nowrap">Succinylcholine</td>
                      <td className="font-mono-tabular font-bold text-[var(--accent-text)] whitespace-nowrap">
                        {Math.min(150, w * (effAgeYr < 1 ? 2.0 : 1.5)).toFixed(1)} mg IV
                      </td>
                      <td className="text-xs text-[var(--muted)]">1.5–2.0 mg/kg (50 mg/mL)</td>
                    </tr>
                    <tr>
                      <td className="font-bold text-[var(--danger-text)] whitespace-nowrap">
                        Sugammadex (CICO Rescue)
                      </td>
                      <td className="font-mono-tabular font-bold text-[var(--danger-text)] whitespace-nowrap">
                        {Math.min(1500, w * 16).toFixed(0)} mg IV
                      </td>
                      <td className="text-xs text-[var(--muted)]">
                        16 mg/kg immediate Rocuronium reversal (100 mg/mL)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. ANAPHYLAXIS */}
          {activeSubTab === 'anaphylaxis' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="clinical-panel-subtle p-4">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    1st-Line: Epinephrine 1:1,000 IM
                  </div>
                  {renderOrderButton(
                    'Add Anaphylaxis Epinephrine IM dose to Order Sheet',
                    'resus-ana-epi',
                    'Emergency Resus (Anaphylaxis)',
                    `Epinephrine (1:1,000) ${anaEpiDose} mg (${anaEpiDose} mL) IM anterolateral thigh stat q 5–15 min PRN`
                  )}
                </div>
                <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--danger-text)] mt-1">
                  {anaEpiDose} mg{' '}
                  <span className="text-sm font-bold whitespace-nowrap">
                    ({anaEpiDose} mL)
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  IM anterolateral thigh q 5–15 min PRN
                </div>
              </div>

              <div className="clinical-panel-subtle p-4">
                <div className="text-xs font-semibold text-[var(--muted)]">
                  Antihistamine (H1 / H2)
                </div>
                <div className="text-lg font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                  CPM {(w * 0.25).toFixed(1)} mg IV
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  Or Diphenhydramine {Math.min(50, w * 1).toFixed(0)} mg IV
                </div>
              </div>

              <div className="clinical-panel-subtle p-4">
                <div className="text-xs font-semibold text-[var(--muted)]">
                  Steroid &amp; Fluid Bolus
                </div>
                <div className="text-lg font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                  Methylpred {Math.min(60, w * 1.5).toFixed(0)} mg IV
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  NSS Bolus: {Math.min(BOLUS_20_CAP_ML, Math.round(w * 20))} mL (20 mL/kg)
                </div>
              </div>
            </div>
          )}

          {/* 4. SEIZURE */}
          {activeSubTab === 'seizure' && (
            <div className="space-y-4">
              <div className="clinical-panel-subtle p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[var(--ink)]">
                    Seizure Resuscitation Stopwatch
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    0–5m Stabilization · 5–10m 1st-Line BZD · 10–20m 2nd-Line ASM
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]">
                  <span className="text-xl font-extrabold font-mono-tabular text-[var(--accent-text)] px-2">
                    {formatTimer(seizureSeconds)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onToggleSeizureTimer}
                      className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-md bg-[var(--accent)] text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {seizureRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{seizureRunning ? 'Pause' : 'Start'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onResetSeizureTimer}
                      className="min-h-[36px] min-w-[36px] p-2 rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--ink)] flex items-center justify-center cursor-pointer"
                      title="Reset timer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div
                className="clinical-table-container"
                tabIndex={0}
                role="region"
                aria-label="Seizure medication reference table"
              >
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>Stage / Anticonvulsant</th>
                      <th>Calculated Dose ({w.toFixed(1)} kg)</th>
                      <th>Administration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DATASET.seizureProtocol.flatMap((st) =>
                      (st.drugs || []).map((d) => {
                        const raw = (d.doseMgPerKg || 0) * w;
                        const dose = d.maxDoseMg && raw > d.maxDoseMg ? d.maxDoseMg : raw;
                        return (
                          <tr key={d.key}>
                            <td>
                              <span className="text-[11px] font-bold text-[var(--accent-text)] block">
                                {st.stage}
                              </span>
                              <strong>{d.name}</strong>
                            </td>
                            <td className="font-mono-tabular font-bold text-[var(--ink)] whitespace-nowrap">
                              {fmtMg(dose)} mg
                            </td>
                            <td className="text-xs text-[var(--muted)]">
                              {d.route} · {d.prep}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. SEPSIS */}
          {activeSubTab === 'sepsis' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="font-bold text-[var(--muted)] block mb-1.5">1. Respiratory</label>
                  <select
                    value={sepsisResp}
                    onChange={(e) => setSepsisResp(parseInt(e.target.value, 10))}
                    className="clinical-input w-full text-xs font-bold"
                  >
                    <option value={0}>0: Normal</option>
                    <option value={1}>1: HFNC/CPAP</option>
                    <option value={2}>2: Intubated (Mod)</option>
                    <option value={3}>3: Intubated (Sev)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[var(--muted)] block mb-1.5">2. Cardiovascular</label>
                  <select
                    value={sepsisCardio}
                    onChange={(e) => setSepsisCardio(parseInt(e.target.value, 10))}
                    className="clinical-input w-full text-xs font-bold"
                  >
                    <option value={0}>0: Normal</option>
                    <option value={1}>1: 1 Vasoactive</option>
                    <option value={2}>2: Low MAP / Lactate ≥ 5</option>
                    <option value={4}>4: Lactate ≥ 11</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[var(--muted)] block mb-1.5">3. Coagulation</label>
                  <select
                    value={sepsisCoag}
                    onChange={(e) => setSepsisCoag(parseInt(e.target.value, 10))}
                    className="clinical-input w-full text-xs font-bold"
                  >
                    <option value={0}>0: Normal</option>
                    <option value={1}>1: Plt &lt; 100k / INR &gt; 1.6</option>
                    <option value={2}>2: Plt &lt; 50k</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[var(--muted)] block mb-1.5">4. Neurological</label>
                  <select
                    value={sepsisNeuro}
                    onChange={(e) => setSepsisNeuro(parseInt(e.target.value, 10))}
                    className="clinical-input w-full text-xs font-bold"
                  >
                    <option value={0}>0: GCS 15</option>
                    <option value={1}>1: GCS 11–14</option>
                    <option value={2}>2: GCS ≤ 10</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Phoenix Sepsis Score
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                    {sepsisResp + sepsisCardio + sepsisCoag + sepsisNeuro} pts
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {sepsisResp + sepsisCardio + sepsisCoag + sepsisNeuro >= 2
                      ? '▲ Sepsis Criteria Met (≥ 2 pts)'
                      : '✓ Score < 2 pts'}
                  </div>
                </div>
                <div className="clinical-panel-subtle p-4">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="text-xs font-semibold text-[var(--muted)]">
                      1st Fluid Bolus (20 mL/kg)
                    </div>
                    {renderOrderButton(
                      'Add Sepsis 1st fluid bolus to Order Sheet',
                      'resus-sepsis-bolus',
                      'Emergency Resus (Sepsis)',
                      `0.9% NSS ${sepsisBolusMl} mL IV bolus over 15 min (Phoenix Sepsis 1h bundle)`
                    )}
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--accent-text)] mt-1">
                    {sepsisBolusMl} mL
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">0.9% NS over 15 min</div>
                </div>
                <div className="clinical-panel-subtle p-4">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="text-xs font-semibold text-[var(--muted)]">
                      IV Ceftriaxone (80 mg/kg)
                    </div>
                    {renderOrderButton(
                      'Add IV Ceftriaxone sepsis dose to Order Sheet',
                      'resus-sepsis-cef',
                      'Emergency Resus (Sepsis)',
                      `Ceftriaxone ${sepsisCefMg} mg IV stat (Give within 1st hour for sepsis)`
                    )}
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                    {sepsisCefMg} mg
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">Give within 1st hour</div>
                </div>
              </div>
            </div>
          )}

          {/* 6. NCPR */}
          {activeSubTab === 'ncpr' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-bold text-[var(--muted)]">
                  Birth Weight (kg):
                </label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder={w ? String(w) : '3.0'}
                  value={ncprWeight}
                  onChange={(e) => setNcprWeight(e.target.value)}
                  className="clinical-input w-28 font-mono-tabular font-bold"
                />
              </div>
              {(() => {
                const bw = parseFloat(ncprWeight) || w || 3.0;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="clinical-panel-subtle p-4">
                      <div className="text-xs font-semibold text-[var(--muted)]">
                        Epinephrine IV/UVC (1:10,000)
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--danger-text)] mt-1">
                        {(0.02 * bw).toFixed(3)} mg ({((0.02 * bw) / 0.1).toFixed(2)} mL)
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        0.02 mg/kg + 3 mL NSS flush
                      </div>
                    </div>
                    <div className="clinical-panel-subtle p-4">
                      <div className="text-xs font-semibold text-[var(--muted)]">
                        Volume Expander (10 mL/kg)
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                        {(10 * bw).toFixed(0)} mL
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">0.9% NS over 5–10 min</div>
                    </div>
                    <div className="clinical-panel-subtle p-4">
                      <div className="text-xs font-semibold text-[var(--muted)]">
                        D10W Bolus (Hypoglycemia)
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--accent-text)] mt-1">
                        {(2 * bw).toFixed(1)} mL IV
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        Follow with {(3.5 * bw).toFixed(1)} mL/hr
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 7. TRAUMA & BURNS */}
          {activeSubTab === 'trauma' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-bold text-[var(--muted)]">
                  Burn Surface Area (%TBSA):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  inputMode="decimal"
                  value={burnTBSA}
                  onChange={(e) => setBurnTBSA(e.target.value)}
                  className="clinical-input w-24 font-mono-tabular font-bold"
                />
              </div>
              {(() => {
                const burn = calcParklandBurn(w, parseFloat(burnTBSA) || 0, 0);
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="clinical-panel-subtle p-4">
                      <div className="text-xs font-semibold text-[var(--muted)]">
                        First 8 Hours (LRS Rate)
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--accent-text)] mt-1">
                        {burn.rateFirst8h} mL/hr
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        + Maintenance {burn.maintRate} mL/hr
                      </div>
                    </div>
                    <div className="clinical-panel-subtle p-4">
                      <div className="text-xs font-semibold text-[var(--muted)]">
                        Next 16 Hours (LRS Rate)
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                        {burn.rateNext16h} mL/hr
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        Total 24h Parkland: {burn.total24h} mL
                      </div>
                    </div>
                    <div className="clinical-panel-subtle p-4">
                      <div className="text-xs font-semibold text-[var(--muted)]">
                        Estimated Blood Volume
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--danger-text)] mt-1">
                        {Math.round(w * 75)} mL
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        Target Urine Output ≥ {burn.targetUO} mL/hr
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
};
