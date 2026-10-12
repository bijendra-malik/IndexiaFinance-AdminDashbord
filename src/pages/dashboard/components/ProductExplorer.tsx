import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import type { ProductStat } from "../../../api/dashboard";
import {
  BUCKET_ORDER,
  STATUS,
  applicationPath,
  formatCurrency,
  percentOf,
  productCount,
} from "../dashboardUtils";
import StackedBar from "./StackedBar";

type SortKey = "total" | "approved" | "label";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "total", label: "Total" },
  { value: "approved", label: "Approved" },
  { value: "label", label: "Name" },
];

const compare = (a: ProductStat, b: ProductStat, sort: SortKey): number => {
  if (sort === "label") return a.label.localeCompare(b.label);
  if (sort === "approved") return b.approved - a.approved || a.label.localeCompare(b.label);
  return b.total - a.total || a.label.localeCompare(b.label);
};

interface ExplorerItem {
  /** Guaranteed-unique identity for selection, keys and highlighting. */
  key: string;
  product: ProductStat;
}

/**
 * `slug` is not dependable — the live backend has sent product rows without it,
 * and using it directly made every row compare equal (`undefined === undefined`)
 * so all of them rendered as selected. Identity therefore comes from the label,
 * with the index appended only if that would still collide.
 */
const toItems = (products: ProductStat[]): ExplorerItem[] => {
  const seen = new Set<string>();
  return products.map((product, index) => {
    const base = product.slug?.trim() || product.label?.trim() || `product-${index}`;
    const key = seen.has(base) ? `${base}#${index}` : base;
    seen.add(key);
    return { key, product };
  });
};

/**
 * Master-detail view for the per-product breakdown.
 *
 * The old eight-column table grew to eighteen rows and forced a horizontal
 * scrollbar, so the page became very long. Here the product list scrolls
 * inside a fixed height and the selected product's figures render in full
 * detail beside it — the panel keeps the same height no matter how many
 * products the backend returns.
 */
const ProductExplorer = ({ products }: { products: ProductStat[] }) => {
  const items = useMemo(() => toItems(products), [products]);
  const [selectedKey, setSelectedKey] = useState<string | null>(() => items[0]?.key ?? null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("total");

  const ordered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter(({ product }) => !needle || product.label.toLowerCase().includes(needle))
      .sort((a, b) => compare(a.product, b.product, sort));
  }, [items, query, sort]);

  const totalApplications = products.reduce((sum, product) => sum + product.total, 0);

  // Selection survives filtering; when the selected product is filtered out we
  // fall back to the first visible one instead of rendering an empty pane.
  const current = ordered.find((item) => item.key === selectedKey) ?? ordered[0] ?? null;

  if (products.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm italic text-slate-400">
        No loan products returned by the API yet.
      </p>
    );
  }

  const currentPath = applicationPath(current?.product.slug);

  return (
    <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* ── Product list ──────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 lg:border-b-0 lg:border-r">
        <div className="flex gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-0 flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find product…"
              aria-label="Search loan products"
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-7 pr-2 text-xs outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label="Sort products by"
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600"
          >
            {SORTS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Capped on every breakpoint — with 18 products an uncapped list made
            the whole panel 1300px+ tall on a phone. */}
        <ul className="max-h-[19rem] overflow-y-auto p-1.5" role="listbox" aria-label="Loan products">
          {ordered.map((item) => {
            const active = item.key === current?.key;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => setSelectedKey(item.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                    active ? "text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"
                  }`}
                  style={
                    active
                      ? { background: "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))" }
                      : undefined
                  }
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{item.product.label}</span>
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${
                      active ? "text-white" : "text-slate-500"
                    }`}
                  >
                    {item.product.total}
                  </span>
                </button>
              </li>
            );
          })}
          {ordered.length === 0 && (
            <li className="px-3 py-6 text-center text-xs italic text-slate-400">
              No product matches your search.
            </li>
          )}
        </ul>

        <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
          Showing {ordered.length} of {products.length} products
        </p>
      </div>

      {/* ── Selected product ──────────────────────────────────────────────── */}
      <div className="p-5">
        {current ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-base font-bold text-slate-800">{current.product.label}</h4>
                <p className="mt-0.5 text-xs text-slate-500">
                  {current.product.total} application{current.product.total === 1 ? "" : "s"} ·{" "}
                  {percentOf(current.product.total, totalApplications).toFixed(1)}% of all
                  applications
                </p>
              </div>
              {currentPath && (
                <Link
                  to={currentPath}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-[rgb(6,106,156)]"
                >
                  Open applications
                  <ArrowUpRight size={13} />
                </Link>
              )}
            </div>

            <div className="mt-4">
              <StackedBar product={current.product} thickness="lg" />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BUCKET_ORDER.map((bucket) => (
                <div
                  key={bucket}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                >
                  <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: STATUS[bucket].hex }}
                    />
                    {bucket}
                  </dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-slate-800">
                    {productCount(current.product, bucket)}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "Requested", value: formatCurrency(current.product.requestedAmount) },
                { label: "Sanctioned", value: formatCurrency(current.product.approvedAmount) },
                {
                  label: "Approval rate",
                  value: `${percentOf(current.product.approved, current.product.total).toFixed(1)}%`,
                },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 font-semibold tabular-nums text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-sm italic text-slate-400">No product selected.</p>
        )}
      </div>
    </div>
  );
};

export default ProductExplorer;
