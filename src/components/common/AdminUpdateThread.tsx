import { useMemo, useState } from "react";
import { Clock3, Loader2, Send, ShieldCheck } from "lucide-react";
import {
  ENTITY_DECISIONS,
  UPDATE_TAGS_BY_ENTITY,
  updateTagLabel,
  type AdminUpdate,
  type EntityKind,
} from "../../api/adminUpdates";
import type { StatusRecommendation } from "../../types/admin.types";
/* Naam/role/timestamp formatting shared utils me hai — wahi reuse. */
import { adminLabel, formatDateTime, roleLabel } from "../../utils/auditFormat";

/*
==========================================
AdminUpdateThread

Customer drawer aur franchise detail dono me same thread — loan application
jaisa behaviour:

  regular admin : note / verification / flag / escalation likhta hai, aur chaho
                  to final decision SUGGEST kar sakta hai
  super admin   : likhta nahi (server 403 deta hai) — final decision leta hai,
                  jo backend khud "Decision" entry bana kar isi thread me daal
                  deta hai

Isliye `canWrite=false` par composer chhup jaata hai, thread padhne ke liye
rehta hai.
==========================================
*/

const KIND_STYLES: Record<string, { label: string; className: string }> = {
  note: { label: "Note", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  recommendation: {
    label: "Recommendation",
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  status: {
    label: "Decision",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
};

const TAG_STYLES: Record<string, string> = {
  verification: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  document: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  visit: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  correction: "bg-amber-50 text-amber-700 ring-amber-200",
  flag: "bg-rose-50 text-rose-700 ring-rose-200",
  escalation: "bg-orange-50 text-orange-700 ring-orange-200",
  general: "bg-slate-100 text-slate-600 ring-slate-200",
};

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "A";

export interface AdminUpdateComposerPayload {
  text: string;
  tag: string;
  suggestedStatus?: string;
}

interface AdminUpdateThreadProps {
  entity: EntityKind;
  updates?: AdminUpdate[];
  recommendation?: StatusRecommendation | null;
  /** Regular admin => true. Super admin ko composer nahi dikhta. */
  canWrite: boolean;
  /** true return kare to composer clear ho jaata hai. */
  onSubmit?: (payload: AdminUpdateComposerPayload) => Promise<boolean>;
  className?: string;
}

const AdminUpdateThread = ({
  entity,
  updates,
  recommendation,
  canWrite,
  onSubmit,
  className = "",
}: AdminUpdateThreadProps) => {
  const tags = UPDATE_TAGS_BY_ENTITY[entity];
  const decisions = ENTITY_DECISIONS[entity];

  const [text, setText] = useState("");
  const [tag, setTag] = useState(tags[0]);
  const [decision, setDecision] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /* Backend newest-first bhejta hai; purane records me order mixed ho sakta hai. */
  const ordered = useMemo(
    () =>
      [...(updates ?? [])].sort(
        (left, right) =>
          new Date(right.addedAt ?? 0).getTime() -
          new Date(left.addedAt ?? 0).getTime()
      ),
    [updates]
  );

  const canSubmit = Boolean(text.trim() || decision) && !saving && Boolean(onSubmit);

  const submit = async () => {
    if (!onSubmit || !canSubmit) return;
    setSaving(true);
    setError("");
    try {
      const saved = await onSubmit({
        text: text.trim(),
        tag,
        ...(decision ? { suggestedStatus: decision } : {}),
      });
      if (saved) {
        setText("");
        setDecision("");
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not save the update."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Admin updates</h3>
          <p className="mt-0.5 text-xs text-slate-500">
Verification, corrections, flags and recommendations in one thread.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 tabular-nums">
          {ordered.length}
        </span>
      </header>

      {/* Pending suggestion — super admin ka decision isi par lena hai */}
      {recommendation?.status && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <ShieldCheck size={13} />
            Decision pending —{" "}
            <span className="font-bold">{recommendation.status}</span> suggested
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700">
            {adminLabel(recommendation.recommendedByName)}
            {recommendation.recommendedAt
              ? ` · ${formatDateTime(recommendation.recommendedAt)}`
              : ""}
            {recommendation.note ? ` · ${recommendation.note}` : ""}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
        {ordered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
            No admin updates yet.
          </p>
        ) : (
          ordered.map((update, index) => {
            const kind = KIND_STYLES[update.kind ?? "note"] ?? KIND_STYLES.note;
            const tagStyle = TAG_STYLES[update.tag ?? "general"] ?? TAG_STYLES.general;
            const name = adminLabel(update.addedByName);
            return (
              <article
                key={update._id ?? `${update.addedAt ?? "u"}-${index}`}
                className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(6,106,156,0.12)] text-[10px] font-bold text-[rgb(6,106,156)]">
                    {initials(name)}
                  </span>
                  <span className="text-xs font-semibold text-slate-800" title={update.addedByName}>
                    {name}
                  </span>
                  <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                    {roleLabel(update.addedByRole)}
                  </span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${kind.className}`}>
                    {kind.label}
                  </span>
                  {!(update.kind === "status" && (update.tag ?? "general") === "general") && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${tagStyle}`}>
                      {updateTagLabel(update.tag)}
                    </span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock3 size={10} />
                    {formatDateTime(update.addedAt)}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                  {update.text}
                </p>
                {update.suggestedStatus && update.kind !== "status" && (
                  <p className="mt-1 text-[11px] font-semibold text-sky-700">
                    Suggested decision: {update.suggestedStatus}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Composer — sirf regular admin */}
      {canWrite && onSubmit && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {entity === "customer" ? "Customer check" : "Franchise check"} — what did you verify?
          </label>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder={
              entity === "customer"
                ? "e.g. PAN + Aadhaar verified, bank statement matched"
                : "e.g. GST certificate received, office verified on site"
            }
            className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-[rgb(6,106,156)]"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              aria-label="Update category"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[rgb(6,106,156)]"
            >
              {tags.map((value) => (
                <option key={value} value={value}>
                  {updateTagLabel(value)}
                </option>
              ))}
            </select>
            <select
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
              aria-label="Suggested decision"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[rgb(6,106,156)]"
            >
              <option value="">No decision suggestion</option>
              {decisions.map((value) => (
                <option key={value} value={value}>
                  Suggest {value}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400">{text.length}/500</span>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[rgb(6,106,156)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {saving ? "Saving…" : "Add update"}
            </button>
          </div>
          {decision && (
            <p className="mt-1.5 text-[10px] text-slate-500">
              A suggestion goes to the super admin as a pending decision — it does not
              change the record by itself.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-1.5 text-[11px] font-medium text-rose-600">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default AdminUpdateThread;
