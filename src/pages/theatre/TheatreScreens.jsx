// src/pages/theatre/TheatreScreens.jsx — resilient + CRUD (polished)
// - defensive probing endpoints
// - optimistic updates with rollback
// - loading UX, validation, accessibility
import React, { useEffect, useState, useCallback, useRef } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { Navigate } from "react-router-dom";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-4 ${className}`}>{children}</div>
);

/* ------------------------------ helpers ------------------------------ */
const A = (x) => (Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : []);
const idOf = (x) => x?._id ?? x?.id ?? x?.uuid ?? "";
const rowsOf = (x) => x?.rows ?? x?.seatRows ?? x?.numRows ?? x?.rowsCount ?? "";
const colsOf = (x) => x?.cols ?? x?.columns ?? x?.seatCols ?? x?.numCols ?? x?.colsCount ?? "";

function decodeJwt(t) {
  try {
    if (!t) return {};
    const p = String(t).split(".")[1];
    return p ? JSON.parse(atob(p)) : {};
  } catch {
    return {};
  }
}

async function tryGet(endpoints = []) {
  for (const ep of endpoints.filter(Boolean)) {
    try {
      const r = await api.get(ep);
      return r?.data ?? r;
    } catch {
      /* continue */
    }
  }
  return undefined;
}
async function tryPost(endpoints = [], body = {}) {
  for (const ep of endpoints.filter(Boolean)) {
    try {
      const r = await api.post(ep, body);
      return r?.data ?? r;
    } catch {
      /* continue */
    }
  }
  throw new Error("Create endpoint not found");
}
async function tryPatchPut(endpoints = [], body = {}) {
  for (const ep of endpoints.filter(Boolean)) {
    try {
      const r = await api.patch(ep, body);
      return r?.data ?? r;
    } catch {
      try {
        const r2 = await api.put(ep, body);
        return r2?.data ?? r2;
      } catch {
        /* continue */
      }
    }
  }
  throw new Error("Update endpoint not found");
}
async function tryDelete(endpoints = []) {
  for (const ep of endpoints.filter(Boolean)) {
    try {
      await api.delete(ep);
      return true;
    } catch {
      /* continue */
    }
  }
  throw new Error("Delete endpoint not found");
}

/* ------------------------------ Component ------------------------------ */
export default function TheatreScreens() {
  const { token, adminToken, user, isTheatreAdmin } = useAuth() || {};
  const activeToken = adminToken || token || null;

  const payload = decodeJwt(activeToken);
  const theatreId =
    user?.theatreId ||
    user?.theaterId ||
    user?.theatre?._id ||
    user?.theatre?.id ||
    user?.theater?._id ||
    user?.theater?.id ||
    payload?.theatreId ||
    payload?.theaterId ||
    "";

  const [screens, setScreens] = useState([]);
  const [name, setName] = useState("");
  const [rows, setRows] = useState(8);
  const [cols, setCols] = useState(12);

  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editRows, setEditRows] = useState("");
  const [editCols, setEditCols] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadScreens = useCallback(async () => {
    if (!activeToken || !isTheatreAdmin || !theatreId) {
      setScreens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const ts = Date.now();
      const data =
        (await tryGet([
          `/theatre/screens?ts=${ts}`,
          `/admin/theaters/${theatreId}/screens?ts=${ts}`,
          `/theaters/${theatreId}/screens?ts=${ts}`,
        ])) || [];

      const list = A(data).map((s) => ({
        ...s,
        _id: idOf(s),
        rows: rowsOf(s),
        cols: colsOf(s),
      }));
      if (mountedRef.current) setScreens(list);
    } catch (err) {
      console.error("loadScreens error", err);
      if (mountedRef.current) {
        setMsgType("error");
        setMsg("Failed to load screens");
        setScreens([]);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [activeToken, isTheatreAdmin, theatreId]);

  useEffect(() => {
    loadScreens();
  }, [loadScreens]);

  const resetFlash = useCallback(() => {
    setTimeout(() => {
      if (mountedRef.current) setMsg("");
    }, 3000);
  }, []);

  const createScreen = useCallback(
    async (e) => {
      e?.preventDefault();
      if (saving) return;
      // validation
      if (!name?.trim() || !Number(rows) || !Number(cols)) {
        setMsgType("error");
        setMsg("Name, rows and cols are required.");
        resetFlash();
        return;
      }

      setSaving(true);
      setMsg("");
      // optimistic: append provisional item
      const provisional = {
        _id: `tmp-${Date.now()}`,
        name: name.trim(),
        rows: Number(rows),
        cols: Number(cols),
        provisional: true,
      };
      const prev = [...screens];
      setScreens((s) => [provisional, ...s]);

      try {
        await tryPost(
          [
            `/theatre/screens`,
            `/admin/theaters/${theatreId}/screens`,
            `/theaters/${theatreId}/screens`,
          ],
          { name: name.trim(), rows: Number(rows), cols: Number(cols), theatreId, theaterId: theatreId }
        );
        setName("");
        setRows(8);
        setCols(12);
        setMsgType("success");
        setMsg("Screen created");
        await loadScreens();
      } catch (err) {
        console.error("createScreen err", err);
        setScreens(prev);
        setMsgType("error");
        setMsg(err?.response?.data?.message || err.message || "Failed to create screen");
      } finally {
        setSaving(false);
        resetFlash();
      }
    },
    [name, rows, cols, theatreId, screens, saving, loadScreens, resetFlash]
  );

  function startEdit(s) {
    setEditId(s._id);
    setEditName(s.name || "");
    setEditRows(rowsOf(s) || "");
    setEditCols(colsOf(s) || "");
    setMsg("");
  }
  function cancelEdit() {
    setEditId("");
    setEditName("");
    setEditRows("");
    setEditCols("");
  }

  const saveEdit = useCallback(async () => {
    if (saving) return;
    if (!editId) return;
    if (!editName?.trim() || !Number(editRows) || !Number(editCols)) {
      setMsgType("error");
      setMsg("All fields required to update.");
      resetFlash();
      return;
    }

    setSaving(true);
    setMsg("");
    const prev = [...screens];
    setScreens((xs) => xs.map((x) => ((x._id || x.id) === editId ? { ...x, name: editName.trim(), rows: Number(editRows), cols: Number(editCols) } : x)));

    try {
      await tryPatchPut(
        [
          `/theatre/screens/${editId}`,
          `/admin/theaters/${theatreId}/screens/${editId}`,
          `/theaters/${theatreId}/screens/${editId}`,
        ],
        { name: editName.trim(), rows: Number(editRows), cols: Number(editCols), columns: Number(editCols) }
      );
      setMsgType("success");
      setMsg("Screen updated");
      cancelEdit();
      await loadScreens();
    } catch (err) {
      console.error("saveEdit err", err);
      setScreens(prev);
      setMsgType("error");
      setMsg(err?.response?.data?.message || err.message || "Failed to update screen");
    } finally {
      setSaving(false);
      resetFlash();
    }
  }, [editId, editName, editRows, editCols, theatreId, screens, loadScreens, saving, resetFlash]);

  const removeScreen = useCallback(
    async (id) => {
      if (saving) return;
      if (!id) return;
      if (!window.confirm("Delete this screen? This cannot be undone.")) return;

      setSaving(true);
      setMsg("");
      const prev = [...screens];
      setScreens((s) => s.filter((x) => (x._id || x.id) !== id));

      try {
        await tryDelete([
          `/theatre/screens/${id}`,
          `/admin/theaters/${theatreId}/screens/${id}`,
          `/theaters/${theatreId}/screens/${id}`,
        ]);
        setMsgType("success");
        setMsg("Screen deleted");
        await loadScreens();
      } catch (err) {
        console.error("delete err", err);
        setScreens(prev);
        setMsgType("error");
        setMsg(err?.response?.data?.message || err.message || "Failed to delete screen");
      } finally {
        setSaving(false);
        resetFlash();
      }
    },
    [screens, theatreId, loadScreens, saving, resetFlash]
  );

  // Guards
  if (!activeToken) return <Navigate to="/admin/login" replace />;
  if (!isTheatreAdmin) {
    return <div className="p-8 text-center text-rose-600 font-semibold">Access Denied</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-5">
        <Card>
          <h2 className="text-lg font-extrabold text-[#0071DC]">Screens for your theatre</h2>
          <p className="text-sm text-slate-600 mt-1">Create, edit, and delete screens.</p>
        </Card>

        {msg && (
          <Card
            className={`p-3 font-semibold ${
              msgType === "error"
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : msgType === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}
            role="status"
            aria-live="polite"
          >
            {msg}
          </Card>
        )}

        <Card>
          <form onSubmit={createScreen} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end" aria-label="Create screen form">
            <div>
              <label className="text-xs font-semibold block">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border p-2 rounded-xl"
                placeholder="e.g. Screen 1"
                aria-label="Screen name"
              />
            </div>
            <div>
              <label className="text-xs font-semibold block">Rows</label>
              <input
                type="number"
                min="1"
                value={rows}
                onChange={(e) => setRows(e.target.value)}
                className="w-full border p-2 rounded-xl"
                aria-label="Number of rows"
              />
            </div>
            <div>
              <label className="text-xs font-semibold block">Cols</label>
              <input
                type="number"
                min="1"
                value={cols}
                onChange={(e) => setCols(e.target.value)}
                className="w-full border p-2 rounded-xl"
                aria-label="Number of columns"
              />
            </div>

            <div className="sm:col-span-3 mt-2">
              <button
                type="submit"
                className="bg-[#0071DC] text-white rounded-full px-4 py-2 disabled:opacity-50"
                disabled={saving}
                aria-disabled={saving}
              >
                {saving ? "Saving…" : "Create Screen"}
              </button>
            </div>
          </form>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Existing Screens</h3>
          {loading ? (
            <div className="space-y-2">
              <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-slate-200 rounded animate-pulse" />
            </div>
          ) : screens.length === 0 ? (
            <div className="text-sm text-slate-600">No screens found.</div>
          ) : (
            <ul className="space-y-3">
              {screens.map((s) => {
                const sid = idOf(s);
                const isEditing = editId === sid;
                return (
                  <li key={sid} className="p-3 border rounded-xl">
                    {!isEditing ? (
                      <div className="flex justify-between items-center gap-3">
                        <div>
                          <div className="font-semibold">{s.name}</div>
                          <div className="text-xs text-slate-600">
                            {rowsOf(s) || "?"} × {colsOf(s) || "?"}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(s)}
                            className="px-3 py-1 rounded-full border border-slate-300"
                            aria-label={`Edit ${s.name}`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeScreen(sid)}
                            className="px-3 py-1 rounded-full border border-rose-200 text-rose-700"
                            aria-label={`Delete ${s.name}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                        <div>
                          <label className="text-xs font-semibold block">Name</label>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full border p-2 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold block">Rows</label>
                          <input
                            type="number"
                            min="1"
                            value={editRows}
                            onChange={(e) => setEditRows(e.target.value)}
                            className="w-full border p-2 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold block">Cols</label>
                          <input
                            type="number"
                            min="1"
                            value={editCols}
                            onChange={(e) => setEditCols(e.target.value)}
                            className="w-full border p-2 rounded-xl"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="px-4 py-2 rounded-full bg-[#0071DC] text-white disabled:opacity-50"
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-4 py-2 rounded-full border border-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
