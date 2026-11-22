import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TopbarBiometrics,
  BiometricState,
} from './components/TopbarBiometrics';
import { MedicationsView } from './components/MedicationsView';
import {
  FluidsAndDripsView,
  FluidsAndDripsInputs,
  DEFAULT_FLUIDS_INPUTS,
} from './components/FluidsAndDripsView';
import {
  EmergencyResusView,
  ResusTopic,
  EmergencyResusInputs,
  DEFAULT_RESUS_INPUTS,
} from './components/EmergencyResusView';
import {
  ProtocolsAndCDSView,
  ProtocolTopic,
  ProtocolsInputs,
  DEFAULT_PROTOCOLS_INPUTS,
} from './components/ProtocolsAndCDSView';
import {
  BroselowModal,
  EvidenceModal,
  OrderSheetModal,
  OrderItem,
} from './components/ModalsAndDrawers';
import {
  estimateWeightFromAge,
  estimateWeightFromLength,
} from './utils/clinicalCalculations';
import { HeartPulse } from 'lucide-react';

type MainTab = 'dose' | 'fluids' | 'drip' | 'resus' | 'protocols';
type Theme = 'light' | 'dark' | 'mono' | 'red';

const MAIN_TABS: MainTab[] = ['dose', 'fluids', 'drip', 'resus', 'protocols'];
const THEMES: Theme[] = ['light', 'dark', 'mono', 'red'];
const THEME_STORAGE_KEY = 'er-ped:theme';

/** The active tab lives in the URL hash so reload and back/forward keep the view. Patient data never does. */
function readTabFromHash(): MainTab {
  if (typeof window === 'undefined') return 'dose';
  const hash = window.location.hash.replace('#', '') as MainTab;
  return MAIN_TABS.includes(hash) ? hash : 'dose';
}

