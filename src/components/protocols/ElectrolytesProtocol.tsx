import React from 'react';
import { ChevronRight } from 'lucide-react';
import { DATASET } from '../../data/dataset';
import {
  calcCorrectedCa,
  calcCorrectedNa,
  calcFreeWaterDeficit,
  calcIVKClReplacement,
  calcKShift,
  calcOralKClReplacement,
  calcWeightDoseRange,
  fmtMg,
} from '../../utils/clinicalCalculations';
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

const MODULE = 'Protocol (Electrolytes)';

export interface ElectrolyteLabs {
  lyteNa: string;
  lyteGlucose: string;
  lyteTotalCa: string;
  lyteAlbumin: string;
  lyteK: string;
  lytePH: string;
}

interface ElectrolytesProtocolProps extends ProtocolPanelProps {
  labs: ElectrolyteLabs;
  onChangeLabs: (patch: Partial<ElectrolyteLabs>) => void;
}

const LAB_FIELDS: { key: keyof ElectrolyteLabs; label: string; unit: string; step: string }[] = [
  { key: 'lyteNa', label: 'Measured Na', unit: 'mEq/L', step: '1' },
  { key: 'lyteGlucose', label: 'Glucose', unit: 'mg/dL', step: '1' },
  { key: 'lyteTotalCa', label: 'Total Ca', unit: 'mg/dL', step: '0.1' },
  { key: 'lyteAlbumin', label: 'Albumin', unit: 'g/dL', step: '0.1' },
  { key: 'lyteK', label: 'Serum K⁺', unit: 'mEq/L', step: '0.1' },
  { key: 'lytePH', label: 'Blood pH', unit: '', step: '0.01' },
];

