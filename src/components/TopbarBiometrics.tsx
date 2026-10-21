import React from 'react';
import { getBroselowSpectrumBand } from '../utils/clinicalCalculations';
import { Sun, Moon } from 'lucide-react';

export interface BiometricState {
  rawWeight: string;
  rawAge: string;
  ageUnit: 'yr' | 'mo';
  sex: 'male' | 'female';
  rawHeight: string;
  useIBW: boolean;
  weightSource: 'manual' | 'estimated' | null;
  serumCr: string;
}

interface TopbarBiometricsProps {
  bio: BiometricState;
  activeWeight: number | null;
  ibwWeight: number | null;
  theme: 'light' | 'dark' | 'mono' | 'red';
  onWeightChange: (val: string) => void;
  onAgeChange: (val: string) => void;
  onToggleAgeUnit: () => void;
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
  onHeightChange,
  onToggleUseIBW,
  onCycleTheme,
  onOpenBroselowModal,
}) => {
  const activeBand = getBroselowSpectrumBand(activeWeight);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md no-print">
      <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand & Active Weight Display */}
        <div className="flex items-center gap-3">
          <span className="text-base font-extrabold tracking-tight text-[var(--ink)]">
            ER-PED
          </span>
          <div className="h-4 w-[1px] bg-[var(--border-strong)]" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">Active Weight:</span>
            <strong
              id="activeWeightVal"
              className="text-base font-extrabold font-mono-tabular text-[var(--accent-text)]"
            >
              {activeWeight ? `${activeWeight.toFixed(1)} kg` : '— kg'}
            </strong>
            {activeBand && (
              <button
                type="button"
                onClick={() => onOpenBroselowModal(activeBand.color)}
                style={{ backgroundColor: activeBand.bg, color: activeBand.fg }}
                className="px-2 py-0.5 rounded text-[11px] font-bold font-mono-tabular border border-black/15 cursor-pointer"
                title="View Broselow Resuscitation Tape Reference"
              >
                {activeBand.label}
              </button>
            )}
          </div>
        </div>

        {/* Right: Simple Inputs (BW, Age, Height) & Theme Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[var(--panel-subtle)] border border-[var(--border)] rounded-lg px-2.5 py-1">
            <label htmlFor="weight" className="text-xs font-semibold text-[var(--muted)]">
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
              className="w-16 bg-transparent text-center font-mono-tabular font-bold text-sm text-[var(--ink)] focus:outline-none"
            />
            <span className="text-xs text-[var(--muted)]">kg</span>
          </div>

          <div className="flex items-center gap-1 bg-[var(--panel-subtle)] border border-[var(--border)] rounded-lg px-2.5 py-1">
            <label htmlFor="age" className="text-xs font-semibold text-[var(--muted)]">
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
              className="w-12 bg-transparent text-center font-mono-tabular font-bold text-sm text-[var(--ink)] focus:outline-none"
            />
            <button
              type="button"
              onClick={onToggleAgeUnit}
              className="text-xs font-bold text-[var(--accent-text)] hover:underline cursor-pointer px-1"
              title="Toggle Age Unit: Years (yr) / Months (mo)"
            >
              {bio.ageUnit}
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--panel-subtle)] border border-[var(--border)] rounded-lg px-2.5 py-1">
            <label htmlFor="length" className="text-xs font-semibold text-[var(--muted)]">
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
              className="w-14 bg-transparent text-center font-mono-tabular font-bold text-sm text-[var(--ink)] focus:outline-none"
            />
            {ibwWeight && (
              <label
                htmlFor="useIBW"
                className="flex items-center gap-1 text-[11px] text-[var(--muted)] cursor-pointer border-l border-[var(--border)] pl-1.5"
                title="Use Weight-for-Height (Wt-for-Ht)"
              >
                <input
                  id="useIBW"
                  type="checkbox"
                  checked={bio.useIBW}
                  onChange={(e) => onToggleUseIBW(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[var(--accent)] cursor-pointer"
                />
                <span className="font-mono-tabular">{ibwWeight}k</span>
              </label>
            )}
          </div>

          <button
            type="button"
            onClick={onCycleTheme}
            aria-label="Toggle color theme"
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
            title="Switch Light / Dark theme"
          >
            {theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
