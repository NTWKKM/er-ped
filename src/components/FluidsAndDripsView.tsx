import React, { useState } from 'react';
import { DATASET } from '../data/dataset';
import {
  calcMaintenanceMlPerHr,
  calcMaintenanceMlPerDay,
  calcDripForward,
  calcDripReverse,
  calcTransfusion,
} from '../utils/clinicalCalculations';
import { AlertTriangle } from 'lucide-react';
import { OrderItem, createOrderId } from './ModalsAndDrawers';

interface FluidsAndDripsViewProps {
  activeSubTab: 'fluids' | 'drip' | 'transfusion';
  activeWeight: number | null;
  onChangeSubTab: (sub: 'fluids' | 'drip' | 'transfusion') => void;
  onAddOrder?: (order: OrderItem) => void;
  onInvalidateOrders?: (targetPrefix?: string) => void;
  inputs?: FluidsAndDripsInputs;
  onChangeInputs?: React.Dispatch<React.SetStateAction<FluidsAndDripsInputs>>;
}

export interface FluidsAndDripsInputs {
  deficitPct: number;
  fluidDuration: number;
  dripKey: string;
  dripDose: string;
  dripDrugMg: string;
  dripVolMl: string;
  reverseRate: string;
  currentHb: string;
  targetHb: string;
  prbcType: 'cpda' | 'sagm';
}

export const DEFAULT_FLUIDS_INPUTS: FluidsAndDripsInputs = {
  deficitPct: 5,
  fluidDuration: 24,
  dripKey: DATASET.infusionDrips[0]?.key || 'epinephrine-drip',
  dripDose: '0.1',
  dripDrugMg: '1',
  dripVolMl: '50',
  reverseRate: '',
  currentHb: '6.5',
  targetHb: '10.0',
  prbcType: 'cpda',
};

