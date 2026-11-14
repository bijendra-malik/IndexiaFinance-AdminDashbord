import { Building2, FileText, UserCircle } from "lucide-react";

/*
==========================================
Review entity meta — loan / customer / franchise

Review queue, admin updates aur dialogs sab ek hi cheez dikhate hain: admin ka
kaam kis record par hua. Pehle row par sirf `update.label` aata tha, isliye
customer ya franchise row bhi "Loan application" jaisi lagti thi.

Ab type ek hi jagah define hai — icon, label aur colour. Naya entity add karna
ho to sirf yahan entry chahiye.
==========================================
*/

export type ReviewEntityKind = "loan" | "customer" | "franchise";

/** Backend `entity` field optional hai — missing ka matlab loan row. */
export const reviewEntity = (entity?: string | null): ReviewEntityKind =>
  entity === "customer" ? "customer" : entity === "franchise" ? "franchise" : "loan";

export interface EntityMeta {
  /** Full label — badge me. */
  label: string;
  /** Filter chip me chhota label. */
  short: string;
  icon: typeof FileText;
  /** Badge styling. */
  chip: string;
  /** Left icon tile. */
  tile: string;
  dot: string;
}

export const ENTITY_META: Record<ReviewEntityKind, EntityMeta> = {
  loan: {
    label: "Loan application",
    short: "Loans",
    icon: FileText,
    chip: "bg-sky-50 text-sky-700 ring-sky-200/70",
    tile: "bg-sky-50 text-sky-600",
    dot: "bg-sky-500",
  },
  customer: {
    label: "Customer",
    short: "Customers",
    icon: UserCircle,
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    tile: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-500",
  },
  franchise: {
    label: "Franchise",
    short: "Franchises",
    icon: Building2,
    chip: "bg-violet-50 text-violet-700 ring-violet-200/70",
    tile: "bg-violet-50 text-violet-600",
    dot: "bg-violet-500",
  },
};

/** Filter row ka fixed order — har screen par same. */
export const ENTITY_ORDER: ReviewEntityKind[] = ["loan", "customer", "franchise"];

export const entityLabel = (entity?: string | null): string =>
  ENTITY_META[reviewEntity(entity)].label;

/**
 * Row ka main title. Loan par customer ka naam (product badge alag dikhta hai),
 * customer/franchise record par record ka naam — naam na ho to type hi title.
 */
export const entityRecordTitle = (update: {
  entity?: string;
  customerName?: string;
  label?: string;
}): string => {
  const kind = reviewEntity(update.entity);
  if (kind === "loan") return update.customerName || update.label || "Loan application";
  return update.customerName || (kind === "customer" ? "Customer record" : "Franchise record");
};
