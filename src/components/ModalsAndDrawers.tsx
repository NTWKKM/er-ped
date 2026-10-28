import React, { useState, useEffect } from 'react';
import { BROSELOW_SPECTRUM, DATASET } from '../data/dataset';
import {
  weightToETTCuffed,
  weightToETTUncuffed,
  weightToDepth,
  suggestBlade,
  suggestOPA,
  suggestNPA,
  suggestSuction,
  suggestNG,
  suggestFoley,
  calcMaintenanceMlPerHr,
  MAINTENANCE_CAP_ML_DAY,
  BOLUS_20_CAP_ML,
  getBroselowSpectrumBand,
} from '../utils/clinicalCalculations';
import {
  X,
  Copy,
  Trash2,
  Printer,
  Search,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

export interface OrderItem {
  id: string;
  module: string;
  text: string;
  timestamp: string;
  invalidated?: boolean;
}

let orderIdSeq = 0;

export function createOrderId(prefix: string): string {
  orderIdSeq += 1;
  return `${prefix}-${Date.now()}-${orderIdSeq}`;
}

const MODAL_TRANSITION_MS = 200;

function useModalTransition(isOpen: boolean, durationMs = MODAL_TRANSITION_MS) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isOpen) {
      setShouldRender(true);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      timer = setTimeout(() => {
        setShouldRender(false);
      }, durationMs);
    }

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, durationMs]);

  return {
    mounted: isOpen || shouldRender,
    active: isOpen && isVisible,
  };
}

const BACKDROP_BASE_CLASS =
  'fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';

const DIALOG_MOTION_BASE_CLASS =
  'transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none will-change-[opacity,transform]';

interface BroselowModalProps {
  isOpen: boolean;
  activeWeight: number | null;
  previewColor: string | null;
  onClose: () => void;
  onSelectZoneWeight: (kg: number, color: string) => void;
}

