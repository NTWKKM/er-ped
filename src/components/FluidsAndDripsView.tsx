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

interface FluidsAndDripsViewProps {
  activeSubTab: 'fluids' | 'drip' | 'transfusion';
  activeWeight: number | null;
}

export const FluidsAndDripsView: React.FC<FluidsAndDripsViewProps> = ({
  activeSubTab,
  activeWeight,
}) => {
  // IV Fluids state
  const [deficitPct, setDeficitPct] = useState<number>(5);
  const [fluidDuration, setFluidDuration] = useState<number>(24);

  // Drip state
  const [dripKey, setDripKey] = useState<string>(
    DATASET.infusionDrips[0]?.key || 'epinephrine-drip'
  );
  const [dripDose, setDripDose] = useState<string>('0.1');
  const [dripDrugMg, setDripDrugMg] = useState<string>('1');
  const [dripVolMl, setDripVolMl] = useState<string>('50');
  const [reverseRate, setReverseRate] = useState<string>('');

  // Transfusion state
  const [currentHb, setCurrentHb] = useState<string>('6.5');
  const [targetHb, setTargetHb] = useState<string>('10.0');
  const [prbcType, setPrbcType] = useState<'cpda' | 'sagm'>('cpda');

  const selectedDripItem =
    DATASET.infusionDrips.find((d) => d.key === dripKey) || DATASET.infusionDrips[0];

  const handleSelectDrip = (key: string) => {
    setDripKey(key);
    setReverseRate('');
    const item = DATASET.infusionDrips.find((d) => d.key === key);
    if (item) {
      setDripDose(String(item.doseDefaultMcgKgMin));
      const m = (item.standardPrep || '').match(/(\d+(?:\.\d+)?)\s*mg\s*in\s*(\d+(?:\.\d+)?)\s*mL/i);
      if (m) {
        setDripDrugMg(m[1]);
        setDripVolMl(m[2]);
      } else {
        setDripDrugMg(String((item.concMgPerMl || 0.02) * 50));
        setDripVolMl('50');
      }
    }
  };

  const w = activeWeight || 0;

  if (activeSubTab === 'fluids') {
    const mntHr = calcMaintenanceMlPerHr(w);
    const mntDay = calcMaintenanceMlPerDay(w);
    const deficitVol = w * deficitPct * 10;
    const replaceRate = deficitVol / fluidDuration;
    const combinedRate = mntHr + replaceRate;
    const shockBolus = w * 20;

    return (
      <div className="clinical-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="fDegree" className="text-xs font-bold text-[var(--muted)] block mb-1">
              Dehydration Severity (% Deficit)
            </label>
            <select
              id="fDegree"
              value={deficitPct}
              onChange={(e) => setDeficitPct(parseInt(e.target.value, 10))}
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
              onChange={(e) => setFluidDuration(parseInt(e.target.value, 10))}
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
        )}
      </div>
    );
  }

  if (activeSubTab === 'drip') {
    const doseNum = parseFloat(dripDose) || 0;
    const mgNum = parseFloat(dripDrugMg) || 1;
    const volNum = parseFloat(dripVolMl) || 50;
    const fwd = calcDripForward(doseNum, w, mgNum, volNum);
    const revNum = parseFloat(reverseRate);
    const revDose =
      Number.isFinite(revNum) && revNum > 0 ? calcDripReverse(revNum, w, mgNum, volNum) : null;

    const isExceededMax =
      selectedDripItem?.maxRateMcgKgMin && doseNum > selectedDripItem.maxRateMcgKgMin;

    return (
      <div className="clinical-card p-5 space-y-4">
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
              onChange={(e) => setDripDose(e.target.value)}
              className="clinical-input w-full font-mono-tabular font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--muted)] block mb-1">
              Dilution (mg / mL)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={dripDrugMg}
                onChange={(e) => setDripDrugMg(e.target.value)}
                className="clinical-input w-full font-mono-tabular font-bold text-center px-1.5"
                title="Drug amount (mg)"
              />
              <span className="text-xs text-[var(--muted)]">/</span>
              <input
                type="number"
                min="1"
                step="5"
                value={dripVolMl}
                onChange={(e) => setDripVolMl(e.target.value)}
                className="clinical-input w-full font-mono-tabular font-bold text-center px-1.5"
                title="Diluent volume (mL)"
              />
            </div>
          </div>
        </div>

        {!w ? (
          <div className="clinical-panel-subtle p-6 text-center text-sm text-[var(--muted)]">
            Enter patient Weight (BW) above to calculate infusion pump rate
          </div>
        ) : (
          <div className="space-y-3">
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
                    onChange={(e) => setReverseRate(e.target.value)}
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
    );
  }

  // Transfusion View
  const curHbNum = parseFloat(currentHb) || 0;
  const tarHbNum = parseFloat(targetHb) || 10.0;
  const tx = calcTransfusion(w, curHbNum, tarHbNum, prbcType);

  return (
    <div className="clinical-card p-5 space-y-4">
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
            onChange={(e) => setCurrentHb(e.target.value)}
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
            onChange={(e) => setTargetHb(e.target.value)}
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
            onChange={(e) => setPrbcType(e.target.value as 'cpda' | 'sagm')}
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="clinical-panel-subtle p-4">
            <div className="text-xs font-semibold text-[var(--muted)]">PRBC Volume Required</div>
            <div className="text-2xl font-extrabold font-mono-tabular text-[var(--danger-text)] mt-1">
              {tx.prbcVol} <span className="text-sm font-bold">mL</span>
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">
              Max safe rate ≤ {tx.maxInfusionRate} mL/hr
            </div>
          </div>

          <div className="clinical-panel-subtle p-4">
            <div className="text-xs font-semibold text-[var(--muted)]">Platelets &amp; FFP</div>
            <div className="text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
              Plt {tx.pltVol} mL · FFP {tx.ffpVol} mL
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">Cryo: {tx.cryoVol} mL</div>
          </div>

          <div className="clinical-panel-subtle p-4">
            <div className="text-xs font-semibold text-[var(--muted)]">Tranexamic Acid (TXA)</div>
            <div className="text-2xl font-extrabold font-mono-tabular text-[var(--accent-text)] mt-1">
              {tx.txaLoadingMg} <span className="text-sm font-bold">mg IV</span>
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">
              15 mg/kg over 10 min (Max 1000 mg)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
