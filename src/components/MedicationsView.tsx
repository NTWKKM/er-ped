import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DATASET, PediatricDrug } from '../data/dataset';
import {
  resolveDrugDose,
  parseStrength,
  fmtMg,
  fmtMl,
  calcSchwartzEGFR,
  calcPatientRenalDose,
} from '../utils/clinicalCalculations';
import { Search, X, ChevronDown, AlertTriangle } from 'lucide-react';

interface MedicationsViewProps {
  activeWeight: number | null;
  ageYears: number | null;
  heightCm: number | null;
  serumCr: string;
  onSerumCrChange: (val: string) => void;
}

function cleanEnglishText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/\*\*\s*คำนวณตามขนาดยา\s*IV/g, '(calculated per IV dose)')
    .replace(/ระวังไข้เลือดออก/g, 'avoid in suspected Dengue')
    .replace(/ขนาดยาและระยะเวลาปกติ/g, 'Standard dose & interval')
    .replace(/ระยะเวลาการให้ยาปกติ/g, 'Standard dosing interval')
    .replace(/ขนาดยาปกติ/g, 'Standard dose')
    .replace(/ลดขนาดยาและขยายระยะห่างเป็นทุก/g, 'Reduce dose and extend interval to every')
    .replace(/ลดขนาดยาลงเหลือ/g, 'Reduce dose to')
    .replace(/ลดขนาดยาลง/g, 'Reduce dose by')
    .replace(/ลดขนาดลง/g, 'Reduce dose by')
    .replace(/ลดขนาดยาเหลือ/g, 'Reduce dose to')
    .replace(/ลดขนาดเหลือ/g, 'Reduce dose to')
    .replace(/ลดขนาดยา/g, 'Reduce dose')
    .replace(/ลดขนาด/g, 'Reduce dose')
    .replace(/ขยายระยะห่างเป็นทุก/g, 'Extend interval to every')
    .replace(/ปรับเป็นทุก/g, 'Adjust to every')
    .replace(/หรือหลีกเลี่ยง/g, 'or avoid')
    .replace(/หรือขยายเวลา/g, 'or extend interval')
    .replace(/หรือให้ทุก/g, 'or give every')
    .replace(/ของขนาดปกติ/g, 'of standard dose')
    .replace(/วันละ 1 ครั้ง/g, 'once daily')
    .replace(/ทุก/g, 'every')
    .replace(/ชม\./g, 'hr')
    .replace(/ให้ยาหลังฟอกไต HD/g, 'administer post-HD')
    .replace(/ให้หลังฟอกเลือด HD/g, 'administer post-HD')
    .replace(/หลัง HD/g, 'post-HD')
    .replace(/ตามระดับ TDM/g, 'Per TDM')
    .replace(/ตามระดับยา/g, 'Per TDM')
    .replace(/ให้/g, 'Give')
    .replace(/สูงสุด/g, 'Max')
    .trim();
}