export const BroselowModal: React.FC<BroselowModalProps> = ({
  isOpen,
  activeWeight,
  previewColor,
  onClose,
  onSelectZoneWeight,
}) => {
  const { mounted, active } = useModalTransition(isOpen);
  if (!mounted) return null;

  const matchedWeightBand =
    activeWeight != null
      ? getBroselowSpectrumBand(activeWeight) ?? undefined
      : undefined;

  const hasSelectedOrMatchedBand = Boolean(previewColor || matchedWeightBand);

  const currentBand =
    (previewColor &&
      BROSELOW_SPECTRUM.find(
        (b) => b.color.toLowerCase() === previewColor.toLowerCase()
      )) ||
    matchedWeightBand ||
    BROSELOW_SPECTRUM[3]; // fallback Purple ~10.5 kg for unselected equipment preview

  const refW =
    !previewColor && activeWeight != null && activeWeight > 0
      ? activeWeight
      : currentBand.approxKg;
  const epiMgVal = Math.min(1, 0.01 * refW);
  const epiMg = epiMgVal.toFixed(2);
  const epiMl = (epiMgVal / 0.1).toFixed(1);
  const defib1 = Math.min(200, Math.round(2 * refW));
  const defib2 = Math.min(200, Math.round(4 * refW));
  const bolusMl = Math.min(BOLUS_20_CAP_ML, Math.round(20 * refW));

  return (
    <div
      className={`no-print ${BACKDROP_BASE_CLASS} ${
        active ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        className={`clinical-card max-w-3xl w-full max-h-[92dvh] sm:max-h-[88dvh] rounded-t-2xl sm:rounded-xl flex flex-col overflow-hidden shadow-xl ${DIALOG_MOTION_BASE_CLASS} ${
          active
            ? 'opacity-100 translate-y-0 sm:scale-100'
            : 'opacity-0 translate-y-4 sm:translate-y-2 sm:scale-[0.98]'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Broselow Tape Reference Modal"
      >
        <div className="p-3.5 sm:p-4 border-b border-[var(--border)] flex items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-[var(--ink)]">
              Broselow Pediatric Resuscitation Tape Reference (9-Color Spectrum)
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Tap any color band below to adopt its reference weight and inspect equipment sizing
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Broselow modal"
            className="min-h-[34px] px-3 py-1.5 text-xs font-bold rounded-md border border-[var(--border-strong)] bg-[var(--panel-subtle)] text-[var(--ink)] flex items-center gap-1 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-4">
          {/* Interactive 9-Band Spectrum */}
          <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
            {BROSELOW_SPECTRUM.map((b) => {
              const isAct = previewColor
                ? b.color.toLowerCase() === previewColor.toLowerCase()
                : matchedWeightBand
                ? b.color === matchedWeightBand.color
                : false;
              return (
                <button
                  key={b.color}
                  type="button"
                  onClick={() => onSelectZoneWeight(b.approxKg, b.color)}
                  style={{ backgroundColor: b.bg, color: b.fg }}
                  className={`min-h-[48px] p-2 rounded-lg border text-center cursor-pointer transition-transform ${
                    isAct
                      ? 'border-black ring-2 ring-[var(--accent)] font-extrabold'
                      : 'border-black/15 opacity-90 hover:opacity-100'
                  }`}
                >
                  <div className="text-xs font-extrabold truncate">{b.label.split('·')[0].trim()}</div>
                  <div className="text-[10px] font-mono-tabular whitespace-nowrap">{b.range}</div>
                </button>
              );
            })}
          </div>

          {hasSelectedOrMatchedBand ? (
            <div
              className="p-3.5 rounded-lg border border-black/15 flex flex-wrap items-center justify-between gap-2"
              style={{ backgroundColor: currentBand.bg, color: currentBand.fg }}
            >
              <div>
                <div className="text-sm sm:text-base font-extrabold">
                  Broselow Zone: {currentBand.label} — {currentBand.range}
                </div>
                <div className="text-xs font-semibold">
                  Reference Weight: {refW.toFixed(1)} kg ({currentBand.ageApprox})
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)] flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm sm:text-base font-extrabold text-[var(--ink)]">
                  {activeWeight != null && activeWeight > 0 ? (
                    activeWeight < 3 || activeWeight > 36
                      ? `Patient Weight: ${activeWeight.toFixed(1)} kg (Outside Broselow 3–36 kg Range)`
                      : `Patient Weight: ${activeWeight.toFixed(1)} kg (Unmatched Band)`
                  ) : (
                    `No Active Weight or Broselow Zone Selected (Previewing ${refW.toFixed(1)} kg)`
                  )}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {activeWeight != null && activeWeight > 0 ? (
                    `Resuscitation doses calculated from patient weight (${activeWeight.toFixed(1)} kg). Tap a color band above to preview reference equipment.`
                  ) : (
                    `Emergency values below preview reference weight ${refW.toFixed(1)} kg. Tap any color band above to adopt its reference weight and inspect equipment sizing.`
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="clinical-panel-subtle p-3.5">
              <div className="text-xs font-bold text-[var(--danger-text)]">
                Epinephrine Arrest (1:10,000)
              </div>
              <div className="text-lg sm:text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                {epiMg} mg ({epiMl} mL)
              </div>
            </div>
            <div className="clinical-panel-subtle p-3.5">
              <div className="text-xs font-bold text-[var(--accent-text)]">
                Defibrillation Shock
              </div>
              <div className="text-lg sm:text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                1st {defib1} J → 2nd {defib2} J
              </div>
            </div>
            <div className="clinical-panel-subtle p-3.5">
              <div className="text-xs font-bold text-[var(--good-text)]">
                Isotonic Fluid Bolus (20 mL/kg)
              </div>
              <div className="text-lg sm:text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                {bolusMl} mL
              </div>
            </div>
          </div>

          <div
            className="clinical-table-container"
            tabIndex={0}
            role="region"
            aria-label="Airway equipment reference table"
          >
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Equipment / Airway Parameter</th>
                  <th>Recommended Size for {refW.toFixed(1)} kg</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="whitespace-nowrap">
                    <strong>Endotracheal Tube (ETT)</strong>
                  </td>
                  <td className="font-mono-tabular font-bold text-[var(--accent-text)]">
                    Cuffed: {weightToETTCuffed(refW)} mm · Uncuffed: {weightToETTUncuffed(refW)} mm
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap">
                    <strong>ETT Insertion Depth (Oral Lip)</strong>
                  </td>
                  <td className="font-mono-tabular font-bold">{weightToDepth(refW)} cm</td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap">
                    <strong>Laryngoscope Blade</strong>
                  </td>
                  <td className="font-mono-tabular font-bold">{suggestBlade(refW)}</td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap">
                    <strong>Airway Adjuncts (OPA / NPA / Suction)</strong>
                  </td>
                  <td className="font-mono-tabular">
                    OPA: {suggestOPA(refW)} mm · NPA: {suggestNPA(refW)} Fr · Suction:{' '}
                    {suggestSuction(refW)} Fr
                  </td>
                </tr>
                <tr>
                  <td className="whitespace-nowrap">
                    <strong>NG Tube &amp; Foley Catheter</strong>
                  </td>
                  <td className="font-mono-tabular">
                    NG Tube: {suggestNG(refW)} Fr · Foley: {suggestFoley(refW)} Fr
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

interface EvidenceModalProps {
  isOpen: boolean;
  initialTopicKey: string | null;
  onClose: () => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({
  isOpen,
  initialTopicKey,
  onClose,
}) => {
  const [query, setQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { mounted, active } = useModalTransition(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    if (initialTopicKey && DATASET.evidenceReferences[initialTopicKey]) {
      setQuery(initialTopicKey);
      setSelectedCategory('all');
    } else {
      setQuery('');
    }
  }, [initialTopicKey, isOpen]);

  if (!mounted) return null;

  const entries = Object.entries(DATASET.evidenceReferences).filter(([k, r]) => {
    if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      k.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.organization.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  });

  const categories = Array.from(
    new Set(Object.values(DATASET.evidenceReferences).map((r) => r.category))
  );

  return (
    <div
      className={`no-print ${BACKDROP_BASE_CLASS} ${
        active ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        className={`clinical-card max-w-4xl w-full max-h-[92dvh] sm:max-h-[88dvh] rounded-t-2xl sm:rounded-xl flex flex-col overflow-hidden shadow-xl ${DIALOG_MOTION_BASE_CLASS} ${
          active
            ? 'opacity-100 translate-y-0 sm:scale-100'
            : 'opacity-0 translate-y-4 sm:translate-y-2 sm:scale-[0.98]'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Clinical Evidence Registry Modal"
      >
        <div className="p-3.5 sm:p-4 border-b border-[var(--border)] flex items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-[var(--ink)]">
              Clinical Evidence &amp; Guideline Reference Registry (2024–2026)
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Level of Evidence (LOE), Class of Recommendation (COR), and DOI/PMID citations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Evidence modal"
            className="min-h-[34px] px-3 py-1.5 text-xs font-bold rounded-md border border-[var(--border-strong)] bg-[var(--panel-subtle)] text-[var(--ink)] flex items-center gap-1 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        <div className="p-3.5 sm:p-4 border-b border-[var(--border)] bg-[var(--panel-subtle)] flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              enterKeyHint="search"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guideline, trial, organization (e.g. PALS, ESETT, GINA, ISPAD)..."
              className="clinical-input w-full pl-9 text-xs font-semibold"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="clinical-input text-xs font-bold sm:w-52"
          >
            <option value="all">All Clinical Domains</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3">
          {entries.map(([key, ref]) => (
            <div key={key} className="clinical-panel-subtle p-3.5 space-y-1.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm font-extrabold text-[var(--ink)]">{ref.title}</div>
                <span className="text-xs font-mono-tabular font-bold text-[var(--accent-text)]">
                  {ref.loe}
                </span>
              </div>
              <div className="text-xs text-[var(--muted)]">
                <strong>{ref.organization}</strong> · {ref.journal} ({ref.year})
                {ref.doi && (
                  <>
                    {' · '}
                    <a
                      href={`https://doi.org/${ref.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent-text)] underline inline-flex items-center gap-0.5"
                    >
                      DOI: {ref.doi} <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
              </div>
              <div className="text-xs text-[var(--ink)] leading-relaxed pt-1.5 border-t border-[var(--border)]">
                {ref.summary}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface OrderSheetContentProps {
  orders: OrderItem[];
  activeWeight: number | null;
  copyMessage?: { type: 'success' | 'warning'; text: string } | null;
  onRemoveOrder: (id: string) => void;
  onClearOrders: () => void;
  onCopyAll: () => void;
}

const OrderSheetAndPocketContent: React.FC<OrderSheetContentProps> = ({
  orders,
  activeWeight,
  copyMessage,
  onRemoveOrder,
  onClearOrders,
  onCopyAll,
}) => {
  const w = activeWeight || 0;

  return (
    <div className="space-y-4">
      {/* Queued EHR Orders */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-extrabold tracking-tight text-[var(--ink)]">
            Queued EHR Prescription Orders ({orders.length})
          </div>
          {orders.length > 0 && (
            <div className="no-print flex items-center gap-1.5">
              <button
                type="button"
                onClick={onCopyAll}
                className="min-h-[32px] px-2.5 py-1 text-xs font-bold rounded-md bg-[var(--accent)] text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy All</span>
              </button>
              <button
                type="button"
                onClick={onClearOrders}
                className="min-h-[32px] px-2.5 py-1 text-xs font-bold rounded-md border border-[var(--danger)] text-[var(--danger-text)] flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          )}
        </div>

        {copyMessage && (
          <div
            role="status"
            className={`no-print p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
              copyMessage.type === 'success'
                ? 'border-[var(--good)]/40 bg-[var(--good-soft)] text-[var(--good-text)]'
                : 'border-[var(--warning)]/40 bg-[var(--warning-soft)] text-[var(--warning-text)]'
            }`}
          >
            {copyMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{copyMessage.text}</span>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="clinical-panel-subtle p-4 text-xs text-[var(--muted)] text-center leading-relaxed">
            No orders queued yet. Tap <strong>&quot;+ Order Sheet&quot;</strong> on any medication, fluid, drip, or protocol to build a consolidated EHR admission/ER order note.
          </div>
        ) : (
          <div className="space-y-1.5">
            {orders.map((o, idx) => (
              <div
                key={o.id}
                className={`clinical-panel-subtle p-2.5 flex items-start justify-between gap-2 text-xs ${
                  o.invalidated ? 'border border-[var(--warning)] bg-[var(--warning-soft)] opacity-85' : ''
                }`}
              >
                <div className="font-mono-tabular text-[var(--ink)] flex-1 min-w-0">
                  <span className="font-bold text-[var(--accent-text)] mr-1.5">
                    #{idx + 1} [{o.module}]
                  </span>
                  <span className={o.invalidated ? 'line-through text-[var(--muted)] break-words' : 'break-words'}>
                    {o.text}
                  </span>
                  {o.invalidated && (
                    <span className="block mt-1 font-sans font-bold text-[var(--warning-text)]">
                      ▲ Outdated (patient inputs changed — recalculate &amp; re-add to confirm)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveOrder(o.id)}
                  className="no-print min-h-[28px] min-w-[28px] flex items-center justify-center text-[var(--muted)] hover:text-[var(--danger-text)] rounded cursor-pointer shrink-0"
                  title="Remove order"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instant Bedside Pocket Card Summary for Active Weight */}
      <div className="space-y-2.5 pt-3 border-t border-[var(--border)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-extrabold tracking-tight text-[var(--ink)]">
            Bedside Emergency Summary {w > 0 ? `(${w.toFixed(1)} kg)` : ''}
          </div>
          {w > 0 && (
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print min-h-[30px] px-2.5 py-1 text-xs font-bold rounded-md border border-[var(--border-strong)] bg-[var(--panel-subtle)] text-[var(--ink)] flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4 Card</span>
            </button>
          )}
        </div>
        {!w ? (
          <div className="clinical-panel-subtle p-4 text-xs text-[var(--muted)] text-center">
            Enter patient Weight (BW) or Age in the top bar to generate live bedside emergency reference values.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5 text-xs">
            <div className="clinical-panel-subtle p-2.5">
              <div className="text-[var(--muted)] font-semibold text-[11px]">Epi Arrest (1:10,000)</div>
              <div className="font-mono-tabular font-extrabold text-sm text-[var(--danger-text)] mt-0.5">
                {Math.min(1, 0.01 * w).toFixed(2)} mg ({(Math.min(1, 0.01 * w) / 0.1).toFixed(1)} mL IV)
              </div>
            </div>
            <div className="clinical-panel-subtle p-2.5">
              <div className="text-[var(--muted)] font-semibold text-[11px]">Defibrillation</div>
              <div className="font-mono-tabular font-extrabold text-sm text-[var(--ink)] mt-0.5">
                {Math.min(200, Math.round(2 * w))} J → {Math.min(200, Math.round(4 * w))} J
              </div>
            </div>
            <div className="clinical-panel-subtle p-2.5">
              <div className="text-[var(--muted)] font-semibold text-[11px]">Cuffed ETT &amp; Depth</div>
              <div className="font-mono-tabular font-extrabold text-sm text-[var(--accent-text)] mt-0.5">
                {weightToETTCuffed(w)} mm @ {weightToDepth(w)} cm
              </div>
            </div>
            <div className="clinical-panel-subtle p-2.5">
              <div className="text-[var(--muted)] font-semibold text-[11px]">Anaphylaxis Epi IM</div>
              <div className="font-mono-tabular font-extrabold text-sm text-[var(--danger-text)] mt-0.5">
                {Math.min(w < 30 ? 0.3 : 0.5, 0.01 * w).toFixed(2)} mg IM
              </div>
            </div>
            <div className="clinical-panel-subtle p-2.5">
              <div className="text-[var(--muted)] font-semibold text-[11px]">NS Bolus (20 mL/kg)</div>
              <div className="font-mono-tabular font-extrabold text-sm text-[var(--good-text)] mt-0.5">
                {Math.min(BOLUS_20_CAP_ML, Math.round(20 * w))} mL IV
              </div>
            </div>
            <div className="clinical-panel-subtle p-2.5">
              <div className="text-[var(--muted)] font-semibold text-[11px]">Maintenance Fluid</div>
              <div className="font-mono-tabular font-extrabold text-sm text-[var(--ink)] mt-0.5">
                {Math.min(calcMaintenanceMlPerHr(w), +(MAINTENANCE_CAP_ML_DAY / 24).toFixed(1))} mL/hr
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface OrderSheetModalProps {
  isOpen: boolean;
  orders: OrderItem[];
  activeWeight: number | null;
  ageYears: number | null;
  copyMessage?: { type: 'success' | 'warning'; text: string } | null;
  onClose: () => void;
  onRemoveOrder: (id: string) => void;
  onClearOrders: () => void;
  onCopyAll: () => void;
}

export const OrderSheetModal: React.FC<OrderSheetModalProps> = ({
  isOpen,
  orders,
  activeWeight,
  ageYears,
  copyMessage,
  onClose,
  onRemoveOrder,
  onClearOrders,
  onCopyAll,
}) => {
  const { mounted, active } = useModalTransition(isOpen);
  if (!mounted) return null;

  const w = activeWeight || 0;

  return (
    <div
      className={`${BACKDROP_BASE_CLASS} order-sheet-modal-backdrop ${
        active ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        className={`clinical-card order-sheet-modal-card max-w-3xl w-full max-h-[92dvh] sm:max-h-[88dvh] rounded-t-2xl sm:rounded-xl flex flex-col overflow-hidden shadow-xl ${DIALOG_MOTION_BASE_CLASS} ${
          active
            ? 'opacity-100 translate-y-0 sm:scale-100'
            : 'opacity-0 translate-y-4 sm:translate-y-2 sm:scale-[0.98]'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Active Patient Order Sheet & Bedside Pocket Summary"
      >
        <div className="p-3.5 sm:p-4 border-b border-[var(--border)] flex items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-[var(--ink)]">
              Active Patient EHR Order Sheet &amp; Bedside Resuscitation Summary
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Patient Weight: {w ? `${w.toFixed(1)} kg` : 'Not set'} · Age:{' '}
              {ageYears ? `${ageYears.toFixed(1)} yr` : 'Not set'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Order Sheet modal"
            className="no-print min-h-[34px] px-3 py-1.5 text-xs font-bold rounded-md border border-[var(--border-strong)] bg-[var(--panel-subtle)] text-[var(--ink)] flex items-center gap-1 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        <div className="order-sheet-modal-body p-3.5 sm:p-4 overflow-y-auto">
          <OrderSheetAndPocketContent
            orders={orders}
            activeWeight={activeWeight}
            copyMessage={copyMessage}
            onRemoveOrder={onRemoveOrder}
            onClearOrders={onClearOrders}
            onCopyAll={onCopyAll}
          />
        </div>
      </div>
    </div>
  );
};

