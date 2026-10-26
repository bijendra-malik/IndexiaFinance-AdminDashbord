import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight, BarChart3, Bell, Briefcase,
  Building2, Car, ChevronDown, ChevronRight, CreditCard,
  Database, FileText, Globe, GraduationCap,
  Home, Landmark, LayoutDashboard, LogOut,
  Settings, TrendingUp, UserCircle, Users,
  Wallet, Coins, XCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { LOAN_TYPES } from "../../constants/loanTypes";
import logo from "../../assets/main-logo.gif";

const APPLICATIONS_BASE = "/applications";
const activeBg = "linear-gradient(135deg, rgb(6, 106, 156), rgb(38, 174, 144))";

const getInitials = (name?: string) => {
  if (!name) return "A";
  return name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
};

// Rejections ka ek dropdown — kis type ka reject, ye ek hi jagah define hai.
const REJECT_LINKS = [
  { to: "/rejected-loans",                     label: "All Rejects",              icon: XCircle,    match: (path: string) => path === "/rejected-loans" },
  { to: "/rejected-loans/customer",            label: "Customer Reject",          icon: UserCircle, match: (path: string) => path === "/rejected-loans/customer" },
  { to: "/rejected-loans/franchise-customer", label: "Franchise Customer Reject", icon: Users,      match: (path: string) => path === "/rejected-loans/franchise-customer" },
  { to: "/rejected-loans/franchise",           label: "Franchise Reject",          icon: Building2,  match: (path: string) => path === "/rejected-loans/franchise" },
];

const isRejectSection = (path: string) => path.startsWith("/rejected-loans");

const MASTERS_LINKS = [
  { to: "/masters",           label: "Bank Details",          icon: Database },
  { to: "/masters/locations", label: "Location Master",       icon: Globe },
];

// Franchise network: one dropdown instead of four top-level entries.
const FRANCHISE_LINKS = [
  { to: "/franchises",                label: "Franchises",          icon: Building2,  match: (path: string) => path.startsWith("/franchises") },
  { to: "/franchise-plans",           label: "Franchise Plans",     icon: Coins,      match: (path: string) => path === "/franchise-plans" },
  { to: "/franchise-customers",       label: "Franchise Customers", icon: Users,      match: (path: string) => path.startsWith("/franchise-customers") && path !== "/franchise-customers/stats" },
  { to: "/franchise-customers/stats", label: "CIBIL Overview",      icon: BarChart3,  match: (path: string) => path === "/franchise-customers/stats" },
];

const isFranchiseSection = (path: string) =>
  path.startsWith("/franchises") ||
  path.startsWith("/franchise-") ||
  path === "/franchise-plans";

// ── Loan type icon + color map ────────────────────────────────────────────────
const LOAN_TYPE_CONFIG: Record<string, {
  icon: React.ComponentType<{ size?: number }>;
  color: string;
  bg: string;
}> = {
  "personal-loan":            { icon: UserCircle,   color: "#0ea5e9", bg: "rgba(14,165,233,0.15)"  },
  "business-loan":            { icon: Briefcase,    color: "#34d399", bg: "rgba(52,211,153,0.15)"  },
  "home-loan":                { icon: Home,         color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  "loan-against-property":    { icon: Landmark,     color: "#fbbf24", bg: "rgba(251,191,36,0.15)"  },
  "balance-transfer":         { icon: ArrowLeftRight, color: "#f472b6", bg: "rgba(244,114,182,0.15)"},
  "project-loan":             { icon: Building2,    color: "#fb923c", bg: "rgba(251,146,60,0.15)"  },
  "car-loan":                 { icon: Car,          color: "#4ade80", bg: "rgba(74,222,128,0.15)"  },
  "education-loan":           { icon: GraduationCap, color: "#60a5fa", bg: "rgba(96,165,250,0.15)" },
  "credit-card":              { icon: CreditCard,   color: "#f87171", bg: "rgba(248,113,113,0.15)" },
  "working-capital":          { icon: TrendingUp,   color: "#2dd4bf", bg: "rgba(45,212,191,0.15)"  },
  "commercial-purchase":      { icon: BarChart3,    color: "#e879f9", bg: "rgba(232,121,249,0.15)" },
  "lease-rental-discounting": { icon: Wallet,       color: "#a3e635", bg: "rgba(163,230,53,0.15)"  },
  "odcc-limit":               { icon: Coins,        color: "#facc15", bg: "rgba(250,204,21,0.15)"  },
  "loan-against-share":       { icon: Globe,        color: "#67e8f9", bg: "rgba(103,232,249,0.15)" },
  "npa-loan":                 { icon: FileText,     color: "#fb7185", bg: "rgba(251,113,133,0.15)" },
  "gold-loan":                { icon: Coins,        color: "#fbbf24", bg: "rgba(251,191,36,0.15)"  },
  "fdi-loan":                 { icon: Globe,        color: "#38bdf8", bg: "rgba(56,189,248,0.15)"  },
};

// ── Nav helpers ───────────────────────────────────────────────────────────────
const hoverOn  = (e: React.MouseEvent<HTMLElement>, active: boolean) => {
  if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.09)";
};
const hoverOff = (e: React.MouseEvent<HTMLElement>, active: boolean) => {
  if (!active) e.currentTarget.style.background = "transparent";
};

