import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Database, ListTree, Plus, Trash2 } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PageHeader from "../../components/common/PageHeader";
import SearchBar from "../../components/common/SearchBar";
import { TableCard, TableEmpty, TableError, TableSkeleton, Th } from "../../components/common/TableShell";
import NewMasterModal from "../../components/masters/NewMasterModal";
import { useToast } from "../../context/ToastContext";
import { deleteMaster, getApiErrorMessage, getMasters, type MasterSummary } from "../../api/masters";
import { isLocationMasterType } from "../../constants/masterTypes";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const MastersList = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [masters, setMasters]           = useState<MasterSummary[] | null>(null);
  const [error, setError]               = useState("");
  const [search, setSearch]             = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MasterSummary | null>(null);
  const [isDeleting, setIsDeleting]     = useState(false);

  const load = async () => {
    setError("");
    try {
      const list = await getMasters();
      setMasters(list.filter((m) => !isLocationMasterType(m.type)));
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load masters."));
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    if (!masters) return [];
    const q = search.trim().toLowerCase();
    return !q ? masters : masters.filter(
      (m) => m.label.toLowerCase().includes(q) || m.type.toLowerCase().includes(q)
    );
  }, [masters, search]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteMaster(pendingDelete._id);
      setMasters((prev) => prev?.filter((m) => m._id !== pendingDelete._id) ?? prev);
      showToast(`"${pendingDelete.label}" deleted`, "success");
      setPendingDelete(null);
    } catch (err) {
      showToast(getApiErrorMessage(err, "Unable to delete this master."), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <PageHeader
        icon={Database} title="Bank Details"
        subtitle="Manage bank dropdown lists used in loan application forms."
        onRefresh={load} refreshing={masters === null && !error}
        actions={
          <button onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition"
            style={{ background: "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))" }}>
            <Plus size={16} /> New Master
          </button>
        }
      />

      <TableCard>
        <SearchBar
          value={search} onChange={setSearch}
          onSubmit={() => {/* client-side — instant */}}
          onClear={() => setSearch("")}
          placeholder="Search masters…"
          showClear={!!search}
        />

        {error ? (
          <TableError message={error} onRetry={() => void load()} />
        ) : masters === null ? (
          <TableSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <TableEmpty
            icon={Database}
            title={masters.length === 0 ? "No bank masters yet" : "No masters match your search"}
            description={masters.length === 0 ? "Create the first one with the button above." : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                  <Th>Label</Th><Th>Type Key</Th><Th>Kind</Th>
                  <Th>Values</Th><Th>Updated</Th><Th right>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((m) => (
                  <tr key={m._id} onClick={() => navigate(`/masters/type/${encodeURIComponent(m.type)}`)}
                    className="cursor-pointer transition hover:bg-slate-50 group">
                    <td className="px-4 py-3 font-medium text-slate-800 group-hover:text-sky-700">{m.label}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{m.type}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.kind === "grouped" ? "bg-purple-50 text-purple-700" : "bg-sky-50 text-sky-700"}`}>
                        {m.kind === "grouped" ? <><ListTree size={12} /> Grouped</> : <><Database size={12} /> List</>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.count} {m.kind === "grouped" ? "groups" : "items"}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(m.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button onClick={(e) => { e.stopPropagation(); setPendingDelete(m); }}
                          aria-label={`Delete ${m.label}`}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>

      {showNewModal && (
        <NewMasterModal
          onClose={() => setShowNewModal(false)}
          onCreated={(master) => {
            setShowNewModal(false);
            showToast(`"${master.label}" created`, "success");
            navigate(`/masters/type/${encodeURIComponent(master.type)}`);
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.label}"?`}
          message="This list may still be used by loan application forms. Deleting it can break dropdowns. This cannot be undone."
          confirmText={pendingDelete.type} confirmLabel="Delete Master"
          isSubmitting={isDeleting} onConfirm={handleDelete} onCancel={() => setPendingDelete(null)}
        />
      )}
    </AdminLayout>
  );
};

export default MastersList;
