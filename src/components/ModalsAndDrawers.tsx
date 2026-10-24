import React, { useState } from 'react';
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
  if (!isOpen) return null;

  const currentBand =
    (previewColor &&
      BROSELOW_SPECTRUM.find(
        (b) => b.color.toLowerCase() === previewColor.toLowerCase()
      )) ||
    (activeWeight &&
      BROSELOW_SPECTRUM.find(
        (b) => activeWeight >= b.min && activeWeight <= b.max
      )) ||
    BROSELOW_SPECTRUM[3]; // default Purple ~10.5 kg

  const refW = activeWeight && !previewColor ? activeWeight : currentBand.approxKg;
  const epiMg = (0.01 * refW).toFixed(2);
  const epiMl = ((0.01 * refW) / 0.1).toFixed(1);
  const defib1 = Math.round(2 * refW);
  const defib2 = Math.round(4 * refW);
  const bolusMl = Math.round(20 * refW);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="clinical-card max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Broselow Tape Reference Modal"
      >
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-[var(--ink)]">
              Broselow Pediatric Resuscitation Tape Reference (9-Color Spectrum)
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Click any color band below to adopt its reference weight and inspect equipment sizing
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Broselow modal"
            className="px-3 py-1.5 text-xs font-bold rounded border border-[var(--border-strong)] bg-[var(--panel-subtle)] text-[var(--ink)] flex items-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Interactive 9-Band Spectrum */}
          <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
            {BROSELOW_SPECTRUM.map((b) => {
              const isAct = b.color === currentBand.color;
              return (
                <button
                  key={b.color}
                  type="button"
                  onClick={() => onSelectZoneWeight(b.approxKg, b.color)}
                  style={{ backgroundColor: b.bg, color: b.fg }}
                  className={`p-2 rounded-md border text-center cursor-pointer transition-transform ${
                    isAct
                      ? 'border-black ring-2 ring-[var(--accent)] scale-105 font-extrabold'
                      : 'border-black/15 opacity-90 hover:opacity-100'
                  }`}
                >
                  <div className="text-xs font-extrabold">{b.label}</div>
                  <div className="text-[10px] font-mono-tabular">{b.range}</div>
                </button>
              );
            })}
          </div>

          <div
            className="p-3.5 rounded-lg border border-black/15 flex flex-wrap items-center justify-between gap-2"
            style={{ backgroundColor: currentBand.bg, color: currentBand.fg }}
          >
            <div>
              <div className="text-base font-extrabold">
                Broselow Zone: {currentBand.label} — {currentBand.range}
              </div>
              <div className="text-xs font-semibold">
                Reference Weight: {refW.toFixed(1)} kg ({currentBand.ageApprox})
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="clinical-panel-subtle p-3">
              <div className="text-[11px] font-bold uppercase text-[var(--danger-text)]">
                Epinephrine Arrest (1:10,000)
              </div>
              <div className="text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                {epiMg} mg ({epiMl} mL)
              </div>
            </div>
            <div className="clinical-panel-subtle p-3">
              <div className="text-[11px] font-bold uppercase text-[var(--accent-text)]">
                Defibrillation Shock
              </div>
              <div className="text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                1st {defib1} J → 2nd {defib2} J
              </div>
            </div>
            <div className="clinical-panel-subtle p-3">
              <div className="text-[11px] font-bold uppercase text-[var(--good-text)]">
                Isotonic Fluid Bolus (20 mL/kg)
              </div>
              <div className="text-xl font-extrabold font-mono-tabular text-[var(--ink)] mt-1">
                {bolusMl} mL
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Equipment / Airway Parameter</th>
                  <th>Recommended Size for {refW.toFixed(1)} kg</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Endotracheal Tube (ETT)</strong>
                  </td>
                  <td className="font-mono-tabular font-bold text-[var(--accent-text)]">
                    Cuffed: {weightToETTCuffed(refW)} mm · Uncuffed: {weightToETTUncuffed(refW)} mm
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>ETT Insertion Depth (Oral Lip)</strong>
                  </td>
                  <td className="font-mono-tabular font-bold">{weightToDepth(refW)} cm</td>
                </tr>
                <tr>
                  <td>
                    <strong>Laryngoscope Blade</strong>
                  </td>
                  <td className="font-mono-tabular font-bold">{suggestBlade(refW)}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Airway Adjuncts (OPA / NPA / Suction)</strong>
                  </td>
                  <td className="font-mono-tabular">
                    OPA: {suggestOPA(refW)} mm · NPA: {suggestNPA(refW)} Fr · Suction:{' '}
                    {suggestSuction(refW)} Fr
                  </td>
                </tr>
                <tr>
                  <td>
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

  React.useEffect(() => {
    if (initialTopicKey && DATASET.evidenceReferences[initialTopicKey]) {
      setQuery(initialTopicKey);
      setSelectedCategory('all');
    } else {
      setQuery('');
    }
  }, [initialTopicKey, isOpen]);

  if (!isOpen) return null;

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
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="clinical-card max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Clinical Evidence Registry Modal"
      >
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-[var(--ink)]">
              Clinical Evidence &amp; Guideline Reference Registry (2024–2026)
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Level of Evidence (LOE), Class of Recommendation (COR), and DOI/PMID citations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Evidence modal"
            className="px-3 py-1.5 text-xs font-bold rounded border border-[var(--border-strong)] bg-[var(--panel-subtle)] text-[var(--ink)] flex items-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        <div className="p-4 border-b border-[var(--border)] bg-[var(--panel-subtle)] flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guideline, trial, organization (e.g. PALS, ESETT, GINA, ISPAD)..."
              className="clinical-input w-full pl-9 text-xs font-semibold"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="clinical-input text-xs font-bold"
          >
            <option value="all">All Clinical Domains</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
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
              <div className="text-xs text-[var(--ink)] leading-relaxed pt-1 border-t border-[var(--border)]">
                {ref.summary}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface OrderSheetModalProps {
  isOpen: boolean;
  orders: OrderItem[];
  activeWeight: number | null;
  ageYears: number | null;
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
  onClose,
  onRemoveOrder,
  onClearOrders,
  onCopyAll,
}) => {
  if (!isOpen) return null;

  const w = activeWeight || 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="clinical-card max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Active Patient Order Sheet & Bedside Pocket Summary"
      >
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-[var(--ink)]">
              Active Patient EHR Order Sheet &amp; Bedside Resuscitation Summary
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Patient Weight: {w ? `${w.toFixed(1)} kg` : 'Not set'} · Age:{' '}
              {ageYears ? `${ageYears.toFixed(1)} yr` : 'Not set'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Order Sheet modal"
            className="px-3 py-1.5 text-xs font-bold rounded border border-[var(--border-strong)] bg-[var(--panel-subtle)] text-[var(--ink)] flex items-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Queued EHR Orders */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Queued EHR Prescription Orders ({orders.length})
              </div>
              {orders.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onCopyAll}
                    className="px-3 py-1 text-xs font-bold rounded bg-[var(--accent)] text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All Orders</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClearOrders}
                    className="px-2.5 py-1 text-xs font-bold rounded border border-[var(--danger)] text-[var(--danger-text)] flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              )}
            </div>

            {orders.length === 0 ? (
              <div className="clinical-panel-subtle p-4 text-xs text-[var(--muted)] text-center">
                No orders queued yet. Click <strong>&quot;+ Order Sheet&quot;</strong> on any medication, fluid, drip, or protocol to build a consolidated EHR admission/ER order note.
              </div>
            ) : (
              <div className="space-y-1.5">
                {orders.map((o, idx) => (
                  <div
                    key={o.id}
                    className={`clinical-panel-subtle p-2.5 flex items-center justify-between gap-2 text-xs ${
                      o.invalidated ? 'border border-[var(--warning)] bg-[var(--warning-soft)] opacity-80' : ''
                    }`}
                  >
                    <div className="font-mono-tabular text-[var(--ink)] flex-1">
                      <span className="font-bold text-[var(--accent-text)] mr-2">
                        #{idx + 1} [{o.module}]
                      </span>
                      <span className={o.invalidated ? 'line-through text-[var(--muted)]' : ''}>
                        {o.text}
                      </span>
                      {o.invalidated && (
                        <span className="ml-2 font-sans font-bold text-[var(--warning-text)]">
                          ▲ Outdated (patient inputs changed — recalculate &amp; re-add to confirm)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveOrder(o.id)}
                      className="text-[var(--muted)] hover:text-[var(--danger-text)] p-1 cursor-pointer"
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
          {w > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  Instant Bedside Emergency Pocket Card ({w.toFixed(1)} kg)
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 py-1 text-xs font-bold rounded border border-[var(--border-strong)] bg-[var(--panel-subtle)] text-[var(--ink)] flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print A4 Card</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="clinical-panel-subtle p-2.5">
                  <div className="text-[var(--muted)] font-bold">Epi Arrest (1:10,000)</div>
                  <div className="font-mono-tabular font-extrabold text-sm text-[var(--danger-text)]">
                    {Math.min(1, 0.01 * w).toFixed(2)} mg ({(Math.min(1, 0.01 * w) / 0.1).toFixed(1)} mL IV)
                  </div>
                </div>
                <div className="clinical-panel-subtle p-2.5">
                  <div className="text-[var(--muted)] font-bold">Defibrillation</div>
                  <div className="font-mono-tabular font-extrabold text-sm text-[var(--ink)]">
                    {Math.round(2 * w)} J → {Math.round(4 * w)} J
                  </div>
                </div>
                <div className="clinical-panel-subtle p-2.5">
                  <div className="text-[var(--muted)] font-bold">Cuffed ETT &amp; Depth</div>
                  <div className="font-mono-tabular font-extrabold text-sm text-[var(--accent-text)]">
                    {weightToETTCuffed(w)} mm @ {weightToDepth(w)} cm
                  </div>
                </div>
                <div className="clinical-panel-subtle p-2.5">
                  <div className="text-[var(--muted)] font-bold">Anaphylaxis Epi 1:1,000 IM</div>
                  <div className="font-mono-tabular font-extrabold text-sm text-[var(--danger-text)]">
                    {Math.min(w < 30 ? 0.3 : 0.5, 0.01 * w).toFixed(2)} mg IM
                  </div>
                </div>
                <div className="clinical-panel-subtle p-2.5">
                  <div className="text-[var(--muted)] font-bold">NS Shock Bolus (20 mL/kg)</div>
                  <div className="font-mono-tabular font-extrabold text-sm text-[var(--good-text)]">
                    {Math.round(20 * w)} mL IV
                  </div>
                </div>
                <div className="clinical-panel-subtle p-2.5">
                  <div className="text-[var(--muted)] font-bold">Maintenance Fluid</div>
                  <div className="font-mono-tabular font-extrabold text-sm text-[var(--ink)]">
                    {calcMaintenanceMlPerHr(w)} mL/hr
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
