import React from 'react';
import { DATASET } from '../../data/dataset';
import { calcWeightDoseRange, fmtMg } from '../../utils/clinicalCalculations';
import {
  Callout,
  Checklist,
  CriteriaColumns,
  DoseRow,
  DoseTable,
  EvidenceFooter,
  NeedWeight,
  ProtocolHeader,
  ProtocolPanelProps,
  ProtocolSection,
  fmtRange,
  fmtRangeVolume,
} from './ProtocolKit';

interface AsthmaDrug {
  key: string;
  name: string;
  doseMgPerKg?: number | null;
  doseMinMgPerKg?: number;
  doseMaxMgPerKg?: number;
  minDoseMg?: number;
  maxDoseMg?: number | null;
  doseMcgPerKg?: number;
  doseMinMcgPerKg?: number;
  maxDoseMcg?: number;
  fixedDose?: string;
  fixedDoseLt20kg?: number;
  fixedDoseGte20kg?: number;
  route: string;
  prep: string;
  note: string;
}

interface AsthmaStep {
  stage: string;
  name: string;
  actions: string;
  drugs: AsthmaDrug[];
}

const MODULE = 'Protocol (Asthma)';

/** Concentration (mg/mL) used to show a drawing volume next to the dose. */
const DRAW_MG_PER_ML: Record<string, number> = {
  'epinephrine-im-anaphy': 1,
  'epinephrine-im-lt': 1,
  'salbutamol-neb': 5,
  'mgso4-iv': 500,
  'dexamethasone-alt': 4,
  'terbutaline-iv': 0.5,
};

/** Existing order prefixes are kept so queue invalidation keeps working. */
const ORDER_PREFIX: Record<string, string> = {
  'salbutamol-neb': 'proto-asthma-neb',
  'prednisolone-po': 'proto-asthma-steroid',
  'dexamethasone-alt': 'proto-asthma-steroid',
};

function buildRow(d: AsthmaDrug, w: number): DoseRow {
  const prefix = ORDER_PREFIX[d.key] ?? `proto-asthma-${d.key}`;
  const base = { key: d.key, name: d.name, route: `${d.route}. ${d.prep}`, note: d.note.replace(/^⚠️\s*/, '') };

  if (d.fixedDose) {
    return {
      ...base,
      dose: d.fixedDose,
      order: { prefix, module: MODULE, text: `${d.name} ${d.fixedDose}, ${d.route}` },
    };
  }
  if (d.fixedDoseLt20kg != null && d.fixedDoseGte20kg != null) {
    const mcg = Math.round((w < 20 ? d.fixedDoseLt20kg : d.fixedDoseGte20kg) * 1000);
    return {
      ...base,
      dose: `${mcg} mcg`,
      note: `${w < 20 ? '< 20 kg' : '≥ 20 kg'} band. ${base.note}`,
      order: { prefix, module: MODULE, text: `${d.name} ${mcg} mcg ${d.route}` },
    };
  }
  if (d.doseMcgPerKg != null) {
    const r = calcWeightDoseRange(w, d.doseMinMcgPerKg ?? d.doseMcgPerKg, d.doseMcgPerKg, d.maxDoseMcg);
    const perMl = DRAW_MG_PER_ML[d.key] ? DRAW_MG_PER_ML[d.key] * 1000 : 0;
    return {
      ...base,
      dose: fmtRange(r, 'mcg'),
      volume: perMl ? fmtRangeVolume(r, perMl) : undefined,
      order: { prefix, module: MODULE, text: `${d.name} ${fmtRange(r, 'mcg')} ${d.route}` },
    };
  }
  const lo = d.doseMinMgPerKg ?? d.doseMgPerKg ?? 0;
  const hi = d.doseMaxMgPerKg ?? d.doseMgPerKg ?? lo;
  const r = calcWeightDoseRange(w, lo, hi, d.maxDoseMg, d.minDoseMg);
  const perMl = DRAW_MG_PER_ML[d.key];
  return {
    ...base,
    dose: fmtRange(r, 'mg'),
    volume: perMl ? fmtRangeVolume(r, perMl) : undefined,
    order: { prefix, module: MODULE, text: `${d.name} ${fmtRange(r, 'mg')} ${d.route}` },
  };
}

