// src/pages/theatre/TheatreScreens.jsx — resilient + CRUD
import React, { useEffect, useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { Navigate } from "react-router-dom";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-4 ${className}`}>{children}</div>
);

// helpers
const A = (x) => (Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : []);
const idOf = (x) => x?._id ?? x?.id ?? x?.uuid ?? "";
const rowsOf = (x) => x?.rows ?? x?.seatRows ?? x?.numRows ?? "";
const colsOf = (x) => x?.cols ?? x?.columns ?? x?.seatCols ?? x?.numCols ?? "";

function decodeJwt(t) {
  try {
    return JSON.parse(atob(String(t ?? "").split(".")[1])) || {};
  } catch {
    return {};
  }
}

async function tryGet(endpoints) {
  for (const ep of endpoints.filter(Boolean)) {
    try {
      const r = await api.get(ep);
      return r?.data ?? r;
    } catch {}
  }
  return undefined;
}
async function tryPost(endpoints, body) {
  for (const ep of endpoints.filter(Boolean)) {
    try {
      const r = await api.post(ep, body);
      return r?.data ?? r;
    } catch {}
  }
  throw new Error("Create endpoint not found");
}
async function tryPatchPut(endpoints, body) {
  // try PATCH then PUT
  for (const ep of endpoints.filter(Boolean)) {
    try {
      const r = await api.patch(ep, body);
      return r?.data ?? r;
    } catch {
      try {
        const r2 = await api.put(ep, body);
        return r2?.data ?? r2;
      } catch {}
    }
  }
  throw new Error("Update endpoint not found");
}
async function tryDelete(endpoints) {
  for (const ep of endpoints.filter(Boolean)) {
    try {
      await api.delete(ep);
      return true;
    } catch {}
  }
  throw new Error("Delete endpoint not found");
}

export default function TheatreScreens() {
  const { token, adminToken, user, isTheatreAdmin } = useAuth() || {};
  const activeToken = adminToken || token || null; // ✅ use admin token if present

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

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  useEffect(() => {
    if (!activeToken || !isTheatreAdmin || !theatreId) return;
    loadScreens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken, isTheatreAdmin, theatreId]);

  async function loadScreens() {
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
      setScreens(list);
    } catch (err) {
      console.error("loadScreens error", err);
      setMsgType("error");
      setMsg("Failed to load screens");
      setScreens([]);
    } finally {
      setLoading(false);
    }
  }

  async function createScreen(e) {
    e?.preventDefault();
    if (!name || !rows || !cols) {
      setMsgType("error");
      setMsg("Name, rows and cols are required.");
      return;
    }
    try {
      const body = { name: name.trim(), rows: Number(rows), cols: Number(cols), columns: Number(cols) };
      await tryPost(
        [
          `/theatre/screens`, // body may need theatreId on some backends
          `/admin/theaters/${theatreId}/screens`,
          `/theaters/${theatreId}/screens`,
        ],
        { ...body, theatreId, theaterId: theatreId }
      );
      setName("");
      setRows(8);
      setCols(12);
      setMsgType("success");
      setMsg("Screen created");
      await loadScreens();
    } catch (err) {
      console.error("createScreen err", err);
      setMsgType("error");
      setMsg(err?.response?.data?.message || err.message || "Failed to create screen");
    }
  }

  function startEdit(s) {
    setEditId(s._id);
    setEditName(s.name || "");
    setEditRows(rowsOf(s) || "");
    setEditCols(colsOf(s) || "");
  }
  function cancelEdit() {
    setEditId("");
    setEditName("");
    setEditRows("");
    setEditCols("");
  }

  async function saveEdit() {
    if (!editId) return;
    if (!editName || !editRows || !editCols) {
      setMsgType("error");
      setMsg("All fields required to update.");
      return;
    }
    try {
      const body = {
        name: editName.trim(),
        rows: Number(editRows),
        cols: Number(editCols),
        columns: Number(editCols),
      };
      await tryPatchPut(
        [
          `/theatre/screens/${editId}`,
          `/admin/theaters/${theatreId}/screens/${editId}`,
          `/theaters/${theatreId}/screens/${editId}`,
        ],
        body
      );
      setMsgType("success");
      setMsg("Screen updated");
      cancelEdit();
      await loadScreens();
    } catch (err) {
      console.error("saveEdit err", err);
      setMsgType("error");
      setMsg(err?.response?.data?.message || err.message || "Failed to update screen");
    }
  }

  async function removeScreen(id) {
    if (!id) return;
    if (!window.confirm("Delete this screen?")) return;
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
      setMsgType("error");
      setMsg(err?.response?.data?.message || err.message || "Failed to delete screen");
    }
  }

  // ✅ Proper guards
  if (!activeToken) return <Navigate to="/admin/login" replace />;
  if (!isTheatreAdmin) {
    return <div className="p-8 text-center text-rose-600 font-semibold">Access Denied</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-5">
        <Card>
          <h2 className="text-lg font-extrabold text-[#111827]">Screens for your theatre</h2>
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
          >
            {msg}
          </Card>
        )}

        <Card>
          <form onSubmit={createScreen} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs font-semibold">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border p-2 rounded-xl"
                placeholder="e.g. Screen 1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold">Rows</label>
              <input
                type="number"
                min="1"
                value={rows}
                onChange={(e) => setRows(e.target.value)}
                className="w-full border p-2 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold">Cols</label>
              <input
                type="number"
                min="1"
                value={cols}
                onChange={(e) => setCols(e.target.value)}
                className="w-full border p-2 rounded-xl"
              />
            </div>
            <div className="sm:col-span-3 mt-2">
              <button className="bg-[#0071DC] text-white rounded-full px-4 py-2">Create Screen</button>
            </div>
          </form>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Existing Screens</h3>
          {loading ? (
            <div>Loading...</div>
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
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeScreen(sid)}
                            className="px-3 py-1 rounded-full border border-rose-200 text-rose-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                        <div>
                          <label className="text-xs font-semibold">Name</label>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full border p-2 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold">Rows</label>
                          <input
                            type="number"
                            min="1"
                            value={editRows}
                            onChange={(e) => setEditRows(e.target.value)}
                            className="w-full border p-2 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold">Cols</label>
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
                            className="px-4 py-2 rounded-full bg-[#0071DC] text-white"
                          >
                            Save
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
