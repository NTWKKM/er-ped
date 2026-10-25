import React, { useMemo, useState } from 'react';
import {
  getBroselowSpectrumBand,
  calcGrowthZScores,
} from '../utils/clinicalCalculations';
import { Sun, Moon, Monitor, Flame, BookOpen, FileText, SlidersHorizontal, Ruler } from 'lucide-react';

export interface BiometricState {
  rawWeight: string;
  rawAge: string;
  ageUnit: 'yr' | 'mo';
  sex: 'male' | 'female';
  rawHeight: string;
  useIBW: boolean;
  weightSource: 'manual' | 'estimated' | 'broselow' | null;
  serumCr: string;
}

interface TopbarBiometricsProps {
  bio: BiometricState;
  activeWeight: number | null;
  ibwWeight: number | null;
  theme: 'light' | 'dark' | 'mono' | 'red';
  orderCount?: number;
  onWeightChange: (val: string, source?: 'manual' | 'broselow') => void;
  onAgeChange: (val: string) => void;
  onToggleAgeUnit: () => void;
  onToggleSex: () => void;
  onHeightChange: (val: string) => void;
  onToggleUseIBW: (checked: boolean) => void;
  onCycleTheme: () => void;
  onOpenBroselowModal: (zoneColor?: string, e?: React.SyntheticEvent<HTMLElement>) => void;
  onOpenEvidenceModal?: (e?: React.MouseEvent<HTMLElement>) => void;
  onOpenOrderSheetModal?: (e?: React.MouseEvent<HTMLElement>) => void;
}

