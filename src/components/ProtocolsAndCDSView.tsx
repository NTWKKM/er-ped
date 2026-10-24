import React, { useState } from 'react';
import { DATASET } from '../data/dataset';
import {
  calcMaintenanceMlPerHr,
  calcCorrectedNa,
  calcCorrectedCa,
  calcKShift,
  calcIVKClReplacement,
  fmtMg,
} from '../utils/clinicalCalculations';
import { OrderItem, createOrderId } from './ModalsAndDrawers';

export type ProtocolTopic =
  | 'asthma'
  | 'dka'
  | 'electrolytes'
  | 'croup'
  | 'psa'
  | 'tox'
  | 'vitals';

interface ProtocolsAndCDSViewProps {
  activeSubTab: ProtocolTopic;
  activeWeight: number | null;
  ageYears: number | null;
  onChangeTopic: (topic: ProtocolTopic) => void;
  onAddOrder?: (order: OrderItem) => void;
  onInvalidateOrders?: (targetPrefix?: string) => void;
  dkaSeverity?: number;
  onChangeDkaSeverity?: (severity: number) => void;
  dkaPriorBolus?: string;
  onChangeDkaPriorBolus?: (bolus: string) => void;
}

export const ProtocolsAndCDSView: React.FC<ProtocolsAndCDSViewProps> = ({
  activeSubTab,
  activeWeight,
  ageYears,
  onChangeTopic,
  onAddOrder,
  onInvalidateOrders,
  dkaSeverity,
  onChangeDkaSeverity,
  dkaPriorBolus,
  onChangeDkaPriorBolus,
}) => {
  const [internalDkaSeverity, setInternalDkaSeverity] = useState<number>(7);
  const [internalDkaPriorBolus, setInternalDkaPriorBolus] = useState<string>('0');

  const currentDkaSeverity = dkaSeverity ?? internalDkaSeverity;
  const currentDkaPriorBolus = dkaPriorBolus ?? internalDkaPriorBolus;

  const handleDkaSeverityChange = (val: number) => {
    onInvalidateOrders?.('proto-dka-fluid');
    if (onChangeDkaSeverity) {
      onChangeDkaSeverity(val);
    } else {
      setInternalDkaSeverity(val);
    }
  };

  const handleDkaPriorBolusChange = (val: string) => {
    onInvalidateOrders?.('proto-dka-fluid');
    if (onChangeDkaPriorBolus) {
      onChangeDkaPriorBolus(val);
    } else {
      setInternalDkaPriorBolus(val);
    }
  };

  const [lyteNa, setLyteNa] = useState<string>('130');
  const [lyteGlucose, setLyteGlucose] = useState<string>('350');
  const [lyteTotalCa, setLyteTotalCa] = useState<string>('7.4');
  const [lyteAlbumin, setLyteAlbumin] = useState<string>('2.5');
  const [lyteK, setLyteK] = useState<string>('3.2');
  const [lytePH, setLytePH] = useState<string>('7.15');

  const w = activeWeight || 0;
  const effAgeYr = ageYears ?? 0;

  return (
    <div className="clinical-card p-5 space-y-5">
      {/* Simple Protocol Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
        <label htmlFor="protocolTopicSelect" className="text-xs font-bold text-[var(--muted)]">
          Clinical Protocol &amp; Reference
        </label>
        <select
          id="protocolTopicSelect"
          value={activeSubTab}
          onChange={(e) => onChangeTopic(e.target.value as ProtocolTopic)}
          className="clinical-input sm:w-80 font-bold"
        >
          <option value="asthma">Asthma — Acute Exacerbation &amp; HFNC</option>
          <option value="dka">DKA — Diabetic Ketoacidosis</option>
          <option value="electrolytes">Electrolytes — Imbalance Correctors</option>
          <option value="croup">Croup — Stridor &amp; Airway Edema</option>
          <option value="psa">Sedation (PSA) — Procedural Sedation</option>
          <option value="tox">Toxicology — Antidotes &amp; Overdose</option>
          <option value="vitals">Vital Signs — Normal Ranges by Age</option>
        </select>
      </div>

      {/* 1. ASTHMA */}
      {activeSubTab === 'asthma' && (
        !w ? (
          <div className="clinical-panel-subtle p-6 text-center text-sm text-[var(--muted)]">
            Enter patient Weight (BW) above to calculate acute asthma and HFNC settings
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="clinical-panel-subtle p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Salbutamol Nebulizer
                  </div>
                  {onAddOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        const nebDose = w < 20 ? '2.5 mg' : '5.0 mg';
                        const ipraDose = w < 20 ? '250 mcg' : '500 mcg';
                        onAddOrder({
                          id: createOrderId('proto-asthma-neb'),
                          module: 'Protocol (Asthma)',
                          text: `Salbutamol Nebulizer ${nebDose} + Ipratropium ${ipraDose} neb q 20 min × 3 doses`,
                          timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                        });
                      }}
                      className="px-2 py-0.5 text-[11px] font-bold rounded border border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-soft)] hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer shrink-0"
                      title="Add to Active Patient Order Sheet"
                    >
                      + Order Sheet
                    </button>
                  )}
                </div>
                <div className="text-2xl font-extrabold font-mono-tabular text-[var(--accent-text)] mt-1">
                  {w < 20 ? '2.5 mg' : '5.0 mg'}
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  q 20 min × 3 doses (+ Ipratropium {w < 20 ? '250' : '500'} mcg)
                </div>
              </div>

              <div className="clinical-panel-subtle p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Systemic Corticosteroid
                  </div>
                  {onAddOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        const predDose = Math.min(60, Math.round(w * 1.5));
                        const dexaDose = Math.min(16, +(w * 0.6).toFixed(1));
                        onAddOrder({
                          id: createOrderId('proto-asthma-steroid'),
                          module: 'Protocol (Asthma)',
                          text: `Prednisolone ${predDose} mg PO stat (or Dexamethasone ${dexaDose} mg PO/IV stat)`,
                          timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                        });
                      }}
                      className="px-2 py-0.5 text-[11px] font-bold rounded border border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-soft)] hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer shrink-0"
                      title="Add to Active Patient Order Sheet"
                    >
                      + Order Sheet
                    </button>
                  )}
                </div>
                <div className="text-2xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                  Pred {Math.min(60, Math.round(w * 1.5))} mg PO
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  Or Dexamethasone {Math.min(16, +(w * 0.6).toFixed(1))} mg PO/IV
                </div>
              </div>

              <div className="clinical-panel-subtle p-4">
                <div className="text-xs font-semibold text-[var(--muted)]">
                  HFNC Flow &amp; IV MgSO4
                </div>
                <div className="text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                  HFNC {Math.min(60, Math.round(w * 2))} L/min
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  IV MgSO4 (50 mg/kg): {Math.min(2000, Math.round(w * 50))} mg over 20 min
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* 2. DKA */}
      {activeSubTab === 'dka' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[var(--muted)] block mb-1">
                Dehydration Severity (% Deficit)
              </label>
              <select
                value={currentDkaSeverity}
                onChange={(e) => handleDkaSeverityChange(parseInt(e.target.value, 10))}
                className="clinical-input w-full font-bold"
              >
                <option value={5}>Mild DKA (5%)</option>
                <option value={7}>Moderate DKA (7%)</option>
                <option value={10}>Severe DKA (10%)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--muted)] block mb-1">
                Prior Fluid Boluses Given (mL)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={currentDkaPriorBolus}
                onChange={(e) => handleDkaPriorBolusChange(e.target.value)}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
          </div>

          {!w ? (
            <div className="clinical-panel-subtle p-6 text-center text-sm text-[var(--muted)]">
              Enter patient Weight (BW) above to calculate DKA fluid and insulin rates
            </div>
          ) : (
            (() => {
              const rawPriorBolus = parseFloat(currentDkaPriorBolus);
              const isValidPriorBolus =
                currentDkaPriorBolus.trim() !== '' &&
                Number.isFinite(rawPriorBolus) &&
                rawPriorBolus >= 0;
              const priorBolusVal = isValidPriorBolus ? rawPriorBolus : 0;
              const netDef = Math.max(0, w * currentDkaSeverity * 10 - priorBolusVal);
              const mnt = calcMaintenanceMlPerHr(w);
              const totalRate = +(mnt + netDef / 48).toFixed(1);
              const riRate = +(w * 0.1).toFixed(1);
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="clinical-panel-subtle p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-[var(--muted)]">
                        Combined IV Fluid Rate (48h Rehydration)
                      </div>
                      {onAddOrder && isValidPriorBolus && (
                        <button
                          type="button"
                          onClick={() => {
                            onAddOrder({
                              id: createOrderId('proto-dka-fluid'),
                              module: 'Protocol (DKA)',
                              text: `DKA IV Rehydration Fluid @ ${totalRate} mL/hr over 48h (Mnt ${mnt} + Deficit ${(netDef / 48).toFixed(1)} mL/hr, add D5W when BG < 250)`,
                              timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                            });
                          }}
                          className="px-2 py-0.5 text-[11px] font-bold rounded border border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-soft)] hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer shrink-0"
                          title="Add to Active Patient Order Sheet"
                        >
                          + Order Sheet
                        </button>
                      )}
                    </div>
                    {isValidPriorBolus ? (
                      <>
                        <div className="text-2xl font-extrabold font-mono-tabular text-[var(--good-text)] mt-1">
                          {totalRate} mL/hr
                        </div>
                        <div className="text-xs text-[var(--muted)] mt-1">
                          Mnt {mnt} + Deficit {(netDef / 48).toFixed(1)} mL/hr (Add D5W when BG &lt; 250)
                        </div>
                      </>
                    ) : (
                      <div className="text-xs font-bold text-[var(--danger-text)] mt-2">
                        ▲ Enter a valid non-negative fluid bolus (≥ 0 mL)
                      </div>
                    )}
                  </div>
                  <div className="clinical-panel-subtle p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-[var(--muted)]">
                        Regular Insulin Drip (0.1 U/kg/hr)
                      </div>
                      {onAddOrder && (
                        <button
                          type="button"
                          onClick={() => {
                            onAddOrder({
                              id: createOrderId('proto-dka-ri'),
                              module: 'Protocol (DKA)',
                              text: `Regular Insulin Drip @ ${riRate} U/hr (${riRate} mL/hr) IV via Syringe Pump (Mix 50 U RI in 50 mL 0.9% NSS)`,
                              timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                            });
                          }}
                          className="px-2 py-0.5 text-[11px] font-bold rounded border border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-soft)] hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer shrink-0"
                          title="Add to Active Patient Order Sheet"
                        >
                          + Order Sheet
                        </button>
                      )}
                    </div>
                    <div className="text-2xl font-extrabold font-mono-tabular text-[var(--accent-text)] mt-1">
                      {riRate} U/hr ({riRate} mL/hr)
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      Mix 50 U in 50 mL 0.9% NS (Start 1–2h after fluid hydration)
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* 3. ELECTROLYTES */}
      {activeSubTab === 'electrolytes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
            <div>
              <label className="font-bold text-[var(--muted)] block mb-1">Measured Na</label>
              <input
                type="number"
                value={lyteNa}
                onChange={(e) => setLyteNa(e.target.value)}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-[var(--muted)] block mb-1">Glucose</label>
              <input
                type="number"
                value={lyteGlucose}
                onChange={(e) => setLyteGlucose(e.target.value)}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-[var(--muted)] block mb-1">Total Ca</label>
              <input
                type="number"
                step="0.1"
                value={lyteTotalCa}
                onChange={(e) => setLyteTotalCa(e.target.value)}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-[var(--muted)] block mb-1">Albumin</label>
              <input
                type="number"
                step="0.1"
                value={lyteAlbumin}
                onChange={(e) => setLyteAlbumin(e.target.value)}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-[var(--muted)] block mb-1">Serum K+</label>
              <input
                type="number"
                step="0.1"
                value={lyteK}
                onChange={(e) => setLyteK(e.target.value)}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-[var(--muted)] block mb-1">Blood pH</label>
              <input
                type="number"
                step="0.01"
                value={lytePH}
                onChange={(e) => setLytePH(e.target.value)}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="clinical-panel-subtle p-3.5">
              <div className="text-xs text-[var(--muted)]">Corrected Na (Katz / ISPAD)</div>
              <div className="text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-0.5">
                {calcCorrectedNa(parseFloat(lyteNa), parseFloat(lyteGlucose), 'katz')?.toFixed(1) || '—'}{' '}
                / {calcCorrectedNa(parseFloat(lyteNa), parseFloat(lyteGlucose), 'ispad')?.toFixed(1) || '—'} mEq/L
              </div>
            </div>
            <div className="clinical-panel-subtle p-3.5">
              <div className="text-xs text-[var(--muted)]">Corrected Calcium (Payne)</div>
              <div className="text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-0.5">
                {calcCorrectedCa(parseFloat(lyteTotalCa), parseFloat(lyteAlbumin))?.toFixed(1) || '—'} mg/dL
              </div>
            </div>
            <div className="clinical-panel-subtle p-3.5">
              <div className="text-xs text-[var(--muted)]">Estimated K+ at pH 7.40</div>
              <div className="text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-0.5">
                {calcKShift(parseFloat(lyteK), parseFloat(lytePH))?.toFixed(1) || '—'} mEq/L
              </div>
            </div>
          </div>

          {w > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="clinical-panel-subtle p-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    3% NaCl Bolus (Hyponatremic Seizure)
                  </div>
                  {onAddOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        const lowVol = Math.min(w * 3, 100).toFixed(0);
                        const highVol = Math.min(w * 5, 150).toFixed(0);
                        onAddOrder({
                          id: createOrderId('proto-lyte-3nacl'),
                          module: 'Protocol (Electrolytes)',
                          text: `3% NaCl ${lowVol}–${highVol} mL IV over 20 min for acute symptomatic hyponatremia/seizure`,
                          timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                        });
                      }}
                      className="px-2 py-0.5 text-[11px] font-bold rounded border border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-soft)] hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer shrink-0"
                      title="Add to Active Patient Order Sheet"
                    >
                      + Order Sheet
                    </button>
                  )}
                </div>
                <div className="text-lg font-extrabold font-mono-tabular text-[var(--danger-text)] mt-0.5">
                  {Math.min(w * 3, 100).toFixed(0)}–{Math.min(w * 5, 150).toFixed(0)} mL IV over 20 min
                </div>
              </div>
              {(() => {
                const kcl = calcIVKClReplacement(w, 0.5);
                return (
                  kcl && (
                    <div className="clinical-panel-subtle p-3.5">
                      <div className="text-xs font-semibold text-[var(--muted)]">
                        IV KCl Slow Piggyback (0.5 mEq/kg)
                      </div>
                      <div className="text-lg font-extrabold font-mono-tabular text-[var(--warning-text)] mt-0.5">
                        KCl {kcl.doseMeq} mEq in ≥ {kcl.minVolPeripheralMl} mL NSS over 2 hr
                      </div>
                    </div>
                  )
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* 4. CROUP */}
      {activeSubTab === 'croup' && (
        !w ? (
          <div className="clinical-panel-subtle p-6 text-center text-sm text-[var(--muted)]">
            Enter patient Weight (BW) above to calculate Croup medications
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="clinical-panel-subtle p-4">
              <div className="text-xs font-semibold text-[var(--muted)]">
                Dexamethasone (0.6 mg/kg Single Dose)
              </div>
              <div className="text-2xl font-extrabold font-mono-tabular text-[var(--good-text)] mt-1">
                {Math.min(16, +(w * 0.6).toFixed(1))} mg PO/IV/IM
              </div>
              <div className="text-xs text-[var(--muted)] mt-1">
                Injection (4 mg/mL): {(Math.min(16, w * 0.6) / 4).toFixed(2)} mL (Max 16 mg)
              </div>
            </div>
            <div className="clinical-panel-subtle p-4">
              <div className="text-xs font-semibold text-[var(--muted)]">
                Nebulized L-Epinephrine (1:1,000)
              </div>
              <div className="text-2xl font-extrabold font-mono-tabular text-[var(--accent-text)] mt-1">
                {Math.min(5, +(w * 0.5).toFixed(1))} mL Nebulized
              </div>
              <div className="text-xs text-[var(--muted)] mt-1">
                0.5 mL/kg (Max 5 mL) · Observe 2–4 hr for rebound stridor
              </div>
            </div>
          </div>
        )
      )}

      {/* 5. SEDATION (PSA) */}
      {activeSubTab === 'psa' && (
        !w ? (
          <div className="clinical-panel-subtle p-6 text-center text-sm text-[var(--muted)]">
            Enter patient Weight (BW) above to calculate PSA doses
          </div>
        ) : (
          <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Sedation / Analgesia Agent</th>
                  <th>Calculated Dose ({w.toFixed(1)} kg)</th>
                  <th>Route &amp; Preparation</th>
                </tr>
              </thead>
              <tbody>
                {DATASET.proceduralSedation.map((item: any) => {
                  const isMcg = item.unit === 'mcg' || item.doseMinMcgPerKg != null;
                  let minD = isMcg
                    ? (item.doseMinMcgPerKg ?? (item.doseMinMgPerKg || 0) * 1000) * w
                    : (item.doseMinMgPerKg || 0) * w;
                  let maxD = isMcg
                    ? (item.doseMaxMcgPerKg ?? (item.doseMaxMgPerKg || 0) * 1000) * w
                    : (item.doseMaxMgPerKg || 0) * w;
                  const cap = isMcg ? item.maxPerDoseMcg : item.maxPerDoseMg;
                  if (cap) {
                    minD = Math.min(minD, cap);
                    maxD = Math.min(maxD, cap);
                  }
                  const u = isMcg ? 'mcg' : 'mg';
                  return (
                    <tr key={item.key}>
                      <td className="font-bold">{item.name}</td>
                      <td className="font-mono-tabular font-bold text-[var(--accent-text)]">
                        {minD === maxD ? `${fmtMg(minD)} ${u}` : `${fmtMg(minD)}–${fmtMg(maxD)} ${u}`}
                      </td>
                      <td className="text-xs text-[var(--muted)]">
                        {item.route} · {item.prep}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* 6. TOXICOLOGY */}
      {activeSubTab === 'tox' && (
        !w ? (
          <div className="clinical-panel-subtle p-6 text-center text-sm text-[var(--muted)]">
            Enter patient Weight (BW) above to calculate antidote doses
          </div>
        ) : (
          <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Antidote</th>
                  <th>Calculated Dose ({w.toFixed(1)} kg)</th>
                  <th>Indication &amp; Route</th>
                </tr>
              </thead>
              <tbody>
                {DATASET.toxicologyAntidotes.map((item: any) => {
                  const raw = (item.doseMgPerKg || 0) * w;
                  const finalDose = item.maxDoseMg && raw > item.maxDoseMg ? item.maxDoseMg : raw;
                  const unitStr = item.unit === 'g/kg' ? 'g' : 'mg';
                  return (
                    <tr key={item.key}>
                      <td className="font-bold">{item.name}</td>
                      <td className="font-mono-tabular font-bold text-[var(--accent-text)]">
                        {fmtMg(finalDose)} {unitStr}
                      </td>
                      <td className="text-xs text-[var(--muted)]">
                        {item.indication} ({item.route})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* 7. VITAL SIGNS */}
      {activeSubTab === 'vitals' && (
        <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Age Group</th>
                <th>HR (bpm)</th>
                <th>RR (/min)</th>
                <th>Systolic BP</th>
                <th>Hypotension SBP Cutoff</th>
              </tr>
            </thead>
            <tbody>
              {DATASET.vitalSignsRef.map((v) => {
                const isCur = effAgeYr >= v.minAgeYr && effAgeYr < v.maxAgeYr;
                return (
                  <tr
                    key={v.ageBracket}
                    className={isCur ? 'bg-[var(--accent-soft)] font-bold' : ''}
                  >
                    <td>
                      {isCur ? '▶ ' : ''}
                      {v.ageBracket}
                    </td>
                    <td className="font-mono-tabular">{v.hrNormal}</td>
                    <td className="font-mono-tabular">{v.rrNormal}</td>
                    <td className="font-mono-tabular">{v.sysBpNormal}</td>
                    <td className="font-mono-tabular font-bold text-[var(--danger-text)]">
                      {v.hypotensionSysBp}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
