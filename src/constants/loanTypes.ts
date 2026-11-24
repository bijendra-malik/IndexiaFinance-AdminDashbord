export type LoanTypeSlug =
  | "personal-loan"
  | "business-loan"
  | "home-loan"
  | "loan-against-property"
  | "balance-transfer"
  | "project-loan"
  | "car-loan"
  | "education-loan"
  | "credit-card"
  | "working-capital"
  | "commercial-purchase"
  | "lease-rental-discounting"
  | "odcc-limit"
  | "loan-against-share"
  | "npa-loan"
  | "gold-loan"
  | "fdi-loan"
  | "film-funding";

export interface LoanTypeDef {
  slug: LoanTypeSlug;
  label: string;
}

export const LOAN_TYPES: LoanTypeDef[] = [
  { slug: "personal-loan", label: "Personal Loan" },
  { slug: "business-loan", label: "Business Loan" },
  { slug: "home-loan", label: "Home Loan" },
  { slug: "loan-against-property", label: "Loan Against Property" },
  { slug: "balance-transfer", label: "Balance Transfer" },
  { slug: "project-loan", label: "Project Loan" },
  { slug: "car-loan", label: "Car Loan" },
  { slug: "education-loan", label: "Education Loan" },
  { slug: "credit-card", label: "Credit Card" },
  { slug: "working-capital", label: "Working Capital" },
  { slug: "commercial-purchase", label: "Commercial Purchase" },
  { slug: "lease-rental-discounting", label: "Lease Rental Discounting" },
  { slug: "odcc-limit", label: "OD/CC Limit" },
  { slug: "loan-against-share", label: "Loan Against Share" },
  { slug: "npa-loan", label: "NPA Loan" },
  { slug: "gold-loan", label: "Gold Loan" },
  { slug: "fdi-loan", label: "FDI Loan" },
  { slug: "film-funding", label: "Film Funding" },
];

export const getLoanTypeLabel = (slug: string): string =>
  LOAN_TYPES.find((l) => l.slug === slug)?.label ?? slug;

/** Overview/list API product key ("creditCard") route slug ("credit-card") me. */
export const PRODUCT_SLUGS: Record<string, string> = {
  personal: "personal-loan", business: "business-loan", home: "home-loan",
  lap: "loan-against-property", balanceTransfer: "balance-transfer",
  projectLoan: "project-loan", vehicleLoan: "car-loan", educationLoan: "education-loan",
  creditCard: "credit-card", workingCapital: "working-capital",
  commercialPurchase: "commercial-purchase", leaseRentalDiscounting: "lease-rental-discounting",
  odCcLimit: "odcc-limit", loanAgainstShare: "loan-against-share", npaLoan: "npa-loan",
  goldLoan: "gold-loan", fdiLoan: "fdi-loan", filmFunding: "film-funding",
};

/**
 * Kisi bhi product value ko route slug me badalta hai — API key, already-slug,
 * ya label ("Credit card") teeno chalte hain, warna detail route nahi milta.
 */
export const resolveLoanSlug = (product?: string | null): string => {
  const value = (product ?? "").trim();
  if (!value) return "";
  const mapped = PRODUCT_SLUGS[value] ?? value;
  const known = LOAN_TYPES.find(
    (type) =>
      type.slug === mapped ||
      type.label.toLowerCase() === value.toLowerCase() ||
      type.label.toLowerCase() === mapped.toLowerCase()
  );
  return known?.slug ?? mapped;
};
