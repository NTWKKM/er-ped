import React, { useState, useEffect, useMemo } from 'react';
import {
  TopbarBiometrics,
  BiometricState,
} from './components/TopbarBiometrics';
import { MedicationsView } from './components/MedicationsView';
import { FluidsAndDripsView } from './components/FluidsAndDripsView';
import { EmergencyResusView, ResusTopic } from './components/EmergencyResusView';
import { ProtocolsAndCDSView, ProtocolTopic } from './components/ProtocolsAndCDSView';
import { BroselowModal } from './components/ModalsAndDrawers';
import {
  estimateWeightFromAge,
  estimateWeightFromLength,
} from './utils/clinicalCalculations';

type MainTab = 'dose' | 'fluids' | 'drip' | 'resus' | 'protocols';

export default function App() {
  const [bio, setBio] = useState<BiometricState>({
    rawWeight: '15',
    rawAge: '3.5',
    ageUnit: 'yr',
    sex: 'male',
    rawHeight: '',
    useIBW: false,
    weightSource: 'manual',
    serumCr: '0.5',
  });

  const [mainTab, setMainTab] = useState<MainTab>('dose');
  const [resusTopic, setResusTopic] = useState<ResusTopic>('pals');
  const [protocolTopic, setProtocolTopic] = useState<ProtocolTopic>('asthma');
  const [theme, setTheme] = useState<'light' | 'dark' | 'mono' | 'red'>('light');

  const [broselowOpen, setBroselowOpen] = useState<boolean>(false);
  const [broselowPreviewColor, setBroselowPreviewColor] = useState<string | null>(null);

  const [seizureSeconds, setSeizureSeconds] = useState<number>(0);
  const [seizureRunning, setSeizureRunning] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!seizureRunning) return;
    const id = setInterval(() => {
      setSeizureSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [seizureRunning]);

  const ibwWeight = useMemo(() => {
    const h = parseFloat(bio.rawHeight);
    return Number.isFinite(h) && h > 0 ? estimateWeightFromLength(h) : null;
  }, [bio.rawHeight]);

  const ageYears = useMemo(() => {
    const a = parseFloat(bio.rawAge);
    if (!Number.isFinite(a) || a <= 0) return null;
    const yrs = bio.ageUnit === 'mo' ? a / 12 : a;
    return Math.min(15, yrs);
  }, [bio.rawAge, bio.ageUnit]);

  const activeWeight = useMemo(() => {
    if (bio.useIBW && ibwWeight && ibwWeight > 0) return ibwWeight;
    const w = parseFloat(bio.rawWeight);
    if (Number.isFinite(w) && w > 0) return w;
    return null;
  }, [bio.useIBW, bio.rawWeight, ibwWeight]);

  const handleWeightChange = (val: string) => {
    setBio((prev) => ({
      ...prev,
      rawWeight: val,
      useIBW: false,
      weightSource: val && parseFloat(val) > 0 ? 'manual' : null,
    }));
  };

  const handleAgeChange = (val: string) => {
    let num = parseFloat(val);
    const maxLimit = bio.ageUnit === 'mo' ? 180 : 15;
    if (Number.isFinite(num) && num > maxLimit) {
      num = maxLimit;
      val = String(maxLimit);
    }
    setBio((prev) => {
      if (prev.weightSource === 'manual' && parseFloat(prev.rawWeight) > 0) {
        return { ...prev, rawAge: val, useIBW: false };
      }
      const estW =
        Number.isFinite(num) && num > 0 ? estimateWeightFromAge(num, prev.ageUnit) : null;
      return {
        ...prev,
        rawAge: val,
        rawWeight: estW ? String(estW) : '',
        weightSource: estW ? 'estimated' : null,
        useIBW: false,
      };
    });
  };

  const handleToggleAgeUnit = () => {
    setBio((prev) => {
      const nextUnit = prev.ageUnit === 'yr' ? 'mo' : 'yr';
      const raw = parseFloat(prev.rawAge);
      let convertedStr = prev.rawAge;
      if (Number.isFinite(raw) && raw > 0) {
        const converted =
          prev.ageUnit === 'yr' ? Math.round(raw * 12) : Math.round((raw / 12) * 10) / 10;
        convertedStr = String(converted);
      }
      return { ...prev, ageUnit: nextUnit, rawAge: convertedStr };
    });
  };

  const TABS: { id: MainTab; label: string }[] = [
    { id: 'dose', label: 'Meds' },
    { id: 'fluids', label: 'Fluids' },
    { id: 'drip', label: 'Drip' },
    { id: 'resus', label: 'Resus' },
    { id: 'protocols', label: 'Protocols' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)]">
      {/* Clean Single-Row Header & Patient Inputs */}
      <TopbarBiometrics
        bio={bio}
        activeWeight={activeWeight}
        ibwWeight={ibwWeight}
        theme={theme}
        onWeightChange={handleWeightChange}
        onAgeChange={handleAgeChange}
        onToggleAgeUnit={handleToggleAgeUnit}
        onHeightChange={(val) => setBio((prev) => ({ ...prev, rawHeight: val }))}
        onToggleUseIBW={(checked) => setBio((prev) => ({ ...prev, useIBW: checked }))}
        onCycleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        onOpenBroselowModal={(color) => {
          setBroselowPreviewColor(color || null);
          setBroselowOpen(true);
        }}
      />

      {/* Focused, Uncluttered Main Workspace */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-5 space-y-4">
        {/* Simple 5-Tab Segmented Bar */}
        <nav
          role="tablist"
          aria-label="Main calculator tabs"
          className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-[var(--panel)] border border-[var(--border)]"
        >
          {TABS.map((t) => {
            const isAct = mainTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isAct}
                onClick={() => setMainTab(t.id)}
                className={`py-2 px-2 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap text-center cursor-pointer ${
                  isAct
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Active View */}
        {mainTab === 'dose' && (
          <MedicationsView
            activeWeight={activeWeight}
            ageYears={ageYears}
            heightCm={parseFloat(bio.rawHeight) || null}
            serumCr={bio.serumCr}
            onSerumCrChange={(val) => setBio((prev) => ({ ...prev, serumCr: val }))}
          />
        )}

        {(mainTab === 'fluids' || mainTab === 'drip') && (
          <FluidsAndDripsView activeSubTab={mainTab} activeWeight={activeWeight} />
        )}

        {mainTab === 'resus' && (
          <EmergencyResusView
            activeSubTab={resusTopic}
            activeWeight={activeWeight}
            ageYears={ageYears}
            seizureSeconds={seizureSeconds}
            seizureRunning={seizureRunning}
            onToggleSeizureTimer={() => setSeizureRunning((r) => !r)}
            onResetSeizureTimer={() => {
              setSeizureRunning(false);
              setSeizureSeconds(0);
            }}
            onChangeTopic={setResusTopic}
          />
        )}

        {mainTab === 'protocols' && (
          <ProtocolsAndCDSView
            activeSubTab={protocolTopic}
            activeWeight={activeWeight}
            ageYears={ageYears}
            onChangeTopic={setProtocolTopic}
          />
        )}
      </main>

      <BroselowModal
        isOpen={broselowOpen}
        activeWeight={activeWeight}
        previewColor={broselowPreviewColor}
        onClose={() => setBroselowOpen(false)}
        onSelectZoneWeight={(kg, color) => {
          handleWeightChange(String(kg));
          setBroselowPreviewColor(color);
        }}
      />
    </div>
  );
}
