import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ChevronLeft, ChevronRight, Inbox, Mail, MessageSquare, Phone, RefreshCw, Search, Trash2, X,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useToast } from "../../context/ToastContext";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  CONTACT_STATUSES,
  CONTACT_TOPICS,
  deleteContactEnquiry,
  getContactEnquiries,
  updateContactEnquiry,
  type ContactEnquiry,
  type ContactEnquiryList,
  type ContactStatus,
  type ContactStatusFilter,
} from "../../api/contact";

/*
==========================================
Contact enquiries — /contact

Website ke /contact page ka "Send an enquiry" form yahan aata hai:
Full Name, Mobile, Email, "I'm interested in" aur Message. Admin yahan se
status badal sakta hai (new → in-progress → closed), internal note likh sakta
hai aur spam enquiry delete kar sakta hai.
==========================================
*/

const BRAND = "linear-gradient(135deg, rgb(6,106,156), rgb(38,174,144))";
const PAGE_SIZE = 20;

const STATUS_META: Record<ContactStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  "in-progress": {
    label: "In progress",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  closed: { label: "Closed", className: "bg-slate-100 text-slate-600 ring-slate-200" },
};

const dateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

const ContactEnquiries = () => {
  const { showToast } = useToast();

  const [status, setStatus] = useState<ContactStatusFilter>("all");
  const [topic, setTopic] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ContactEnquiryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<ContactEnquiry | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ContactEnquiry | null>(null);

  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      setError("");
      try {
        const result = await getContactEnquiries({
          status,
          topic,
          search,
          page,
          limit: PAGE_SIZE,
        });
        setData(result);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Could not load contact enquiries."));
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [status, topic, search, page]
  );

  /*
  Filter/page badalne par list dobara load hoti hai. setState sirf await ke baad
  hota hai (repo ka pattern — effect ke andar sync setState lint me galat hai),
  isliye spinner filter handlers me on hota hai.
  */
  useEffect(() => {
    let cancelled = false;

    const request = async () => {
      try {
        const result = await getContactEnquiries({
          status,
          topic,
          search,
          page,
          limit: PAGE_SIZE,
        });
        if (cancelled) return;
        setData(result);
        setError("");
      } catch (loadError) {
        if (cancelled) return;
        setError(getApiErrorMessage(loadError, "Could not load contact enquiries."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void request();
    return () => {
      cancelled = true;
    };
  }, [status, topic, search, page]);

  const enquiries = data?.enquiries ?? [];
  const stats = data?.stats ?? { total: 0, new: 0, inProgress: 0, closed: 0 };

  const statusTabs: { value: ContactStatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: stats.total },
    { value: "new", label: "New", count: stats.new },
    { value: "in-progress", label: "In progress", count: stats.inProgress },
    { value: "closed", label: "Closed", count: stats.closed },
  ];

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setSearch(searchInput.trim());
  };

  const changeStatus = async (enquiry: ContactEnquiry, next: ContactStatus) => {
    if (enquiry.status === next) return;
    setBusyId(enquiry.id);
    try {
      const updated = await updateContactEnquiry(enquiry.id, { status: next });
      setData((current) =>
        current
          ? {
              ...current,
              enquiries: current.enquiries.map((row) =>
                row.id === updated.id ? updated : row
              ),
            }
          : current
      );
      setSelected((current) => (current && current.id === updated.id ? updated : current));
      showToast(`Marked as ${STATUS_META[next].label.toLowerCase()}`, "success");
      void load(false);
    } catch (updateError) {
      showToast(getApiErrorMessage(updateError, "Could not update the enquiry."), "error");
    } finally {
      setBusyId("");
    }
  };

  const saveNote = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateContactEnquiry(selected.id, { note });
      setSelected(updated);
      setNote(updated.note);
      setData((current) =>
        current
          ? {
              ...current,
              enquiries: current.enquiries.map((row) =>
                row.id === updated.id ? updated : row
              ),
            }
          : current
      );
      showToast("Note saved", "success");
    } catch (saveError) {
      showToast(getApiErrorMessage(saveError, "Could not save the note."), "error");
    } finally {
      setSaving(false);
    }
  };

  const removeEnquiry = async (enquiry: ContactEnquiry) => {
    setBusyId(enquiry.id);
    try {
      await deleteContactEnquiry(enquiry.id);
      setPendingDelete(null);
      setSelected((current) => (current && current.id === enquiry.id ? null : current));
      showToast("Enquiry deleted", "success");
      /* Page ki aakhri row delete hui ho to pichle page par jaao, warna khaali page dikhta hai. */
      if (enquiries.length === 1 && page > 1) {
        setLoading(true);
        setPage((current) => Math.max(1, current - 1));
      } else {
        void load();
      }
    } catch (deleteError) {
      showToast(getApiErrorMessage(deleteError, "Could not delete the enquiry."), "error");
    } finally {
      setBusyId("");
    }
  };

  const openEnquiry = (enquiry: ContactEnquiry) => {
    setSelected(enquiry);
    setNote(enquiry.note);
  };

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ background: BRAND }}
          >
            <MessageSquare size={19} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Contact enquiries</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Website ke contact form se aayi enquiries — name, mobile, email, product aur message.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          {statusTabs.map((tab) => {
            const isActive = status === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setLoading(true);
                  setPage(1);
                  setStatus(tab.value);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[rgb(6,106,156)] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                    isActive ? "bg-white/20" : "bg-white text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}

          <select
            value={topic}
            onChange={(event) => {
              setLoading(true);
              setPage(1);
              setTopic(event.target.value);
            }}
            aria-label="Filter by product"
            className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[rgb(6,106,156)]"
          >
            <option value="all">All products</option>
            {CONTACT_TOPICS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <form onSubmit={submitSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={13}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name, email, mobile, message"
                className="w-56 rounded-lg border border-slate-200 py-1.5 pr-2.5 pl-8 text-xs text-slate-800 outline-none focus:border-[rgb(6,106,156)]"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[rgb(6,106,156)] hover:text-[rgb(6,106,156)]"
            >
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setSearch("");
                  setSearchInput("");
                  setPage(1);
                }}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <X size={12} /> Clear
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {error && (
          <p className="border-b border-rose-100 bg-rose-50 px-5 py-2.5 text-sm text-rose-700">
            {error}
          </p>
        )}

        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">Loading enquiries…</p>
        ) : enquiries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Inbox size={20} />
            </span>
            <p className="text-sm font-semibold text-slate-700">No enquiries yet</p>
            <p className="max-w-sm text-xs leading-relaxed text-slate-400">
              Jab koi website ke contact form se enquiry bhejega, wo yahan aayegi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5">Contact</th>
                  <th className="px-4 py-2.5">Mobile</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Interested in</th>
                  <th className="px-4 py-2.5">Message</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enquiries.map((enquiry) => (
                  <tr key={enquiry.id} className="align-top transition hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ background: BRAND }}
                          aria-hidden
                        >
                          {initialsOf(enquiry.name)}
                        </span>
                        <span className="min-w-0">
                          <button
                            type="button"
                            onClick={() => openEnquiry(enquiry)}
                            className="block max-w-[13rem] truncate text-left font-semibold text-slate-800 hover:text-[rgb(6,106,156)] hover:underline"
                          >
                            {enquiry.name || "Unnamed"}
                          </button>
                          <span className="block text-[11px] text-slate-400">
                            {dateTime(enquiry.receivedAt)}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      <a href={`tel:${enquiry.mobile}`} className="hover:underline">
                        {enquiry.mobile || "—"}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${enquiry.email}`}
                        className="block max-w-[14rem] truncate text-slate-600 hover:underline"
                        title={enquiry.email}
                      >
                        {enquiry.email || "—"}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[rgba(6,106,156,0.08)] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[rgb(6,106,156)]">
                        {enquiry.topic}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p
                        className="line-clamp-2 max-w-[20rem] text-slate-600"
                        title={enquiry.message}
                      >
                        {enquiry.message || "—"}
                      </p>
                      {enquiry.note && (
                        <span className="mt-0.5 block text-[11px] text-amber-700">
                          Note: {enquiry.note}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={enquiry.status}
                        onChange={(event) =>
                          void changeStatus(enquiry, event.target.value as ContactStatus)
                        }
                        disabled={busyId === enquiry.id}
                        aria-label={`Status for ${enquiry.name || "enquiry"}`}
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ring-1 outline-none ${STATUS_META[enquiry.status].className}`}
                      >
                        {CONTACT_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {STATUS_META[value].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEnquiry(enquiry)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-[rgb(6,106,156)] hover:text-[rgb(6,106,156)]"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(enquiry)}
                          title="Delete enquiry"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(data?.pages ?? 1) > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
            <span>
              {data?.total ?? 0} enquiries · page {data?.page ?? 1} of {data?.pages ?? 1}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setPage((current) => Math.max(1, current - 1));
                }}
                disabled={(data?.page ?? 1) <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40"
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setPage((current) => Math.min(data?.pages ?? 1, current + 1));
                }}
                disabled={(data?.page ?? 1) >= (data?.pages ?? 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40"
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/30"
          onClick={() => setSelected(null)}
        >
          <aside
            className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Contact enquiry
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                  {selected.name || "Unnamed"}
                </h2>
                <p className="text-xs text-slate-400">
                  {dateTime(selected.receivedAt)} · {selected.source}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </header>

            <div className="mt-4 space-y-2 text-sm">
              <a
                href={`tel:${selected.mobile}`}
                className="flex items-center gap-2 text-slate-700 hover:text-[rgb(6,106,156)]"
              >
                <Phone size={14} className="text-slate-400" />
                {selected.mobile || "—"}
              </a>
              <a
                href={`mailto:${selected.email}`}
                className="flex items-center gap-2 break-all text-slate-700 hover:text-[rgb(6,106,156)]"
              >
                <Mail size={14} className="shrink-0 text-slate-400" />
                {selected.email || "—"}
              </a>
              <p className="flex items-center gap-2 text-slate-700">
                <MessageSquare size={14} className="text-slate-400" />
                <span className="rounded-full bg-[rgba(6,106,156,0.08)] px-2 py-0.5 text-[11px] font-semibold text-[rgb(6,106,156)]">
                  {selected.topic}
                </span>
              </p>
            </div>

            <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Message
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                {selected.message || "—"}
              </p>
            </section>

            <section className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Status
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CONTACT_STATUSES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => void changeStatus(selected, value)}
                    disabled={busyId === selected.id}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition disabled:opacity-50 ${
                      selected.status === value
                        ? STATUS_META[value].className
                        : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {STATUS_META[value].label}
                  </button>
                ))}
              </div>
              {selected.handledByName && (
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Last handled by {selected.handledByName} · {dateTime(selected.handledAt)}
                </p>
              )}
            </section>

            <section className="mt-4">
              <label
                htmlFor="contact-note"
                className="text-[10px] font-bold uppercase tracking-widest text-slate-400"
              >
                Internal note (customer ko nahi dikhta)
              </label>
              <textarea
                id="contact-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="e.g. Call kiya, 3 baje callback maanga"
                className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-[rgb(6,106,156)]"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">{note.length}/1000</span>
                <button
                  type="button"
                  onClick={() => void saveNote()}
                  disabled={saving || note === selected.note}
                  className="rounded-lg bg-[rgb(6,106,156)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save note"}
                </button>
              </div>
            </section>

            <button
              type="button"
              onClick={() => setPendingDelete(selected)}
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:underline"
            >
              <Trash2 size={13} /> Delete this enquiry
            </button>
          </aside>
        </div>
      )}

      {/* Delete confirm */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">Delete this enquiry?</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {pendingDelete.name || "Unnamed"} · {pendingDelete.mobile || pendingDelete.email}
              <br />
              Ye permanently delete ho jaayegi, wapas nahi aayegi.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void removeEnquiry(pendingDelete)}
                disabled={busyId === pendingDelete.id}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {busyId === pendingDelete.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default ContactEnquiries;
