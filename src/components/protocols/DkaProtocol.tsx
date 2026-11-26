import React from 'react';
import { DATASET } from '../../data/dataset';
import { calcDkaPlan, calcWeightDoseRange, fmtMg } from '../../utils/clinicalCalculations';
import {
  Callout,
  Checklist,
  EvidenceFooter,
  NeedWeight,
  ProtocolHeader,
  ProtocolPanelProps,
  ProtocolSection,
  fmtRange,
  fmtRangeVolume,
  makeOrder,
} from './ProtocolKit';

const MODULE = 'Protocol (DKA)';

interface DkaProtocolProps extends ProtocolPanelProps {
  severityPct: number;
  priorBolus: string;
  insulinRate: number;
  onSeverityChange: (pct: number) => void;
  onPriorBolusChange: (val: string) => void;
  onInsulinRateChange: (rate: number) => void;
}

const Metric: React.FC<{ label: string; value: string; sub?: string; action?: React.ReactNode }> = ({
  label,
  value,
  sub,
  action,
}) => (
  <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-md)] p-3">
    <div className="text-xs font-semibold text-[var(--muted)]">{label}</div>
    <div className="text-lg sm:text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-0.5">{value}</div>
    {sub && <div className="text-xs text-[var(--ink-secondary)] mt-0.5">{sub}</div>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const DkaProtocol: React.FC<DkaProtocolProps> = ({
  weightKg: w,
  onAddOrder,
  severityPct,
  priorBolus,
  insulinRate,
  onSeverityChange,
  onPriorBolusChange,
  onInsulinRateChange,
}) => {
  const p = DATASET.dkaProtocol;
  const ce = p.cerebralEdema;

  const rawPrior = parseFloat(priorBolus);
  const isValidPrior = priorBolus.trim() !== '' && Number.isFinite(rawPrior) && rawPrior >= 0;
  const plan = isValidPrior ? calcDkaPlan(w, severityPct, rawPrior, insulinRate) : null;

  const mannitolG = calcWeightDoseRange(w, ce.mannitolGPerKgMin, ce.mannitolGPerKgMax);
  const hypertonicMl = calcWeightDoseRange(w, ce.hypertonicMlPerKgMin, ce.hypertonicMlPerKgMax);

  return (
    <div className="space-y-4">
      <ProtocolHeader
        title="Pediatric Diabetic Ketoacidosis (DKA)"
        subtitle="ISPAD Clinical Practice Consensus Guidelines 2022/2024 and Thai Pediatric Endocrine Association"
      />

      <ProtocolSection title="Diagnosis and Severity">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-bold text-[var(--muted)] mb-1.5">All three criteria required</div>
            <Checklist items={p.diagnosticCriteria} marker="check" />
          </div>
          <div className="clinical-table-container" tabIndex={0} role="region" aria-label="DKA severity bands">
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Venous pH / HCO₃</th>
                  <th>Assumed deficit</th>
                </tr>
              </thead>
              <tbody>
                {p.severityBands.map((b) => (
                  <tr key={b.key} className={b.deficitPct === severityPct ? 'bg-[var(--accent-soft)] font-bold' : ''}>
                    <td>{b.label}</td>
                    <td className="font-mono-tabular">{b.criteria}</td>
                    <td className="font-mono-tabular">{b.deficitPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ProtocolSection>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="dkaSeverity" className="text-xs font-bold text-[var(--muted)] block mb-1.5">
            Dehydration Severity (% Deficit)
          </label>
          <select
            id="dkaSeverity"
            value={severityPct}
            onChange={(e) => onSeverityChange(parseInt(e.target.value, 10))}
            className="clinical-input w-full font-bold"
          >
            {p.severityBands.map((b) => (
              <option key={b.key} value={b.deficitPct}>
                {b.label} DKA ({b.deficitPct}%)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dkaPriorBolus" className="text-xs font-bold text-[var(--muted)] block mb-1.5">
            Prior Fluid Boluses Given (mL)
          </label>
          <input
            id="dkaPriorBolus"
            type="number"
            min="0"
            step="50"
            inputMode="decimal"
            autoComplete="off"
            value={priorBolus}
            onChange={(e) => onPriorBolusChange(e.target.value)}
            className={`clinical-input w-full font-mono-tabular font-bold ${
              isValidPrior ? '' : 'border-[var(--danger)] text-[var(--danger-text)] bg-[var(--danger-soft)]'
            }`}
          />
        </div>
        <div>
          <label htmlFor="dkaInsulinRate" className="text-xs font-bold text-[var(--muted)] block mb-1.5">
            Insulin Infusion Rate
          </label>
          <select
            id="dkaInsulinRate"
            value={insulinRate}
            onChange={(e) => onInsulinRateChange(parseFloat(e.target.value))}
            className="clinical-input w-full font-bold"
          >
            <option value={0.1}>0.1 U/kg/hr (standard)</option>
            <option value={0.05}>0.05 U/kg/hr (young child, mild DKA)</option>
          </select>
        </div>
      </div>

      {!w ? (
        <NeedWeight what="DKA fluid and insulin rates" />
      ) : !isValidPrior || !plan ? (
        <Callout tone="danger">Enter a valid non-negative prior fluid bolus (≥ 0 mL) to calculate the fluid plan.</Callout>
      ) : (
        <>
          <ProtocolSection step={1} title="Initial Fluid Resuscitation" timing="0–1 h">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Metric
                label={`${p.initialResus.fluid}, 10–20 mL/kg`}
                value={`${plan.resusBolusMinMl}–${plan.resusBolusMaxMl} mL`}
                sub="Over 30–60 min, only if volume depleted"
              />
              <div className="space-y-2">
                <Callout tone="warning">{p.initialResus.note}</Callout>
                <Callout tone="info">{p.initialResus.shockNote}</Callout>
              </div>
            </div>
          </ProtocolSection>

          <ProtocolSection step={2} title="Deficit Replacement over 48 h" timing="From hour 1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Metric
                label={`Deficit ${severityPct}% × BW × 10`}
                value={`${plan.deficitMl} mL`}
                sub={`Net after ${fmtMg(rawPrior)} mL given: ${plan.netDeficitMl} mL`}
              />
              <Metric
                label="Rate breakdown"
                value={`${plan.maintenanceMlPerHr} + ${plan.deficitMlPerHr} mL/hr`}
                sub="Maintenance (Holliday–Segar) + deficit ÷ 48 h"
              />
              <Metric
                label="Combined IV fluid rate"
                value={`${plan.totalMlPerHr} mL/hr`}
                sub="0.9% NS or balanced crystalloid + KCl"
                action={
                  onAddOrder && (
                    <button
                      type="button"
                      className="order-btn"
                      title="Add to Active Patient Order Sheet"
                      onClick={() =>
                        onAddOrder(
                          makeOrder(
                            'proto-dka-fluid',
                            MODULE,
                            `DKA IV Rehydration Fluid @ ${plan.totalMlPerHr} mL/hr over 48h (Mnt ${plan.maintenanceMlPerHr} + Deficit ${plan.deficitMlPerHr} mL/hr, add D5W when BG < ${p.dextroseSwitch.bgThresholdMgDl})`
                          )
                        )
                      }
                    >
                      + Order Sheet
                    </button>
                  )
                }
              />
            </div>
            <p className="text-xs text-[var(--ink-secondary)]">
              Urine output is not added back. Reassess hydration hourly; oral fluids only once substantially improved.
            </p>
          </ProtocolSection>

          <ProtocolSection step={3} title="Insulin Infusion" timing="1–2 h after fluids start">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Metric
                label={`Regular Insulin ${insulinRate} U/kg/hr`}
                value={`${plan.insulinUPerHr} U/hr (${plan.insulinUPerHr} mL/hr)`}
                sub={p.insulinDrip.prep}
                action={
                  onAddOrder && (
                    <button
                      type="button"
                      className="order-btn"
                      title="Add to Active Patient Order Sheet"
                      onClick={() =>
                        onAddOrder(
                          makeOrder(
                            'proto-dka-ri',
                            MODULE,
                            `Regular Insulin Drip @ ${plan.insulinUPerHr} U/hr (${plan.insulinUPerHr} mL/hr) IV via Syringe Pump (${insulinRate} U/kg/hr; 50 U RI in 50 mL 0.9% NSS). No bolus.`
                          )
                        )
                      }
                    >
                      + Order Sheet
                    </button>
                  )
                }
              />
              <div className="space-y-2">
                <Callout tone="danger" title="No IV insulin bolus">
                  {p.insulinDrip.noBolus} Do not start insulin if K⁺ &lt; {p.insulinDrip.kThresholdMin} mEq/L.
                </Callout>
                <p className="text-xs text-[var(--ink-secondary)]">
                  Target BG fall 50–75 mg/dL/hr. {p.insulinDrip.titration}
                </p>
              </div>
            </div>
          </ProtocolSection>
        </>
      )}

      <ProtocolSection step={4} title="Potassium Replacement">
        <div className="clinical-table-container" tabIndex={0} role="region" aria-label="DKA potassium replacement rules">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Serum K⁺</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {p.potassiumRules.map((r) => (
                <tr key={r.range}>
                  <td className="font-mono-tabular font-bold whitespace-nowrap">{r.range}</td>
                  <td>{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--ink-secondary)]">
          Potassium may be given as half KCl and half potassium phosphate to limit hyperchloremia. Maximum 0.5 mEq/kg/hr.
        </p>
      </ProtocolSection>

      <ProtocolSection step={5} title="Add Dextrose" timing={`BG < ${p.dextroseSwitch.bgThresholdMgDl} mg/dL`}>
        <Checklist
          items={[
            `Switch to ${p.dextroseSwitch.switchFluid}`,
            'Keep BG 150–250 mg/dL while continuing insulin until acidosis resolves',
            'If BG still falls, increase dextrose to D10 or D12.5 before lowering insulin',
          ]}
        />
      </ProtocolSection>

      <ProtocolSection step={6} title="Monitoring">
        <div className="clinical-table-container" tabIndex={0} role="region" aria-label="DKA monitoring schedule">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Interval</th>
                <th>Parameters</th>
              </tr>
            </thead>
            <tbody>
              {p.monitoring.map((m) => (
                <tr key={m.items}>
                  <td className="font-mono-tabular font-bold whitespace-nowrap">{m.interval}</td>
                  <td>{m.items}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="warning" title="Sodium bicarbonate">
          {p.bicarbonate}
        </Callout>
      </ProtocolSection>

      <ProtocolSection step={7} title="Cerebral Edema (Cerebral Injury)" tone="danger">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-bold text-[var(--muted)] mb-1.5">Warning signs</div>
            <Checklist items={ce.warningSigns} />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-bold text-[var(--muted)]">Immediate treatment</div>
            {w > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Metric
                  label="Mannitol 0.5–1 g/kg"
                  value={fmtRange(mannitolG, 'g')}
                  sub={`${fmtRangeVolume(mannitolG, 0.2)} of ${ce.mannitolPrep}`}
                />
                <Metric label="3% NaCl 2.5–5 mL/kg" value={fmtRange(hypertonicMl, 'mL')} sub={ce.hypertonicPrep} />
              </div>
            ) : (
              <NeedWeight what="mannitol and hypertonic saline volumes" />
            )}
            <Checklist items={ce.actions} marker="number" />
          </div>
        </div>
      </ProtocolSection>

      <ProtocolSection title="Resolution and Transition to SC Insulin">
        <Checklist items={p.resolution} marker="check" />
      </ProtocolSection>

      <EvidenceFooter refKey={p.refKey} />
    </div>
  );
};
