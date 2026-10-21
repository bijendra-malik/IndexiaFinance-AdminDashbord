import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

// ── Loading skeleton ───────────────────────────────────────────────────────────
export const TableSkeleton = ({ rows = 6, height = "h-14" }: { rows?: number; height?: string }) => (
  <div className="space-y-2.5 p-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className={`animate-pulse rounded-xl bg-slate-100 ${height}`}
        style={{ opacity: 1 - i * 0.12 }}
      />
    ))}
  </div>
);

// ── Error state ────────────────────────────────────────────────────────────────
export const TableError = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
      <AlertCircle size={24} className="text-red-500" />
    </div>
    <p className="text-sm font-medium text-red-600">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
      >
        <RefreshCw size={14} /> Retry
      </button>
    )}
  </div>
);

// ── Empty state ────────────────────────────────────────────────────────────────
export const TableEmpty = ({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
      <Icon size={22} className="text-slate-400" />
    </div>
    <p className="font-semibold text-slate-700">{title}</p>
    {description && <p className="text-sm text-slate-500">{description}</p>}
    {action}
  </div>
);

// ── Table col header ───────────────────────────────────────────────────────────
export const Th = ({
  children,
  right,
}: {
  children: ReactNode;
  right?: boolean;
}) => (
  <th
    className={`px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 ${
      right ? "text-right" : "text-left"
    }`}
  >
    {children}
  </th>
);

// ── Wrapper card ──────────────────────────────────────────────────────────────
export const TableCard = ({ children }: { children: ReactNode }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    {children}
  </div>
);
