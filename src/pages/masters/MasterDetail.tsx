import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Check, Pencil, RefreshCw, Trash2, Undo2, X } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import ValueListEditor from "../../components/masters/ValueListEditor";
import GroupSwitcher from "../../components/masters/GroupSwitcher";
import { useToast } from "../../context/ToastContext";
import {
  deleteMaster,
  getApiErrorMessage,
  getMaster,
  getMasterByType,
  isGroupedValues,
  replaceBanks,
  updateMasterLabel,
  updateMasterValues,
  type MasterDetail as MasterDetailType,
  type MasterGroupedValues,
  type MasterListValues,
  type MasterValues,
} from "../../api/masters";
import { detectNumeric, isGroupedValid, isListValid } from "../../utils/masterValidation";

const MasterDetail = () => {
  // Reachable two ways: /masters/:id (Mongo id) or /masters/type/:type (stable type key).
  const { id, type } = useParams<{ id?: string; type?: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [master, setMaster] = useState<MasterDetailType | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [valuesDraft, setValuesDraft] = useState<MasterValues | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [savingValues, setSavingValues] = useState(false);

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [labelError, setLabelError] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────────

  const load = () =>
    Promise.resolve()
      .then(() => {
        if (!id && !type) return null;
        return id ? getMaster(id) : getMasterByType(type!);
      })
      .then((data) => {
        if (!data) return;
        setMaster(data);
        setValuesDraft(data.values);
        setSelectedGroup(
          isGroupedValues(data.values) ? Object.keys(data.values)[0] ?? null : null
        );
      })
      .catch((err: unknown) => {
        const anyErr = err as { response?: { status?: number } };
        if (anyErr?.response?.status === 404) {
          setNotFound(true);
        } else {
          setLoadError(getApiErrorMessage(err, "Unable to load this master."));
        }
      });

  // Switching master clears the previous record during render; the effect below
  // only fetches.
  const [seenKey, setSeenKey] = useState<string | null>(id ?? type ?? null);
  const loadKey = id ?? type ?? null;
  if (loadKey !== seenKey) {
    setSeenKey(loadKey);
    setLoadError("");
    setNotFound(false);
    setMaster(null);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const grouped = valuesDraft !== null && isGroupedValues(valuesDraft);

  const isDirty = useMemo(() => {
    if (!master || valuesDraft === null) return false;
    return JSON.stringify(master.values) !== JSON.stringify(valuesDraft);
  }, [master, valuesDraft]);

  const isValid = useMemo(() => {
    if (valuesDraft === null) return false;
    return grouped
      ? isGroupedValid(valuesDraft as MasterGroupedValues)
      : isListValid(valuesDraft as MasterListValues);
  }, [valuesDraft, grouped]);

  const currentGroupList: (string | number)[] =
    grouped && selectedGroup
      ? (valuesDraft as MasterGroupedValues)[selectedGroup] ?? []
      : [];

  const numeric = grouped
    ? detectNumeric(
        currentGroupList,
        master && isGroupedValues(master.values) && selectedGroup
          ? master.values[selectedGroup]
          : undefined
      )
    : detectNumeric(
        valuesDraft as MasterListValues | undefined,
        master?.values as MasterListValues
      );

  // ── Values editing ────────────────────────────────────────────────────────────

  const handleListChange = (next: (string | number)[]) => {
    if (grouped) return;
    setValuesDraft(next);
  };

  const handleGroupListChange = (next: (string | number)[]) => {
    if (!grouped || !selectedGroup || valuesDraft === null) return;
    setValuesDraft({ ...(valuesDraft as MasterGroupedValues), [selectedGroup]: next });
  };

  const handleAddGroup = (name: string): string | void => {
    if (!grouped || valuesDraft === null) return;
    const obj = valuesDraft as MasterGroupedValues;
    const exists = Object.keys(obj).some((k) => k.toLowerCase() === name.toLowerCase());
    if (exists) return `Group "${name}" already exists`;
    setValuesDraft({ ...obj, [name]: [] });
    setSelectedGroup(name);
  };

  const handleDeleteGroup = (name: string) => {
    if (!grouped || valuesDraft === null) return;
    const obj = { ...(valuesDraft as MasterGroupedValues) };
    delete obj[name];
    setValuesDraft(obj);
    if (selectedGroup === name) {
      setSelectedGroup(Object.keys(obj)[0] ?? null);
    }
  };

  const discardChanges = () => {
    if (!master) return;
    setValuesDraft(master.values);
    setSelectedGroup(
      isGroupedValues(master.values) ? Object.keys(master.values)[0] ?? null : null
    );
  };

  const saveValues = async () => {
    if (!master || valuesDraft === null || !isValid) return;
    setSavingValues(true);
    try {
      // Banks master uses dedicated PUT /masters/banks endpoint
      if (master.type === "banks") {
        await replaceBanks(valuesDraft as string[]);
        setMaster(prev => prev ? { ...prev, values: valuesDraft } : prev);
        setValuesDraft(valuesDraft);
      } else {
        const updated = await updateMasterValues(master._id, valuesDraft);
        setMaster(updated);
        setValuesDraft(updated.values);
      }
      showToast("Values saved", "success");
    } catch (err) {
      showToast(getApiErrorMessage(err, "Unable to save values."), "error");
    } finally {
      setSavingValues(false);
    }
  };

  // ── Label editing ─────────────────────────────────────────────────────────────

  const startEditLabel = () => {
    if (!master) return;
    setLabelDraft(master.label);
    setLabelError("");
    setIsEditingLabel(true);
  };

  const saveLabel = async () => {
    if (!master) return;
    const trimmed = labelDraft.trim();
    if (!trimmed) { setLabelError("Label is required"); return; }
    if (trimmed.length > 100) { setLabelError("Max 100 characters"); return; }
    if (trimmed === master.label) { setIsEditingLabel(false); return; }
    setSavingLabel(true);
    try {
      const updated = await updateMasterLabel(master._id, trimmed);
      setMaster((prev) =>
        prev ? { ...prev, label: updated.label, updatedAt: updated.updatedAt } : updated
      );
      setIsEditingLabel(false);
      showToast("Label updated", "success");
    } catch (err) {
      setLabelError(getApiErrorMessage(err, "Unable to update label."));
    } finally {
      setSavingLabel(false);
    }
  };

  // ── Delete master ─────────────────────────────────────────────────────────────

  const handleDeleteMaster = async () => {
    if (!master) return;
    setIsDeleting(true);
    try {
      await deleteMaster(master._id);
      showToast(`"${master.label}" deleted`, "success");
      navigate("/masters");
    } catch (err) {
      showToast(getApiErrorMessage(err, "Unable to delete this master."), "error");
      setIsDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <Link
        to="/masters"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 mb-4 transition"
      >
        <ArrowLeft size={15} />
        Back to Masters
      </Link>

      {notFound ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <p className="text-base font-semibold text-slate-700">Master not found</p>
          <p className="text-sm text-slate-400">
            This master may have been deleted. Go back and select another.
          </p>
          <Link
            to="/masters"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-slate-300 hover:bg-slate-50 transition"
          >
            <ArrowLeft size={14} />
            Back to Masters
          </Link>
        </div>

      ) : loadError ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <p className="text-sm text-red-600">{loadError}</p>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-slate-300 hover:bg-slate-50 transition"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>

      ) : !master || valuesDraft === null ? (
        <div className="space-y-3">
          <div className="h-8 w-64 rounded-md bg-slate-100 animate-pulse" />
          <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
        </div>

      ) : (
        <>
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-5">
            <div style={{ height: "3px", background: "linear-gradient(90deg, #066a9c, #26ae90, #f2f231)" }} />
            <div className="p-5">
              {isEditingLabel ? (
                <div className="flex items-start gap-2 max-w-md">
                  <div className="flex-1">
                    <input
                      autoFocus
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveLabel()}
                      className={`w-full rounded-md border px-3 py-2 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-[rgba(0,102,153,0.4)] ${
                        labelError ? "border-red-400" : "border-slate-300"
                      }`}
                    />
                    {labelError && <p className="text-xs text-red-600 mt-1">{labelError}</p>}
                  </div>
                  <button
                    onClick={saveLabel}
                    disabled={savingLabel}
                    aria-label="Save label"
                    className="p-2 rounded-md text-white disabled:opacity-60 hover:brightness-110 transition"
                    style={{ background: "linear-gradient(135deg, rgb(6, 106, 156), rgb(38, 174, 144))" }}
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setIsEditingLabel(false)}
                    disabled={savingLabel}
                    aria-label="Cancel"
                    className="p-2 rounded-md text-slate-500 hover:bg-slate-100 transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold" style={{ color: "rgb(0, 102, 153)" }}>
                    {master.label}
                  </h2>
                  <button
                    onClick={startEditLabel}
                    aria-label="Edit label"
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {master.type}
                </code>
                <span className="text-xs text-slate-400">
                  {grouped ? "Grouped list" : "Flat list"} · updated{" "}
                  {new Date(master.updatedAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Values editor */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-5">
            {grouped ? (
              <div className="flex flex-col sm:flex-row gap-4">
                <GroupSwitcher
                  groups={Object.keys(valuesDraft as MasterGroupedValues)}
                  selected={selectedGroup}
                  onSelect={setSelectedGroup}
                  onAddGroup={handleAddGroup}
                  onDeleteGroup={handleDeleteGroup}
                  disabled={savingValues}
                />
                <div className="flex-1 min-w-0">
                  {selectedGroup ? (
                    <>
                      <p className="text-sm font-medium text-slate-700 mb-3">{selectedGroup}</p>
                      <ValueListEditor
                        values={currentGroupList}
                        onChange={handleGroupListChange}
                        numeric={numeric}
                        disabled={savingValues}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-slate-400 italic py-16 text-center border border-dashed border-slate-200 rounded-lg">
                      Add a group on the left to get started.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <ValueListEditor
                values={valuesDraft as MasterListValues}
                onChange={handleListChange}
                numeric={numeric}
                disabled={savingValues}
              />
            )}
          </div>

          {/* Save bar */}
          {isDirty && (
            <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 bg-white border border-slate-200 shadow-lg rounded-xl px-5 py-3 mb-5">
              <p className="text-sm text-slate-600">
                {isValid ? "You have unsaved changes." : "Fix the highlighted errors before saving."}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={discardChanges}
                  disabled={savingValues}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition disabled:opacity-60"
                >
                  <Undo2 size={14} />
                  Discard
                </button>
                <button
                  onClick={saveValues}
                  disabled={savingValues || !isValid}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                  style={{ background: "linear-gradient(135deg, rgb(6, 106, 156), rgb(38, 174, 144))" }}
                >
                  {savingValues ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Danger zone */}
          <div className="bg-white rounded-xl border border-red-200 p-5">
            <h3 className="text-sm font-semibold text-red-700 mb-1">Danger Zone</h3>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-slate-500">
                Permanently delete this master and all of its values.
              </p>
              <button
                onClick={() => setPendingDelete(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-md transition"
              >
                <Trash2 size={15} />
                Delete Master
              </button>
            </div>
          </div>
        </>
      )}

      {pendingDelete && master && (
        <ConfirmDialog
          title={`Delete "${master.label}"?`}
          message="This list may still be used by the public loan application forms. Deleting it can break dropdowns that rely on it. This cannot be undone."
          confirmText={master.type}
          confirmLabel="Delete Master"
          isSubmitting={isDeleting}
          onConfirm={handleDeleteMaster}
          onCancel={() => setPendingDelete(false)}
        />
      )}
    </AdminLayout>
  );
};

export default MasterDetail;
