import React from 'react';
import { DATASET } from '../../data/dataset';
import { calcWeightDoseRange } from '../../utils/clinicalCalculations';
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
} from './ProtocolKit';

interface PsaAgent {
  key: string;
  name: string;
  doseMinMgPerKg?: number;
  doseMaxMgPerKg?: number;
  maxPerDoseMg?: number;
  doseMinMcgPerKg?: number;
  doseMaxMcgPerKg?: number;
  maxPerDoseMcg?: number;
  route: string;
  prep: string;
  note: string;
}

const MODULE = 'Protocol (PSA)';

export const SedationProtocol: React.FC<ProtocolPanelProps> = ({ weightKg: w, onAddOrder }) => {
  const s = DATASET.psaSafety;
  const agents = DATASET.proceduralSedation as unknown as PsaAgent[];
  const tox = DATASET.toxicologyAntidotes;
  const naloxone = tox.find((t) => t.key === 'naloxone-antidote')!;
  const flumazenil = tox.find((t) => t.key === 'flumazenil-antidote')!;

  const agentRows: DoseRow[] = agents.map((a) => {
    const isMcg = a.doseMinMcgPerKg != null;
    const r = isMcg
      ? calcWeightDoseRange(w, a.doseMinMcgPerKg!, a.doseMaxMcgPerKg ?? a.doseMinMcgPerKg!, a.maxPerDoseMcg)
      : calcWeightDoseRange(w, a.doseMinMgPerKg ?? 0, a.doseMaxMgPerKg ?? a.doseMinMgPerKg ?? 0, a.maxPerDoseMg);
    const unit = isMcg ? 'mcg' : 'mg';
    return {
      key: a.key,
      name: a.name,
      dose: fmtRange(r, unit),
      route: `${a.route}. ${a.prep}`,
      note: a.note,
      order: { prefix: `proto-psa-${a.key}`, module: MODULE, text: `${a.name} ${fmtRange(r, unit)} ${a.route}` },
    };
  });

  const reversalRows: DoseRow[] = [
    {
      key: naloxone.key,
      name: naloxone.name,
      dose: fmtRange(calcWeightDoseRange(w, naloxone.doseMgPerKg, naloxone.doseMgPerKg, naloxone.maxDoseMg), 'mg'),
      route: `${naloxone.route}. ${naloxone.prep}`,
      note: naloxone.note,
    },
    {
      key: flumazenil.key,
      name: flumazenil.name,
      dose: fmtRange(calcWeightDoseRange(w, flumazenil.doseMgPerKg, flumazenil.doseMgPerKg, flumazenil.maxDoseMg), 'mg'),
      route: `${flumazenil.route}. ${flumazenil.prep}`,
      alarm: 'Contraindicated in chronic benzodiazepine use, seizure disorder, or TCA co-ingestion.',
    },
  ];

  return (
    <div className="space-y-4">
      <ProtocolHeader
        title="Procedural Sedation and Analgesia (PSA)"
        subtitle="ACEP Clinical Policy and AAP/AAPD Pediatric Sedation Guideline 2019"
      />

      <ProtocolSection step={1} title="Pre-sedation Assessment" timing="Before drug">
        <Checklist items={s.preSedation} marker="check" />
      </ProtocolSection>

      <ProtocolSection step={2} title="Equipment at the Bedside (SOAPME)">
        <Checklist items={s.equipment} marker="check" />
      </ProtocolSection>

      <ProtocolSection step={3} title="Sedation and Analgesia Agents">
        {w ? (
          <DoseTable label="Procedural sedation agents" weightKg={w} rows={agentRows} onAddOrder={onAddOrder} />
        ) : (
          <NeedWeight what="sedation doses" />
        )}
        <Callout tone="warning" title="Ketamine relative contraindications">
          <Checklist items={s.ketamineContraindications} />
        </Callout>
        <p className="text-xs text-[var(--ink-secondary)]">
          Titrate to effect and wait for peak onset before redosing. Combining an opioid with a benzodiazepine sharply increases the
          risk of apnea: reduce each dose.
        </p>
      </ProtocolSection>

      <ProtocolSection step={4} title="Monitoring" timing="During and after">
        <Checklist items={s.monitoring} />
      </ProtocolSection>

      <ProtocolSection step={5} title="Adverse Events and Rescue" tone="danger">
        <div className="clinical-table-container" tabIndex={0} role="region" aria-label="PSA adverse event management">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {s.adverseEvents.map((e) => (
                <tr key={e.event}>
                  <td className="font-bold min-w-[9rem]">{e.event}</td>
                  <td>{e.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {w ? (
          <DoseTable label="Reversal agents" weightKg={w} rows={reversalRows} />
        ) : (
          <NeedWeight what="reversal agent doses" />
        )}
      </ProtocolSection>

      <ProtocolSection title="Discharge Criteria">
        <CriteriaColumns columns={[{ title: 'All criteria met before discharge', items: s.discharge, tone: 'good' }]} />
      </ProtocolSection>

      <EvidenceFooter refKey="sedation" />
    </div>
  );
};
