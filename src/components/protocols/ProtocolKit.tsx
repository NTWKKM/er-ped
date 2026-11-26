import React from 'react';
import { AlertTriangle, BookOpen, Check, Clock, Info } from 'lucide-react';
import { DATASET } from '../../data/dataset';
import { DoseRange, fmtMg } from '../../utils/clinicalCalculations';
import { OrderItem, createOrderId } from '../ModalsAndDrawers';

/** Shared props every protocol panel receives from ProtocolsAndCDSView. */
export interface ProtocolPanelProps {
  weightKg: number;
  ageYears: number | null;
  onAddOrder?: (order: OrderItem) => void;
  onInvalidateOrders?: (targetPrefix?: string) => void;
}

export const orderTimestamp = () =>
  new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

export function makeOrder(prefix: string, module: string, text: string): OrderItem {
  return { id: createOrderId(prefix), module, text, timestamp: orderTimestamp() };
}

/** `150–225 mg` (unit once, en dash) or `150 mg` when the range collapses. */
export function fmtRange(r: DoseRange | null, unit: string): string {
  if (!r) return '—';
  const lo = fmtMg(r.min);
  const hi = fmtMg(r.max);
  return lo === hi ? `${lo} ${unit}` : `${lo}–${hi} ${unit}`;
}

/** Volume for a dose range given a concentration (per mL). */
export function fmtRangeVolume(r: DoseRange | null, perMl: number): string {
  if (!r || !perMl) return '—';
  return fmtRange({ min: r.min / perMl, max: r.max / perMl, isCapped: r.isCapped }, 'mL');
}

export const ProtocolHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div>
    <h2 className="text-lg sm:text-xl font-bold text-[var(--ink)] leading-tight text-balance">{title}</h2>
    <p className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>
  </div>
);

interface SectionProps {
  step?: number | string;
  title: string;
  timing?: string;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}

/**
 * Pathway stage: an open section under a hairline (no box, so its tables and
 * tiles are the only containers), the step number set as plain text in the
 * heading, and the timing as a quiet fact on the right.
 */
export const ProtocolSection: React.FC<SectionProps> = ({ step, title, timing, tone = 'default', children }) => (
  <section className="border-t border-[var(--border)] pt-4 sm:pt-5 space-y-3">
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h3
        className={`text-base font-bold leading-snug ${
          tone === 'danger' ? 'text-[var(--danger-text)]' : 'text-[var(--ink)]'
        }`}
      >
        {step !== undefined && (
          <>
            <span className="sr-only-heading">Step {step}: </span>
            <span className="font-mono-tabular text-[var(--muted)] mr-2" aria-hidden="true">
              {step}
            </span>
          </>
        )}
        {title}
      </h3>
      {timing && (
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--ink-secondary)] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {timing}
        </span>
      )}
    </div>
    {children}
  </section>
);

