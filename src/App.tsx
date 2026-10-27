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
import { EmergencyResusView, ResusTopic } from './components/EmergencyResusView';
import { ProtocolsAndCDSView, ProtocolTopic } from './components/ProtocolsAndCDSView';
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

type MainTab = 'dose' | 'fluids' | 'drip' | 'resus' | 'protocols';

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

  const [mainTab, setMainTab] = useState<MainTab>('dose');
  const [fluidsTopic, setFluidsTopic] = useState<'fluids' | 'drip' | 'transfusion'>('fluids');
  const [fluidsInputs, setFluidsInputs] = useState<FluidsAndDripsInputs>(DEFAULT_FLUIDS_INPUTS);
  const [medSelectedKey, setMedSelectedKey] = useState<string>('paracetamol-syrup-120-mg-5-ml');
  const [medConcOverride, setMedConcOverride] = useState<string>('');
  const [dkaSeverity, setDkaSeverity] = useState<number>(7);
  const [dkaPriorBolus, setDkaPriorBolus] = useState<string>('0');
  const [resusTopic, setResusTopic] = useState<ResusTopic>('pals');
  const [protocolTopic, setProtocolTopic] = useState<ProtocolTopic>('asthma');
  const [theme, setTheme] = useState<'light' | 'dark' | 'mono' | 'red'>('light');

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

  const handleWeightChange = (
    val: string,
    source: 'manual' | 'broselow' = 'manual'
  ) => {
    invalidateCalculatedOrders();
    setBio((prev) => ({
      ...prev,
      rawWeight: val,
      useIBW: false,
      weightSource: val && parseFloat(val) > 0 ? source : null,
    }));
  };

  const handleAgeChange = (val: string) => {
    invalidateCalculatedOrders();
    let num = parseFloat(val);
    const maxLimit = bio.ageUnit === 'mo' ? 180 : 15;
    if (Number.isFinite(num) && num > maxLimit) {
      num = maxLimit;
      val = String(maxLimit);
    }
    setBio((prev) => {
      if ((prev.weightSource === 'manual' || prev.weightSource === 'broselow') && parseFloat(prev.rawWeight) > 0) {
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
    invalidateCalculatedOrders();
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
        className={`flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 lg:px-8 py-4 sm:py-5 space-y-4 ${
          orderSheetOpen ? 'no-print' : ''
        }`}
      >
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
                onClick={() => {
                  setMainTab(t.id);
                  if (t.id === 'fluids') setFluidsTopic('fluids');
                  if (t.id === 'drip') setFluidsTopic('drip');
                }}
                className={`min-h-[38px] sm:min-h-[40px] py-1.5 sm:py-2 px-1 sm:px-2 text-xs sm:text-sm font-bold rounded-lg transition-colors text-center cursor-pointer truncate ${
                  isAct
                    ? 'bg-[var(--accent)] text-white shadow-xs'
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
            dkaSeverity={dkaSeverity}
            onChangeDkaSeverity={setDkaSeverity}
            dkaPriorBolus={dkaPriorBolus}
            onChangeDkaPriorBolus={setDkaPriorBolus}
          />
        )}
      </main>

      {/* Broselow 9-Color Spectrum Equipment & Drug Modal */}
      <BroselowModal
        isOpen={broselowOpen}
        activeWeight={activeWeight}
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
