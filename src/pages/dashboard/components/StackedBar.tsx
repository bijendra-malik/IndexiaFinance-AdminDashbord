import type { ProductStat } from "../../../api/dashboard";
import {
  BUCKET_ORDER,
  STATUS,
  barPercent,
  formatCurrency,
  productCount,
} from "../dashboardUtils";

/** Fixed classes rather than a dynamic string — Tailwind can see these. */
const THICKNESS = {
  sm: "h-2",
  lg: "h-3.5",
} as const;

/**
 * One product's approved/pending/submitted/rejected split as a single bar.
 * Shared by the at-a-glance chart and the product explorer so the segment
 * logic exists exactly once.
 */
const StackedBar = ({
  product,
  scale,
  thickness = "sm",
}: {
  product: ProductStat;
  /** Value that represents a full-width bar. Defaults to this product's total. */
  scale?: number;
  thickness?: keyof typeof THICKNESS;
}) => (
  <div
    className={`w-full overflow-hidden rounded-full bg-slate-100 ${THICKNESS[thickness]}`}
    role="img"
    aria-label={`${product.label}: ${product.approved} approved, ${product.pending} pending, ${product.submitted} submitted, ${product.rejected} rejected`}
    title={`Requested ${formatCurrency(product.requestedAmount)} · Sanctioned ${formatCurrency(product.approvedAmount)}`}
  >
    <div
      className="flex h-full"
      style={{ width: `${barPercent(product.total, scale ?? product.total)}%` }}
    >
      {BUCKET_ORDER.map((bucket) => {
        const count = productCount(product, bucket);
        if (count === 0) return null;
        return (
          <div key={bucket} style={{ flexGrow: count, background: STATUS[bucket].hex }} />
        );
      })}
    </div>
  </div>
);

export default StackedBar;
