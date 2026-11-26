import React from 'react';
import { AlertTriangle, BookOpen, Check, Info } from 'lucide-react';
import { DATASET } from '../../data/dataset';
import { DoseRange, fmtMg } from '../../utils/clinicalCalculations';
import { OrderItem, createOrderId } from '../ModalsAndDrawers';

/** Shared props every protocol panel receives from ProtocolsAndCDSView. */
export interface ProtocolPanelProps {
  weightKg: number;
  ageYears: number | null;
  onAddOrder?: (order: OrderItem) => void;
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
    <h2 className="text-base sm:text-lg font-extrabold text-[var(--ink)] leading-tight">{title}</h2>
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

/** Numbered pathway stage: step badge, heading, optional timing chip. */
export const ProtocolSection: React.FC<SectionProps> = ({ step, title, timing, tone = 'default', children }) => (
  <section
    className={`clinical-panel-subtle p-3.5 sm:p-4 space-y-3 ${
      tone === 'danger' ? 'border-l-4 border-l-[var(--danger)]' : ''
    }`}
  >
    <div className="flex flex-wrap items-center gap-2">
      {step !== undefined && (
        <span
          className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-[var(--r-sm)] bg-[var(--accent)] text-[var(--accent-ink)] text-xs font-extrabold font-mono-tabular"
          aria-hidden="true"
        >
          {step}
        </span>
      )}
      <h3 className={`text-sm font-extrabold ${tone === 'danger' ? 'text-[var(--danger-text)]' : 'text-[var(--ink)]'}`}>
        {step !== undefined && <span className="sr-only-heading">Step {step}: </span>}
        {title}
      </h3>
      {timing && (
        <span className="ml-auto text-[11px] font-bold font-mono-tabular px-2 py-0.5 rounded-[var(--r-xs)] border border-[var(--border-strong)] text-[var(--ink-secondary)] bg-[var(--card)]">
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
  return (
    <ul className="space-y-1 text-[13px] text-[var(--ink)] leading-snug">
      {items.map((it) => (
        <li key={it} className="flex items-start gap-2">
          {marker === 'check' ? (
            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--good-text)]" aria-hidden="true" />
          ) : (
            <span className="w-1.5 h-1.5 mt-[7px] shrink-0 rounded-full bg-[var(--muted)]" aria-hidden="true" />
          )}
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
    <div className={`flex items-start gap-2 border-l-4 rounded-[var(--r-sm)] px-3 py-2 text-[13px] leading-snug ${styles}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        {title && <div className="font-extrabold">{title}</div>}
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
  order?: { prefix: string; module: string; text: string };
}

export const DoseTable: React.FC<{
  label: string;
  weightKg: number;
  rows: DoseRow[];
  onAddOrder?: (order: OrderItem) => void;
}> = ({ label, weightKg, rows, onAddOrder }) => {
  const showOrder = Boolean(onAddOrder) && rows.some((r) => r.order);
  return (
    <div className="clinical-table-container" tabIndex={0} role="region" aria-label={label}>
      <table className="clinical-table">
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
                      onClick={() => onAddOrder(makeOrder(r.order!.prefix, r.order!.module, r.order!.text))}
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
  );
};

/** Two-or-more column criteria lists (disposition, discharge vs admit). */
export const CriteriaColumns: React.FC<{
  columns: { title: string; items: string[]; tone?: 'good' | 'warning' | 'danger' }[];
}> = ({ columns }) => (
  <div className={`grid grid-cols-1 gap-3 ${columns.length >= 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2'}`}>
    {columns.map((c) => {
      const edge =
        c.tone === 'danger'
          ? 'border-t-[var(--danger)]'
          : c.tone === 'warning'
            ? 'border-t-[var(--warning)]'
            : 'border-t-[var(--good)]';
      return (
        <div key={c.title} className={`bg-[var(--card)] border border-[var(--border)] border-t-4 ${edge} rounded-[var(--r-md)] p-3`}>
          <div className="text-xs font-extrabold text-[var(--ink)] mb-1.5">{c.title}</div>
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