export const MedicationsView: React.FC<MedicationsViewProps> = ({
  activeWeight,
  ageYears,
  heightCm,
  serumCr,
  onSerumCrChange,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [selectedKey, setSelectedKey] = useState<string>('paracetamol-syrup-120-mg-5-ml');
  const [concOverride, setConcOverride] = useState<string>('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const allDrugs = DATASET.pediatricDose;

  const selectedDrug = useMemo(() => {
    return allDrugs.find((d) => d.key === selectedKey) || allDrugs[0];
  }, [allDrugs, selectedKey]);

  const filteredDrugs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allDrugs;
    return allDrugs.filter((d) => {
      const name = (d.name || '').toLowerCase();
      const drug = (d.drug || '').toLowerCase();
      const aliases = (d.aliases || []).join(' ').toLowerCase();
      return name.includes(q) || drug.includes(q) || aliases.includes(q);
    });
  }, [allDrugs, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectDrug = (d: PediatricDrug) => {
    setSelectedKey(d.key);
    setSearchQuery('');
    setConcOverride('');
    setIsDropdownOpen(false);
  };

  const resolved = useMemo(
    () => resolveDrugDose(selectedDrug, activeWeight, ageYears),
    [selectedDrug, activeWeight, ageYears]
  );

  const strength = useMemo(
    () => parseStrength(selectedDrug?.preparation || selectedDrug?.name || ''),
    [selectedDrug]
  );

  const customConcNum = parseFloat(concOverride);
  const effectiveMgPerMl =
    Number.isFinite(customConcNum) && customConcNum > 0
      ? customConcNum
      : strength.mgPerMl || null;
  const effectiveMgPerTab = strength.mgPerTab || null;

  const formatRangeTxt = (
    minVal: number | null | undefined,
    maxVal: number | null | undefined,
    fmtFn: (n: number) => string
  ) => {
    if (minVal == null && maxVal == null) return '—';
    if (minVal != null && maxVal != null && Math.abs(maxVal - minVal) >= 0.5) {
      return `${fmtFn(minVal)}–${fmtFn(maxVal)}`;
    }
    const v = maxVal != null ? maxVal : minVal!;
    return fmtFn(v);
  };

  const singleDoseMgText = useMemo(() => {
    if (!resolved) return '—';
    if (
      selectedDrug?.unit === 'units' ||
      resolved.doseMinUnits != null ||
      resolved.doseMaxUnits != null
    ) {
      return formatRangeTxt(
        resolved.doseMinUnits,
        resolved.doseMaxUnits,
        (n) => `${n.toLocaleString()} U`
      );
    }
    if (
      resolved.doseMinMg == null &&
      resolved.doseMaxMg == null &&
      (resolved.doseMinMl != null || resolved.doseMaxMl != null)
    ) {
      return formatRangeTxt(resolved.doseMinMl, resolved.doseMaxMl, (n) => `${fmtMl(n)} mL`);
    }
    return formatRangeTxt(resolved.doseMinMg, resolved.doseMaxMg, (n) => `${fmtMg(n)} mg`);
  }, [resolved, selectedDrug]);

  const singleDoseVolumeText = useMemo(() => {
    if (!resolved) return '';
    if (effectiveMgPerMl && (resolved.doseMinMg != null || resolved.doseMaxMg != null)) {
      const minMl = resolved.doseMinMg != null ? resolved.doseMinMg / effectiveMgPerMl : null;
      const maxMl = resolved.doseMaxMg != null ? resolved.doseMaxMg / effectiveMgPerMl : null;
      const txt = formatRangeTxt(minMl, maxMl, (n) => fmtMl(n));
      if (txt !== '—') return `${txt} mL`;
    }
    if (
      (resolved.doseMinMg != null || resolved.doseMaxMg != null) &&
      (resolved.doseMinMl != null || resolved.doseMaxMl != null)
    ) {
      const txt = formatRangeTxt(resolved.doseMinMl, resolved.doseMaxMl, (n) => fmtMl(n));
      if (txt !== '—') return `${txt} mL`;
    }
    if (effectiveMgPerTab && (resolved.doseMinMg != null || resolved.doseMaxMg != null)) {
      const minTab = resolved.doseMinMg != null ? resolved.doseMinMg / effectiveMgPerTab : null;
      const maxTab = resolved.doseMaxMg != null ? resolved.doseMaxMg / effectiveMgPerTab : null;
      const txt = formatRangeTxt(minTab, maxTab, (n) => (n >= 1 ? n.toFixed(1) : n.toFixed(2)));
      if (txt !== '—') return `${txt} tab`;
    }
    return '';
  }, [resolved, effectiveMgPerMl, effectiveMgPerTab]);

  const dailyDoseText = useMemo(() => {
    if (!resolved) return '—';
    return formatRangeTxt(resolved.perDayMinMg, resolved.perDayMaxMg, (n) => `${fmtMg(n)} mg`);
  }, [resolved]);

  const egfr = calcSchwartzEGFR(parseFloat(serumCr), heightCm);

  return (
    <div className="clinical-card p-5 space-y-5">
      {/* Simple Single-Input Drug Selector */}
      <div ref={wrapperRef} className="relative">
        <label htmlFor="doseSearch" className="text-xs font-bold text-[var(--muted)] block mb-1.5">
          Select or Search Medication (Medications &amp; Antibiotics)
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="doseSearch"
            type="text"
            value={isDropdownOpen ? searchQuery : selectedDrug?.name || ''}
            onFocus={() => {
              setSearchQuery('');
              setIsDropdownOpen(true);
            }}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            placeholder="Search medication e.g. Paracetamol, Amoxicillin, Ceftriaxone..."
            aria-label="Search medication"
            className="clinical-input w-full pl-10 pr-10 py-2.5 text-sm font-bold"
          />
          {isDropdownOpen && searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsDropdownOpen((o) => !o)}
              aria-label="Toggle medication list"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {isDropdownOpen && (
          <div
            role="listbox"
            className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-lg border border-[var(--border-strong)] bg-[var(--card)] shadow-lg divide-y divide-[var(--border)]"
          >
            {filteredDrugs.length === 0 ? (
              <div className="p-3 text-xs text-[var(--muted)] text-center">
                No matching medications found
              </div>
            ) : (
              filteredDrugs.map((d) => (
                <div
                  key={d.key}
                  role="option"
                  aria-selected={d.key === selectedKey}
                  onClick={() => handleSelectDrug(d)}
                  className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-2 text-xs ${
                    d.key === selectedKey
                      ? 'bg-[var(--accent-soft)] font-bold text-[var(--accent-text)]'
                      : 'hover:bg-[var(--panel-subtle)] text-[var(--ink)]'
                  }`}
                >
                  <span className="truncate">{d.name}</span>
                  <span className="text-[11px] text-[var(--muted)] shrink-0">
                    {cleanEnglishText(d.route) || 'PO'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Main Output Area */}
      {!activeWeight ? (
        <div className="clinical-panel-subtle p-6 text-center text-sm text-[var(--muted)]">
          Enter patient Weight (BW) or Age above to calculate doses
        </div>
      ) : resolved?.isAgeRestricted ? (
        <div className="p-4 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)] text-xs space-y-1">
          <div className="font-bold text-sm flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Age Restriction / Contraindicated for this age group</span>
          </div>
          <div className="text-[var(--ink)]">
            Approved age range:{' '}
            <strong>
              {selectedDrug.minAgeYr != null ? `≥ ${selectedDrug.minAgeYr} yr` : ''}
              {selectedDrug.maxAgeYr != null ? ` ≤ ${selectedDrug.maxAgeYr} yr` : ''}
            </strong>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 2 Clean Hero Readouts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="clinical-panel-subtle p-4">
              <div className="text-xs font-semibold text-[var(--muted)]">
                Dose Per Single Administration
              </div>
              <div className="text-2xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1 flex flex-wrap items-baseline gap-2">
                <span>{singleDoseMgText}</span>
                {singleDoseVolumeText && (
                  <span className="text-base font-bold text-[var(--accent-text)] whitespace-nowrap">
                    ({singleDoseVolumeText})
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1.5">
                Regimen:{' '}
                <strong className="text-[var(--ink)]">
                  {selectedDrug.freq || selectedDrug.split || 'PRN'}
                </strong>{' '}
                ·{' '}
                <strong className="text-[var(--ink)]">
                  {cleanEnglishText(selectedDrug.route) || 'PO/IV'}
                </strong>
              </div>
              {resolved?.isCappedPerDose && (
                <div className="text-xs font-bold text-[var(--warning-text)] mt-1">
                  ▲ Capped at Max Single Dose ({selectedDrug.maxPerDoseMg} mg)
                </div>
              )}
            </div>

            <div className="clinical-panel-subtle p-4">
              <div className="text-xs font-semibold text-[var(--muted)]">
                Total Daily Dose (24h)
              </div>
              <div className="text-2xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                {dailyDoseText}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1.5">
                Preparation: {selectedDrug.preparation || 'Standard'}
              </div>
              {resolved?.isCappedPerDay && (
                <div className="text-xs font-bold text-[var(--warning-text)] mt-1">
                  ▲ Capped at Max Daily Dose ({selectedDrug.maxPerDayMg} mg/day)
                </div>
              )}
            </div>
          </div>

          {/* Concise Note & Optional Strength Override */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[var(--border)] text-xs text-[var(--muted)]">
            <div className="flex-1 leading-relaxed">
              {selectedDrug.note && (
                <span>
                  <strong className="text-[var(--ink)]">Note:</strong>{' '}
                  {cleanEnglishText(selectedDrug.note)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="doseConc" className="whitespace-nowrap">
                Custom Conc (mg/mL):
              </label>
              <input
                id="doseConc"
                type="number"
                min="0"
                step="0.1"
                placeholder={strength.mgPerMl ? strength.mgPerMl.toFixed(1) : 'mg/mL'}
                value={concOverride}
                onChange={(e) => setConcOverride(e.target.value)}
                className="clinical-input w-20 text-center font-mono-tabular text-xs font-bold py-1"
              />
            </div>
          </div>

          {/* Collapsible Renal Adjustment */}
          {selectedDrug.renalAdjust && selectedDrug.renalDosing && (
            <details className="clinical-panel-subtle p-3 text-xs">
              <summary className="font-bold text-[var(--warning-text)] cursor-pointer">
                ▲ Renal Dose Adjustment Required (Click to view eGFR table)
              </summary>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span>Serum Cr (mg/dL):</span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={serumCr}
                    onChange={(e) => onSerumCrChange(e.target.value)}
                    className="clinical-input w-16 text-center font-mono-tabular text-xs font-bold py-0.5"
                  />
                  {egfr !== null && (
                    <span className="font-mono-tabular font-bold text-[var(--ink)]">
                      → eGFR: {egfr.toFixed(1)} mL/min/1.73m²
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto border border-[var(--border)] rounded">
                  <table className="clinical-table">
                    <thead>
                      <tr>
                        <th>eGFR (mL/min)</th>
                        <th>Recommended Dose</th>
                        <th>Interval</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDrug.renalDosing.map((t, i) => {
                        const matched = egfr !== null && egfr >= t.minGfr && egfr <= t.maxGfr;
                        return (
                          <tr key={i} className={matched ? 'bg-[var(--warning-soft)] font-bold' : ''}>
                            <td className="font-mono-tabular">{t.gfr}</td>
                            <td className="font-mono-tabular text-[var(--accent-text)]">
                              {cleanEnglishText(calcPatientRenalDose(t, selectedDrug, activeWeight))}
                            </td>
                            <td className="text-[var(--muted)]">
                              {cleanEnglishText(t.freq || 'Per TDM')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
};
