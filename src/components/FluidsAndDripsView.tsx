import React from 'react';
import { DATASET } from '../data/dataset';
import {
  calcFluidRegimen,
  calcDripForward,
  calcDripReverse,
  calcTransfusion,
} from '../utils/clinicalCalculations';
import { AlertTriangle, BookOpen } from 'lucide-react';
import { OrderItem, createOrderId } from './ModalsAndDrawers';

interface FluidsAndDripsViewProps {
  activeSubTab: 'fluids' | 'drip' | 'transfusion';
  activeWeight: number | null;
  onChangeSubTab: (sub: 'fluids' | 'drip' | 'transfusion') => void;
  onAddOrder?: (order: OrderItem) => void;
  onInvalidateOrders?: (targetPrefix?: string) => void;
  onOpenEvidence?: (topicKey: string, e?: React.SyntheticEvent<HTMLElement>) => void;
  inputs: FluidsAndDripsInputs;
  onChangeInputs: React.Dispatch<React.SetStateAction<FluidsAndDripsInputs>>;
}

export interface FluidsAndDripsInputs {
  deficitPct: number;
  fluidDuration: number;
  priorBolusMl: string;
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
  priorBolusMl: '',
  dripKey: DATASET.infusionDrips[0]?.key || 'epinephrine-drip',
  dripDose: '0.1',
  dripDrugMg: '1',
  dripVolMl: '50',
  reverseRate: '',
  currentHb: '',
  targetHb: '',
  prbcType: 'cpda',
};

