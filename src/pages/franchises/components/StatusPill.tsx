import { franchiseStatusLabel, statusPillClass } from "../franchiseUtils";

/**
 * One status pill for both franchise and application rows.
 * `label` overrides the franchise-specific normalisation (which turns
 * "none" into "Registered") when rendering application statuses.
 */
const StatusPill = ({ status, label }: { status?: string; label?: string }) => (
  <span
    className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClass(status)}`}
  >
    {label ?? franchiseStatusLabel(status)}
  </span>
);

export default StatusPill;
