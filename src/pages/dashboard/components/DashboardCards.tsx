import type { ComponentType, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type IconComponent = ComponentType<{ size?: number; className?: string }>;

/** Card shell used by every dashboard panel. */
export const Panel = ({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section
    className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
  >
    <div className="flex items-start justify-between gap-3 p-5 pb-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

/** One of the four headline numbers. */
export const KpiCard = ({
  label,
  value,
  sub,
  icon: Icon,
  color,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: IconComponent;
  /** Icon stroke colour. */
  color: string;
  /** Icon tile background. */
  tint: string;
}) => (
  <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold leading-none tabular-nums text-slate-900">{value}</p>
      {sub && (
        <p className="mt-2 truncate text-xs text-slate-400" title={sub}>
          {sub}
        </p>
      )}
    </div>
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
      style={{ background: tint, color }}
    >
      <Icon size={20} />
    </div>
  </div>
);

/** Secondary "context" numbers — deliberately quieter than the KPI cards. */
export const ContextStrip = ({
  items,
}: {
  items: { label: string; value: string; title?: string }[];
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(({ label, value, title }) => (
        <div key={label} className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="mt-1 truncate text-lg font-bold tabular-nums text-slate-800" title={title ?? value}>
            {value}
          </p>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Partial-failure notice. The dashboard aggregates four endpoints, so one of
 * them can fail while the rest still render — that is worth saying out loud
 * instead of silently showing zeros.
 */
export const DataWarning = ({ messages }: { messages: string[] }) =>
  messages.length === 0 ? null : (
    <div
      role="alert"
      className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">Some dashboard data could not be loaded</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
