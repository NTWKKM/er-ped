import React from 'react';
import { DATASET } from '../../data/dataset';
import { calcNacRegimen, calcWeightDoseRange, fmtMg } from '../../utils/clinicalCalculations';
import {
  Callout,
  Checklist,
  DoseRow,
  DoseTable,
  EvidenceFooter,
  NeedWeight,
  ProtocolHeader,
  ProtocolPanelProps,
  ProtocolSection,
  fmtRange,
  makeOrder,
} from './ProtocolKit';

interface Antidote {
  key: string;
  name: string;
  indication: string;
  doseMgPerKg: number;
  doseMinMgPerKg?: number;
  minDoseMg?: number;
  maxDoseMg: number;
  maxTotalDoseMg?: number;
  unit?: string;
  route: string;
  prep: string;
  note: string;
}

const MODULE = 'Protocol (Toxicology)';

export const ToxicologyProtocol: React.FC<ProtocolPanelProps> = ({ weightKg: w, onAddOrder }) => {
  const a = DATASET.toxicologyApproach;
  const antidotes = (DATASET.toxicologyAntidotes as unknown as Antidote[]).filter((x) => x.key !== 'nac-paracetamol');
  const nac = calcNacRegimen(w);

  const rows: DoseRow[] = antidotes.map((x) => {
    const isGram = x.unit === 'g/kg';
    const r = isGram
      ? calcWeightDoseRange(w, x.doseMgPerKg, x.doseMgPerKg, x.maxDoseMg / 1000)
      : calcWeightDoseRange(w, x.doseMinMgPerKg ?? x.doseMgPerKg, x.doseMgPerKg, x.maxDoseMg, x.minDoseMg);
    const unit = isGram ? 'g' : 'mg';
    const contraindication = x.note.startsWith('⚠️') || x.note.includes('⚠️');
    const [plain, alarm] = contraindication ? x.note.split('⚠️').map((t) => t.trim()) : [x.note, undefined];
    return {
      key: x.key,
      name: x.name,
      dose: fmtRange(r, unit),
      route: `${x.indication}. ${x.route}. ${x.prep}`,
      note: plain || undefined,
      alarm,
      order: { prefix: `proto-tox-${x.key}`, module: MODULE, text: `${x.name} ${fmtRange(r, unit)} ${x.route}` },
    };
  });

  return (
    <div className="space-y-4">
      <ProtocolHeader
        title="Pediatric Poisoning and Antidotes"
        subtitle="Goldfrank's Toxicologic Emergencies 12th ed and Ramathibodi / Siriraj Poison Center protocols"
      />

      <ProtocolSection step={1} title="Initial Approach" timing="First 10 min">
        <Checklist items={a.initial} marker="number" />
      </ProtocolSection>

      <ProtocolSection step={2} title="Recognize the Toxidrome">
        <div className="clinical-table-container" tabIndex={0} role="region" aria-label="Toxidromes">
          <table className="clinical-table" aria-label="Toxidromes">
            <thead>
              <tr>
                <th>Toxidrome</th>
                <th>Key features</th>
                <th>Specific therapy</th>
              </tr>
            </thead>
            <tbody>
              {a.toxidromes.map((t) => (
                <tr key={t.name}>
                  <td className="font-bold whitespace-nowrap">{t.name}</td>
                  <td>{t.features}</td>
                  <td className="font-semibold">{t.antidote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProtocolSection>

      <ProtocolSection step={3} title="Antidotes and Decontamination">
        {w ? <DoseTable label="Antidote doses" weightKg={w} rows={rows} onAddOrder={onAddOrder} /> : <NeedWeight what="antidote doses" />}
        <Callout tone="warning" title="Activated charcoal: do not give if">
          <Checklist items={a.charcoalContraindications} />
        </Callout>
      </ProtocolSection>

      <ProtocolSection step={4} title="Paracetamol Overdose: IV N-Acetylcysteine (21-h, 3-bag)">
        <p className="text-[13px] text-[var(--ink)] leading-snug">{a.nacTreatmentLine}</p>
        {w && nac ? (
          <>
            <div className="clinical-table-container" tabIndex={0} role="region" aria-label="NAC 3-bag regimen">
              <table className="clinical-table" aria-label="NAC 3-bag regimen">
                <thead>
                  <tr>
                    <th>Bag</th>
                    <th>NAC dose</th>
                    <th>D5W volume</th>
                    <th>Total in bag</th>
                    <th>Duration</th>
                    <th>Pump rate</th>
                  </tr>
                </thead>
                <tbody>
                  {nac.map((b) => (
                    <tr key={b.bag}>
                      <td className="font-bold">
                        Bag {b.bag} ({[150, 50, 100][b.bag - 1]} mg/kg)
                      </td>
                      <td className="font-mono-tabular font-bold whitespace-nowrap">
                        {fmtMg(b.doseMg)} mg
                        <div className="text-xs font-semibold text-[var(--ink-secondary)]">= {fmtMg(b.nacMl)} mL of 200 mg/mL</div>
                      </td>
                      <td className="font-mono-tabular whitespace-nowrap">{b.diluentMl} mL</td>
                      <td className="font-mono-tabular whitespace-nowrap">{fmtMg(b.totalMl)} mL</td>
                      <td className="font-mono-tabular whitespace-nowrap">{b.durationHr} h</td>
                      <td className="font-mono-tabular font-bold whitespace-nowrap">{b.rateMlPerHr} mL/hr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--ink-secondary)]">
                {w < 20
                  ? 'Weight < 20 kg: D5W scaled to 3 / 7 / 14 mL/kg to prevent hyponatremia.'
                  : 'Standard D5W volumes 200 / 500 / 1000 mL.'}{' '}
                Pump rate runs the total bag volume (D5W + NAC) over the stated time. Dosing weight capped at 100 kg. Check LFT, INR and paracetamol level before stopping.
              </p>
              {onAddOrder && (
                <button
                  type="button"
                  className="order-btn"
                  title="Add to Active Patient Order Sheet"
                  onClick={() =>
                    onAddOrder(
                      makeOrder(
                        'proto-tox-nac',
                        MODULE,
                        `IV NAC 21-h: ${nac
                          .map(
                            (b) =>
                              `Bag ${b.bag} ${fmtMg(b.doseMg)} mg in D5W ${b.diluentMl} mL (total ${fmtMg(b.totalMl)} mL) @ ${b.rateMlPerHr} mL/hr over ${b.durationHr} h`
                          )
                          .join('; ')}`
                      )
                    )
                  }
                >
                  + Order Sheet
                </button>
              )}
            </div>
          </>
        ) : (
          <NeedWeight what="the NAC regimen" />
        )}
      </ProtocolSection>

      <EvidenceFooter refKey="toxicology" />
    </div>
  );
};
