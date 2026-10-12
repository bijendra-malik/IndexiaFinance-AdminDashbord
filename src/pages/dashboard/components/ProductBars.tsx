import { useState } from "react";
import { Link } from "react-router-dom";
import type { ProductStat } from "../../../api/dashboard";
import { BUCKET_ORDER, STATUS, applicationPath } from "../dashboardUtils";
import StackedBar from "./StackedBar";

const INITIAL_VISIBLE = 8;

/**
 * Horizontal stacked bars, one per loan product, scaled against the busiest
 * product. This is the at-a-glance view — the full per-product breakdown lives
 * in the explorer, one tab away.
 */
const ProductBars = ({ products }: { products: ProductStat[] }) => {
  const [showAll, setShowAll] = useState(false);

  if (products.length === 0) {
    return (
      <p className="px-5 pb-5 text-sm italic text-slate-400">
        No loan products returned by the API yet.
      </p>
    );
  }

  const ordered = [...products].sort(
    (a, b) => b.total - a.total || a.label.localeCompare(b.label)
  );
  const visible = showAll ? ordered : ordered.slice(0, INITIAL_VISIBLE);
  const busiest = Math.max(1, ...ordered.map((product) => product.total));

  return (
    <div className="px-5 pb-4">
      <ul className="space-y-4">
        {visible.map((product, index) => {
          // `slug` is optional in the payload — never build a bare
          // `/applications/undefined` link out of it.
          const path = applicationPath(product.slug);
          return (
            <li key={product.slug?.trim() || product.label || `product-${index}`}>
              <div className="flex items-baseline justify-between gap-3">
                {path ? (
                  <Link
                    to={path}
                    title={`Open ${product.label} applications`}
                    className="truncate text-sm font-medium text-slate-700 transition hover:text-[rgb(6,106,156)] hover:underline"
                  >
                    {product.label}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-medium text-slate-700">
                    {product.label}
                  </span>
                )}
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                  {product.total}
                </span>
              </div>
              <div className="mt-1.5">
                <StackedBar product={product} scale={busiest} />
              </div>
            </li>
          );
        })}
      </ul>

      {ordered.length > INITIAL_VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((previous) => !previous)}
          className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          {showAll ? `Show top ${INITIAL_VISIBLE} products` : `Show all ${ordered.length} products`}
        </button>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3">
        {BUCKET_ORDER.map((bucket) => (
          <span key={bucket} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS[bucket].hex }} />
            {bucket}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ProductBars;