export const AsthmaProtocol: React.FC<ProtocolPanelProps> = ({ weightKg: w, onAddOrder }) => {
  const p = DATASET.asthmaProtocol;
  const steps = p.steps as unknown as AsthmaStep[];
  const hf = p.hfncSettings;
  const mp = p.methylprednisolone;

  const hfMin = Math.min(hf.flowRateMaxLPerMin, w * hf.flowRateMinLPerKgPerMin);
  const hfMax = Math.min(hf.flowRateMaxLPerMin, w * hf.flowRateLPerKgPerMin);
  const nebReduce = Math.min(hf.nebFlowMaxLPerMin, w * hf.nebFlowMaxLPerKgPerMin);
  const mpRange = calcWeightDoseRange(w, mp.doseMgPerKgPerDayMin, mp.doseMgPerKgPerDayMax);

  return (
    <div className="space-y-4">
      <ProtocolHeader
        title="Acute Asthma Exacerbation"
        subtitle="Stepwise ED pathway per GINA 2026 and Thai Asthma Council (TAC 2568)"
      />

      <ProtocolSection title="Severity Assessment">
        <div className="clinical-table-container" tabIndex={0} role="region" aria-label="Asthma severity assessment">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Mild to Moderate</th>
                <th>Severe</th>
                <th className="text-[var(--danger-text)]">Life-threatening</th>
              </tr>
            </thead>
            <tbody>
              {p.severityAssessment.map((r) => (
                <tr key={r.feature}>
                  <td className="font-bold whitespace-nowrap">{r.feature}</td>
                  <td>{r.mildModerate}</td>
                  <td>{r.severe}</td>
                  <td className="font-semibold">{r.lifeThreatening}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="danger" title="Red flags: call PICU now">
          <Checklist items={p.redFlags} />
        </Callout>
      </ProtocolSection>

      {!w ? (
        <NeedWeight what="asthma drug doses and HFNC settings" />
      ) : (
        steps.map((s, i) => (
          <ProtocolSection
            key={s.stage}
            step={i + 1}
            title={s.name}
            timing={s.stage}
            tone={s.stage === 'Life-threatening' ? 'danger' : 'default'}
          >
            <p className="text-[13px] text-[var(--ink)] leading-snug">{s.actions}</p>

            {s.name.startsWith('HFNC') && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  { label: 'Flow (1–2 L/kg/min)', value: `${fmtMg(hfMin)}–${fmtMg(hfMax)} L/min`, sub: `Max ${hf.flowRateMaxLPerMin} L/min` },
                  { label: 'Starting FiO₂', value: `${hf.startFiO2Percent}%`, sub: `Titrate to SpO₂ ≥ ${hf.targetSpO2Percent}%` },
                  { label: 'Temperature', value: `${hf.temperatureC} °C`, sub: 'Humidified' },
                  { label: 'During in-line neb', value: `−${fmtMg(nebReduce)} L/min`, sub: '0.25 L/kg/min, max 10 L/min' },
                ].map((m) => (
                  <div key={m.label} className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-md)] p-2.5">
                    <div className="text-[11px] font-semibold text-[var(--muted)]">{m.label}</div>
                    <div className="text-base sm:text-lg font-extrabold font-mono-tabular text-[var(--ink)]">{m.value}</div>
                    <div className="text-[11px] text-[var(--muted)]">{m.sub}</div>
                  </div>
                ))}
              </div>
            )}

            {s.drugs.length > 0 && (
              <DoseTable
                label={`${s.name} medications`}
                weightKg={w}
                rows={s.drugs.map((d) => buildRow(d, w))}
                onAddOrder={onAddOrder}
              />
            )}

            {s.name.startsWith('Reassess') && (
              <p className="text-xs text-[var(--ink-secondary)]">
                Alternative IV steroid: {mp.name} {fmtRange(mpRange, 'mg/day')} {mp.route} (max {mp.maxPerDoseMg} mg/dose).
              </p>
            )}
          </ProtocolSection>
        ))
      )}

      <ProtocolSection title="Disposition">
        <CriteriaColumns
          columns={[
            { title: 'Discharge when all present', items: p.dispositionCriteria.discharge, tone: 'good' },
            { title: 'Admit to ward', items: p.dispositionCriteria.admit, tone: 'warning' },
            { title: 'Admit to PICU', items: p.dispositionCriteria.picu, tone: 'danger' },
          ]}
        />
      </ProtocolSection>

      <EvidenceFooter refKey={p.refKey} />
    </div>
  );
};
