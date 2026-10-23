import type { ComponentType, ReactNode } from "react";
import { RefreshCw } from "lucide-react";

const BRAND_GRADIENT = "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))";

interface PageHeaderProps {
  icon: ComponentType<{ size?: number }>;
  title: string;
  subtitle?: string;
  /** Extra content on the right side (buttons, badges, etc.) */
  actions?: ReactNode;
  /** Content rendered below the header row (status chips, filters, …). */
  children?: ReactNode;
  /** Convenience: show a single Refresh button with loading state */
  onRefresh?: () => void;
  refreshing?: boolean;
}

/**
 * Standard page header with gradient icon, title, subtitle and an
 * optional right-side actions area (or a built-in Refresh button).
 */
const PageHeader = ({
  icon: Icon,
  title,
  subtitle,
  actions,
  onRefresh,
  refreshing,
  children,
}: PageHeaderProps) => (
  <div className="mb-6 space-y-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
          style={{ background: BRAND_GRADIENT }}
        >
          <Icon size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>

      {(actions ?? onRefresh) && (
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {actions}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          )}
        </div>
      )}
    </div>

    {children && <div className="flex flex-wrap items-center gap-1.5">{children}</div>}
  </div>
);

export default PageHeader;