export const Checklist: React.FC<{ items: string[]; marker?: 'check' | 'bullet' | 'number' }> = ({
  items,
  marker = 'bullet',
}) => {
  if (marker === 'number') {
    return (
      <ol className="list-decimal pl-5 space-y-1 text-[13px] text-[var(--ink)] leading-snug">
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ol>
    );
  }
  if (marker === 'bullet') {
    return (
      <ul className="list-disc pl-5 space-y-1 text-[13px] text-[var(--ink)] leading-snug marker:text-[var(--muted)]">
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="space-y-1 text-[13px] text-[var(--ink)] leading-snug">
      {items.map((it) => (
        <li key={it} className="flex items-start gap-2">
          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--good-text)]" aria-hidden="true" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
};

export const Callout: React.FC<{
  tone: 'danger' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
}> = ({ tone, title, children }) => {
  const styles = {
    danger: 'bg-[var(--danger-soft)] border-[var(--danger)] text-[var(--danger-text)]',
    warning: 'bg-[var(--warning-soft)] border-[var(--warning)] text-[var(--warning-text)]',
    info: 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--ink)]',
  }[tone];
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div className={`flex items-start gap-2 rounded-[var(--r-sm)] px-3 py-2.5 text-[13px] leading-snug ${styles}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        {title && <div className="font-bold">{title}</div>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  );
};

export interface DoseRow {
  key: string;
  name: string;
  dose: string;
  volume?: string;
  route: string;
  note?: string;
  /** Contraindication or alarm note, rendered in danger colour. */
  alarm?: string;
  /** `exclusive`: adding this order replaces any active order with the same prefix (alternative drugs). */
  order?: { prefix: string; module: string; text: string; exclusive?: boolean };
}

export const DoseTable: React.FC<{
  label: string;
  weightKg: number;
  rows: DoseRow[];
  onAddOrder?: (order: OrderItem) => void;
  onInvalidateOrders?: (targetPrefix?: string) => void;
}> = ({ label, weightKg, rows, onAddOrder, onInvalidateOrders }) => {
  const showOrder = Boolean(onAddOrder) && rows.some((r) => r.order);
  const addOrder = (r: DoseRow) => {
    if (!r.order || !onAddOrder) return;
    // Invalidate the active alternative first; handleAddOrder then reuses its slot.
    if (r.order.exclusive) onInvalidateOrders?.(r.order.prefix);
    onAddOrder(makeOrder(r.order.prefix, r.order.module, r.order.text));
  };
  return (
    <>
      {/* Phones: one stacked row per drug, so route and the order action never scroll off screen. */}
      <ul className="sm:hidden clinical-table-container divide-y divide-[var(--border)]" aria-label={label}>
        {rows.map((r) => (
          <li key={r.key} className="p-3 space-y-1">
            <div className="text-[13px] font-bold text-[var(--ink)]">{r.name}</div>
            <div className="font-mono-tabular font-bold text-[var(--ink)]">
              {r.dose}
              {r.volume && (
                <span className="ml-2 text-xs font-semibold text-[var(--ink-secondary)]">= {r.volume}</span>
              )}
            </div>
            <div className="text-xs text-[var(--ink-secondary)]">{r.route}</div>
            {r.note && <div className="text-xs text-[var(--muted)]">{r.note}</div>}
            {r.alarm && (
              <div className="flex items-start gap-1 text-xs font-bold text-[var(--danger-text)]">
                <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
                <span>{r.alarm}</span>
              </div>
            )}
            {showOrder && r.order && (
              <div className="pt-1 no-print">
                <button type="button" className="order-btn" onClick={() => addOrder(r)}>
                  + Order Sheet
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    <div className="hidden sm:block clinical-table-container" tabIndex={0} role="region" aria-label={label}>
      <table className="clinical-table" aria-label={label}>
        <thead>
          <tr>
            <th>Medication</th>
            <th>Dose ({weightKg.toFixed(1)} kg)</th>
            <th>Route &amp; Preparation</th>
            {showOrder && <th className="no-print">Order</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="font-bold min-w-[9rem]">{r.name}</td>
              <td className="font-mono-tabular font-bold whitespace-nowrap">
                {r.dose}
                {r.volume && (
                  <div className="text-xs font-semibold text-[var(--ink-secondary)] mt-0.5">= {r.volume}</div>
                )}
              </td>
              <td className="text-xs text-[var(--ink-secondary)] min-w-[12rem]">
                <div>{r.route}</div>
                {r.note && <div className="text-[var(--muted)] mt-0.5">{r.note}</div>}
                {r.alarm && (
                  <div className="flex items-start gap-1 mt-0.5 font-bold text-[var(--danger-text)]">
                    <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
                    <span>{r.alarm}</span>
                  </div>
                )}
              </td>
              {showOrder && (
                <td className="no-print">
                  {r.order && onAddOrder && (
                    <button
                      type="button"
                      className="order-btn"
                      title="Add to Active Patient Order Sheet"
                      onClick={() => addOrder(r)}
                    >
                      + Order Sheet
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
};

/**
 * Two-or-more column criteria lists (disposition, discharge vs admit): open
 * columns with the tone carried by the title's ink, not by a coloured card edge.
 */
export const CriteriaColumns: React.FC<{
  columns: { title: string; items: string[]; tone?: 'good' | 'warning' | 'danger' }[];
}> = ({ columns }) => (
  <div className={`grid grid-cols-1 gap-x-8 gap-y-4 ${columns.length >= 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2'}`}>
    {columns.map((c) => {
      const ink =
        c.tone === 'danger'
          ? 'text-[var(--danger-text)]'
          : c.tone === 'warning'
            ? 'text-[var(--warning-text)]'
            : 'text-[var(--good-text)]';
      return (
        <div key={c.title} className="min-w-0">
          <h4 className={`text-sm font-bold mb-1.5 ${ink}`}>{c.title}</h4>
          <Checklist items={c.items} />
        </div>
      );
    })}
  </div>
);

export const EvidenceFooter: React.FC<{ refKey: string }> = ({ refKey }) => {
  const ref = DATASET.evidenceReferences[refKey];
  if (!ref) return null;
  return (
    <footer className="flex items-start gap-2 text-xs text-[var(--muted)] border-t border-[var(--border)] pt-3">
      <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <span className="font-bold text-[var(--ink-secondary)]">{ref.title}</span>
        <span>
          {' '}
          ({ref.organization}, {ref.year}). Level of evidence: {ref.loe}.
        </span>
        <div className="mt-0.5">
          Reference aid only. Confirm doses against the order and local protocol before administration.
        </div>
      </div>
    </footer>
  );
};

export const NeedWeight: React.FC<{ what: string }> = ({ what }) => (
  <div className="clinical-panel-subtle p-4 text-center text-sm text-[var(--muted)]">
    Enter patient Weight (BW) above to calculate {what}
  </div>
);