// ── Profile Dropdown ──────────────────────────────────────────────────────────
const ProfileDropdown = ({
  name, email, role, onLogout,
}: { name?: string; email?: string; role?: string; onLogout: () => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-full hover:bg-slate-100 transition">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
          style={{ background: activeBg }}>
          {getInitials(name)}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold text-slate-700 leading-tight">{name}</p>
          <p className="text-xs text-slate-400 capitalize leading-tight">{role}</p>
        </div>
        <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2.5 w-60 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
          {/* User header */}
          <div className="px-4 py-4 flex items-center gap-3"
            style={{ background: "linear-gradient(135deg,#044e7415,#26ae9015)" }}>
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow"
              style={{ background: activeBg }}>
              {getInitials(name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
              <p className="text-xs text-slate-500 truncate">{email}</p>
              <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(0,102,153,0.1)] text-[rgb(0,102,153)] font-semibold capitalize">
                {role}
              </span>
            </div>
          </div>

          <div className="py-1">
            {[
              { icon: UserCircle, label: "Profile Settings",  action: () => { setOpen(false); navigate("/profile?tab=profile");  } },
              { icon: Settings,   label: "Account Settings",  action: () => { setOpen(false); navigate("/profile?tab=security"); } },
            ].map(({ icon: Icon, label, action }) => (
              <button key={label} onClick={action}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition">
                <Icon size={15} className="text-slate-400" />{label}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100 py-1">
            <button onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 hover:text-red-700 transition">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Layout ───────────────────────────────────────────────────────────────
const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { admin, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const isOnMasters      = location.pathname.startsWith("/masters");
  const isOnApplications = location.pathname.startsWith(APPLICATIONS_BASE);
  const isOnFranchises   = isFranchiseSection(location.pathname);
  const isOnRejects      = isRejectSection(location.pathname);

  // null = follow the route (a section opens automatically); true/false = the user's own choice.
  const [mastersOpenChoice,      setMastersOpenChoice]      = useState<boolean | null>(null);
  const [applicationsOpenChoice, setApplicationsOpenChoice] = useState<boolean | null>(null);
  const [franchisesOpenChoice,   setFranchisesOpenChoice]   = useState<boolean | null>(null);
  const [rejectsOpenChoice,      setRejectsOpenChoice]      = useState<boolean | null>(null);

  const mastersOpen      = mastersOpenChoice      ?? isOnMasters;
  const applicationsOpen = applicationsOpenChoice ?? isOnApplications;
  const franchisesOpen   = franchisesOpenChoice   ?? isOnFranchises;
  const rejectsOpen      = rejectsOpenChoice      ?? isOnRejects;

  const handleLogout  = () => { logout(); navigate("/login", { replace: true }); };
  const handleProfile = () => navigate("/profile");

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f1f5f9" }}>

      {/* ══════════════ SIDEBAR ══════════════ */}
      <aside className="h-full w-64 shrink-0 flex flex-col shadow-xl z-20"
        style={{ background: "linear-gradient(180deg,#03405e 0%,#055a84 60%,#066a9c 100%)" }}>

        {/* Logo */}
        <div className="px-5 pt-5 pb-4">
          <Link to="/dashboard"
            className="block bg-white rounded-xl px-4 py-3 shadow-md hover:shadow-lg transition">
            <img src={logo} alt="Indexia Finance" className="w-full h-auto" />
          </Link>
        </div>

        {/* Navigation label */}
        <div className="px-5 mb-2">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Menu</p>
        </div>

        {/* Nav */}
        <nav className="scrollbar-hidden flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">

          {/* Flat links */}
          {[
            { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { to: "/customers", label: "Customers",  icon: Users },
          ].map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <Link key={to} to={to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={isActive ? { background: activeBg, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" } : { color: "rgba(255,255,255,0.75)" }}
                onMouseEnter={e => hoverOn(e, isActive)}
                onMouseLeave={e => hoverOff(e, isActive)}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-white/20" : "bg-white/10"}`}>
                  <Icon size={15} />
                </div>
                {label}
              </Link>
            );
          })}

          {/* Reject Loans dropdown — customer / franchise customer / franchise alag alag */}
          <div>
            <button type="button" onClick={() => setRejectsOpenChoice(!rejectsOpen)}
              aria-expanded={rejectsOpen}
              title="Rejections — customer, franchise customer aur franchise"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={isOnRejects
                ? { background: activeBg, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }
                : { color: "rgba(255,255,255,0.75)" }}
              onMouseEnter={e => hoverOn(e, isOnRejects)}
              onMouseLeave={e => hoverOff(e, isOnRejects)}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isOnRejects ? "bg-white/20" : "bg-white/10"}`}>
                <XCircle size={15} />
              </div>
              <span className="flex-1 text-left">Reject Loans</span>
              <ChevronRight size={14} className={`transition-transform duration-200 opacity-60 ${rejectsOpen ? "rotate-90" : ""}`} />
            </button>
            {rejectsOpen && (
              <div className="ml-4 mt-0.5 pl-3 border-l border-white/10 space-y-0.5">
                {REJECT_LINKS.map(({ to, label, icon: Icon, match }) => {
                  const isActive = match(location.pathname);
                  return (
                    <Link key={to} to={to}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={isActive ? { background: "rgba(255,255,255,0.15)", color: "#fff" } : { color: "rgba(255,255,255,0.65)" }}
                      onMouseEnter={e => hoverOn(e, isActive)}
                      onMouseLeave={e => hoverOff(e, isActive)}>
                      <Icon size={13} className="opacity-70" />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section label */}
          <div className="pt-3 pb-1 px-3">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Franchise network</p>
          </div>

          {/* Franchises dropdown — Franchises, Plans, Customers and CIBIL in one group */}
          <div>
            <button type="button" onClick={() => setFranchisesOpenChoice(!franchisesOpen)}
              aria-expanded={franchisesOpen}
              title="Franchises, plans, customers and CIBIL"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={isOnFranchises
                ? { background: activeBg, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }
                : { color: "rgba(255,255,255,0.75)" }}
              onMouseEnter={e => hoverOn(e, isOnFranchises)}
              onMouseLeave={e => hoverOff(e, isOnFranchises)}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isOnFranchises ? "bg-white/20" : "bg-white/10"}`}>
                <Building2 size={15} />
              </div>
              <span className="flex-1 text-left">Franchises</span>
              <ChevronRight size={14} className={`transition-transform duration-200 opacity-60 ${franchisesOpen ? "rotate-90" : ""}`} />
            </button>
            {franchisesOpen && (
              <div className="ml-4 mt-0.5 pl-3 border-l border-white/10 space-y-0.5">
                {FRANCHISE_LINKS.map(({ to, label, icon: Icon, match }) => {
                  const isActive = match(location.pathname);
                  return (
                    <Link key={to} to={to}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={isActive ? { background: "rgba(255,255,255,0.15)", color: "#fff" } : { color: "rgba(255,255,255,0.65)" }}
                      onMouseEnter={e => hoverOn(e, isActive)}
                      onMouseLeave={e => hoverOff(e, isActive)}>
                      <Icon size={13} className="opacity-70" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section label */}
          <div className="pt-3 pb-1 px-3">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Management</p>
          </div>

          {/* Masters dropdown */}
          <div>
            <button type="button" onClick={() => setMastersOpenChoice(!mastersOpen)}
              aria-expanded={mastersOpen}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={isOnMasters
                ? { background: activeBg, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }
                : { color: "rgba(255,255,255,0.75)" }}
              onMouseEnter={e => hoverOn(e, isOnMasters)}
              onMouseLeave={e => hoverOff(e, isOnMasters)}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isOnMasters ? "bg-white/20" : "bg-white/10"}`}>
                <Database size={15} />
              </div>
              <span className="flex-1 text-left">Masters</span>
              <ChevronRight size={14} className={`transition-transform duration-200 opacity-60 ${mastersOpen ? "rotate-90" : ""}`} />
            </button>
            {mastersOpen && (
              <div className="ml-4 mt-0.5 pl-3 border-l border-white/10 space-y-0.5">
                {MASTERS_LINKS.map(({ to, label, icon: Icon }) => {
                  const isActive = location.pathname === to;
                  return (
                    <Link key={to} to={to}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={isActive ? { background: "rgba(255,255,255,0.15)", color: "#fff" } : { color: "rgba(255,255,255,0.65)" }}
                      onMouseEnter={e => hoverOn(e, isActive)}
                      onMouseLeave={e => hoverOff(e, isActive)}>
                      <Icon size={13} className="opacity-70" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Loan Applications dropdown */}
          <div>
            <button type="button" onClick={() => setApplicationsOpenChoice(!applicationsOpen)}
              aria-expanded={applicationsOpen}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={isOnApplications
                ? { background: activeBg, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }
                : { color: "rgba(255,255,255,0.75)" }}
              onMouseEnter={e => hoverOn(e, isOnApplications)}
              onMouseLeave={e => hoverOff(e, isOnApplications)}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isOnApplications ? "bg-white/20" : "bg-white/10"}`}>
                <FileText size={15} />
              </div>
              <span className="flex-1 text-left">Loan Applications</span>
              <ChevronRight size={14} className={`transition-transform duration-200 opacity-60 ${applicationsOpen ? "rotate-90" : ""}`} />
            </button>
            {applicationsOpen && (
              <div className="scrollbar-hidden ml-4 mt-0.5 pl-3 border-l border-white/10 space-y-0.5 max-h-64 overflow-y-auto">
                {LOAN_TYPES.map(({ slug, label }) => {
                  const to = `${APPLICATIONS_BASE}/${slug}`;
                  const isActive = location.pathname === to;
                  const cfg = LOAN_TYPE_CONFIG[slug];
                  const Icon = cfg?.icon ?? FileText;
                  return (
                    <Link key={slug} to={to}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
                      style={isActive
                        ? { background: "rgba(255,255,255,0.15)", color: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }
                        : { color: "rgba(255,255,255,0.65)" }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = cfg?.bg ?? "rgba(255,255,255,0.09)";
                          e.currentTarget.style.color = cfg?.color ?? "rgba(255,255,255,0.9)";
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "rgba(255,255,255,0.65)";
                        }
                      }}
                      onMouseDown={e => {
                        if (!isActive) e.currentTarget.style.transform = "scale(0.97)";
                      }}
                      onMouseUp={e => {
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      {/* Icon bubble */}
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all"
                        style={isActive
                          ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                          : { background: cfg?.bg ?? "rgba(255,255,255,0.1)", color: cfg?.color ?? "#fff" }}
                      >
                        <Icon size={12} />
                      </div>
                      <span className="truncate">{label}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* ── Bottom admin strip ── */}
        <div className="px-4 py-4 border-t border-white/10">
          <button onClick={handleProfile}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition group">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 border-2 border-white/20"
              style={{ background: "rgba(255,255,255,0.15)" }}>
              {getInitials(admin?.name)}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-white truncate leading-tight">{admin?.name}</p>
              <p className="text-[11px] text-white/50 capitalize truncate">{admin?.role}</p>
            </div>
            <Settings size={14} className="text-white/30 group-hover:text-white/60 transition shrink-0" />
          </button>
        </div>
      </aside>

      {/* ══════════════ MAIN AREA ══════════════ */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">

        {/* Topbar */}
        <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-200/70">
          <div className="h-16 flex items-center justify-between px-6 gap-4">
            {/* Left */}
            <div>
              <h1 className="text-base font-bold" style={{ color: "rgb(0,102,153)" }}>
                Admin Panel
              </h1>
              <p className="text-[11px] text-slate-400 leading-none">Indexia Finance</p>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              {/* Bell */}
              <button className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition text-slate-500">
                <Bell size={17} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
              </button>

              <div className="w-px h-6 bg-slate-200" />

              <ProfileDropdown
                name={admin?.name}
                email={admin?.email}
                role={admin?.role}
                onLogout={handleLogout}
              />
            </div>
          </div>
          <div style={{ height: "2px", background: "linear-gradient(90deg,#066a9c,#26ae90,#f2f231)" }} />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
