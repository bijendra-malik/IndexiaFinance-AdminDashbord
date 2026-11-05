/*
==========================================
Admin row helpers — naam, role, timestamp aur avatar

Dashboard tables, Admin Updates timeline aur shared `AdminUpdateThread` sab
admin ko ek hi tarah dikhate hain: same label rule, same time format aur same
avatar colour. Pehle avatar ke helpers ek alag chhoti file me the, jabki
initials ka rule page me bhi copy tha — ab sab ek hi jagah hai.
==========================================
*/

export const formatDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/**
 * The audit trail stores the admin name as `name || loginId || email`, so a
 * super admin shows up as `admin@indexiafinance.com`. Show the handle part and
 * keep the full email for the tooltip instead.
 */
export const adminLabel = (name?: string) => {
  const raw = (name ?? "").trim();
  if (!raw) return "Admin";
  if (!raw.includes("@")) return raw;
  const local = raw.split("@")[0] || "admin";
  // `admin04indexiafinance@…` → `admin04`: when the org name is glued to the
  // handle, keep just the name+number prefix so the row stays readable.
  const compact = local.match(/^[a-z]+[._-]?\d+/i);
  return (compact ? compact[0] : local)
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

/** Stored as "SuperAdmin"/"Admin" — shown as "Super admin"/"Admin". */
export const roleLabel = (role?: string) => {
  const raw = (role ?? "").replace(/[_-]+/g, " ").trim();
  if (!raw) return "";
  if (/^super\s*admin$/i.test(raw)) return "Super admin";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};

/*
Avatar: same name → same gradient, har screen par. Naam ka hash colour chunta
hai, isliye ek admin dashboard aur timeline me ek hi rang me dikhta hai.
*/
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#066a9c,#26ae90)",
  "linear-gradient(135deg,#4338ca,#0ea5e9)",
  "linear-gradient(135deg,#0f766e,#22c55e)",
  "linear-gradient(135deg,#b45309,#f59e0b)",
  "linear-gradient(135deg,#9d174d,#fb7185)",
  "linear-gradient(135deg,#5b21b6,#8b5cf6)",
];

export const avatarGradient = (name: string) => {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 9973;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
};

/** Pehle do words ke initials; khaali naam par "A". */
export const initialsOf = (name: string) =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "A";
