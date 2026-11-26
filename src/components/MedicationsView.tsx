import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DATASET, PediatricDrug } from '../data/dataset';
import {
  resolveDrugDose,
  resolveDrugStrength,
  fmtMg,
  fmtMl,
  calcSchwartzEGFR,
  calcPatientRenalDose,
} from '../utils/clinicalCalculations';
import { Search, X, ChevronDown, AlertTriangle } from 'lucide-react';
import { OrderItem, createOrderId } from './ModalsAndDrawers';

interface MedicationsViewProps {
  activeWeight: number | null;
  ageYears: number | null;
  heightCm: number | null;
  serumCr: string;
  onSerumCrChange: (val: string) => void;
  onAddOrder?: (order: OrderItem) => void;
  onInvalidateOrders?: (targetPrefix?: string) => void;
  selectedKey: string;
  onSelectKey: (key: string) => void;
  concOverride: string;
  onConcOverrideChange: (val: string) => void;
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

/** Renders a dataset note, swapping the warning emoji for an inline Lucide icon. */
function ClinicalNote({ text }: { text?: string | null }) {
  const clean = cleanEnglishText(text);
  if (!clean) return null;
  const parts = clean.split(/\s*⚠️?\s*/u);
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <AlertTriangle
              className="inline w-3.5 h-3.5 mx-1 -mt-0.5 text-[var(--warning-text)]"
              aria-label="Caution"
              role="img"
            />
          )}
          {part}
        </React.Fragment>
      ))}
    </>
  );
}