export const TopbarBiometrics: React.FC<TopbarBiometricsProps> = ({
  bio,
  activeWeight,
  ibwWeight,
  theme,
  orderCount = 0,
  onWeightChange,
  onAgeChange,
  onToggleAgeUnit,
  onToggleSex,
  onHeightChange,
  onToggleUseIBW,
  onCycleTheme,
  onOpenBroselowModal,
  onOpenEvidenceModal,
  onOpenOrderSheetModal,
}) => {
  const [mobileMoreOpen, setMobileMoreOpen] = useState<boolean>(false);
  const activeBand = getBroselowSpectrumBand(activeWeight);

  // Age in fractional years for WHO Z-Scores (max 15 yr)
  const ageYears = useMemo(() => {
    const a = parseFloat(bio.rawAge);
    if (!Number.isFinite(a) || a <= 0) return null;
    const yrs = bio.ageUnit === 'mo' ? a / 12 : a;
    return Math.min(15, yrs);
  }, [bio.rawAge, bio.ageUnit]);

  const heightVal = parseFloat(bio.rawHeight);
  const validHeight = Number.isFinite(heightVal) && heightVal > 0 ? heightVal : null;

  const parsedWeight = parseFloat(bio.rawWeight);
  const measuredWeight =
    bio.weightSource === 'manual' && Number.isFinite(parsedWeight) && parsedWeight > 0
      ? parsedWeight
      : null;

  // Real-time WHO Growth Standards Z-Scores (requires measured weight)
  const zScores = useMemo(() => {
    return calcGrowthZScores(ageYears, measuredWeight, validHeight, bio.sex);
  }, [ageYears, measuredWeight, validHeight, bio.sex]);

  // Authoritative clinical provenance of the active dosing weight
  const weightProvenance = useMemo(() => {
    if (!activeWeight) {
      return {
        label: 'enter BW or age',
        compactLabel: 'enter BW',
        isDerived: false,
        isEmpty: true,
      };
    }
    if (bio.useIBW && ibwWeight) {
      const htText = bio.rawHeight ? ` · ${bio.rawHeight} cm` : '';
      return {
        label: `Wt for Ht${htText}`,
        compactLabel: 'Wt-for-Ht',
        isDerived: true,
        isEmpty: false,
      };
    }
    if (bio.weightSource === 'estimated') {
      const ageStr = bio.rawAge ? ` ${bio.rawAge} ${bio.ageUnit}` : '';
      return {
        label: `estimated · Weech${ageStr}`,
        compactLabel: 'est Weech',
        isDerived: true,
        isEmpty: false,
      };
    }
    if (bio.weightSource === 'broselow') {
      const bandName = activeBand ? ` · ${activeBand.color}` : '';
      return {
        label: `Broselow band${bandName}`,
        compactLabel: activeBand ? activeBand.color : 'Broselow',
        isDerived: true,
        isEmpty: false,
      };
    }
    if (bio.weightSource === 'manual') {
      return {
        label: 'measured',
        compactLabel: 'measured',
        isDerived: false,
        isEmpty: false,
      };
    }
    return {
      label: 'estimated',
      compactLabel: 'estimated',
      isDerived: true,
      isEmpty: false,
    };
  }, [
    activeWeight,
    bio.useIBW,
    ibwWeight,
    bio.rawHeight,
    bio.weightSource,
    bio.rawAge,
    bio.ageUnit,
    activeBand,
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md no-print">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 py-2 sm:py-2.5 flex flex-col gap-2">
        {/* Main Instrument Row */}
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 sm:gap-3">
          {/* Left Section: Brand & Patient Biometrics Cluster */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap lg:flex-nowrap min-w-0 flex-1">
            {/* Brand Wordmark */}
            <span className="text-sm sm:text-base font-extrabold tracking-tight text-[var(--ink)] select-none whitespace-nowrap shrink-0">
              ER-PED
            </span>
            <div className="h-4 w-[1px] bg-[var(--border-strong)] hidden sm:block shrink-0" />

            {/* Biometrics Input Fields */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
              {/* 1. Measured Weight (BW) */}
              <div className="flex items-center gap-1 bg-[var(--panel-subtle)] border border-[var(--border)] rounded-lg px-2 py-1 min-h-[36px] shrink-0">
                <label htmlFor="weight" className="text-xs font-bold text-[var(--muted)] select-none">
                  BW
                </label>
                <input
                  id="weight"
                  type="number"
                  min="0"
                  max="150"
                  step="0.1"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="kg"
                  value={bio.rawWeight}
                  onChange={(e) => onWeightChange(e.target.value)}
                  className="w-12 sm:w-16 bg-transparent text-center font-mono-tabular font-bold text-base sm:text-sm text-[var(--ink)] focus:outline-none"
                />
                <span className="text-xs text-[var(--muted)] select-none">kg</span>
              </div>

              {/* 2. Age Input + Unit Toggle (yr/mo) + Sex Toggle (♂/♀) */}
              <div className="flex items-center gap-1 bg-[var(--panel-subtle)] border border-[var(--border)] rounded-lg px-2 py-1 min-h-[36px] shrink-0">
                <label htmlFor="age" className="text-xs font-bold text-[var(--muted)] select-none">
                  Age
                </label>
                <input
                  id="age"
                  type="number"
                  min="0"
                  max={bio.ageUnit === 'yr' ? 15 : 180}
                  step="0.1"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={bio.rawAge}
                  onChange={(e) => onAgeChange(e.target.value)}
                  className="w-10 sm:w-12 bg-transparent text-center font-mono-tabular font-bold text-base sm:text-sm text-[var(--ink)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={onToggleAgeUnit}
                  className="min-h-[26px] min-w-[28px] text-xs font-bold px-1.5 py-0.5 rounded bg-[var(--panel)] text-[var(--ink)] hover:text-[var(--accent-text)] cursor-pointer select-none transition-colors whitespace-nowrap shrink-0"
                  title="คลิกเพื่อสลับหน่วยอายุ: ปี (yr) / เดือน (mo)"
                >
                  {bio.ageUnit}
                </button>

                {/* Sex Toggle Button (Tablet/Desktop inline) */}
                <button
                  type="button"
                  onClick={onToggleSex}
                  className={`hidden sm:inline-flex items-center justify-center min-h-[26px] min-w-[26px] text-xs font-extrabold px-1.5 py-0.5 rounded cursor-pointer select-none transition-colors whitespace-nowrap shrink-0 ${
                    bio.sex === 'male'
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                  }`}
                  title={`สลับเพศ (${bio.sex === 'male' ? 'เด็กชาย ♂' : 'เด็กหญิง ♀'}) สำหรับ WHO Growth Standards`}
                >
                  {bio.sex === 'male' ? '♂' : '♀'}
                </button>
              </div>

              {/* Mobile Secondary Biometrics Toggle Button (< 640px) */}
              <button
                type="button"
                onClick={() => setMobileMoreOpen((o) => !o)}
                aria-expanded={mobileMoreOpen}
                aria-label="Toggle Height and Sex inputs"
                className={`sm:hidden inline-flex items-center gap-1 min-h-[36px] px-2 py-1 rounded-lg border text-xs font-bold transition-colors cursor-pointer select-none whitespace-nowrap shrink-0 ${
                  mobileMoreOpen || bio.rawHeight
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'border-[var(--border)] bg-[var(--panel-subtle)] text-[var(--muted)]'
                }`}
                title="ระบุส่วนสูง (HT cm) และเพศ (♂/♀) สำหรับคำนวณ eGFR และ Wt-for-Ht"
              >
                <Ruler className="w-3.5 h-3.5 shrink-0" />
                <span>{bio.rawHeight ? `${bio.rawHeight}cm` : 'HT'}</span>
                <span>·</span>
                <span>{bio.sex === 'male' ? '♂' : '♀'}</span>
              </button>

              {/* 3. Height (HT) & Wt-for-Ht (Tablet/Desktop >= 640px inline) */}
              <div className="hidden sm:flex items-center gap-1.5 bg-[var(--panel-subtle)] border border-[var(--border)] rounded-lg px-2 py-1 min-h-[36px] shrink-0">
                <label htmlFor="length" className="text-xs font-bold text-[var(--muted)] select-none">
                  HT
                </label>
                <input
                  id="length"
                  type="number"
                  min="0"
                  max="200"
                  step="1"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="cm"
                  value={bio.rawHeight}
                  onChange={(e) => onHeightChange(e.target.value)}
                  className="w-12 sm:w-14 bg-transparent text-center font-mono-tabular font-bold text-base sm:text-sm text-[var(--ink)] focus:outline-none"
                />
                <span className="text-xs text-[var(--muted)] select-none">cm</span>

                {ibwWeight && (
                  <div className="flex items-center gap-1.5 border-l border-[var(--border)] pl-1.5">
                    <span className="text-[11px] text-[var(--muted)] font-mono-tabular whitespace-nowrap">
                      Wt-for-Ht: <strong className="text-[var(--ink)]">{ibwWeight.toFixed(1)}k</strong>
                    </span>
                    <label
                      htmlFor="useIBW"
                      className="flex items-center gap-1 text-[11px] font-semibold text-[var(--muted)] cursor-pointer hover:text-[var(--ink)] select-none whitespace-nowrap"
                      title="ใช้น้ำหนักประมาณจากส่วนสูงแทนน้ำหนักจริงในการคำนวณยา (Use Wt-for-Ht)"
                    >
                      <input
                        id="useIBW"
                        type="checkbox"
                        checked={bio.useIBW}
                        onChange={(e) => onToggleUseIBW(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[var(--accent)] cursor-pointer rounded"
                      />
                      <span>Use</span>
                    </label>
                  </div>
                )}
              </div>

              {/* 4. WHO Growth Standards Z-Score Metadata (Unboxed typographic telemetry on xl:) */}
              {zScores && (
                <div className="hidden xl:flex items-center gap-1.5 select-none shrink-0 text-xs font-mono-tabular">
                  {(zScores.waz !== null || zScores.haz !== null || zScores.nutritionLabel) && (
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors truncate ${
                        zScores.wazStatus === 'danger' ||
                        zScores.hazStatus === 'danger' ||
                        zScores.nutritionStatus === 'danger'
                          ? 'bg-[var(--danger-soft)] text-[var(--danger-text)] border-[var(--danger)]/30'
                          : zScores.wazStatus === 'warning' ||
                            zScores.hazStatus === 'warning' ||
                            zScores.nutritionStatus === 'warning'
                          ? 'bg-[var(--warning-soft)] text-[var(--warning-text)] border-[var(--warning)]/30'
                          : 'bg-[var(--good-soft)] text-[var(--good-text)] border-[var(--good)]/30'
                      }`}
                      title={`WHO Growth Standards (${bio.sex === 'male' ? 'เด็กชาย' : 'เด็กหญิง'}, ${Math.round(zScores.refAgeMo)} mo): Median Wt ${zScores.medianWeight.toFixed(1)}kg, Median Ht ${zScores.medianHeight.toFixed(1)}cm`}
                    >
                      {zScores.waz !== null && (
                        <span>
                          WAZ {zScores.waz >= 0 ? `+${zScores.waz}` : zScores.waz} ({zScores.wazLabel})
                        </span>
                      )}
                      {zScores.haz !== null && (
                        <span>
                          {zScores.waz !== null ? ' · ' : ''}
                          HAZ {zScores.haz >= 0 ? `+${zScores.haz}` : zScores.haz} ({zScores.hazLabel})
                        </span>
                      )}
                      {zScores.nutritionLabel && (
                        <span>
                          {zScores.waz !== null || zScores.haz !== null ? ' · ' : ''}
                          {zScores.nutritionIndicator ? `${zScores.nutritionIndicator} ` : ''}
                          ({zScores.nutritionLabel})
                        </span>
                      )}
                    </div>
                  )}
                  {zScores.waz === null && zScores.bmi !== null && (
                    <span
                      className="text-[11px] font-semibold text-[var(--muted)] px-1.5"
                      title={`Raw BMI: ${zScores.bmi} kg/m² (WHO reference cut-offs not applied)`}
                    >
                      BMI {zScores.bmi}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Section: In-Use Active Weight Readout + Broselow Band + Tools + Theme Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
            {/* Authoritative In-Use Active Weight Box (All-around hairline border per taste-skill) */}
            <div
              className={`flex flex-col justify-center px-2 sm:px-2.5 py-1 rounded-lg border transition-colors shrink-0 min-h-[36px] ${
                weightProvenance.isEmpty
                  ? 'border-[var(--border)] bg-[var(--panel-subtle)]'
                  : weightProvenance.isDerived
                  ? 'border-[var(--warning)]/40 bg-[var(--warning-soft)]'
                  : 'border-[var(--accent)]/40 bg-[var(--accent-soft)]/50'
              }`}
            >
              <div className="flex items-baseline gap-1 sm:gap-1.5">
                <span className="text-[10px] font-bold text-[var(--muted)] select-none whitespace-nowrap">
                  In use
                </span>
                <strong
                  id="activeWeightVal"
                  className="font-mono-tabular font-extrabold text-xs sm:text-base text-[var(--ink)] leading-none whitespace-nowrap"
                >
                  {activeWeight ? `${activeWeight.toFixed(1)} kg` : '— kg'}
                </strong>
              </div>
              <span
                className={`text-[9.5px] sm:text-[10px] leading-tight font-semibold tracking-tight select-none truncate max-w-[96px] sm:max-w-none ${
                  weightProvenance.isDerived ? 'text-[var(--warning-text)]' : 'text-[var(--muted)]'
                }`}
              >
                <span className="hidden sm:inline">{weightProvenance.label}</span>
                <span className="sm:hidden">{weightProvenance.compactLabel}</span>
              </span>
            </div>

            {/* Broselow Tape Reference Trigger */}
            <button
              type="button"
              onClick={(e) => onOpenBroselowModal(activeBand?.color, e)}
              style={
                activeBand
                  ? { backgroundColor: activeBand.bg, color: activeBand.fg }
                  : undefined
              }
              className={`min-h-[36px] px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono-tabular border cursor-pointer transition-opacity select-none whitespace-nowrap shrink-0 flex items-center gap-1 ${
                activeBand
                  ? 'border-black/15 hover:opacity-90'
                  : 'border-[var(--border)] bg-[var(--panel-subtle)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
              title="คลิกเพื่อเปิดตารางอุปกรณ์และยา Broselow Resuscitation Tape (9-Color Spectrum)"
            >
              {activeBand ? (
                <>
                  <span className="hidden sm:inline">{activeBand.label}</span>
                  <span className="sm:hidden">{activeBand.label.split('·')[0].trim()}</span>
                </>
              ) : (
                <>
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Broselow</span>
                </>
              )}
            </button>

            {/* Evidence Registry Modal Button */}
            {onOpenEvidenceModal && (
              <button
                type="button"
                onClick={(e) => onOpenEvidenceModal(e)}
                aria-label="Clinical Evidence & Guidelines"
                className="min-h-[36px] min-w-[36px] px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] text-[var(--muted)] hover:text-[var(--accent-text)] cursor-pointer transition-colors shrink-0 flex items-center justify-center gap-1.5"
                title="Clinical Evidence & Guideline Reference Registry (2024–2026)"
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline text-xs font-bold whitespace-nowrap">Evidence</span>
              </button>
            )}

            {/* Bedside Pocket Card & Order Sheet Modal Button */}
            {onOpenOrderSheetModal && (
              <button
                type="button"
                onClick={(e) => onOpenOrderSheetModal(e)}
                aria-label="Bedside Pocket Card & Order Sheet"
                className={`min-h-[36px] min-w-[36px] px-2 py-1.5 rounded-lg border cursor-pointer transition-colors shrink-0 flex items-center justify-center gap-1.5 ${
                  orderCount > 0
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)] font-bold'
                    : 'border-[var(--border)] bg-[var(--panel-subtle)] text-[var(--muted)] hover:text-[var(--accent-text)]'
                }`}
                title="Bedside Emergency Pocket Card & EHR Order Sheet (Print A4 Card)"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline text-xs font-bold whitespace-nowrap">Orders</span>
                {orderCount > 0 && (
                  <span className="font-mono-tabular text-[11px] font-extrabold">
                    ({orderCount})
                  </span>
                )}
              </button>
            )}

            {/* 4-Theme Cycle Toggle Button */}
            <button
              type="button"
              onClick={onCycleTheme}
              aria-label="สลับธีมสี (Light, Dark, Mono, Red)"
              className="min-h-[36px] min-w-[36px] p-2 rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition-colors shrink-0 flex items-center justify-center"
              title={
                theme === 'light'
                  ? 'ธีมปัจจุบัน: Light (Medical Mist) - คลิกเพื่อสลับเป็น Dark'
                  : theme === 'dark'
                  ? 'ธีมปัจจุบัน: Dark (Obsidian) - คลิกเพื่อสลับเป็น Mono'
                  : theme === 'mono'
                  ? 'ธีมปัจจุบัน: Mono (High-Contrast Grayscale) - คลิกเพื่อสลับเป็น Red'
                  : 'ธีมปัจจุบัน: Red (Night-Vision PICU) - คลิกเพื่อสลับเป็น Light'
              }
            >
              {theme === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
              {theme === 'dark' && <Moon className="w-4 h-4 text-sky-400" />}
              {theme === 'mono' && <Monitor className="w-4 h-4 text-slate-400" />}
              {theme === 'red' && <Flame className="w-4 h-4 text-rose-500" />}
            </button>
          </div>
        </div>

        {/* Mobile Expandable Drawer for Height (HT), Wt-for-Ht, Sex, and Z-Score (< 640px) */}
        {mobileMoreOpen && (
          <div className="sm:hidden pt-2 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Mobile Height Input */}
              <div className="flex items-center gap-1.5 bg-[var(--panel-subtle)] border border-[var(--border)] rounded-lg px-2.5 py-1 min-h-[36px]">
                <label htmlFor="mobile-length" className="text-xs font-bold text-[var(--muted)]">
                  HT
                </label>
                <input
                  id="mobile-length"
                  type="number"
                  min="0"
                  max="200"
                  step="1"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="cm"
                  value={bio.rawHeight}
                  onChange={(e) => onHeightChange(e.target.value)}
                  className="w-14 bg-transparent text-center font-mono-tabular font-bold text-base text-[var(--ink)] focus:outline-none"
                />
                <span className="text-xs text-[var(--muted)]">cm</span>
              </div>

              {/* Mobile Sex Toggle */}
              <button
                type="button"
                onClick={onToggleSex}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                  bio.sex === 'male'
                    ? 'border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'border-[var(--danger)]/40 bg-[var(--danger-soft)] text-[var(--danger-text)]'
                }`}
              >
                Sex: {bio.sex === 'male' ? '♂ Male' : '♀ Female'}
              </button>

              {/* Mobile Wt-for-Ht Checkbox */}
              {ibwWeight && (
                <label
                  htmlFor="mobile-useIBW"
                  className="flex items-center gap-1.5 min-h-[36px] px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] text-xs font-semibold text-[var(--ink)] cursor-pointer select-none"
                >
                  <input
                    id="mobile-useIBW"
                    type="checkbox"
                    checked={bio.useIBW}
                    onChange={(e) => onToggleUseIBW(e.target.checked)}
                    className="w-4 h-4 accent-[var(--accent)] rounded"
                  />
                  <span className="font-mono-tabular">
                    Use Wt-for-Ht ({ibwWeight.toFixed(1)} kg)
                  </span>
                </label>
              )}
            </div>

            {/* Mobile WHO Z-Score Summary */}
            {zScores && (zScores.waz !== null || zScores.haz !== null) && (
              <div className="w-full text-[11px] font-mono-tabular text-[var(--muted)] flex items-center gap-1.5 pt-0.5">
                <span className="font-semibold text-[var(--ink)]">WHO Growth:</span>
                {zScores.waz !== null && (
                  <span>
                    WAZ {zScores.waz >= 0 ? `+${zScores.waz}` : zScores.waz} ({zScores.wazLabel})
                  </span>
                )}
                {zScores.haz !== null && (
                  <span>
                    {zScores.waz !== null ? ' · ' : ''}
                    HAZ {zScores.haz >= 0 ? `+${zScores.haz}` : zScores.haz} ({zScores.hazLabel})
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

