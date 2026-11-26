import React from 'react';
import { OrderItem } from './ModalsAndDrawers';
import { AsthmaProtocol } from './protocols/AsthmaProtocol';
import { DkaProtocol } from './protocols/DkaProtocol';
import { ElectrolytesProtocol } from './protocols/ElectrolytesProtocol';
import { CroupProtocol, DEFAULT_WESTLEY, WestleyInputs } from './protocols/CroupProtocol';
import { SedationProtocol } from './protocols/SedationProtocol';
import { ToxicologyProtocol } from './protocols/ToxicologyProtocol';
import { VitalsReference } from './protocols/VitalsReference';

export type ProtocolTopic =
  | 'asthma'
  | 'dka'
  | 'electrolytes'
  | 'croup'
  | 'psa'
  | 'tox'
  | 'vitals';

export interface ProtocolsInputs {
  dkaSeverity: number;
  dkaPriorBolus: string;
  dkaInsulinRate: number;
  lyteNa: string;
  lyteGlucose: string;
  lyteTotalCa: string;
  lyteAlbumin: string;
  lyteK: string;
  lytePH: string;
  westley: WestleyInputs;
}

export const DEFAULT_PROTOCOLS_INPUTS: ProtocolsInputs = {
  dkaSeverity: 7,
  dkaPriorBolus: '0',
  dkaInsulinRate: 0.1,
  // Labs start empty: a pre-filled sample would render as this patient's corrected values.
  lyteNa: '',
  lyteGlucose: '',
  lyteTotalCa: '',
  lyteAlbumin: '',
  lyteK: '',
  lytePH: '',
  westley: DEFAULT_WESTLEY,
};

interface ProtocolsAndCDSViewProps {
  activeSubTab: ProtocolTopic;
  activeWeight: number | null;
  ageYears: number | null;
  onChangeTopic: (topic: ProtocolTopic) => void;
  onAddOrder?: (order: OrderItem) => void;
  onInvalidateOrders?: (targetPrefix?: string) => void;
  inputs: ProtocolsInputs;
  onChangeInputs: React.Dispatch<React.SetStateAction<ProtocolsInputs>>;
}

const TOPICS: { id: ProtocolTopic; label: string }[] = [
  { id: 'asthma', label: 'Asthma: Acute Exacerbation and HFNC' },
  { id: 'dka', label: 'DKA: Diabetic Ketoacidosis' },
  { id: 'electrolytes', label: 'Electrolytes: Imbalance Emergencies' },
  { id: 'croup', label: 'Croup: Westley Score and Stridor' },
  { id: 'psa', label: 'Sedation (PSA): Procedural Sedation' },
  { id: 'tox', label: 'Toxicology: Toxidromes and Antidotes' },
  { id: 'vitals', label: 'Vital Signs: Normal Ranges by Age' },
];

export const ProtocolsAndCDSView: React.FC<ProtocolsAndCDSViewProps> = ({
  activeSubTab,
  activeWeight,
  ageYears,
  onChangeTopic,
  onAddOrder,
  onInvalidateOrders,
  inputs,
  onChangeInputs,
}) => {
  const updateInputs = (patch: Partial<ProtocolsInputs>) => {
    onChangeInputs((prev) => ({ ...prev, ...patch }));
  };

  const w = activeWeight || 0;
  const common = { weightKg: w, ageYears, onAddOrder, onInvalidateOrders };

  return (
    <div className="clinical-card p-4 sm:p-5 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--border)]">
        <label htmlFor="protocolTopicSelect" className="text-xs font-bold text-[var(--muted)]">
          Clinical Protocol &amp; Reference
        </label>
        <select
          id="protocolTopicSelect"
          value={activeSubTab}
          onChange={(e) => onChangeTopic(e.target.value as ProtocolTopic)}
          className="clinical-input w-full sm:w-80 md:w-96 font-bold"
        >
          {TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {activeSubTab === 'asthma' && <AsthmaProtocol {...common} />}

      {activeSubTab === 'dka' && (
        <DkaProtocol
          {...common}
          severityPct={inputs.dkaSeverity}
          priorBolus={inputs.dkaPriorBolus}
          insulinRate={inputs.dkaInsulinRate}
          onSeverityChange={(val) => {
            onInvalidateOrders?.('proto-dka-fluid');
            updateInputs({ dkaSeverity: val });
          }}
          onPriorBolusChange={(val) => {
            onInvalidateOrders?.('proto-dka-fluid');
            updateInputs({ dkaPriorBolus: val });
          }}
          onInsulinRateChange={(val) => {
            onInvalidateOrders?.('proto-dka-ri');
            updateInputs({ dkaInsulinRate: val });
          }}
        />
      )}

      {activeSubTab === 'electrolytes' && (
        <ElectrolytesProtocol {...common} labs={inputs} onChangeLabs={(patch) => updateInputs(patch)} />
      )}

      {activeSubTab === 'croup' && (
        <CroupProtocol
          {...common}
          westley={inputs.westley}
          onChangeWestley={(patch) =>
            onChangeInputs((prev) => ({ ...prev, westley: { ...prev.westley, ...patch } }))
          }
        />
      )}

      {activeSubTab === 'psa' && <SedationProtocol {...common} />}

      {activeSubTab === 'tox' && <ToxicologyProtocol {...common} />}

      {activeSubTab === 'vitals' && <VitalsReference ageYears={ageYears} />}
    </div>
  );
};
