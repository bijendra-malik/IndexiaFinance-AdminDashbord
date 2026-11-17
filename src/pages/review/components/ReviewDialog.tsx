import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { updateLoanStatusBySlug, type LoanStatus } from "../../../api/personalLoans";
import { ENTITY_META, reviewEntity } from "../../../constants/entityMeta";
import { adminLabel, formatDateTime, roleLabel } from "../../../utils/auditFormat";
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

/** Backend ka suggested status hi loan ka real status banega (`Rejected` etc.). */
const LOAN_STATUSES: LoanStatus[] = ["Pending", "Approved", "Rejected", "Submitted"];
const toLoanStatus = (value: string | null): LoanStatus | null => {
  if (!value) return null;
  const wanted = value.trim().toLowerCase();
  return LOAN_STATUSES.find((status) => status.toLowerCase() === wanted) ?? null;
};

/**
 * Record ka full-detail route — notifications.ts ke targetForUpdate() jaisa hi
 * rule, taaki super admin ek hi jagah se poori application / customer /
 * franchise khol sake aur sirf review note par nahi atke.
 */
const detailTarget = (update: AdminActivityUpdate): { path: string; label: string } | null => {
  const entity = reviewEntity(update.entity);
  const recordId = update.entityId || update.applicationId;

  if (entity === "loan") {
    return update.slug && recordId
      ? { path: `/applications/${update.slug}/${recordId}`, label: "Open loan application" }
      : null;
  }
  if (entity === "customer") {
    return recordId
      ? { path: `/customers?customer=${encodeURIComponent(recordId)}`, label: "Open customer" }
      : null;
  }
  return recordId ? { path: `/franchises/${recordId}`, label: "Open franchise" } : null;
};

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
  const navigate = useNavigate();

  const key = reviewKey(update);
  const entityKind = reviewEntity(update.entity);
  const target = detailTarget(update);

  /*
  Actor line: agar backend ka `adminName` khud role ka naam hai ("Super Admin"),
  to wahi role chip me dikhta hai — naam dobara print karke confusion nahi failate.
  */
  const actorName = adminLabel(update.adminName);
  const actorRole = roleLabel(update.adminRole) || "Normal admin";
  const actorNameIsRole = actorName.trim().toLowerCase() === actorRole.toLowerCase();
  const reviewerName = existing ? adminLabel(existing.reviewedByName) : "";
  const reviewerRole = roleLabel(existing?.reviewedByRole) || "Sub admin";
  const reviewerNameIsRole = reviewerName.trim().toLowerCase() === reviewerRole.toLowerCase();
  const entity = ENTITY_META[entityKind];
  /*
  `loans.decide` sirf loan application par lagti hai. Customer / franchise row
  par ye action backend se 403 deta hai, isliye button dikhana hi nahi chahiye.
  */
  const isLoanUpdate = entityKind === "loan";
  const allowed = REVIEW_ACTIONS.filter(
    (action) =>
      can(action.permission) &&
      (action.permission !== "loans.decide" || isLoanUpdate)
  );
  /*
  Pehle hamesha pehla action (Verify) select hota tha — "Returned" dikhne ke baad
  bhi Save dabane par state chup-chaap badal jaati thi. Ab jo review pehle se hai
  wahi select rehta hai.
  */
  const [state, setState] = useState<ReviewState>(
    existing && allowed.some((entry) => entry.state === existing.state)
      ? existing.state
      : (allowed[0]?.state ?? "verified")
  );
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
    if (isOwnUpdate) return setError("You cannot review your own update.");
    if (action.requireNote && note.trim().length < 5) {
      return setError("Please add a reason (at least 5 characters).");
    }
    /*
    "Record decision" ka matlab sirf review note nahi — loan ka asli status badalna
    hai. Pehle sirf POST /reviews hota tha, isliye suggested "Rejected" ke baad bhi
    application "Submitted" hi rehti thi. Ab status endpoint bhi chalta hai.
    */
    const decisionStatus = action.state === "decided" ? toLoanStatus(update.suggestedStatus) : null;
    if (action.state === "decided" && isLoanUpdate) {
      if (!decisionStatus) {
        return setError(
          "This update has no suggested status (Approved / Rejected), so the loan status cannot be changed."
        );
      }
      if (!update.slug || !update.applicationId) {
        return setError("Loan type or application ID is missing — status cannot be updated.");
      }
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
      if (decisionStatus && update.slug && update.applicationId) {
        await updateLoanStatusBySlug(
          update.slug,
          update.applicationId,
          decisionStatus,
          note.trim()
        );
      }
      const records = await writeReview(record, {
        entity: update.entity ?? "loan",
        applicationId: update.applicationId,
        updateId: update.id,
        slug: update.slug,
        updateAdminId: update.adminId,
        updateAdminName: update.adminName,
      });
      showToast(
        `${actorName} (${actorRole}) — ${REVIEW_STATE_META[action.state].label}${
          decisionStatus ? ` · loan marked ${decisionStatus}` : ""
        }.`
      );
      onSaved(records);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save the review. Please try again."));
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
      showToast("Review cleared — this update is back in the queue.");
      onSaved(records);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not clear the review."));
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
              {entity.label}
              {update.applicationNo ? ` · ${update.applicationNo}` : ""}
              {entityKind === "loan" && update.label ? ` · ${update.label}` : ""}
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
            <span
              className={`rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide ring-1 ${entity.chip}`}
            >
              {entity.label}
            </span>
            {entityKind === "loan" && (
              <span className="rounded bg-white px-1.5 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">
                {update.label}
              </span>
            )}
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
          {/* Kaun bola — naam ke saath role, taaki normal admin / sub admin /
              super admin ka farq message me hi saaf ho. */}
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
            <span>Added by</span>
            {!actorNameIsRole && <span className="font-semibold text-slate-600">{actorName}</span>}
            <span className="rounded bg-white px-1.5 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">
              {actorRole}
            </span>
          </p>
          {update.suggestedStatus && (
            <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
              Suggested status: {update.suggestedStatus}
            </p>
          )}

          {/* Full record — review note padhne ke baad hi picture clear hoti hai. */}
          {target && (
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(target.path);
              }}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[rgb(6,106,156)] transition hover:border-[rgba(6,106,156,0.35)] hover:bg-[rgba(6,106,156,0.05)]"
            >
              {target.label}
              <ArrowUpRight size={12} />
            </button>
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
              <span className="flex flex-wrap items-center justify-end gap-1 text-[10px] text-slate-400">
                {!reviewerNameIsRole && (
                  <span className="font-semibold text-slate-600">{reviewerName}</span>
                )}
                <span className="rounded bg-white px-1.5 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">
                  {reviewerRole}
                </span>
                <span>· {formatDateTime(existing.reviewedAt)}</span>
              </span>
            </div>
            {existing.note && (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{existing.note}</p>
            )}
            {allowed.length > 0 && (
              <p className="mt-1.5 text-[10px] text-slate-400">
                Saving again replaces this review — Clear review puts the update back in the
                queue.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pt-4">
          {allowed.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              You do not have review permission yet. Ask the super admin to enable it for
              this account.
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
                    ? "What is wrong and what needs to be corrected?"
                    : state === "escalated"
                      ? "Summary for the super admin — what is the risk?"
                      : "Optional verification note…"
                }
                className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-[rgb(6,106,156)] focus:outline-none focus:ring-2 focus:ring-[rgba(6,106,156,0.2)]"
              />
            </>
          )}

          {isOwnUpdate && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              You added this update — it cannot be reviewed by you.
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
              {saving ? "Saving…" : existing ? "Update review" : "Save review"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewDialog;