export const ElectrolytesProtocol: React.FC<ElectrolytesProtocolProps> = ({
  weightKg: w,
  ageYears,
  onAddOrder,
  labs,
  onChangeLabs,
}) => {
  const ep = DATASET.electrolyteProtocols;
  const na = parseFloat(labs.lyteNa);
  const glucose = parseFloat(labs.lyteGlucose);
  const k = parseFloat(labs.lyteK);
  const ph = parseFloat(labs.lytePH);
  const ageMonths = ageYears != null ? ageYears * 12 : null;
  const totalCa = parseFloat(labs.lyteTotalCa);
  const albumin = parseFloat(labs.lyteAlbumin);
  // A corrected value is shown only when both of its inputs are valid numbers;
  // otherwise the helper would echo the measured value under a "corrected" label.
  const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x) && x > 0);
  const corrNaKatz = ok(na, glucose) ? calcCorrectedNa(na, glucose, 'katz') : null;
  const corrNaIspad = ok(na, glucose) ? calcCorrectedNa(na, glucose, 'ispad') : null;
  const corrCa = ok(totalCa, albumin) ? calcCorrectedCa(totalCa, albumin) : null;
  const kAt740 = ok(k, ph) ? calcKShift(k, ph) : null;
  const hyperNa = ep.hypernatremia;
  const isSevereHyperNa = Number.isFinite(na) && na >= hyperNa.severeThresholdMeqL;

  const hk = ep.hyperkalemia;
  const hkRows: DoseRow[] = w
    ? [
        {
          key: 'ca',
          name: `Step 1: ${hk[0].name}`,
          dose: fmtRange(calcWeightDoseRange(w, hk[0].doseMlPerKg!, hk[0].doseMlPerKg!, hk[0].maxMl), 'mL'),
          route: `${hk[0].route}. ${hk[0].prep}`,
          note: `${hk[0].indication}. ${hk[0].note}`,
          order: {
            prefix: 'proto-lyte-hk-ca',
            module: MODULE,
            text: `10% Calcium Gluconate ${fmtMg(Math.min(w * hk[0].doseMlPerKg!, hk[0].maxMl!))} mL IV slow over 5–10 min with ECG monitoring (indication: hyperkalemia with ECG changes or arrhythmia)`,
          },
        },
        {
          key: 'ri',
          name: `Step 2: ${hk[1].name}`,
          dose: `RI ${fmtMg(Math.min(w * hk[1].insulinDoseUPerKg!, hk[1].maxInsulinU!))} U + D10W ${fmtMg(
            Math.min(w * hk[1].d10wMlPerKg!, hk[1].maxD10wMl!)
          )} mL`,
          route: `${hk[1].route}. ${hk[1].prep}`,
          note: hk[1].note,
          order: {
            prefix: 'proto-lyte-hk-ri',
            module: MODULE,
            text: `Regular Insulin ${fmtMg(Math.min(w * hk[1].insulinDoseUPerKg!, hk[1].maxInsulinU!))} U IV + D10W ${fmtMg(
              Math.min(w * hk[1].d10wMlPerKg!, hk[1].maxD10wMl!)
            )} mL IV over 30 min, DTX q15–30 min`,
          },
        },
        {
          key: 'salb',
          name: `Step 2: ${hk[2].name}`,
          dose: w < 25 ? hk[2].fixedDoseLt25kg! : hk[2].fixedDoseGte25kg!,
          route: `${hk[2].route}. ${hk[2].prep}`,
          note: hk[2].note,
        },
        {
          key: 'bicarb',
          name: `Step 2: ${hk[3].name}`,
          dose: fmtRange(calcWeightDoseRange(w, hk[3].doseMeqPerKg!, hk[3].doseMeqPerKg!, hk[3].maxMeq), 'mEq'),
          route: `${hk[3].route}. ${hk[3].prep}`,
          note: hk[3].note,
        },
        {
          key: 'lasix',
          name: `Step 3: ${hk[4].name}`,
          dose: fmtRange(calcWeightDoseRange(w, hk[4].doseMgPerKg!, hk[4].doseMgPerKg!, hk[4].maxMg), 'mg'),
          route: `${hk[4].route}. ${hk[4].prep}`,
          note: hk[4].note,
        },
        {
          key: 'resin',
          name: `Step 3: ${hk[5].name}`,
          dose: fmtRange(calcWeightDoseRange(w, hk[5].doseGPerKg!, hk[5].doseGPerKg!, hk[5].maxG), 'g'),
          route: `${hk[5].route}. ${hk[5].prep}`,
          note: hk[5].note,
        },
      ]
    : [];

  const hypoNa = ep.symptomaticHyponatremia;
  const naBolus = calcWeightDoseRange(w, hypoNa.doseMlPerKgMin, hypoNa.doseMlPerKgMax, hypoNa.maxMl);
  const fwd = w && na > 145 ? calcFreeWaterDeficit(w, na, 140, ageYears) : null;
  const ivK = w ? calcIVKClReplacement(w, ep.hypokalemia.ivDoseMeqPerKg) : null;
  const poK = w ? calcOralKClReplacement(w, 1.5) : null;
  const caRange = calcWeightDoseRange(w, ep.hypocalcemia.doseMlPerKg, ep.hypocalcemia.doseMlPerKg, ep.hypocalcemia.maxMl);
  const mgRange = calcWeightDoseRange(w, ep.hypomagnesemia.doseMgPerKg / 2, ep.hypomagnesemia.doseMgPerKg, ep.hypomagnesemia.maxMg);

  return (
    <div className="space-y-4">
      <ProtocolHeader
        title="Pediatric Electrolyte Emergencies"
        subtitle="Harriet Lane Handbook 24th ed and Nelson Textbook of Pediatrics 22nd ed"
      />

      <ProtocolSection title="Laboratory Inputs and Corrected Values">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 text-xs">
          {LAB_FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={f.key} className="font-bold text-[var(--muted)] block mb-1.5">
                {f.label} {f.unit && <span className="font-normal">({f.unit})</span>}
              </label>
              <input
                id={f.key}
                type="number"
                step={f.step}
                inputMode="decimal"
                autoComplete="off"
                value={labs[f.key]}
                onChange={(e) => onChangeLabs({ [f.key]: e.target.value })}
                className="clinical-input w-full font-mono-tabular font-bold"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: 'Corrected Na (Katz / ISPAD)',
              value: `${corrNaKatz?.toFixed(1) ?? '—'} / ${corrNaIspad?.toFixed(1) ?? '—'} mEq/L`,
            },
            {
              label: 'Corrected Calcium (Payne)',
              value: `${corrCa?.toFixed(1) ?? '—'} mg/dL`,
            },
            { label: 'Estimated K⁺ at pH 7.40', value: `${kAt740?.toFixed(1) ?? '—'} mEq/L` },
          ].map((m) => (
            <div key={m.label} className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-md)] p-3">
              <div className="text-xs text-[var(--muted)]">{m.label}</div>
              <div className="text-lg font-extrabold font-mono-tabular text-[var(--ink)] mt-0.5">{m.value}</div>
            </div>
          ))}
        </div>
      </ProtocolSection>

      <ProtocolSection step={1} title="Hyperkalemia (3-Step Treatment)" timing="K⁺ > 6 or ECG changes">
        <div className="text-xs text-[var(--ink-secondary)]">
          <span className="font-bold">ECG progression: </span>
          {ep.hyperkalemiaEcg.join(', then ')}. Exclude hemolyzed heel-stick sample before treating an isolated value.
        </div>
        {w ? (
          <DoseTable label="Hyperkalemia treatment" weightKg={w} rows={hkRows} onAddOrder={onAddOrder} />
        ) : (
          <NeedWeight what="hyperkalemia doses" />
        )}
        <p className="text-xs text-[var(--ink-secondary)]">
          Stop all potassium intake. Calcium does not lower K⁺; repeat in 5–10 min if ECG changes persist. Dialysis for refractory
          hyperkalemia or anuric renal failure.
        </p>
      </ProtocolSection>

      <ProtocolSection step={2} title="Symptomatic Hyponatremia" timing="Seizure or encephalopathy">
        {w ? (
          <div className="flex flex-wrap items-end justify-between gap-3 bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-md)] p-3">
            <div>
              <div className="text-xs font-semibold text-[var(--muted)]">{hypoNa.name}</div>
              <div className="text-lg font-extrabold font-mono-tabular text-[var(--ink)] mt-0.5">
                {fmtRange(naBolus, 'mL')} IV over 10–20 min
              </div>
              <div className="text-xs text-[var(--ink-secondary)] mt-0.5">{hypoNa.prep}. {hypoNa.note}</div>
            </div>
            {onAddOrder && naBolus && (
              <button
                type="button"
                className="order-btn"
                title="Add to Active Patient Order Sheet"
                onClick={() =>
                  onAddOrder(
                    makeOrder(
                      'proto-lyte-3nacl',
                      MODULE,
                      `3% NaCl ${fmtRange(naBolus, 'mL')} IV over 20 min for acute symptomatic hyponatremia/seizure`
                    )
                  )
                }
              >
                + Order Sheet
              </button>
            )}
          </div>
        ) : (
          <NeedWeight what="the 3% NaCl bolus" />
        )}
        <Callout tone="warning" title="Correction ceiling">
          {hypoNa.correctionCap} {hypoNa.recheck}
        </Callout>
      </ProtocolSection>

      <ProtocolSection step={3} title="Hypernatremic Dehydration">
        <p className="text-[13px] font-mono-tabular text-[var(--ink)]">{ep.hypernatremia.formula}</p>
        {isSevereHyperNa && (
          <Callout tone="danger" title={`Severe hypernatremia (Na ≥ ${hyperNa.severeThresholdMeqL})`}>
            {hyperNa.severeNote}
          </Callout>
        )}
        {isSevereHyperNa && fwd != null && fwd > 0 && (
          <div className="text-[13px] text-[var(--ink)]">
            Estimated free water deficit to Na 140:{' '}
            <span className="font-mono-tabular font-extrabold">{(fwd * 1000).toFixed(0)} mL</span> (reference figure only, not an
            infusion rate).
          </div>
        )}
        {!isSevereHyperNa && fwd != null && fwd > 0 && (
          <div className="text-[13px] text-[var(--ink)]">
            Free water deficit at Na {na}:{' '}
            <span className="font-mono-tabular font-extrabold">{(fwd * 1000).toFixed(0)} mL</span>, replace over 48 h (
            <span className="font-mono-tabular font-bold">{((fwd * 1000) / 48).toFixed(1)} mL/hr</span> on top of maintenance).
          </div>
        )}
        <Checklist items={[ep.hypernatremia.duration, ep.hypernatremia.correctionCap, ep.hypernatremia.note]} />
      </ProtocolSection>

      <ProtocolSection step={4} title="Hypokalemia">
        {w && ivK && poK ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-md)] p-3">
              <div className="text-xs font-semibold text-[var(--muted)]">IV KCl slow piggyback (0.5 mEq/kg, max 20 mEq)</div>
              <div className="text-lg font-extrabold font-mono-tabular text-[var(--ink)] mt-0.5">
                KCl {ivK.doseMeq} mEq ({ivK.kcl2MeqPerMl} mL of 2 mEq/mL)
              </div>
              <div className="text-xs text-[var(--ink-secondary)] mt-0.5">
                Peripheral: in ≥ {ivK.minVolPeripheralMl} mL NSS over 2 h ({ivK.peripheralRateMlPerHr} mL/hr)
              </div>
              <div className="text-xs text-[var(--ink-secondary)]">
                Central: in ≥ {ivK.minVolCentralMl} mL over 1 h ({ivK.centralRateMlPerHr} mL/hr)
              </div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-md)] p-3">
              <div className="text-xs font-semibold text-[var(--muted)]">Oral KCl (1–2 mEq/kg/day, mild and asymptomatic)</div>
              <div className="text-lg font-extrabold font-mono-tabular text-[var(--ink)] mt-0.5">
                {poK.tidDoseMeq} mEq PO TID
              </div>
              <div className="text-xs text-[var(--ink-secondary)] mt-0.5">
                10% KCl syrup {poK.kcl10PctSyrupMlPerDose} mL per dose ({poK.dailyMeq} mEq/day)
              </div>
            </div>
          </div>
        ) : (
          <NeedWeight what="potassium replacement" />
        )}
        <Callout tone="danger" title="Potassium safety rules">
          <Checklist items={ep.hypokalemia.safetyRules} />
        </Callout>
      </ProtocolSection>

      <ProtocolSection step={5} title="Symptomatic Hypocalcemia and Hypomagnesemia">
        {w ? (
          <DoseTable
            label="Calcium and magnesium replacement"
            weightKg={w}
            onAddOrder={onAddOrder}
            rows={[
              {
                key: 'ca',
                name: ep.hypocalcemia.name,
                dose: fmtRange(caRange, 'mL'),
                route: `${ep.hypocalcemia.route}. ${ep.hypocalcemia.prep}`,
                note: ep.hypocalcemia.note,
              },
              {
                key: 'mg',
                name: ep.hypomagnesemia.name,
                dose: fmtRange(mgRange, 'mg'),
                volume: mgRange ? fmtRange({ ...mgRange, min: mgRange.min / 500, max: mgRange.max / 500 }, 'mL of 50%') : undefined,
                route: `${ep.hypomagnesemia.route}. ${ep.hypomagnesemia.prep}`,
                note: ep.hypomagnesemia.note,
              },
            ]}
          />
        ) : (
          <NeedWeight what="calcium and magnesium doses" />
        )}
      </ProtocolSection>

      <ProtocolSection title="Age-Specific Reference Ranges">
        <div className="clinical-table-container" tabIndex={0} role="region" aria-label="Electrolyte reference ranges by age">
          <table className="clinical-table" aria-label="Electrolyte reference ranges by age">
            <thead>
              <tr>
                <th>Age</th>
                <th>Na</th>
                <th>K</th>
                <th>Cl</th>
                <th>HCO₃</th>
                <th>Total Ca (mg/dL)</th>
                <th>iCa</th>
                <th>Mg</th>
                <th>PO₄</th>
                <th>AG</th>
              </tr>
            </thead>
            <tbody>
              {DATASET.electrolyteRef.map((r) => {
                const isCur =
                  !r.isPreterm &&
                  ageMonths != null &&
                  ageMonths >= r.minAgeMonths &&
                  ageMonths < r.maxAgeMonths;
                return (
                  <tr key={r.ageKey} className={isCur ? 'bg-[var(--accent-soft)] font-bold' : ''}>
                    <td className="whitespace-nowrap">
                      {isCur && <ChevronRight className="inline w-3.5 h-3.5 mr-0.5 -mt-0.5" aria-label="Current age bracket" />}
                      {r.ageLabel}
                    </td>
                    {[r.na, r.k, r.cl, r.hco3, r.totalCa, r.iCa, r.mg, r.po4, r.anionGap].map((v, i) => (
                      <td key={i} className="font-mono-tabular whitespace-nowrap">
                        {v}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ProtocolSection>

      <EvidenceFooter refKey={ep.refKey} />
    </div>
  );
};