/** Theme is a per-device display preference; storage may be unavailable (private mode), so every access is guarded. */
function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    return stored && THEMES.includes(stored) ? stored : 'light';
  } catch {
    return 'light';
  }
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useModalFocusTrap(isOpen: boolean, dialogSelector: string, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const getDialog = () => document.querySelector<HTMLElement>(dialogSelector);
    const timer = setTimeout(() => {
      getDialog()?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = getDialog();
      if (!dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !dialog.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !dialog.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, dialogSelector]);
}

export default function App() {
  const [bio, setBio] = useState<BiometricState>({
    rawWeight: '',
    rawAge: '',
    ageUnit: 'yr',
    sex: 'male',
    rawHeight: '',
    useIBW: false,
    weightSource: null,
    serumCr: '',
  });

  const [mainTab, setMainTab] = useState<MainTab>(readTabFromHash);
  const [fluidsTopic, setFluidsTopic] = useState<'fluids' | 'drip' | 'transfusion'>('fluids');
  const [fluidsInputs, setFluidsInputs] = useState<FluidsAndDripsInputs>(DEFAULT_FLUIDS_INPUTS);
  const [medSelectedKey, setMedSelectedKey] = useState<string>('paracetamol-syrup-120-mg-5-ml');
  const [medConcOverride, setMedConcOverride] = useState<string>('');
  const [resusTopic, setResusTopic] = useState<ResusTopic>('pals');
  const [resusInputs, setResusInputs] = useState<EmergencyResusInputs>(DEFAULT_RESUS_INPUTS);
  const [protocolTopic, setProtocolTopic] = useState<ProtocolTopic>('asthma');
  const [protocolsInputs, setProtocolsInputs] = useState<ProtocolsInputs>(DEFAULT_PROTOCOLS_INPUTS);
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  const [broselowOpen, setBroselowOpen] = useState<boolean>(false);
  const [broselowPreviewColor, setBroselowPreviewColor] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState<boolean>(false);
  const [evidenceTopic, setEvidenceTopic] = useState<string | null>(null);
  const [orderSheetOpen, setOrderSheetOpen] = useState<boolean>(false);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [copyMessage, setCopyMessage] = useState<{
    type: 'success' | 'warning';
    text: string;
  } | null>(null);

  const broselowTriggerRef = useRef<HTMLElement | null>(null);
  const evidenceTriggerRef = useRef<HTMLElement | null>(null);
  const orderSheetTriggerRef = useRef<HTMLElement | null>(null);

  const handleOpenBroselowModal = (color?: string, e?: React.SyntheticEvent<HTMLElement>) => {
    broselowTriggerRef.current = (e?.currentTarget as HTMLElement) || (document.activeElement as HTMLElement) || null;
    setBroselowPreviewColor(color || null);
    setBroselowOpen(true);
  };

  const handleCloseBroselowModal = () => {
    setBroselowOpen(false);
    broselowTriggerRef.current?.focus();
  };

  const handleOpenEvidenceModal = (e?: React.SyntheticEvent<HTMLElement>, topicKey: string | null = null) => {
    evidenceTriggerRef.current = (e?.currentTarget as HTMLElement) || (document.activeElement as HTMLElement) || null;
    setEvidenceTopic(topicKey);
    setEvidenceOpen(true);
  };

  const handleCloseEvidenceModal = () => {
    setEvidenceOpen(false);
    evidenceTriggerRef.current?.focus();
  };

  const handleOpenOrderSheetModal = (e?: React.SyntheticEvent<HTMLElement>) => {
    orderSheetTriggerRef.current = (e?.currentTarget as HTMLElement) || (document.activeElement as HTMLElement) || null;
    setCopyMessage(null);
    setOrderSheetOpen(true);
  };

  const handleCloseOrderSheetModal = () => {
    setOrderSheetOpen(false);
    orderSheetTriggerRef.current?.focus();
  };

  const getOrderPrefix = (id: string) => id.replace(/-\d+-\d+$/, '');

  const invalidateCalculatedOrders = (targetPrefix?: string) => {
    setCopyMessage(null);
    setOrders((prev) =>
      prev.length > 0
        ? prev.map((o) => {
            if (targetPrefix) {
              const orderPrefix = getOrderPrefix(o.id);
              if (orderPrefix !== targetPrefix) {
                return o;
              }
            }
            return o.invalidated ? o : { ...o, invalidated: true };
          })
        : prev
    );
  };

  const handleAddOrder = (order: OrderItem) => {
    setCopyMessage(null);
    const prefix = getOrderPrefix(order.id);
    setOrders((prev) => {
      const idx = prev.findIndex((o) => o.invalidated && getOrderPrefix(o.id) === prefix);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...order, invalidated: false };
        return next;
      }
      return [...prev, { ...order, invalidated: false }];
    });
  };

  const handleCopyAllOrders = async () => {
    const confirmedOrders = orders.filter((o) => !o.invalidated);
    if (confirmedOrders.length === 0) {
      setCopyMessage({
        type: 'warning',
        text: 'Patient inputs changed since these orders were queued. Recalculate and confirm orders via "+ Order Sheet" before copying.',
      });
      return;
    }
    const text = confirmedOrders.map((o, idx) => `${idx + 1}. [${o.module}] ${o.text}`).join('\n');
    if (!navigator.clipboard?.writeText) {
      setCopyMessage({
        type: 'warning',
        text: 'Copy failed. Clipboard API is unavailable; select the order text and copy it manually.',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage({
        type: 'success',
        text: `Copied ${confirmedOrders.length} active order(s) to clipboard.`,
      });
    } catch {
      setCopyMessage({
        type: 'warning',
        text: 'Copy failed. Select the order text and copy it manually.',
      });
    }
  };

  useModalFocusTrap(
    broselowOpen,
    '[role="dialog"][aria-label="Broselow Tape Reference Modal"]',
    handleCloseBroselowModal
  );
  useModalFocusTrap(
    evidenceOpen,
    '[role="dialog"][aria-label="Clinical Evidence Registry Modal"]',
    handleCloseEvidenceModal
  );
  useModalFocusTrap(
    orderSheetOpen,
    '[role="dialog"][aria-label="Active Patient Order Sheet & Bedside Pocket Summary"]',
    handleCloseOrderSheetModal
  );

  const [seizureSeconds, setSeizureSeconds] = useState<number>(0);
  const [seizureRunning, setSeizureRunning] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // storage unavailable: theme still applies for this session
    }
  }, [theme]);

  useEffect(() => {
    const next = `#${mainTab}`;
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next);
    }
  }, [mainTab]);

  useEffect(() => {
    const onHashChange = () => setMainTab(readTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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
    if (bio.useIBW) {
      return ibwWeight && ibwWeight > 0 && ibwWeight <= 150 ? ibwWeight : null;
    }
    const w = parseFloat(bio.rawWeight);
    if (Number.isFinite(w) && w > 0 && w <= 150) return w;
    return null;
  }, [bio.useIBW, bio.rawWeight, ibwWeight]);

  const handleWeightChange = (
    val: string,
    source: 'manual' | 'broselow' = 'manual'
  ) => {
    invalidateCalculatedOrders();
    setBio((prev) => {
      // Preserve age-estimated weight fallback ONLY when no weight was entered
      if (!val || val.trim() === '') {
        const ageNum = parseFloat(prev.rawAge);
        const estW =
          Number.isFinite(ageNum) && ageNum > 0
            ? estimateWeightFromAge(ageNum, prev.ageUnit)
            : null;
        return {
          ...prev,
          rawWeight: estW ? String(estW) : '',
          useIBW: false,
          weightSource: estW ? 'estimated' : null,
        };
      }

      const numW = parseFloat(val);
      if (Number.isFinite(numW) && numW > 0 && numW <= 150) {
        return {
          ...prev,
          rawWeight: val,
          useIBW: false,
          weightSource: source,
        };
      }

      // Entered weight above 150 kg or <= 0 is rejected as invalid
      // Retain the entered string so the input reflects validation error, but do NOT fall through to age-estimated fallback
      return {
        ...prev,
        rawWeight: val,
        useIBW: false,
        weightSource: null,
      };
    });
  };

  const handleAgeChange = (val: string) => {
    invalidateCalculatedOrders();
    setBio((prev) => {
      let nextVal = val;
      let num = parseFloat(nextVal);
      const maxLimit = prev.ageUnit === 'mo' ? 180 : 15;
      if (Number.isFinite(num) && num > maxLimit) {
        num = maxLimit;
        nextVal = String(maxLimit);
      }
      // Preserve a user-entered weight (manual, broselow, or invalid/out-of-range with weightSource: null)
      // Only recalculate or clear estimated weights (or when no weight has been entered)
      if (prev.weightSource !== 'estimated' && prev.rawWeight && prev.rawWeight.trim() !== '') {
        return { ...prev, rawAge: nextVal, useIBW: false };
      }
      // Apply, recalculate, or clear estimated weight from the updated age
      const estW =
        Number.isFinite(num) && num > 0 ? estimateWeightFromAge(num, prev.ageUnit) : null;
      return {
        ...prev,
        rawAge: nextVal,
        rawWeight: estW ? String(estW) : '',
        weightSource: estW ? 'estimated' : null,
        useIBW: false,
      };
    });
  };

  const handleToggleAgeUnit = () => {
    invalidateCalculatedOrders();
    setBio((prev) => {
      const nextUnit = prev.ageUnit === 'yr' ? 'mo' : 'yr';
      const raw = parseFloat(prev.rawAge);
      let convertedStr = prev.rawAge;
      let convertedNum = NaN;
      if (Number.isFinite(raw) && raw > 0) {
        const maxLimit = nextUnit === 'mo' ? 180 : 15;
        const rawConverted =
          prev.ageUnit === 'yr'
            ? parseFloat((raw * 12).toFixed(2))
            : parseFloat((raw / 12).toFixed(4));
        convertedNum = Math.min(maxLimit, rawConverted);
        convertedStr = String(convertedNum);
      }
      // Only apply estimated weight when the current weight was estimated or when no weight was entered
      if (prev.weightSource === 'estimated' || (!prev.weightSource && (!prev.rawWeight || prev.rawWeight.trim() === ''))) {
        const estW =
          Number.isFinite(convertedNum) && convertedNum > 0
            ? estimateWeightFromAge(convertedNum, nextUnit)
            : null;
        return {
          ...prev,
          ageUnit: nextUnit,
          rawAge: convertedStr,
          rawWeight: estW ? String(estW) : prev.rawWeight,
          weightSource: estW ? 'estimated' : prev.weightSource,
        };
      }
      return { ...prev, ageUnit: nextUnit, rawAge: convertedStr };
    });
  };

  const handleToggleSex = () => {
    invalidateCalculatedOrders();
    setBio((prev) => ({
      ...prev,
      sex: prev.sex === 'male' ? 'female' : 'male',
    }));
  };

  const handleHeightChange = (val: string) => {
    invalidateCalculatedOrders();
    setBio((prev) => ({ ...prev, rawHeight: val }));
  };

  const handleToggleUseIBW = (checked: boolean) => {
    invalidateCalculatedOrders();
    setBio((prev) => ({ ...prev, useIBW: checked }));
  };

  const handleSerumCrChange = (val: string) => {
    invalidateCalculatedOrders();
    setBio((prev) => ({ ...prev, serumCr: val }));
  };

  const handleCycleTheme = () => {
    setTheme((t) => {
      if (t === 'light') return 'dark';
      if (t === 'dark') return 'mono';
      if (t === 'mono') return 'red';
      return 'light';
    });
  };

  const selectMainTab = (id: MainTab, focusTab = false) => {
    setMainTab(id);
    if (id === 'fluids') setFluidsTopic('fluids');
    if (id === 'drip') setFluidsTopic('drip');
    if (focusTab) {
      requestAnimationFrame(() => document.getElementById(`tab-${id}`)?.focus());
    }
  };

  const openPals = () => {
    setResusTopic('pals');
    setMainTab('resus');
    requestAnimationFrame(() => {
      const panel = document.getElementById('panel-main');
      panel?.focus({ preventScroll: true });
      panel?.scrollIntoView({ block: 'start' });
    });
  };

  // Alt+P opens PALS; Alt+1..5 jump to the five main tabs. Ignored while a dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (broselowOpen || evidenceOpen || orderSheetOpen) return;
      if (e.code === 'KeyP') {
        e.preventDefault();
        openPals();
        return;
      }
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
      if (idx !== -1) {
        e.preventDefault();
        selectMainTab(MAIN_TABS[idx], true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % MAIN_TABS.length;
    if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + MAIN_TABS.length) % MAIN_TABS.length;
    if (e.key === 'Home') nextIdx = 0;
    if (e.key === 'End') nextIdx = MAIN_TABS.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    selectMainTab(MAIN_TABS[nextIdx], true);
  };

  const activeOrderCount = useMemo(
    () => orders.filter((o) => !o.invalidated).length,
    [orders]
  );

  const TABS: { id: MainTab; label: string }[] = [
    { id: 'dose', label: 'Meds' },
    { id: 'fluids', label: 'Fluids' },
    { id: 'drip', label: 'Drip' },
    { id: 'resus', label: 'Resus' },
    { id: 'protocols', label: 'Protocols' },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--ink)]">
      {/* Clean Header & Patient Inputs */}
      <TopbarBiometrics
        bio={bio}
        activeWeight={activeWeight}
        ibwWeight={ibwWeight}
        theme={theme}
        orderCount={activeOrderCount}
        onWeightChange={handleWeightChange}
        onAgeChange={handleAgeChange}
        onToggleAgeUnit={handleToggleAgeUnit}
        onToggleSex={handleToggleSex}
        onHeightChange={handleHeightChange}
        onToggleUseIBW={handleToggleUseIBW}
        onCycleTheme={handleCycleTheme}
        onOpenBroselowModal={handleOpenBroselowModal}
        onOpenEvidenceModal={handleOpenEvidenceModal}
        onOpenOrderSheetModal={handleOpenOrderSheetModal}
      />

      {/* Responsive Clinical Workspace */}
      <main
        className={`flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-5 lg:px-8 pt-4 sm:pt-5 pb-24 space-y-4 ${
          orderSheetOpen ? 'no-print' : ''
        }`}
      >
        <h1 className="sr-only-heading">ER-PED pediatric emergency calculator</h1>
        {/* Simple 5-Tab Segmented Bar */}
        <nav
          role="tablist"
          aria-label="Main calculator tabs"
          className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-[var(--panel)] border border-[var(--border)]"
        >
          {TABS.map((t, idx) => {
            const isAct = mainTab === t.id;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={isAct}
                aria-controls="panel-main"
                aria-keyshortcuts={`Alt+${idx + 1}`}
                tabIndex={isAct ? 0 : -1}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                onClick={() => selectMainTab(t.id)}
                className={`min-h-[44px] sm:min-h-[40px] py-1.5 sm:py-2 px-1 sm:px-2 max-[360px]:px-0.5 text-xs max-[360px]:text-[11px] sm:text-sm font-bold rounded-lg transition-colors text-center cursor-pointer whitespace-nowrap ${
                  isAct
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Active View */}
        <div
          id="panel-main"
          role="tabpanel"
          aria-labelledby={`tab-${mainTab}`}
          tabIndex={-1}
          className="space-y-4"
        >
        {mainTab === 'dose' && (
          <MedicationsView
            activeWeight={activeWeight}
            ageYears={ageYears}
            heightCm={parseFloat(bio.rawHeight) || null}
            serumCr={bio.serumCr}
            onSerumCrChange={handleSerumCrChange}
            onAddOrder={handleAddOrder}
            onInvalidateOrders={invalidateCalculatedOrders}
            selectedKey={medSelectedKey}
            onSelectKey={setMedSelectedKey}
            concOverride={medConcOverride}
            onConcOverrideChange={setMedConcOverride}
          />
        )}

        {(mainTab === 'fluids' || mainTab === 'drip') && (
          <FluidsAndDripsView
            activeSubTab={fluidsTopic}
            activeWeight={activeWeight}
            inputs={fluidsInputs}
            onChangeInputs={setFluidsInputs}
            onChangeSubTab={(sub) => {
              setFluidsTopic(sub);
              if (sub === 'drip') setMainTab('drip');
              else if (sub === 'fluids' || sub === 'transfusion') setMainTab('fluids');
            }}
            onAddOrder={handleAddOrder}
            onInvalidateOrders={invalidateCalculatedOrders}
            onOpenEvidence={(topicKey, e) => handleOpenEvidenceModal(e, topicKey)}
          />
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
            onAddOrder={handleAddOrder}
            inputs={resusInputs}
            onChangeInputs={setResusInputs}
          />
        )}

        {mainTab === 'protocols' && (
          <ProtocolsAndCDSView
            activeSubTab={protocolTopic}
            activeWeight={activeWeight}
            ageYears={ageYears}
            onChangeTopic={setProtocolTopic}
            onAddOrder={handleAddOrder}
            onInvalidateOrders={invalidateCalculatedOrders}
            inputs={protocolsInputs}
            onChangeInputs={setProtocolsInputs}
          />
        )}
        </div>
      </main>

      {/* PALS quick access: always one tap (or Alt+P) from any module */}
      <button
        type="button"
        onClick={openPals}
        className="pals-fab no-print"
        aria-label="Open PALS cardiac arrest dosing"
        aria-keyshortcuts="Alt+P"
        title="PALS (Alt+P)"
      >
        <HeartPulse className="w-5 h-5" aria-hidden="true" />
        <span>PALS</span>
      </button>

      {/* Broselow 9-Color Spectrum Equipment & Drug Modal */}
      <BroselowModal
        isOpen={broselowOpen}
        activeWeight={activeWeight}
        weightSource={bio.weightSource}
        useIBW={bio.useIBW}
        previewColor={broselowPreviewColor}
        onClose={handleCloseBroselowModal}
        onSelectZoneWeight={(kg, color) => {
          handleWeightChange(String(kg), 'broselow');
          setBroselowPreviewColor(color);
        }}
      />

      {/* Clinical Evidence & Guideline Reference Registry Modal */}
      <EvidenceModal
        isOpen={evidenceOpen}
        initialTopicKey={evidenceTopic}
        onClose={handleCloseEvidenceModal}
      />

      {/* Active Patient EHR Order Sheet & Bedside Pocket Summary Modal */}
      <OrderSheetModal
        isOpen={orderSheetOpen}
        orders={orders}
        activeWeight={activeWeight}
        ageYears={ageYears}
        copyMessage={copyMessage}
        onClose={handleCloseOrderSheetModal}
        onRemoveOrder={(id) => {
          setCopyMessage(null);
          setOrders((prev) => prev.filter((o) => o.id !== id));
        }}
        onClearOrders={() => {
          setCopyMessage(null);
          setOrders([]);
        }}
        onCopyAll={handleCopyAllOrders}
      />
    </div>
  );
}