export const MedicationsView: React.FC<MedicationsViewProps> = ({
  activeWeight,
  ageYears,
  heightCm,
  serumCr,
  onSerumCrChange,
  onAddOrder,
  onInvalidateOrders,
  selectedKey,
  onSelectKey,
  concOverride,
  onConcOverrideChange,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isRenalReviewed, setIsRenalReviewed] = useState<boolean>(false);
  const [isRenalDetailsOpen, setIsRenalDetailsOpen] = useState<boolean>(false);
  // True when the concentration came from the marketed-strength radios, not typed in the field
  const [isStrengthPicked, setIsStrengthPicked] = useState<boolean>(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsRenalReviewed(false);
  }, [selectedKey, serumCr, heightCm, activeWeight]);

  useEffect(() => {
    setIsStrengthPicked(false);
  }, [selectedKey]);

  const allDrugs = DATASET.pediatricDose;

  const selectedDrug = useMemo(() => {
    return allDrugs.find((d) => d.key === selectedKey) || allDrugs[0];
  }, [allDrugs, selectedKey]);

  const filteredDrugs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allDrugs;

    const scored: Array<{ drug: PediatricDrug; score: number }> = [];
    for (const d of allDrugs) {
      const name = (d.name || '').toLowerCase();
      const drug = (d.drug || '').toLowerCase();
      const aliases = (d.aliases || []).join(' ').toLowerCase();
      const category = (d.category || '').toLowerCase();
      const note = (d.note || '').toLowerCase();

      if (name.startsWith(q) || drug.startsWith(q)) {
        scored.push({ drug: d, score: 1 });
      } else if (name.includes(q) || drug.includes(q)) {
        scored.push({ drug: d, score: 2 });
      } else if (aliases.includes(q)) {
        scored.push({ drug: d, score: 3 });
      } else if (category.includes(q) || note.includes(q)) {
        scored.push({ drug: d, score: 4 });
      }
    }

    return scored.sort((a, b) => a.score - b.score).map((s) => s.drug);
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
    if (concOverride) {
      onInvalidateOrders?.(`med-${selectedDrug.key}`);
      onConcOverrideChange('');
    }
    onSelectKey(d.key);
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleConcOverrideChange = (val: string) => {
    onInvalidateOrders?.(`med-${selectedDrug.key}`);
    onConcOverrideChange(val);
  };

  const isReferenceOnlyDrug = useMemo(() => {
    if (!selectedDrug) return false;
    return (
      selectedDrug.doseMinMgPerKg == null &&
      selectedDrug.doseMaxMgPerKg == null &&
      selectedDrug.dose == null &&
      !selectedDrug.fixedDose &&
      (!Array.isArray(selectedDrug.doseBands) || selectedDrug.doseBands.length === 0)
    );
  }, [selectedDrug]);

  const resolved = useMemo(
    () => resolveDrugDose(selectedDrug, activeWeight, ageYears),
    [selectedDrug, activeWeight, ageYears]
  );

  const strength = useMemo(
    () => resolveDrugStrength(selectedDrug),
    [selectedDrug]
  );

  const customConcNum = parseFloat(concOverride);
  const effectiveMgPerMl =
    Number.isFinite(customConcNum) && customConcNum > 0
      ? customConcNum
      : strength.mgPerMl || null;
  const effectiveMgPerTab = strength.mgPerTab || null;
  const selectedStrengthOption = effectiveMgPerMl
    ? strength.options?.find((o) => Math.abs(o.mgPerMl - effectiveMgPerMl) < 1e-4) ?? null
    : null;
  const fmtConc = (n: number) => String(Number(n.toFixed(4)));

  const formatRangeTxt = (
    minVal: number | null | undefined,
    maxVal: number | null | undefined,
    fmtFn: (n: number) => string,
    options?: { minDiff?: number; formatDiffers?: boolean }
  ) => {
    if (minVal == null && maxVal == null) return '—';
    if (minVal != null && maxVal != null) {
      const formattedMin = fmtFn(minVal);
      const formattedMax = fmtFn(maxVal);
      const isDiff = options?.formatDiffers
        ? formattedMin !== formattedMax
        : Math.abs(maxVal - minVal) >= (options?.minDiff ?? 0.5);
      if (isDiff) {
        const unitMatch = formattedMax.match(/\s(\S+)$/);
        const unit = unitMatch ? unitMatch[0] : '';
        if (unit && formattedMin.endsWith(unit)) {
          return `${formattedMin.slice(0, -unit.length)}–${formattedMax}`;
        }
        return `${formattedMin}–${formattedMax}`;
      }
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
      return formatRangeTxt(
        resolved.doseMinMl,
        resolved.doseMaxMl,
        (n) => `${fmtMl(n)} mL`,
        { formatDiffers: true }
      );
    }
    return formatRangeTxt(resolved.doseMinMg, resolved.doseMaxMg, (n) => `${fmtMg(n)} mg`);
  }, [resolved, selectedDrug]);

  const singleDoseVolumeText = useMemo(() => {
    if (!resolved) return '';
    if (effectiveMgPerMl && (resolved.doseMinMg != null || resolved.doseMaxMg != null)) {
      const minMl = resolved.doseMinMg != null ? resolved.doseMinMg / effectiveMgPerMl : null;
      const maxMl = resolved.doseMaxMg != null ? resolved.doseMaxMg / effectiveMgPerMl : null;
      const txt = formatRangeTxt(minMl, maxMl, (n) => fmtMl(n), { formatDiffers: true });
      if (txt !== '—') return `${txt} mL`;
    }
    if (
      (resolved.doseMinMg != null || resolved.doseMaxMg != null) &&
      (resolved.doseMinMl != null || resolved.doseMaxMl != null)
    ) {
      const txt = formatRangeTxt(resolved.doseMinMl, resolved.doseMaxMl, (n) => fmtMl(n), { formatDiffers: true });
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

  const matchedRenalTier = useMemo(() => {
    if (!selectedDrug.renalAdjust || !selectedDrug.renalDosing || egfr === null) {
      return null;
    }
    return selectedDrug.renalDosing.find((t) => egfr >= t.minGfr && egfr <= t.maxGfr) || null;
  }, [selectedDrug, egfr]);

  const matchedRenalRegimen = useMemo(() => {
    if (!matchedRenalTier) return null;
    return cleanEnglishText(calcPatientRenalDose(matchedRenalTier, selectedDrug, activeWeight));
  }, [matchedRenalTier, selectedDrug, activeWeight]);

  const isRenalReviewRequired = Boolean(matchedRenalTier && !isRenalReviewed);

  const isAgeLimited = selectedDrug?.minAgeYr != null || selectedDrug?.maxAgeYr != null;
  const isMissingRequiredAge = Boolean(isAgeLimited && (ageYears == null || ageYears <= 0));

  const hasNumericStandardDose = Boolean(
    resolved &&
    (
      (resolved.doseMg != null && Number.isFinite(resolved.doseMg) && resolved.doseMg > 0) ||
      (resolved.doseMinMg != null && Number.isFinite(resolved.doseMinMg) && resolved.doseMinMg > 0) ||
      (resolved.doseMaxMg != null && Number.isFinite(resolved.doseMaxMg) && resolved.doseMaxMg > 0) ||
      (resolved.doseMl != null && Number.isFinite(resolved.doseMl) && resolved.doseMl > 0) ||
      (resolved.doseMinMl != null && Number.isFinite(resolved.doseMinMl) && resolved.doseMinMl > 0) ||
      (resolved.doseMaxMl != null && Number.isFinite(resolved.doseMaxMl) && resolved.doseMaxMl > 0) ||
      (resolved.doseUnits != null && Number.isFinite(resolved.doseUnits) && resolved.doseUnits > 0) ||
      (resolved.doseMinUnits != null && Number.isFinite(resolved.doseMinUnits) && resolved.doseMinUnits > 0) ||
      (resolved.doseMaxUnits != null && Number.isFinite(resolved.doseMaxUnits) && resolved.doseMaxUnits > 0)
    ) &&
    singleDoseMgText !== '—'
  );

  const hasNumericRenalDose = Boolean(
    matchedRenalRegimen &&
    /\d+\s*(?:–|-|\s)*\d*\s*(?:mg|g|mcg|mL|units?|U\b)/i.test(matchedRenalRegimen)
  );

  const hasNumericDose = matchedRenalTier ? hasNumericRenalDose : hasNumericStandardDose;

  const concSuffix = effectiveMgPerMl
    ? selectedStrengthOption
      ? ` [${selectedStrengthOption.label} = ${fmtConc(effectiveMgPerMl)} mg/mL]`
      : ` [${fmtConc(effectiveMgPerMl)} mg/mL]`
    : '';

  const orderText = (matchedRenalTier && !hasNumericRenalDose)
    ? ''
    : matchedRenalRegimen
    ? `${selectedDrug.name} ${matchedRenalRegimen} ${cleanEnglishText(selectedDrug.route) || 'PO'}${concSuffix} [Renal eGFR ${egfr!.toFixed(1)} mL/min/1.73m²]`
    : `${selectedDrug.name} ${singleDoseMgText}${singleDoseVolumeText ? ` (${singleDoseVolumeText})` : ''} ${cleanEnglishText(selectedDrug.route) || 'PO'}${concSuffix} ${selectedDrug.freq || selectedDrug.split || 'PRN'}`;

  const hasRequiredConcentration = !strength.hasMultipleConcs || Boolean(effectiveMgPerMl);

  const canAddOrder = Boolean(
    onAddOrder &&
    resolved &&
    !resolved.isAgeRestricted &&
    !isMissingRequiredAge &&
    !isRenalReviewRequired &&
    hasRequiredConcentration &&
    hasNumericDose &&
    orderText
  );

  return (
    <div className="clinical-card p-4 sm:p-5 grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <section aria-labelledby="medSelectorHeading" className="min-w-0 space-y-3">
      <h2 id="medSelectorHeading" className="sr-only-heading">Medication selector</h2>
      {/* Simple Single-Input Drug Selector */}
      <div ref={wrapperRef} className="relative">
        <label htmlFor="doseSearch" className="text-xs font-bold text-[var(--muted)] block mb-1.5">
          Select or Search Medication ({allDrugs.length} Pediatric Formulary Items)
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="doseSearch"
            type="text"
            enterKeyHint="search"
            spellCheck={false}
            autoComplete="off"
            value={isDropdownOpen ? searchQuery : selectedDrug?.name || ''}
            onFocus={() => {
              setSearchQuery('');
              setIsDropdownOpen(true);
            }}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            placeholder="Search generic, brand, or indication (e.g. Paracetamol, Meropenem, Caffeine, Ritalin)..."
            aria-label="Search medication"
            className="clinical-input w-full pl-10 pr-12 py-2.5 text-sm font-bold min-h-[48px]"
          />
          {isDropdownOpen && searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsDropdownOpen((o) => !o)}
              aria-label="Toggle medication list"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
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
              <div className="p-3.5 text-xs text-[var(--muted)] text-center">
                No matching medications found
              </div>
            ) : (
              filteredDrugs.map((d) => (
                <div
                  key={d.key}
                  role="option"
                  aria-selected={d.key === selectedKey}
                  onClick={() => handleSelectDrug(d)}
                  className={`px-3.5 py-2.5 min-h-[40px] cursor-pointer flex items-center justify-between gap-2 text-xs ${
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

      {/* Preparation stays visible in full even when the drug name truncates in the field */}
      {selectedDrug && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
          <span className="font-semibold text-[var(--muted)]">Preparation</span>
          <strong className="font-mono-tabular text-sm text-[var(--ink)] break-words min-w-0">
            {selectedDrug.preparation || 'Standard'}
          </strong>
          <span className="text-[var(--muted)]">{cleanEnglishText(selectedDrug.route) || 'PO'}</span>
        </div>
      )}

      {selectedDrug?.note && !isReferenceOnlyDrug && (
        <div className="clinical-panel-subtle p-3.5 text-xs text-[var(--ink-secondary)] leading-relaxed">
          <strong className="text-[var(--ink)]">Reference regimen:</strong>{' '}
          <ClinicalNote text={selectedDrug.note} />
        </div>
      )}
      </section>

      <section aria-labelledby="medOutputHeading" className="min-w-0">
      <h2 id="medOutputHeading" className="sr-only-heading">Calculated dose</h2>
      {/* Main Output Area */}
      {resolved?.isAgeRestricted ? (
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
      ) : isReferenceOnlyDrug ? (
        <div className="space-y-3.5">
          {isMissingRequiredAge && (
            <div className="p-3 rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning-text)] text-xs flex items-start sm:items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                Age-limited medication ({selectedDrug.minAgeYr != null ? `≥ ${selectedDrug.minAgeYr} yr` : ''}{selectedDrug.maxAgeYr != null ? ` ≤ ${selectedDrug.maxAgeYr} yr` : ''}). Enter patient Age above to verify eligibility before adding to Order Sheet.
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--muted)]">Reference Dosing Regimen</span>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-[var(--panel-subtle)] border border-[var(--border)] text-[var(--muted)]">
              Reference Regimen
            </span>
          </div>
          <div className="clinical-panel-subtle p-4 space-y-2.5">
            <div className="text-xs font-semibold text-[var(--muted)]">
              Standard Pediatric / Neonatal Reference Dose
            </div>
            <div className="text-sm sm:text-base font-bold text-[var(--ink)] leading-relaxed">
              {selectedDrug.note ? <ClinicalNote text={selectedDrug.note} /> : 'Refer to institutional protocol'}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)] pt-2 border-t border-[var(--border)]">
              <span>
                Regimen:{' '}
                <strong className="text-[var(--ink)]">
                  {selectedDrug.freq || selectedDrug.split || 'Per protocol'}
                </strong>
              </span>
              <span>
                Route:{' '}
                <strong className="text-[var(--ink)]">
                  {cleanEnglishText(selectedDrug.route) || 'PO'}
                </strong>
              </span>
              <span>
                Preparation:{' '}
                <strong className="text-[var(--ink)]">
                  {selectedDrug.preparation || 'Standard'}
                </strong>
              </span>
            </div>
          </div>
        </div>
      ) : !activeWeight ? (
        <div className="space-y-3">
          <div className="clinical-panel-subtle p-4 sm:p-5 text-center text-sm text-[var(--muted)]">
            Enter patient Weight (BW) or Age above to calculate patient-specific doses
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--muted)]">Calculated Dosage</span>
            {canAddOrder ? (
              <button
                type="button"
                onClick={() => {
                  onAddOrder?.({
                    id: createOrderId(`med-${selectedDrug.key}`),
                    module: 'Medication',
                    text: orderText,
                    timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                  });
                }}
                className="order-btn"
                title="Add to Active Patient Order Sheet"
              >
                + Order Sheet
              </button>
            ) : isRenalReviewRequired ? (
              <button
                type="button"
                onClick={() => {
                  setIsRenalDetailsOpen(true);
                  setIsRenalReviewed(true);
                }}
                className="order-btn order-btn--warning"
                title="Review matched renal dosing tier before adding to Order Sheet"
              >
                ▲ Review Renal Regimen ({egfr?.toFixed(0)} mL/min/1.73m²)
              </button>
            ) : matchedRenalTier && !hasNumericRenalDose ? (
              <span
                className="status-chip"
                title="Matched renal tier provides qualitative guidance only; order entry must be completed outside this calculator"
              >
                ▲ Review-Only Guidance
              </span>
            ) : strength.hasMultipleConcs && !effectiveMgPerMl ? (
              <span
                className="status-chip"
                title="Select a preparation concentration below before adding to Order Sheet"
              >
                ▲ Select Concentration
              </span>
            ) : null}
          </div>

          {matchedRenalTier && !hasNumericRenalDose && (
            <div className="p-3 rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning-text)] text-xs flex items-start sm:items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                Matched renal adjustment is qualitative guidance ({matchedRenalRegimen}). Enter the calculated dose outside this calculator (e.g. directly in the patient&apos;s chart or EHR).
              </span>
            </div>
          )}

          {isMissingRequiredAge && (
            <div className="p-3 rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning-text)] text-xs flex items-start sm:items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                Age-limited medication ({selectedDrug.minAgeYr != null ? `≥ ${selectedDrug.minAgeYr} yr` : ''}{selectedDrug.maxAgeYr != null ? ` ≤ ${selectedDrug.maxAgeYr} yr` : ''}). Enter patient Age above to verify eligibility before adding to Order Sheet.
              </span>
            </div>
          )}

          {strength.hasMultipleConcs && !effectiveMgPerMl && (
            <div className="p-3 rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning-text)] text-xs flex items-start sm:items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                Medication is sold in {strength.options?.length} strengths ({strength.options?.map((o) => o.label).join(' · ')}). Select the product in hand below before adding to Order Sheet.
              </span>
            </div>
          )}

          {/* 2 Clean Hero Readouts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="clinical-panel-subtle p-4">
              <div className="text-xs font-semibold text-[var(--muted)]">
                Dose Per Single Administration
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--ink)] mt-1 flex flex-wrap items-baseline gap-2">
                <span>{singleDoseMgText}</span>
                {singleDoseVolumeText ? (
                  <span className="text-sm sm:text-base font-bold text-[var(--accent-text)] whitespace-nowrap">
                    ({singleDoseVolumeText})
                  </span>
                ) : strength.hasMultipleConcs && (resolved?.doseMinMg != null || resolved?.doseMaxMg != null) ? (
                  <span className="text-xs font-semibold text-[var(--warning-text)] whitespace-nowrap">
                    (Select conc below to calculate volume)
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1.5">
                Regimen:{' '}
                <strong className="text-[var(--ink)]">
                  {selectedDrug.freq || selectedDrug.split || 'PRN'}
                </strong>{', '}
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
              <div className="text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--ink)] mt-1">
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

          {/* Marketed strength selector & optional custom concentration */}
          <div className="flex flex-col gap-2.5 pt-2.5 border-t border-[var(--border)] text-xs text-[var(--muted)]">
            {strength.options && strength.options.length > 1 && (
              <fieldset className="flex flex-col gap-1.5 min-w-0">
                <legend className={`font-semibold mb-1.5 ${!effectiveMgPerMl ? 'text-[var(--warning-text)]' : ''}`}>
                  Strength in hand:
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {strength.options.map((o) => {
                    const isActive = selectedStrengthOption?.mgPerMl === o.mgPerMl;
                    return (
                      <label
                        key={o.mgPerMl}
                        className={`strength-option min-h-[44px] sm:min-h-[36px] px-3 py-1 rounded-lg border text-left cursor-pointer transition-colors ${
                          isActive
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                            : 'border-[var(--border)] bg-[var(--panel-subtle)] text-[var(--ink-secondary)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`strength-${selectedDrug.key}`}
                          value={o.mgPerMl}
                          checked={isActive}
                          onChange={() => {
                            setIsStrengthPicked(true);
                            handleConcOverrideChange(String(o.mgPerMl));
                          }}
                          className="sr-only"
                        />
                        <span className="block text-xs font-bold">{o.label}</span>
                        <span className="block text-[11px] font-mono-tabular opacity-80">
                          {fmtConc(o.mgPerMl)} mg/mL
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
              <label htmlFor="doseConc" className="whitespace-nowrap font-semibold">
                {strength.hasMultipleConcs ? 'Or other conc (mg/mL):' : 'Custom Conc (mg/mL):'}
              </label>
              <input
                id="doseConc"
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                placeholder={strength.mgPerMl ? fmtConc(strength.mgPerMl) : 'mg/mL'}
                value={isStrengthPicked ? '' : concOverride}
                onChange={(e) => {
                  setIsStrengthPicked(false);
                  handleConcOverrideChange(e.target.value);
                }}
                className={`clinical-input w-24 text-center font-mono-tabular text-xs font-bold py-1.5 ${
                  strength.hasMultipleConcs && !effectiveMgPerMl ? 'border-[var(--warning)]' : ''
                }`}
              />
            </div>
          </div>

          {/* Collapsible Renal Adjustment */}
          {selectedDrug.renalAdjust && selectedDrug.renalDosing && (
            <details
              open={isRenalDetailsOpen}
              onToggle={(e) => {
                const isOpen = e.currentTarget.open;
                setIsRenalDetailsOpen(isOpen);
                if (isOpen) setIsRenalReviewed(true);
              }}
              className="clinical-panel-subtle p-3.5 text-xs"
            >
              <summary className="font-bold text-[var(--warning-text)] cursor-pointer flex flex-wrap items-center justify-between gap-2">
                <span>▲ Renal Dose Adjustment Required (Click to view eGFR table)</span>
                {matchedRenalTier && (
                  <span className={`text-[11px] font-bold whitespace-nowrap ${isRenalReviewed ? 'text-[var(--good-text)]' : 'text-[var(--warning-text)]'}`}>
                    [{isRenalReviewed ? '✓ Reviewed' : 'Review Required'}]
                  </span>
                )}
              </summary>
              <div className="mt-3 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="serumCrInput" className="font-semibold text-[var(--ink)]">
                    Serum Cr (mg/dL):
                  </label>
                  <input
                    id="serumCrInput"
                    type="number"
                    min="0.1"
                    step="0.1"
                    inputMode="decimal"
                    value={serumCr}
                    onChange={(e) => onSerumCrChange(e.target.value)}
                    className="clinical-input w-20 text-center font-mono-tabular text-xs font-bold py-1"
                  />
                  {egfr !== null ? (
                    <span className="font-mono-tabular font-bold text-[var(--ink)]">
                      → eGFR: {egfr.toFixed(1)} mL/min/1.73m²
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--muted)]">
                      (Requires Height cm &amp; Serum Cr to calculate Schwartz eGFR)
                    </span>
                  )}
                </div>
                {matchedRenalTier && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                    <span className="text-xs text-[var(--ink)]">
                      Matched Tier ({matchedRenalTier.gfr} mL/min/1.73m²):{' '}
                      <strong className="text-[var(--accent-text)]">{matchedRenalRegimen}</strong>
                    </span>
                    {!isRenalReviewed ? (
                      <button
                        type="button"
                        onClick={() => setIsRenalReviewed(true)}
                        className="min-h-[32px] px-3 py-1 text-[11px] font-bold rounded-md bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap self-start sm:self-auto shrink-0"
                      >
                        ✓ Confirm Review
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-[var(--good-text)] whitespace-nowrap shrink-0">
                        ✓ Reviewed
                      </span>
                    )}
                  </div>
                )}
                <div
                  className="clinical-table-container"
                  tabIndex={0}
                  role="region"
                  aria-label="Renal dosing reference table"
                >
                  <table className="clinical-table">
                    <thead>
                      <tr>
                        <th>eGFR (mL/min/1.73m²)</th>
                        <th>Recommended Dose</th>
                        <th>Interval</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDrug.renalDosing.map((t, i) => {
                        const matched = egfr !== null && egfr >= t.minGfr && egfr <= t.maxGfr;
                        return (
                          <tr key={i} className={matched ? 'bg-[var(--warning-soft)] font-bold' : ''}>
                            <td className="font-mono-tabular whitespace-nowrap">{t.gfr}</td>
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
      </section>
    </div>
  );
};