export const FluidsAndDripsView: React.FC<FluidsAndDripsViewProps> = ({
  activeSubTab,
  activeWeight,
  onChangeSubTab,
  onAddOrder,
  onInvalidateOrders,
  inputs,
  onChangeInputs,
}) => {
  const handleSubTabChange = (tab: 'fluids' | 'drip' | 'transfusion') => {
    onChangeSubTab(tab);
  };

  const [internalInputs, setInternalInputs] = useState<FluidsAndDripsInputs>(DEFAULT_FLUIDS_INPUTS);
  const currentInputs = inputs ?? internalInputs;

  const updateInputs = (patch: Partial<FluidsAndDripsInputs>) => {
    if (onChangeInputs) {
      onChangeInputs((prev) => ({ ...prev, ...patch }));
    } else {
      setInternalInputs((prev) => ({ ...prev, ...patch }));
    }
  };

  const {
    deficitPct,
    fluidDuration,
    dripKey,
    dripDose,
    dripDrugMg,
    dripVolMl,
    reverseRate,
    currentHb,
    targetHb,
    prbcType,
  } = currentInputs;

  const selectedDripItem =
    DATASET.infusionDrips.find((d) => d.key === dripKey) || DATASET.infusionDrips[0];

  const handleSelectDrip = (key: string) => {
    onInvalidateOrders?.('drip');
    const item = DATASET.infusionDrips.find((d) => d.key === key);
    let nextMg = '1';
    let nextVol = '50';
    let nextDose = '0.1';
    if (item) {
      nextDose = String(item.doseDefaultMcgKgMin);
      const m = (item.standardPrep || '').match(/(\d+(?:\.\d+)?)\s*mg\s*in\s*(\d+(?:\.\d+)?)\s*mL/i);
      if (m) {
        nextMg = m[1];
        nextVol = m[2];
      } else {
        nextMg = String((item.concMgPerMl || 0.02) * 50);
        nextVol = '50';
      }
    }
    updateInputs({
      dripKey: key,
      reverseRate: '',
      dripDose: nextDose,
      dripDrugMg: nextMg,
      dripVolMl: nextVol,
    });
  };

  const w = activeWeight || 0;

  // 1. IV Fluids calculations
  const mntHr = calcMaintenanceMlPerHr(w);
  const mntDay = calcMaintenanceMlPerDay(w);
  const deficitVol = w * deficitPct * 10;
  const replaceRate = deficitVol / fluidDuration;
  const combinedRate = mntHr + replaceRate;
  const shockBolus = w * 20;

  // 2. Drip calculations
  const doseNum = parseFloat(dripDose) || 0;
  const mgNum = parseFloat(dripDrugMg) || 1;
  const volNum = parseFloat(dripVolMl) || 50;
  const hasValidDripInputs =
    parseFloat(dripDose) > 0 && parseFloat(dripDrugMg) > 0 && parseFloat(dripVolMl) > 0;
  const fwd = calcDripForward(doseNum, w, mgNum, volNum);
  const revNum = parseFloat(reverseRate);
  const revDose =
    Number.isFinite(revNum) && revNum > 0 ? calcDripReverse(revNum, w, mgNum, volNum) : null;
  const isExceededMax =
    selectedDripItem?.maxRateMcgKgMin && doseNum > selectedDripItem.maxRateMcgKgMin;

  // 3. Transfusion calculations
  const curHbNum = parseFloat(currentHb);
  const tarHbNum = parseFloat(targetHb);
  const hasValidHb =
    Number.isFinite(curHbNum) &&
    curHbNum > 0 &&
    Number.isFinite(tarHbNum) &&
    tarHbNum > 0;
  const tx = hasValidHb ? calcTransfusion(w, curHbNum, tarHbNum, prbcType) : null;
  const rawMinPrbcHours = tx && tx.maxInfusionRate > 0 ? tx.prbcVol / tx.maxInfusionRate : 0;
  const minPrbcDurationHr = Math.max(2, Math.ceil(rawMinPrbcHours * 10) / 10);
  const maxPermittedPrbcVol = tx ? tx.maxInfusionRate * 4 : 0;
  const isPrbcScheduleConflict = Boolean(
    tx && tx.prbcVol > 0 && (tx.maxInfusionRate <= 0 || tx.prbcVol > maxPermittedPrbcVol)
  );
  const prbcDurationText = isPrbcScheduleConflict
    ? 'no feasible 4-hr schedule'
    : minPrbcDurationHr >= 4
      ? '4 hr'
      : minPrbcDurationHr > 2
        ? `${minPrbcDurationHr}-4 hr`
        : '2-4 hr';
  const baseTx = calcTransfusion(w, 0, 0, prbcType);

  return (
    <div className="clinical-card p-5 space-y-4">
      {/* 3-Subtab Selector: IV Fluids, Continuous Drips, Blood Transfusion */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
        <label className="text-xs font-bold text-[var(--muted)]">
          Fluids, Infusions &amp; Transfusion Protocol
        </label>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--panel)] border border-[var(--border)] self-start sm:self-auto">
          <button
            type="button"
            aria-pressed={activeSubTab === 'fluids'}
            onClick={() => handleSubTabChange('fluids')}
            className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              activeSubTab === 'fluids'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            IV Fluids
          </button>
          <button
            type="button"
            aria-pressed={activeSubTab === 'drip'}
            onClick={() => handleSubTabChange('drip')}
            className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              activeSubTab === 'drip'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            Continuous Drips
          </button>
          <button
            type="button"
            aria-pressed={activeSubTab === 'transfusion'}
            onClick={() => handleSubTabChange('transfusion')}
            className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              activeSubTab === 'transfusion'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            Blood Transfusion
          </button>
        </div>
      </div>

      {/* 1. IV FLUIDS VIEW */}
      {activeSubTab === 'fluids' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="fDegree" className="text-xs font-bold text-[var(--muted)] block mb-1">
                Dehydration Severity (% Deficit)
              </label>
              <select
                id="fDegree"
                value={deficitPct}
                onChange={(e) => {
                  onInvalidateOrders?.('fluids');
                  updateInputs({ deficitPct: parseInt(e.target.value, 10) });
                }}
                className="clinical-input w-full font-semibold"
              >
                <option value={3}>3% — Mild (dry mucous membranes)</option>
                <option value={5}>5% — Mild (decreased urine output)</option>
                <option value={7}>7% — Moderate (sunken eyes, tachycardia)</option>
                <option value={9}>9% — Moderate (lethargy, delayed CRT &gt; 2s)</option>
                <option value={10}>10% — Severe (consider 20 mL/kg Shock Bolus)</option>
              </select>
            </div>

            <div>
              <label htmlFor="fPlan" className="text-xs font-bold text-[var(--muted)] block mb-1">
                Replacement Duration
              </label>
              <select
                id="fPlan"
                value={fluidDuration}
                onChange={(e) => {
                  onInvalidateOrders?.('fluids');
                  updateInputs({ fluidDuration: parseInt(e.target.value, 10) });
                }}
                className="clinical-input w-full font-semibold"
              >
                <option value={24}>Over 24 Hours</option>
                <option value={48}>Over 48 Hours</option>
              </select>
            </div>
          </div>

          {!w ? (
            <div className="clinical-panel-subtle p-6 text-center text-sm text-[var(--muted)]">
              Enter patient Weight (BW) above to calculate IV fluid rates
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--muted)]">Calculated Fluid Regimen</span>
                {onAddOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddOrder({
                        id: createOrderId('fluids'),
                        module: 'IV Fluids',
                        text: `Maintenance Fluid @ ${mntHr.toFixed(1)} mL/hr (${mntDay} mL/day)${deficitPct ? ` + Deficit ${deficitPct}% replacement over ${fluidDuration} h (${replaceRate.toFixed(1)} mL/hr) = Total ${combinedRate.toFixed(1)} mL/hr` : ''}`,
                        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                      });
                    }}
                    className="px-2.5 py-1 text-xs font-bold rounded border border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-soft)] hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer shrink-0"
                    title="Add to Active Patient Order Sheet"
                  >
                    + Order Sheet
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Combined Rate (Maintenance + Deficit)
                  </div>
                  <div className="text-2xl font-extrabold font-mono-tabular text-[var(--good-text)] mt-1">
                    {combinedRate.toFixed(1)} <span className="text-sm font-bold">mL/hr</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    Mnt {mntHr.toFixed(1)} + Deficit {replaceRate.toFixed(1)} mL/hr
                  </div>
                </div>

                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Maintenance (Holliday–Segar)
                  </div>
                  <div className="text-2xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                    {mntHr.toFixed(1)} <span className="text-sm font-bold">mL/hr</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">{mntDay} mL/day</div>
                </div>

                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Shock Bolus (20 mL/kg)
                  </div>
                  <div className="text-2xl font-extrabold font-mono-tabular text-[var(--danger-text)] mt-1">
                    {shockBolus.toFixed(0)} <span className="text-sm font-bold">mL</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    Total Deficit ({deficitPct}%): {deficitVol.toFixed(0)} mL
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. CONTINUOUS DRIP VIEW */}
      {activeSubTab === 'drip' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="dripDrug" className="text-xs font-bold text-[var(--muted)] block mb-1">
                Continuous Infusion Drug
              </label>
              <select
                id="dripDrug"
                value={dripKey}
                onChange={(e) => handleSelectDrip(e.target.value)}
                className="clinical-input w-full font-bold"
              >
                {DATASET.infusionDrips.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.drug} ({d.doseMinMcgKgMin}–{d.doseMaxMcgKgMin} {d.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="dripDoseInput"
                className="text-xs font-bold text-[var(--muted)] block mb-1"
              >
                Target Dose ({selectedDripItem.unit})
              </label>
              <input
                id="dripDoseInput"
                type="number"
                min="0"
                step="0.05"
                value={dripDose}
                onChange={(e) => {
                  onInvalidateOrders?.('drip');
                  updateInputs({ dripDose: e.target.value });
                }}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>

            <fieldset className="border-0 p-0 m-0">
              <legend className="text-xs font-bold text-[var(--muted)] block mb-1">
                Dilution (mg / mL)
              </legend>
              <div className="flex items-center gap-1">
                <label htmlFor="dripDrugMgInput" className="sr-only">
                  Drug amount (mg)
                </label>
                <input
                  id="dripDrugMgInput"
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={dripDrugMg}
                  onChange={(e) => {
                    onInvalidateOrders?.('drip');
                    updateInputs({ dripDrugMg: e.target.value });
                  }}
                  className="clinical-input w-full font-mono-tabular font-bold text-center px-1.5"
                  title="Drug amount (mg)"
                />
                <span className="text-xs text-[var(--muted)]" aria-hidden="true">/</span>
                <label htmlFor="dripVolMlInput" className="sr-only">
                  Diluent volume (mL)
                </label>
                <input
                  id="dripVolMlInput"
                  type="number"
                  min="1"
                  step="5"
                  value={dripVolMl}
                  onChange={(e) => {
                    onInvalidateOrders?.('drip');
                    updateInputs({ dripVolMl: e.target.value });
                  }}
                  className="clinical-input w-full font-mono-tabular font-bold text-center px-1.5"
                  title="Diluent volume (mL)"
                />
              </div>
            </fieldset>
          </div>

          {!w ? (
            <div className="clinical-panel-subtle p-6 text-center text-sm text-[var(--muted)]">
              Enter patient Weight (BW) above to calculate infusion pump rate
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--muted)]">Calculated Infusion Rate</span>
                {onAddOrder && hasValidDripInputs && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddOrder({
                        id: createOrderId(`drip-${dripKey}`),
                        module: 'Drip',
                        text: `${selectedDripItem.drug} ${dripDose} ${selectedDripItem.unit} → Syringe Pump @ ${fwd.rateMlHr.toFixed(1)} mL/hr (Mix ${mgNum} mg in ${volNum} mL diluent)`,
                        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                      });
                    }}
                    className="px-2.5 py-1 text-xs font-bold rounded border border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-soft)] hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer shrink-0"
                    title="Add to Active Patient Order Sheet"
                  >
                    + Order Sheet
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Syringe Pump Rate
                  </div>
                  <div className="text-2xl font-extrabold font-mono-tabular text-[var(--danger-text)] mt-1">
                    {fwd.rateMlHr.toFixed(1)} <span className="text-sm font-bold">mL/hr</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    Mix {mgNum} mg in {volNum} mL ({fwd.concMcgPerMl} mcg/mL)
                  </div>
                </div>

                <div className="clinical-panel-subtle p-4 flex flex-col justify-between">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Reverse Check (Pump mL/hr → mcg/kg/min)
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Enter mL/hr"
                      value={reverseRate}
                      onChange={(e) => updateInputs({ reverseRate: e.target.value })}
                      className="clinical-input w-28 font-mono-tabular font-bold text-xs"
                    />
                    <span className="text-sm font-extrabold font-mono-tabular text-[var(--accent-text)]">
                      = {revDose !== null ? `${revDose} ${selectedDripItem.unit}` : '—'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--muted)] mt-1">
                    Usual range: {selectedDripItem.doseMinMcgKgMin}–{selectedDripItem.doseMaxMcgKgMin}{' '}
                    {selectedDripItem.unit}
                  </div>
                </div>
              </div>

              {isExceededMax && (
                <div className="p-3 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-xs font-bold text-[var(--danger-text)] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Target dose ({doseNum} mcg/kg/min) exceeds recommended maximum ({selectedDripItem.maxRateMcgKgMin} mcg/kg/min)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. BLOOD TRANSFUSION VIEW */}
      {activeSubTab === 'transfusion' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="txCurrentHb" className="text-xs font-bold text-[var(--muted)] block mb-1">
                Current Hb (g/dL)
              </label>
              <input
                id="txCurrentHb"
                type="number"
                step="0.1"
                value={currentHb}
                onChange={(e) => {
                  onInvalidateOrders?.('tx');
                  updateInputs({ currentHb: e.target.value });
                }}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
            <div>
              <label htmlFor="txTargetHb" className="text-xs font-bold text-[var(--muted)] block mb-1">
                Target Hb (g/dL)
              </label>
              <input
                id="txTargetHb"
                type="number"
                step="0.1"
                value={targetHb}
                onChange={(e) => {
                  onInvalidateOrders?.('tx');
                  updateInputs({ targetHb: e.target.value });
                }}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
            <div>
              <label htmlFor="txPrbcType" className="text-xs font-bold text-[var(--muted)] block mb-1">
                PRBC Preparation
              </label>
              <select
                id="txPrbcType"
                value={prbcType}
                onChange={(e) => {
                  onInvalidateOrders?.('tx');
                  updateInputs({ prbcType: e.target.value as 'cpda' | 'sagm' });
                }}
                className="clinical-input w-full font-bold"
              >
                <option value="cpda">CPDA-1 (×3)</option>
                <option value="sagm">SAGM (×4)</option>
              </select>
            </div>
          </div>

          {!w ? (
            <div className="clinical-panel-subtle p-6 text-center text-sm text-[var(--muted)]">
              Enter patient Weight (BW) above to calculate transfusion volumes
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--muted)]">Calculated Transfusion Volumes</span>
                {onAddOrder && tx && tx.prbcVol > 0 && !isPrbcScheduleConflict && (
                  <button
                    type="button"
                    onClick={() => {
                      if (tx.maxInfusionRate <= 0 || tx.prbcVol > tx.maxInfusionRate * 4) return;
                      onAddOrder({
                        id: createOrderId('tx'),
                        module: 'Transfusion',
                        text: `PRBC (${prbcType.toUpperCase()}) ${tx.prbcVol} mL IV over ${prbcDurationText} (Max rate ≤ ${tx.maxInfusionRate} mL/hr) [Current Hb ${curHbNum} → Target ${tarHbNum} g/dL]`,
                        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                      });
                    }}
                    className="px-2.5 py-1 text-xs font-bold rounded border border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-soft)] hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer shrink-0"
                    title="Add to Active Patient Order Sheet"
                  >
                    + Order Sheet
                  </button>
                )}
              </div>
              {tx && isPrbcScheduleConflict && (
                <div
                  role="alert"
                  className="p-3 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-xs font-bold text-[var(--danger-text)] flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Calculated PRBC volume ({tx.prbcVol} mL) exceeds the 4-hour maximum volume ({maxPermittedPrbcVol} mL) at max safe rate ({tx.maxInfusionRate} mL/hr). Revise clinical plan (lower Target Hb or divide into aliquots) before queuing order.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">PRBC Volume Required</div>
                  {tx ? (
                    <>
                      <div className="text-2xl font-extrabold font-mono-tabular text-[var(--danger-text)] mt-1">
                        {tx.prbcVol} <span className="text-sm font-bold">mL</span>
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        Max safe rate ≤ {tx.maxInfusionRate} mL/hr ({prbcDurationText})
                      </div>
                    </>
                  ) : (
                    <div className="text-xs font-bold text-[var(--warning-text)] mt-2">
                      Enter valid Current &amp; Target Hb
                    </div>
                  )}
                </div>

                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">Platelets &amp; FFP</div>
                  <div className="text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                    Plt {baseTx.pltVol} mL · FFP {baseTx.ffpVol} mL
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">Cryo: {baseTx.cryoVol} mL</div>
                </div>

                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">Tranexamic Acid (TXA)</div>
                  <div className="text-2xl font-extrabold font-mono-tabular text-[var(--accent-text)] mt-1">
                    {baseTx.txaLoadingMg} <span className="text-sm font-bold">mg IV</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    15 mg/kg over 10 min (Max 1000 mg)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
