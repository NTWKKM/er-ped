import React from 'react';
import { DATASET } from '../../data/dataset';
import { calcWeightDoseRange, classifyWestleyScore, fmtMg } from '../../utils/clinicalCalculations';
import {
  Callout,
  Checklist,
  DoseTable,
  EvidenceFooter,
  NeedWeight,
  ProtocolHeader,
  ProtocolPanelProps,
  ProtocolSection,
  fmtRange,
  fmtRangeVolume,
} from './ProtocolKit';

const MODULE = 'Protocol (Croup)';

export interface WestleyInputs {
  consciousness: number;
  cyanosis: number;
  stridor: number;
  airEntry: number;
  retractions: number;
}

export const DEFAULT_WESTLEY: WestleyInputs = {
  consciousness: 0,
  cyanosis: 0,
  stridor: 0,
  airEntry: 0,
  retractions: 0,
};

const WESTLEY_LABELS: Record<keyof WestleyInputs, string> = {
  stridor: 'Stridor',
  retractions: 'Retractions',
  airEntry: 'Air entry',
  cyanosis: 'Cyanosis',
  consciousness: 'Level of consciousness',
};

interface CroupProtocolProps extends ProtocolPanelProps {
  westley: WestleyInputs;
  onChangeWestley: (patch: Partial<WestleyInputs>) => void;
}

export const CroupProtocol: React.FC<CroupProtocolProps> = ({ weightKg: w, onAddOrder, westley, onChangeWestley }) => {
  const c = DATASET.croup;
  const score = Object.values(westley).reduce((a, b) => a + b, 0);
  const severity = classifyWestleyScore(score) ?? 'mild';
  const band = c.severityBands.find((b) => b.key === severity)!;
  const bandTone =
    severity === 'failure' || severity === 'severe' ? 'danger' : severity === 'moderate' ? 'warning' : 'info';

  const [dexa, racemic, lEpi] = c.meds;
  const dexaStd = calcWeightDoseRange(w, dexa.standardDoseMgPerKg!, dexa.standardDoseMgPerKg!, dexa.maxSingleMg);
  const dexaLow = calcWeightDoseRange(w, dexa.doseMinMgPerKg!, dexa.doseMinMgPerKg!, dexa.maxSingleMg);
  const racemicMl = calcWeightDoseRange(w, racemic.doseMlPerKg!, racemic.doseMlPerKg!, racemic.maxMl);
  const lEpiMl = calcWeightDoseRange(w, lEpi.doseMlPerKg!, lEpi.doseMlPerKg!, lEpi.maxMl);

  return (
    <div className="space-y-4">
      <ProtocolHeader
        title="Croup (Acute Laryngotracheobronchitis)"
        subtitle="Westley Croup Score with AAP and Cochrane-based management"
      />

      <ProtocolSection step={1} title="Westley Croup Score">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.keys(WESTLEY_LABELS) as (keyof WestleyInputs)[]).map((key) => (
            <div key={key}>
              <label htmlFor={`westley-${key}`} className="text-xs font-bold text-[var(--muted)] block mb-1.5">
                {WESTLEY_LABELS[key]}
              </label>
              <select
                id={`westley-${key}`}
                value={westley[key]}
                onChange={(e) => onChangeWestley({ [key]: parseInt(e.target.value, 10) })}
                className="clinical-input w-full"
              >
                {c.westley[key].map((o) => (
                  <option key={o.score} value={o.score}>
                    {o.score}: {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div aria-live="polite">
          <Callout tone={bandTone} title={`Score ${score} / 17: ${band.label}`}>
            {band.description}
          </Callout>
        </div>
        <div className="clinical-table-container" tabIndex={0} role="region" aria-label="Croup severity bands">
          <table className="clinical-table" aria-label="Croup severity bands">
            <thead>
              <tr>
                <th>Score</th>
                <th>Severity</th>
                <th>Management</th>
              </tr>
            </thead>
            <tbody>
              {c.severityBands.map((b) => (
                <tr key={b.key} className={b.key === severity ? 'bg-[var(--accent-soft)]' : ''}>
                  <td className="font-mono-tabular font-bold whitespace-nowrap">
                    {b.min}–{b.max}
                  </td>
                  <td className="font-bold whitespace-nowrap">{b.label}</td>
                  <td>
                    <Checklist items={c.management[b.key as keyof typeof c.management]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProtocolSection>

      <ProtocolSection step={2} title="Medications">
        {w ? (
          <DoseTable
            label="Croup medications"
            weightKg={w}
            onAddOrder={onAddOrder}
            rows={[
              {
                key: 'dexa',
                name: dexa.name,
                dose: fmtRange(dexaStd, 'mg'),
                volume: `${fmtRangeVolume(dexaStd, 4)} of 4 mg/mL`,
                route: `${dexa.route}. ${dexa.prep}`,
                note: `Mild croup: 0.15 mg/kg = ${fmtRange(dexaLow, 'mg')} is equally effective. Max ${dexa.maxSingleMg} mg. ${dexa.note}`,
                order: {
                  prefix: 'proto-croup-dexa',
                  module: MODULE,
                  text: `Dexamethasone ${fmtRange(dexaStd, 'mg')} PO/IM/IV single dose (0.6 mg/kg, max 16 mg)`,
                },
              },
              {
                key: 'lepi',
                name: lEpi.name,
                dose: fmtRange(lEpiMl, 'mL'),
                route: `${lEpi.route}. ${lEpi.diluent}`,
                note: lEpi.note,
                order: {
                  prefix: 'proto-croup-epi',
                  module: MODULE,
                  text: `Nebulized L-Epinephrine 1:1,000 ${fmtRange(lEpiMl, 'mL')} with O₂ 6–8 L/min, observe ${c.observationHours.min}–${c.observationHours.standard} h for rebound`,
                },
              },
              {
                key: 'racemic',
                name: racemic.name,
                dose: fmtRange(racemicMl, 'mL'),
                route: `${racemic.route}. ${racemic.diluent}`,
                note: racemic.note,
              },
            ]}
          />
        ) : (
          <NeedWeight what="croup medication doses" />
        )}
        <p className="text-xs text-[var(--ink-secondary)]">
          Nebulized epinephrine may be repeated q15–20 min in severe croup. Each dose restarts the {fmtMg(c.observationHours.min)}–
          {fmtMg(c.observationHours.standard)} h observation period. Humidified air and antibiotics have no proven benefit.
        </p>
      </ProtocolSection>

      <ProtocolSection step={3} title="Think Beyond Croup" tone="danger">
        <Checklist items={c.differentialRedFlags} />
      </ProtocolSection>

      <ProtocolSection step={4} title="Discharge Criteria">
        <Checklist items={c.discharge} marker="check" />
      </ProtocolSection>

      <EvidenceFooter refKey={c.refKey} />
    </div>
  );
};
