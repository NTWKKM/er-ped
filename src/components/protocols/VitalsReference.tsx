import React from 'react';
import { ChevronRight } from 'lucide-react';
import { DATASET } from '../../data/dataset';
import { calcHypotensionSbp } from '../../utils/clinicalCalculations';
import { Callout, EvidenceFooter, ProtocolHeader, ProtocolSection } from './ProtocolKit';

export const VitalsReference: React.FC<{ ageYears: number | null }> = ({ ageYears }) => {
  const sbpCutoff = calcHypotensionSbp(ageYears);
  return (
    <div className="space-y-4">
      <ProtocolHeader title="Pediatric Vital Signs" subtitle="Age-banded normal ranges and PALS hypotension thresholds" />

      {sbpCutoff != null ? (
        <Callout tone="info" title={`Hypotension for this patient: SBP < ${sbpCutoff} mmHg`}>
          Calculated from the topbar age. Tachycardia and prolonged capillary refill appear before hypotension; hypotension in a
          child is a late, pre-arrest sign.
        </Callout>
      ) : (
        <Callout tone="info">Enter patient Age above to highlight the age band and calculate the hypotension threshold.</Callout>
      )}

      <ProtocolSection title="Normal Ranges by Age">
        <div className="clinical-table-container" tabIndex={0} role="region" aria-label="Pediatric vital signs reference table">
          <table className="clinical-table" aria-label="Pediatric vital signs reference table">
            <thead>
              <tr>
                <th>Age Group</th>
                <th>HR (bpm)</th>
                <th>RR (/min)</th>
                <th>Systolic BP</th>
                <th>Diastolic BP</th>
                <th>SpO₂</th>
                <th>Hypotension SBP</th>
              </tr>
            </thead>
            <tbody>
              {DATASET.vitalSignsRef.map((v) => {
                const isCur = ageYears != null && ageYears >= v.minAgeYr && ageYears < v.maxAgeYr;
                return (
                  <tr key={v.ageBracket} className={isCur ? 'bg-[var(--accent-soft)] font-bold' : ''}>
                    <td className="whitespace-nowrap">
                      {isCur && <ChevronRight className="inline w-3.5 h-3.5 mr-0.5 -mt-0.5" aria-label="Current age bracket" />}
                      {v.ageBracket}
                    </td>
                    <td className="font-mono-tabular whitespace-nowrap">{v.hrNormal}</td>
                    <td className="font-mono-tabular whitespace-nowrap">{v.rrNormal}</td>
                    <td className="font-mono-tabular whitespace-nowrap">{v.sysBpNormal}</td>
                    <td className="font-mono-tabular whitespace-nowrap">{v.diaBpNormal}</td>
                    <td className="font-mono-tabular whitespace-nowrap">{v.spo2Normal}</td>
                    <td className="font-mono-tabular font-bold text-[var(--danger-text)] whitespace-nowrap">{v.hypotensionSysBp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ProtocolSection>

      <ProtocolSection title="PALS Definition of Hypotension">
        <div className="clinical-table-container" tabIndex={0} role="region" aria-label="PALS hypotension thresholds">
          <table className="clinical-table" aria-label="PALS hypotension thresholds">
            <thead>
              <tr>
                <th>Age</th>
                <th>Systolic BP threshold</th>
              </tr>
            </thead>
            <tbody>
              {DATASET.vitalSignsHypotension.map((h) => (
                <tr key={h.ageBand}>
                  <td className="font-bold">{h.ageBand}</td>
                  <td className="font-mono-tabular">{h.threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProtocolSection>

      <EvidenceFooter refKey="vitals" />
    </div>
  );
};
