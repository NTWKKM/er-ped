import React, { useMemo } from 'react';
import {
  getBroselowSpectrumBand,
  calcGrowthZScores,
} from '../utils/clinicalCalculations';
import { Sun, Moon, Monitor, Flame } from 'lucide-react';

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
  onWeightChange: (val: string, source?: 'manual' | 'broselow') => void;
  onAgeChange: (val: string) => void;
  onToggleAgeUnit: () => void;
  onToggleSex: () => void;
  onHeightChange: (val: string) => void;
  onToggleUseIBW: (checked: boolean) => void;
  onCycleTheme: () => void;
  onOpenBroselowModal: (zoneColor?: string) => void;
}

export const TopbarBiometrics: React.FC<TopbarBiometricsProps> = ({
  bio,
  activeWeight,
  ibwWeight,
  theme,
  onWeightChange,
  onAgeChange,
  onToggleAgeUnit,
  onToggleSex,
  onHeightChange,
  onToggleUseIBW,
  onCycleTheme,
  onOpenBroselowModal,
}) => {
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
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md no-print shadow-xs">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Section: Brand & Patient Biometrics Cluster */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          {/* Brand Logo */}
          <span className="text-sm sm:text-base font-extrabold tracking-tight text-[var(--ink)] select-none">
            ER-PED
          </span>
          <div className="h-4 w-[1px] bg-[var(--border-strong)] hidden sm:block" />

          {/* Biometrics Input Fields */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
            {/* 1. Measured Weight (BW) */}
            <div className="flex items-center gap-1 bg-[var(--panel-subtle)] border border-[var(--border)] rounded-lg px-2 py-1 shadow-2xs">
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
                placeholder="kg"
                value={bio.rawWeight}
                onChange={(e) => onWeightChange(e.target.value)}
                className="w-13 sm:w-16 bg-transparent text-center font-mono-tabular font-bold text-base sm:text-sm text-[var(--ink)] focus:outline-none"
              />
              <span className="text-xs text-[var(--muted)] select-none">kg</span>
            </div>

            {/* 2. Age Input + Unit Toggle (yr/mo) + Sex Toggle (♂/♀) */}
            <div className="flex items-center gap-1 bg-[var(--panel-subtle)] border border-[var(--border)] rounded-lg px-2 py-1 shadow-2xs">
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
                placeholder="0"
                value={bio.rawAge}
                onChange={(e) => onAgeChange(e.target.value)}
                className="w-10 sm:w-12 bg-transparent text-center font-mono-tabular font-bold text-base sm:text-sm text-[var(--ink)] focus:outline-none"
              />
              <button
                type="button"
                onClick={onToggleAgeUnit}
                className="text-xs font-bold px-1 py-0.5 rounded bg-[var(--panel)] text-[var(--ink)] hover:text-[var(--accent-text)] cursor-pointer select-none transition-colors"
                title="คลิกเพื่อสลับหน่วยอายุ: ปี (yr) / เดือน (mo)"
              >
                {bio.ageUnit}
              </button>

              {/* Sex Toggle Button (Desktop/Tablet >= 640px) */}
              <button
                type="button"
                onClick={onToggleSex}
                className={`hidden sm:inline-flex text-xs font-extrabold px-1.5 py-0.5 rounded cursor-pointer select-none transition-colors ${
                  bio.sex === 'male'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                }`}
                title={`สลับเพศ (${bio.sex === 'male' ? 'เด็กชาย ♂' : 'เด็กหญิง ♀'}) สำหรับ WHO Growth Standards`}
              >
                {bio.sex === 'male' ? '♂' : '♀'}
              </button>
            </div>

            {/* 3. Height (HT) & Wt-for-Ht (Desktop/Tablet >= 640px) */}
            <div className="hidden sm:flex items-center gap-1.5 bg-[var(--panel-subtle)] border border-[var(--border)] rounded-lg px-2 py-1 shadow-2xs">
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
                placeholder="cm"
                value={bio.rawHeight}
                onChange={(e) => onHeightChange(e.target.value)}
                className="w-14 bg-transparent text-center font-mono-tabular font-bold text-base sm:text-sm text-[var(--ink)] focus:outline-none"
              />
              <span className="text-xs text-[var(--muted)] select-none">cm</span>

              {ibwWeight && (
                <div className="flex items-center gap-1.5 border-l border-[var(--border)] pl-1.5">
                  <span className="text-[11px] text-[var(--muted)] font-mono-tabular whitespace-nowrap">
                    Wt-for-Ht: <strong className="text-[var(--ink)]">{ibwWeight.toFixed(1)}k</strong>
                  </span>
                  <label
                    htmlFor="useIBW"
                    className="flex items-center gap-1 text-[11px] font-semibold text-[var(--muted)] cursor-pointer hover:text-[var(--ink)] select-none"
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

            {/* 4. WHO Growth Standards Z-Score Badge (Desktop/Large Screen) */}
            {zScores && (
              <div
                className={`hidden lg:flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold font-mono-tabular border transition-all select-none ${
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
                    WAZ: {zScores.waz >= 0 ? `+${zScores.waz}` : zScores.waz} ({zScores.wazLabel})
                  </span>
                )}
                {zScores.haz !== null && (
                  <span>
                    {zScores.waz !== null ? ' · ' : ''}
                    HAZ: {zScores.haz >= 0 ? `+${zScores.haz}` : zScores.haz} ({zScores.hazLabel})
                  </span>
                )}
                {zScores.waz === null && zScores.bmi !== null && (
                  <span>
                    {zScores.haz !== null ? ' · ' : ''}
                    BMI {zScores.bmi}
                  </span>
                )}
                {zScores.nutritionLabel && (
                  <span>
                    {zScores.waz !== null || zScores.haz !== null || zScores.bmi !== null ? ' · ' : ''}
                    {zScores.nutritionIndicator ? `${zScores.nutritionIndicator} ` : ''}
                    ({zScores.nutritionLabel})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: In-Use Active Weight Hero Box + Broselow Band + Theme Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-shrink-0">
          {/* Authoritative In-Use Active Weight Hero Box */}
          <div
            className={`flex flex-col justify-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border shadow-xs transition-colors ${
              weightProvenance.isEmpty
                ? 'border-l-[3.5px] border-l-[var(--border-strong)] border-[var(--border)] bg-[var(--panel-subtle)]'
                : weightProvenance.isDerived
                ? 'border-l-[3.5px] border-l-[var(--warning)] border-[var(--border)] bg-[var(--warning-soft)]'
                : 'border-l-[3.5px] border-l-[var(--accent)] border-[var(--border)] bg-[var(--card)]'
            }`}
          >
            <div className="flex items-baseline gap-1 sm:gap-1.5">
              <span className="text-[9px] sm:text-[9.5px] uppercase font-extrabold tracking-wider text-[var(--muted)] select-none">
                In use
              </span>
              <strong
                id="activeWeightVal"
                className="font-mono-tabular font-extrabold text-sm sm:text-base text-[var(--ink)] leading-none"
              >
                {activeWeight ? `${activeWeight.toFixed(1)} kg` : '— kg'}
              </strong>
            </div>
            <span
              className={`text-[9.5px] sm:text-[10px] leading-tight font-semibold tracking-tight select-none ${
                weightProvenance.isDerived ? 'text-[var(--warning-text)]' : 'text-[var(--muted)]'
              }`}
            >
              <span className="hidden sm:inline">{weightProvenance.label}</span>
              <span className="sm:hidden">{weightProvenance.compactLabel}</span>
            </span>
          </div>

          {/* Broselow Tape Band Pill */}
          {activeBand && (
            <button
              type="button"
              onClick={() => onOpenBroselowModal(activeBand.color)}
              style={{ backgroundColor: activeBand.bg, color: activeBand.fg }}
              className="px-2 py-1 rounded-md text-[10.5px] sm:text-[11px] font-bold font-mono-tabular border border-black/15 shadow-xs cursor-pointer hover:opacity-90 transition-opacity select-none"
              title="คลิกเพื่อเปิดตารางอุปกรณ์และยา Broselow Resuscitation Tape"
            >
              <span className="hidden sm:inline">{activeBand.label}</span>
              <span className="sm:hidden">{activeBand.label.split('·')[0].trim()}</span>
            </button>
          )}

          {/* 4-Theme Cycle Toggle Button */}
          <button
            type="button"
            onClick={onCycleTheme}
            aria-label="สลับธีมสี (Light, Dark, Mono, Red)"
            className="p-1.5 sm:p-2 rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition-colors"
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
    </header>
  );
};