export const FluidsAndDripsView: React.FC<FluidsAndDripsViewProps> = ({
  activeSubTab,
  activeWeight,
  onChangeSubTab,
  onAddOrder,
  onInvalidateOrders,
  onOpenEvidence,
  inputs,
  onChangeInputs,
}) => {
  const handleSubTabChange = (tab: 'fluids' | 'drip' | 'transfusion') => {
    onChangeSubTab(tab);
  };

  const updateInputs = (patch: Partial<FluidsAndDripsInputs>) => {
    onChangeInputs((prev) => ({ ...prev, ...patch }));
  };

  const {
    deficitPct,
    fluidDuration,
    priorBolusMl,
    dripKey,
    dripDose,
    dripDrugMg,
    dripVolMl,
    reverseRate,
    currentHb,
    targetHb,
    prbcType,
  } = inputs;

  const selectedDripItem =
    DATASET.infusionDrips.find((d) => d.key === dripKey) || DATASET.infusionDrips[0];

  const handleSelectDrip = (key: string) => {
    onInvalidateOrders?.(`drip-${dripKey}`);
    if (key !== dripKey) {
      onInvalidateOrders?.(`drip-${key}`);
    }
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

  // 1. IV Fluids calculations (unrounded; rounding at display only)
  const regimen = calcFluidRegimen({
    weightKg: w,
    deficitPct,
    durationHr: fluidDuration === 48 ? 48 : 24,
    priorBolusMl: parseFloat(priorBolusMl) || 0,
  });

  // 2. Drip calculations
  const parsedDose = parseFloat(dripDose);
  const parsedMg = parseFloat(dripDrugMg);
  const parsedVol = parseFloat(dripVolMl);
  const doseNum = Number.isFinite(parsedDose) && parsedDose > 0 ? parsedDose : 0;
  const mgNum = Number.isFinite(parsedMg) && parsedMg > 0 ? parsedMg : 0;
  const volNum = Number.isFinite(parsedVol) && parsedVol > 0 ? parsedVol : 0;
  const hasValidDripInputs = doseNum > 0 && mgNum > 0 && volNum > 0;
  const fwd = calcDripForward(doseNum, w, mgNum, volNum);
  const revNum = parseFloat(reverseRate);
  const revDose =
    Number.isFinite(revNum) && revNum > 0 && mgNum > 0 && volNum > 0
      ? calcDripReverse(revNum, w, mgNum, volNum)
      : null;
  const isExceededMax = Boolean(
    selectedDripItem?.maxRateMcgKgMin && doseNum > selectedDripItem.maxRateMcgKgMin
  );

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
    <div className="clinical-card p-4 sm:p-5 space-y-4 sm:space-y-5">
      {/* 3-Subtab Selector: IV Fluids, Continuous Drips, Blood Transfusion */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--border)]">
        <label className="text-xs font-bold text-[var(--muted)]">
          Fluids, Infusions &amp; Transfusion Protocol
        </label>
        <div className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
          <button
            type="button"
            aria-pressed={activeSubTab === 'fluids'}
            onClick={() => handleSubTabChange('fluids')}
            className={`min-h-[34px] px-2 sm:px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap truncate text-center ${
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
            className={`min-h-[34px] px-2 sm:px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap truncate text-center ${
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
            className={`min-h-[34px] px-2 sm:px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap truncate text-center ${
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[var(--ink)]">
              IV Maintenance &amp; Deficit Fluids{' '}
              <span className="font-semibold text-[var(--muted)]">(สารน้ำทางหลอดเลือดดำ)</span>
            </h2>
            {onOpenEvidence && (
              <button
                type="button"
                onClick={(e) => onOpenEvidence('fluids', e)}
                className="min-h-[28px] px-2 py-0.5 text-[11px] font-bold rounded-md border border-[var(--border)] text-[var(--accent-text)] hover:bg-[var(--accent-soft)] transition-colors flex items-center gap-1 cursor-pointer"
                title="Open evidence & level of evidence"
              >
                <BookOpen className="w-3 h-3" aria-hidden="true" /> AAP Isotonic CPG
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label htmlFor="fDegree" className="text-xs font-bold text-[var(--muted)] block mb-1.5">
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
                <option value={4}>4% — Mild (decreased urine output)</option>
                <option value={5}>5% — Mild (dry skin)</option>
                <option value={6}>6% — Moderate (sunken eyes)</option>
                <option value={7}>7% — Moderate (tachycardia)</option>
                <option value={8}>8% — Moderate (lethargy, reduced turgor)</option>
                <option value={9}>9% — Moderate (CRT &gt; 2 s)</option>
                <option value={10}>10% — Severe (assess for shock)</option>
              </select>
            </div>

            <div>
              <label htmlFor="fPlan" className="text-xs font-bold text-[var(--muted)] block mb-1.5">
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
                <option value={48}>Over 48 Hours (hypernatremia)</option>
              </select>
            </div>

            <div>
              <label htmlFor="fPriorBolus" className="text-xs font-bold text-[var(--muted)] block mb-1.5">
                Boluses Already Given (mL)
              </label>
              <input
                id="fPriorBolus"
                type="number"
                min="0"
                step="10"
                inputMode="decimal"
                placeholder="0"
                value={priorBolusMl}
                onChange={(e) => {
                  onInvalidateOrders?.('fluids');
                  updateInputs({ priorBolusMl: e.target.value });
                }}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
          </div>

          {!regimen ? (
            <div className="clinical-panel-subtle p-5 sm:p-6 text-center text-sm text-[var(--muted)]">
              Enter patient Weight (BW) above to calculate IV fluid rates
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--muted)]">Calculated Fluid Regimen</span>
                {onAddOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddOrder({
                        id: createOrderId('fluids'),
                        module: 'IV Fluids',
                        text: `Isotonic IV fluid @ ${regimen.combinedMlHr.toFixed(1)} mL/hr (Mnt ${regimen.mntMlHr.toFixed(1)} mL/hr + Deficit ${deficitPct}% ${regimen.replaceMlHr.toFixed(1)} mL/hr over ${fluidDuration} h; net deficit ${regimen.netDeficitMl.toFixed(0)} mL) [BW: ${w.toFixed(1)} kg]`,
                        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                      });
                    }}
                    className="min-h-[32px] px-3 py-1 text-xs font-bold rounded-md border border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-soft)] hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    title="Add to Active Patient Order Sheet"
                  >
                    + Order Sheet
                  </button>
                )}
              </div>

              {regimen.severity === 'severe' && (
                <div
                  role="alert"
                  className="p-3 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-xs font-bold text-[var(--danger-text)] flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Severe dehydration: assess for shock first. If shock / poor perfusion → isotonic bolus{' '}
                    {regimen.bolus10Ml.toFixed(0)} mL (10 mL/kg) – {regimen.bolus20Ml.toFixed(0)} mL (20 mL/kg), reassess after each
                    bolus, then enter the volume given above so it is subtracted from the deficit.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Combined Rate (Maintenance + Deficit)
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--good-text)] mt-1">
                    {regimen.combinedMlHr.toFixed(1)} <span className="text-sm font-bold">mL/hr</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    Mnt {regimen.mntMlHr.toFixed(1)} + Deficit {regimen.replaceMlHr.toFixed(1)} mL/hr
                  </div>
                </div>

                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">Maintenance (Holliday–Segar)</div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                    {regimen.mntMlHr.toFixed(1)} <span className="text-sm font-bold">mL/hr</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {regimen.mntMlDay.toFixed(0)} mL/day
                    {regimen.isMntCapped && ' · capped at 2400 mL/day'}
                  </div>
                </div>

                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">Deficit ({deficitPct}%)</div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--warning-text)] mt-1">
                    {regimen.netDeficitMl.toFixed(0)} <span className="text-sm font-bold">mL</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {regimen.netDeficitMl < regimen.deficitMl
                      ? `Total ${regimen.deficitMl.toFixed(0)} − bolus given ${(regimen.deficitMl - regimen.netDeficitMl).toFixed(0)} mL`
                      : `Replace over ${fluidDuration} h`}
                  </div>
                </div>

                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">First 24 h Total</div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--accent-text)] mt-1">
                    {regimen.day1TotalMl.toFixed(0)} <span className="text-sm font-bold">mL</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    Mnt × 24 h + {fluidDuration === 48 ? '½ net deficit' : 'net deficit'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    {regimen.orsPlan ? 'Oral Rehydration (ORS) Option' : 'Shock Bolus (only if shock / poor perfusion)'}
                  </div>
                  {regimen.orsPlan ? (
                    <>
                      <div className="text-lg sm:text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                        ORS {regimen.orsPlan.volumeMl.toFixed(0)} mL over {regimen.orsPlan.overHr} h
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        {regimen.orsPlan.mlPerKg} mL/kg
                        {regimen.severity === 'moderate' ? ' (WHO Plan B)' : ' (mild dehydration)'} + replace ongoing losses;
                        IV if unable to drink
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg sm:text-xl font-extrabold font-mono-tabular text-[var(--danger-text)] mt-1">
                        {regimen.bolus10Ml.toFixed(0)} – {regimen.bolus20Ml.toFixed(0)} mL
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        10–20 mL/kg NS/RL (max 500 / 1000 mL per bolus){regimen.isBolusCapped && ' · capped'}; IV bolus +
                        deficit model (not WHO Plan C)
                      </div>
                    </>
                  )}
                </div>

                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">Urine Output Target</div>
                  <div className="text-lg sm:text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                    ≥ {regimen.uoTargetMlHr.toFixed(0)} <span className="text-sm font-bold">mL/hr</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    ≥ {regimen.uoTargetMlKgHr} mL/kg/hr · check Na, K, BUN/Cr, glucose at baseline &amp; at least q24h
                  </div>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                Use isotonic fluid (0.9% NaCl or balanced solution with dextrose ± KCl) for maintenance (AAP 2018). Use the
                48 h plan for hypernatremic dehydration (Na &gt; 150) and lower Na by ≤ 0.5 mEq/L/hr. Holliday–Segar for
                maintenance; Deficit = % × BW × 10 mL − boluses already given.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 2. CONTINUOUS DRIP VIEW */}
      {activeSubTab === 'drip' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            <div className="sm:col-span-2">
              <label htmlFor="dripDrug" className="text-xs font-bold text-[var(--muted)] block mb-1.5">
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
                className="text-xs font-bold text-[var(--muted)] block mb-1.5"
              >
                Target Dose ({selectedDripItem.unit})
              </label>
              <input
                id="dripDoseInput"
                type="number"
                min="0"
                step="0.05"
                inputMode="decimal"
                value={dripDose}
                onChange={(e) => {
                  onInvalidateOrders?.(`drip-${dripKey}`);
                  updateInputs({ dripDose: e.target.value });
                }}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>

            <fieldset className="border-0 p-0 m-0">
              <legend className="text-xs font-bold text-[var(--muted)] block mb-1.5">
                Dilution (mg / mL)
              </legend>
              <div className="flex items-center gap-1.5">
                <label htmlFor="dripDrugMgInput" className="sr-only">
                  Drug amount (mg)
                </label>
                <input
                  id="dripDrugMgInput"
                  type="number"
                  min="0.1"
                  step="0.5"
                  inputMode="decimal"
                  value={dripDrugMg}
                  onChange={(e) => {
                    onInvalidateOrders?.(`drip-${dripKey}`);
                    updateInputs({ dripDrugMg: e.target.value });
                  }}
                  className="clinical-input w-full font-mono-tabular font-bold text-center px-2"
                  title="Drug amount (mg)"
                />
                <span className="text-xs text-[var(--muted)] font-bold" aria-hidden="true">/</span>
                <label htmlFor="dripVolMlInput" className="sr-only">
                  Diluent volume (mL)
                </label>
                <input
                  id="dripVolMlInput"
                  type="number"
                  min="1"
                  step="5"
                  inputMode="decimal"
                  value={dripVolMl}
                  onChange={(e) => {
                    onInvalidateOrders?.(`drip-${dripKey}`);
                    updateInputs({ dripVolMl: e.target.value });
                  }}
                  className="clinical-input w-full font-mono-tabular font-bold text-center px-2"
                  title="Diluent volume (mL)"
                />
              </div>
            </fieldset>
          </div>

          {!w ? (
            <div className="clinical-panel-subtle p-5 sm:p-6 text-center text-sm text-[var(--muted)]">
              Enter patient Weight (BW) above to calculate infusion pump rate
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
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
                    className="min-h-[32px] px-3 py-1 text-xs font-bold rounded-md border border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-soft)] hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    title="Add to Active Patient Order Sheet"
                  >
                    + Order Sheet
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Syringe Pump Rate
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--danger-text)] mt-1">
                    {hasValidDripInputs ? (
                      <>
                        {fwd.rateMlHr.toFixed(1)} <span className="text-sm font-bold">mL/hr</span>
                      </>
                    ) : (
                      <span className="text-base sm:text-lg font-bold text-[var(--muted)]">
                        Enter dose & dilution
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {hasValidDripInputs
                      ? `Mix ${mgNum} mg in ${volNum} mL (${fwd.concMcgPerMl} mcg/mL)`
                      : '—'}
                  </div>
                </div>

                <div className="clinical-panel-subtle p-4 flex flex-col justify-between">
                  <div className="text-xs font-semibold text-[var(--muted)]">
                    Reverse Check (Pump mL/hr → mcg/kg/min)
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      placeholder="Enter mL/hr"
                      value={reverseRate}
                      onChange={(e) => updateInputs({ reverseRate: e.target.value })}
                      className="clinical-input w-28 font-mono-tabular font-bold text-xs"
                    />
                    <span className="text-sm font-extrabold font-mono-tabular text-[var(--accent-text)] whitespace-nowrap">
                      = {revDose !== null ? `${revDose} ${selectedDripItem.unit}` : '—'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--muted)] mt-1.5">
                    Usual range: {selectedDripItem.doseMinMcgKgMin}–{selectedDripItem.doseMaxMcgKgMin}{' '}
                    {selectedDripItem.unit}
                  </div>
                </div>
              </div>

              {isExceededMax && (
                <div className="p-3 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-xs font-bold text-[var(--danger-text)] flex items-start sm:items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label htmlFor="txCurrentHb" className="text-xs font-bold text-[var(--muted)] block mb-1.5">
                Current Hb (g/dL)
              </label>
              <input
                id="txCurrentHb"
                type="number"
                step="0.1"
                inputMode="decimal"
                value={currentHb}
                onChange={(e) => {
                  onInvalidateOrders?.('tx');
                  updateInputs({ currentHb: e.target.value });
                }}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
            <div>
              <label htmlFor="txTargetHb" className="text-xs font-bold text-[var(--muted)] block mb-1.5">
                Target Hb (g/dL)
              </label>
              <input
                id="txTargetHb"
                type="number"
                step="0.1"
                inputMode="decimal"
                value={targetHb}
                onChange={(e) => {
                  onInvalidateOrders?.('tx');
                  updateInputs({ targetHb: e.target.value });
                }}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
            <div>
              <label htmlFor="txPrbcType" className="text-xs font-bold text-[var(--muted)] block mb-1.5">
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
            <div className="clinical-panel-subtle p-5 sm:p-6 text-center text-sm text-[var(--muted)]">
              Enter patient Weight (BW) above to calculate transfusion volumes
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
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
                    className="min-h-[32px] px-3 py-1 text-xs font-bold rounded-md border border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent-soft)] hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    title="Add to Active Patient Order Sheet"
                  >
                    + Order Sheet
                  </button>
                )}
              </div>
              {tx && isPrbcScheduleConflict && (
                <div
                  role="alert"
                  className="p-3 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-xs font-bold text-[var(--danger-text)] flex items-start sm:items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
                  <span>
                    Calculated PRBC volume ({tx.prbcVol} mL) exceeds the 4-hour maximum volume ({maxPermittedPrbcVol} mL) at max safe rate ({tx.maxInfusionRate} mL/hr). Revise clinical plan (lower Target Hb or divide into aliquots) before queuing order.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">PRBC Volume Required</div>
                  {tx ? (
                    <>
                      <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--danger-text)] mt-1">
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
                  <div className="text-lg sm:text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                    Plt {baseTx.pltVol} mL · FFP {baseTx.ffpVol} mL
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">Cryo: {baseTx.cryoVol} mL</div>
                </div>

                <div className="clinical-panel-subtle p-4">
                  <div className="text-xs font-semibold text-[var(--muted)]">Tranexamic Acid (TXA)</div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[var(--accent-text)] mt-1">
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
