import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProductStat } from "../../../api/dashboard";
import { BUCKET_ORDER, STATUS, applicationPath, productCount } from "../dashboardUtils";

/**
 * "Applications by Product" — status × product dot chart.
 *
 * Y axis: chaar status rows (Approved / Pending / Submitted / Rejected), naam
 * aur uske rang ka dot row ke shuru me.
 * X axis: ek column per loan product (naam tilted anchor ke saath).
 * Har cell me us product ke us status ka dot + count; ek hi row ke dots halki
 * line se jude hain taaki products ke beech trend dikhe. Row banding, row
 * separators aur column guides matrix ko padhne layak rakhte hain.
 *
 * Columns fix width ke hain aur container scroll karta hai — 18 products hone
 * par bhi labels squeeze nahi hote. Product column par click se us product ki
 * applications list khulti hai (pehle jaisa behaviour).
 */

const MARGIN = { top: 12, right: 18, bottom: 74, left: 98 };
const ROW_HEIGHT = 50;
const MIN_COLUMN = 88;
const DOT_RADIUS = 4.5;
const MAX_LABEL = 16;
const LABEL_DOT_X = 16;
const LABEL_TEXT_X = 26;

const truncate = (label: string, max = MAX_LABEL) =>
  label.length > max ? `${label.slice(0, max - 1)}…` : label;

const ProductBars = ({ products }: { products: ProductStat[] }) => {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);

  // Panel resize par chart available width me phailta hai; columns MIN_COLUMN
  // se chhote nahi hote, us se neeche horizontal scroll aata hai.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setAvailable(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const ordered = useMemo(
    () => [...products].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)),
    [products]
  );

  const grandTotal = useMemo(
    () => ordered.reduce((sum, product) => sum + product.total, 0),
    [ordered]
  );

  if (products.length === 0) {
    return (
      <p className="px-5 pb-5 text-sm italic text-slate-400">
        No loan products returned by the API yet.
      </p>
    );
  }

  const plotInnerWidth = Math.max(
    ordered.length * MIN_COLUMN,
    available - MARGIN.left - MARGIN.right
  );
  const column = plotInnerWidth / Math.max(1, ordered.length);
  const width = plotInnerWidth + MARGIN.left + MARGIN.right;
  const plotHeight = BUCKET_ORDER.length * ROW_HEIGHT;
  const baseline = MARGIN.top + plotHeight;
  const height = baseline + MARGIN.bottom;
  const columnCenter = (index: number) => MARGIN.left + column * (index + 0.5);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 pb-4 pt-1">
      <div ref={wrapRef} className="min-h-0 flex-1 overflow-auto">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Applications by product: ${ordered
            .map((product) => `${product.label} ${product.total}`)
            .join(", ")}`}
        >
          {/* ── Row banding + separators (background) ─────────────────────── */}
          {BUCKET_ORDER.map((bucket, rowIndex) => {
            const rowTop = MARGIN.top + ROW_HEIGHT * rowIndex;

            return (
              <g key={`band-${bucket}`}>
                {rowIndex % 2 === 1 && (
                  <rect
                    x={MARGIN.left}
                    y={rowTop}
                    width={plotInnerWidth}
                    height={ROW_HEIGHT}
                    fill="#f8fafc"
                  />
                )}
                <line
                  x1={MARGIN.left}
                  y1={rowTop}
                  x2={width - MARGIN.right}
                  y2={rowTop}
                  stroke="#eef2f7"
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* ── Column guides + clickable product columns ─────────────────── */}
          {ordered.map((product, index) => {
            const centerX = columnCenter(index);
            const path = applicationPath(product.slug);

            return (
              <g
                key={product.slug?.trim() || product.label || `product-${index}`}
                className={path ? "cursor-pointer" : undefined}
                onClick={path ? () => navigate(path) : undefined}
              >
                <rect
                  x={centerX - column / 2}
                  y={MARGIN.top}
                  width={column}
                  height={plotHeight}
                  fill="transparent"
                >
                  <title>{`${product.label} — ${product.total} applications`}</title>
                </rect>
                <line
                  x1={centerX}
                  y1={MARGIN.top}
                  x2={centerX}
                  y2={baseline}
                  stroke="#f1f5f9"
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* ── Status rows: label, dots, connector ───────────────────────── */}
          {BUCKET_ORDER.map((bucket, rowIndex) => {
            const rowY = MARGIN.top + ROW_HEIGHT * (rowIndex + 0.5);

            const points = ordered
              .map((product, index) => ({
                count: productCount(product, bucket),
                x: columnCenter(index),
                label: product.label,
              }))
              .filter((point) => point.count > 0);

            return (
              <g key={bucket}>
                {/* row label: status ka rang + naam, y-axis par */}
                <circle cx={LABEL_DOT_X} cy={rowY} r={3.5} fill={STATUS[bucket].hex} />
                <text
                  x={LABEL_TEXT_X}
                  y={rowY + 3.75}
                  fontSize={11}
                  fontWeight={500}
                  fill="#475569"
                >
                  {bucket}
                </text>

                {/* ek hi status ke dots ke beech halki line — trend ek nazar me */}
                {points.length > 1 && (
                  <polyline
                    points={points.map((point) => `${point.x},${rowY}`).join(" ")}
                    fill="none"
                    stroke={STATUS[bucket].hex}
                    strokeOpacity={0.35}
                    strokeWidth={1.5}
                  />
                )}

                {points.map((point) => (
                  <g key={`${bucket}-${point.x}`}>
                    <circle
                      cx={point.x}
                      cy={rowY}
                      r={DOT_RADIUS}
                      fill={STATUS[bucket].hex}
                      stroke="#ffffff"
                      strokeWidth={1.25}
                    >
                      <title>{`${point.label} — ${bucket}: ${point.count}`}</title>
                    </circle>
                    <text
                      x={point.x + 9}
                      y={rowY + 3.5}
                      fontSize={10}
                      fill="#64748b"
                      className="tabular-nums"
                    >
                      {point.count.toLocaleString("en-IN")}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}

          {/* ── Baseline + product names (x-axis) ─────────────────────────── */}
          <line
            x1={MARGIN.left}
            y1={baseline}
            x2={width - MARGIN.right}
            y2={baseline}
            stroke="#e2e8f0"
            strokeWidth={1}
          />

          {ordered.map((product, index) => {
            const centerX = columnCenter(index);
            const labelY = baseline + 16;

            return (
              <text
                key={product.slug?.trim() || product.label || `label-${index}`}
                x={centerX}
                y={labelY}
                transform={`rotate(-22 ${centerX} ${labelY})`}
                textAnchor="end"
                fontSize={10.5}
                fill="#64748b"
              >
                {truncate(product.label)}
                <title>{`${product.label} — ${product.total} applications`}</title>
              </text>
            );
          })}

          <text
            x={MARGIN.left + plotInnerWidth / 2}
            y={baseline + MARGIN.bottom - 10}
            textAnchor="middle"
            fontSize={9.5}
            letterSpacing={0.6}
            fill="#94a3b8"
          >
            PRODUCTS
          </text>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        <span>Rows: application status · Columns: products</span>
        <span className="ml-auto tabular-nums">
          {ordered.length} product{ordered.length === 1 ? "" : "s"} ·{" "}
          {grandTotal.toLocaleString("en-IN")} applications
        </span>
      </div>
    </div>
  );
};

export default ProductBars;
