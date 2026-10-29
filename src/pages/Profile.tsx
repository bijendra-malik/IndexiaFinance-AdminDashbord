import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Lock, Mail, Settings,
  Shield, UserCircle,
} from "lucide-react";
import AdminLayout from "../components/layout/AdminLayout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { changeAdminPassword, updateAdminProfile } from "../api/auth";
import { getApiErrorMessage } from "../utils/apiError";

const activeBg     = "linear-gradient(135deg, rgb(6, 106, 156), rgb(38, 174, 144))";
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const EMAIL_REGEX    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getInitials = (name?: string) =>
  name ? name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") : "A";

// ── Tabs config ───────────────────────────────────────────────────────────────
const TABS = [
  { id: "profile",  label: "Profile Settings",  icon: UserCircle, desc: "Update your name and email"     },
  { id: "security", label: "Account Settings",  icon: Lock,       desc: "Change your password"           },
];

// ── Input component ───────────────────────────────────────────────────────────
const Input = ({
  label, type = "text", value, onChange, error, hint, disabled, placeholder,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; error?: string; hint?: string;
  disabled?: boolean; placeholder?: string;
}) => (
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
    <input
      type={type} value={value} disabled={disabled} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 transition
        ${disabled ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white"}
        ${error ? "border-red-400 focus:ring-red-200" : "border-slate-200 focus:ring-[rgba(6,106,156,0.25)] focus:border-[rgb(6,106,156)]"}`}
    />
    {error  && <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1"><span>⚠</span>{error}</p>}
    {!error && hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
  </div>
);

// ── Profile tab ───────────────────────────────────────────────────────────────
const ProfileTab = () => {
  const { admin, updateAdmin } = useAuth();
  const { showToast }          = useToast();

  const [name,  setName]  = useState(admin?.name  ?? "");
  const [email, setEmail] = useState(admin?.email ?? "");
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Re-sync the drafts whenever the admin record itself changes (profile
  // refetch after sign-in, or a save made elsewhere). The guarded pattern React
  // recommends, instead of an effect that copies state during render.
  const [syncedAdmin, setSyncedAdmin] = useState(admin);
  if (admin !== syncedAdmin) {
    setSyncedAdmin(admin);
    setName(admin?.name ?? "");
    setEmail(admin?.email ?? "");
  }

  const isDirty = name.trim() !== (admin?.name ?? "") || email.trim() !== (admin?.email ?? "");

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim())                        next.name  = "Name is required";
    else if (name.trim().length > 100)       next.name  = "Max 100 characters";
    if (!email.trim())                       next.email = "Email is required";
    else if (!EMAIL_REGEX.test(email.trim())) next.email = "Enter a valid email address";
    setErrors(next);
    return !Object.keys(next).length;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const updated = await updateAdminProfile({ name: name.trim(), email: email.trim() });
      updateAdmin(updated);
      showToast("Profile updated successfully", "success");
    } catch (err) {
      showToast(getApiErrorMessage(err, "Unable to update profile."), "error");
    } finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="Full Name"     value={name}  onChange={setName}  error={errors.name}
             placeholder="Your full name" />
      <Input label="Email Address" type="email" value={email} onChange={setEmail} error={errors.email}
             placeholder="you@example.com" />

      {/* Read-only role */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Role</label>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50">
          <Shield size={15} className="text-slate-400 shrink-0" />
          <span className="text-sm font-medium text-slate-600 capitalize">{admin?.role}</span>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
            Read-only
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          {isDirty ? "You have unsaved changes" : "No changes to save"}
        </p>
        <button type="submit" disabled={isSubmitting || !isDirty}
          className="px-6 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition shadow-sm"
          style={{ background: activeBg }}>
          {isSubmitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
};

// ── Security tab ──────────────────────────────────────────────────────────────
const SecurityTab = () => {
  const { showToast } = useToast();

  const [cur,     setCur]     = useState("");
  const [next,    setNext]    = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!cur)  e.cur = "Current password is required";
    if (!next) e.next = "New password is required";
    else if (!PASSWORD_REGEX.test(next)) e.next = "Min 8 chars with a letter and number";
    else if (next === cur)               e.next = "New password must differ from current";
    if (!confirm)       e.confirm = "Please confirm your new password";
    else if (confirm !== next) e.confirm = "Passwords do not match";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormErr("");
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await changeAdminPassword({ currentPassword: cur, newPassword: next });
      showToast("Password changed successfully", "success");
      setCur(""); setNext(""); setConfirm(""); setErrors({});
    } catch (err) {
      setFormErr(getApiErrorMessage(err, "Unable to change password."));
    } finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="Current Password"  type="password" value={cur}     onChange={setCur}
             error={errors.cur}     placeholder="Enter current password" />
      <Input label="New Password"      type="password" value={next}    onChange={setNext}
             error={errors.next}    hint="At least 8 characters with a letter and a number"
             placeholder="Enter new password" />
      <Input label="Confirm New Password" type="password" value={confirm} onChange={setConfirm}
             error={errors.confirm} placeholder="Re-enter new password" />

      {formErr && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span className="shrink-0">⚠</span>{formErr}
        </div>
      )}

      {/* Password rules */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Password requirements</p>
        {[
          { rule: "At least 8 characters",                ok: next.length >= 8 },
          { rule: "Contains a letter",                    ok: /[A-Za-z]/.test(next) },
          { rule: "Contains a number",                    ok: /\d/.test(next) },
          { rule: "Matches confirmation",                 ok: next.length > 0 && next === confirm },
        ].map(({ rule, ok }) => (
          <div key={rule} className="flex items-center gap-2">
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${ok ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
              {ok ? "✓" : "·"}
            </span>
            <span className={`text-xs ${ok ? "text-emerald-600 font-semibold" : "text-slate-500"}`}>{rule}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button type="submit" disabled={isSubmitting}
          className="px-6 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-60 hover:brightness-110 transition shadow-sm"
          style={{ background: activeBg }}>
          {isSubmitting ? "Updating…" : "Update Password"}
        </button>
      </div>
    </form>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
const Profile = () => {
  const { admin }              = useAuth();
  const navigate               = useNavigate();
  const [searchParams]         = useSearchParams();
  const activeTab              = searchParams.get("tab") === "security" ? "security" : "profile";

  return (
    <AdminLayout>

      {/* ── Hero banner ── */}
      <div className="relative rounded-3xl overflow-hidden mb-6 shadow-lg"
        style={{ background: "linear-gradient(135deg,#03405e 0%,#066a9c 55%,#0e9080 100%)" }}>
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-4 right-44 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative z-10 px-8 py-8 flex items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-black border-2 border-white/25 shadow-xl shrink-0"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)" }}>
            {getInitials(admin?.name)}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-white text-2xl font-extrabold leading-tight">{admin?.name}</h2>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-white/70 text-sm">
                <Mail size={13} />{admin?.email}
              </span>
              <span className="flex items-center gap-1.5 text-white/70 text-sm capitalize">
                <Shield size={13} />{admin?.role}
              </span>
            </div>
          </div>
          {/* Settings icon decoration */}
          <div className="hidden md:flex items-center justify-center w-14 h-14 rounded-2xl shrink-0"
            style={{ background: "rgba(255,255,255,0.1)" }}>
            <Settings size={24} className="text-white/60" />
          </div>
        </div>
      </div>

      {/* ── Tab + content layout ── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* ── Left: Tab sidebar ── */}
        <div className="w-full lg:w-64 shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Settings</p>
          </div>
          <nav className="p-2 space-y-1">
            {TABS.map(({ id, label, icon: Icon, desc }) => {
              const isActive = activeTab === id;
              return (
                <button key={id} onClick={() => navigate(`/profile?tab=${id}`)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                    isActive ? "text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                  style={isActive ? { background: activeBg } : undefined}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive ? "bg-white/20" : "bg-slate-100"}`}>
                    <Icon size={16} className={isActive ? "text-white" : "text-slate-500"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-tight">{label}</p>
                    <p className={`text-[11px] mt-0.5 truncate ${isActive ? "text-white/70" : "text-slate-400"}`}>{desc}</p>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Admin info footer */}
          <div className="px-4 py-4 mt-2 border-t border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: activeBg }}>
                {getInitials(admin?.name)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate">{admin?.name}</p>
                <p className="text-[10px] text-slate-400 capitalize">{admin?.role}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Content ── */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3"
              style={{ background: "linear-gradient(90deg,#f8fafc,#f1f5f9)" }}>
              {(() => {
                const tab = TABS.find(t => t.id === activeTab)!;
                const Icon = tab.icon;
                return (
                  <>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(6,106,156,0.12)" }}>
                      <Icon size={18} style={{ color: "rgb(6,106,156)" }} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">{tab.label}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{tab.desc}</p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Tab content */}
            <div className="px-6 py-6">
              {activeTab === "profile"  && <ProfileTab />}
              {activeTab === "security" && <SecurityTab />}
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
};

export default Profile;
