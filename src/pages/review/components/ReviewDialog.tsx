import { useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import {
  REVIEW_ACTIONS,
  REVIEW_STATE_META,
  clearReview,
  reviewKey,
  writeReview,
  type ReviewRecord,
  type ReviewState,
} from "../../../api/adminReviews";
import type { AdminActivityUpdate } from "../../../api/adminActivity";
import { adminLabel, formatDateTime } from "../../../utils/auditFormat";
import { getApiErrorMessage } from "../../../utils/apiError";

/*
==========================================
Review dialog — sub admin ka ek hi action surface

Verify / Return / Escalate / Record decision. Har action ek capability se
bandha hai, isliye jo permission nahi mili wo button dikhta hi nahi. Note
mandatory hai wahan jahan admin ko wapas bhejna ya super admin ko escalate
karna hai — bina wajah ke kaam wapas jaana sirf confusion banata hai.

Do safety rules yahin lagte hain:
  1. Apna hi update review nahi kar sakte.
  2. Final decision ke liye `loans.decide` chahiye.
==========================================
*/

const BRAND_GRADIENT = "linear-gradient(135deg, rgb(6,106,156), rgb(38,174,144))";

const ACTION_ICONS: Record<Exclude<ReviewState, "pending">, typeof CheckCircle2> = {
  verified: CheckCircle2,
  returned: RefreshCw,
  escalated: ArrowUpRight,
  decided: ShieldCheck,
};

const kindLabel = (kind: AdminActivityUpdate["kind"]) =>
  kind === "recommendation" ? "Recommendation" : kind === "status" ? "Decision" : "Note";

const ReviewDialog = ({
  update,
  existing,
  onClose,
  onSaved,
}: {
  update: AdminActivityUpdate;
  existing?: ReviewRecord;
  onClose: () => void;
  onSaved: (records: Record<string, ReviewRecord>) => void;
}) => {
  const { admin, can, isSuperAdmin } = useAuth();
  const { showToast } = useToast();

  const key = reviewKey(update);
  /*
  `loans.decide` sirf loan application par lagti hai. Customer / franchise row
  par ye action backend se 403 deta hai, isliye button dikhana hi nahi chahiye.
  */
  const isLoanUpdate = (update.entity ?? "loan") === "loan";
  const allowed = REVIEW_ACTIONS.filter(
    (action) =>
      can(action.permission) &&
      (action.permission !== "loans.decide" || isLoanUpdate)
  );
  const [state, setState] = useState<ReviewState>(allowed[0]?.state ?? "verified");
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const action = REVIEW_ACTIONS.find((entry) => entry.state === state);
  // Supervisor apna hi kaam verify/decide na kare — warna quality-check layer
  // ka matlab hi nahi rehta. Super admin ke liye ye restriction nahi hai.
  const isOwnUpdate =
    !isSuperAdmin &&
    (update.adminName ?? "").trim().toLowerCase() === (admin?.name ?? "").trim().toLowerCase();

  const submit = async () => {
    if (!action || saving) return;
    if (isOwnUpdate) return setError("Aap apne hi update ko review nahi kar sakte.");
    if (action.requireNote && note.trim().length < 5) {
      return setError("Wajah / summary likho (kam se kam 5 characters).");
    }
    const record: ReviewRecord = {
      key,
      state: action.state,
      note: note.trim(),
      reviewedBy: admin?.email ?? "",
      reviewedByName: admin?.name ?? "",
      reviewedByRole: admin?.role ?? "sub_admin",
      reviewedAt: new Date().toISOString(),
    };
    setSaving(true);
    setError("");
    try {
      const records = await writeReview(record, {
        entity: update.entity ?? "loan",
        applicationId: update.applicationId,
        updateId: update.id,
        slug: update.slug,
        updateAdminId: update.adminId,
        updateAdminName: update.adminName,
      });
      showToast(`${adminLabel(update.adminName)} ka update — ${REVIEW_STATE_META[action.state].label}.`);
      onSaved(records);
    } catch (err) {
      setError(getApiErrorMessage(err, "Review save nahi hua. Dobara try karo."));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const records = await clearReview(key);
      showToast("Review state cleared — update wapas queue me hai.");
      onSaved(records);
    } catch (err) {
      setError(getApiErrorMessage(err, "Review clear nahi hua."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-1.5" style={{ background: BRAND_GRADIENT }} />

        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800">Review update</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {adminLabel(update.adminName)} · {update.label}
              {update.applicationNo ? ` · ${update.applicationNo}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Update being reviewed */}
        <div className="mx-6 mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded bg-white px-1.5 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">
              {kindLabel(update.kind)}
            </span>
            {update.customerName && (
              <span className="truncate font-medium text-slate-700">{update.customerName}</span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-slate-400">
              <Clock3 size={11} /> {formatDateTime(update.addedAt)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {update.text || `${kindLabel(update.kind)} added`}
          </p>
          {update.suggestedStatus && (
            <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
              Suggested status: {update.suggestedStatus}
            </p>
          )}
        </div>

        {/* Existing review */}
        {existing && (
          <div className="mx-6 mt-3 rounded-xl border border-slate-100 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${REVIEW_STATE_META[existing.state].chip}`}
              >
                {REVIEW_STATE_META[existing.state].label}
              </span>
              <span className="text-[10px] text-slate-400">
                {adminLabel(existing.reviewedByName)} · {formatDateTime(existing.reviewedAt)}
              </span>
            </div>
            {existing.note && (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{existing.note}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pt-4">
          {allowed.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              Aapke paas review ki koi permission nahi hai. Super admin se
              &quot;Review&quot; permission maango.
            </p>
          ) : (
            <>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Action</p>
              <div className="flex flex-wrap gap-1.5">
                {allowed.map((entry) => {
                  const active = state === entry.state;
                  const Icon = ACTION_ICONS[entry.state as Exclude<ReviewState, "pending">];
                  return (
                    <button
                      key={entry.state}
                      type="button"
                      onClick={() => {
                        setState(entry.state);
                        setError("");
                      }}
                      aria-pressed={active}
                      title={entry.hint}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        active
                          ? "border-[rgb(6,106,156)] bg-[rgba(6,106,156,0.06)] text-[rgb(6,106,156)] ring-1 ring-[rgba(6,106,156,0.25)]"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <Icon size={13} />
                      {entry.label}
                    </button>
                  );
                })}
              </div>
              {action && <p className="mt-1.5 text-[11px] text-slate-400">{action.hint}</p>}

              <label className="mt-3 block text-sm font-semibold text-slate-700">
                Note {action?.requireNote ? <span className="text-rose-500">*</span> : "(optional)"}
              </label>
              <textarea
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setError("");
                }}
                rows={3}
                placeholder={
                  state === "returned"
                    ? "Kya galat hai / kya correction chahiye…"
                    : state === "escalated"
                      ? "Super admin ke liye summary — kya risk hai…"
                      : "Verification note…"
                }
                className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-[rgb(6,106,156)] focus:outline-none focus:ring-2 focus:ring-[rgba(6,106,156,0.2)]"
              />
            </>
          )}

          {isOwnUpdate && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              Ye update aapne hi add kiya hai — self-review allowed nahi hai.
            </p>
          )}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <div>
            {existing && (
              <button
                type="button"
                onClick={reset}
                className="text-[11px] font-semibold text-slate-500 transition hover:text-slate-700"
              >
                Clear review
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={allowed.length === 0 || isOwnUpdate || saving}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: BRAND_GRADIENT }}
            >
              {saving ? "Saving…" : "Save review"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewDialog;
