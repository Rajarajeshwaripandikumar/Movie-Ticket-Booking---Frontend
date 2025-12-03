// src/pages/theatre/TheatreShowtimes.jsx — resilient CRUD (Walmart style)
// - defensive endpoint probing
// - improved UX, accessibility, validation, and stable refresh flows

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { Navigate } from "react-router-dom";

const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-4 ${className}`} {...rest}>
    {children}
  </Tag>
);

/* ------------------------------ helpers ------------------------------ */
const A = (x) =>
  Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : [];

const idOf = (x) => x?._id ?? x?.id ?? x?.uuid ?? "";
const titleOf = (x) => x?.title ?? x?.name ?? x?.movieTitle ?? "Untitled";
const rowsOf = (x) => x?.rows ?? x?.seatRows ?? x?.numRows ?? "";
const colsOf = (x) => x?.cols ?? x?.columns ?? x?.seatCols ?? x?.numCols ?? "";
const cityOf = (t) => t?.city ?? t?.location?.city ?? t?.location ?? "";

function decodeJwt(t) {
  try {
    if (!t) return {};
    const payload = String(t).split(".")[1];
    return payload ? JSON.parse(atob(payload)) : {};
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

/* Convert ISO -> input[type=datetime-local] value in local timezone */
function toLocalDatetimeInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/* ------------------------------ Component ------------------------------ */
export default function TheatreShowtimes() {
  const { token, adminToken, user, isTheatreAdmin } = useAuth() || {};
  const activeToken = adminToken || token || null; // prefer adminToken if present
  const payload = decodeJwt(activeToken);

  const theatreId =
    user?.theatreId ||
    user?.theaterId ||
    user?.theatre?.id ||
    user?.theatre?._id ||
    user?.theater?.id ||
    user?.theater?._id ||
    payload?.theatreId ||
    payload?.theaterId ||
    "";

  const [movies, setMovies] = useState([]);
  const [screens, setScreens] = useState([]);
  const [showtimes, setShowtimes] = useState([]);

  const [movieId, setMovieId] = useState("");
  const [screenId, setScreenId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [basePrice, setBasePrice] = useState(150);

  const [theatre, setTheatre] = useState(null);
  const [editId, setEditId] = useState("");
  const [editStart, setEditStart] = useState("");

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const mountedRef = useRef(true);
  const flashTimeoutRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    document.title = "Manage Showtimes | Theatre";
    return () => {
      mountedRef.current = false;
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
    };
  }, []);

  const city = useMemo(() => cityOf(theatre), [theatre]);

  const refreshAll = useCallback(
    async (opts = {}) => {
      const { keepMsg = false } = opts;
      if (!activeToken || !isTheatreAdmin || !theatreId) return;
      if (!mountedRef.current) return;
      setLoading(true);
      if (!keepMsg) setMsg(""); // don't wipe success/error if caller wants to keep it
      try {
        const ts = Date.now();

        // theatre (for city)
        const tData =
          (await tryGet([
            `/theatre/my?ts=${ts}`,
            `/theatre/me?ts=${ts}`,
            `/theaters/${theatreId}?ts=${ts}`,
            `/admin/theaters/${theatreId}?ts=${ts}`,
          ])) || {};
        const t =
          tData?.theatre || tData?.theater || tData?.data || (typeof tData === "object" ? tData : null);
        if (mountedRef.current) setTheatre(t || null);

        // screens
        const sData =
          (await tryGet([
            `/theatre/screens?ts=${ts}`,
            `/admin/theaters/${theatreId}/screens?ts=${ts}`,
            `/theaters/${theatreId}/screens?ts=${ts}`,
          ])) || [];
        if (mountedRef.current) {
          setScreens(
            A(sData).map((s) => ({
              ...s,
              _id: idOf(s),
              rows: rowsOf(s),
              cols: colsOf(s),
            }))
          );
        }

        // showtimes
        const stData =
          (await tryGet([
            `/theatre/showtimes?theatre=${theatreId}&ts=${ts}`,
            `/admin/showtimes?theatre=${theatreId}&ts=${ts}`,
            `/showtimes?theatre=${theatreId}&ts=${ts}`,
          ])) || [];
        const stItems = A(stData);
        if (mountedRef.current) setShowtimes(stItems);

        // movies: prefer movies endpoint, else derive from showtimes
        const mData =
          (await tryGet([`/theatre/movies?ts=${ts}`, `/admin/movies?ts=${ts}`, `/movies?ts=${ts}`])) || [];
        let mvItems = A(mData);
        if (!mvItems.length && stItems.length) {
          const seen = new Set();
          mvItems = stItems
            .map((st) => {
              const m =
                st.movie && typeof st.movie === "object"
                  ? st.movie
                  : { _id: st.movieId || st.movie, title: st.movieTitle || st.title || "Untitled" };
              const id = idOf(m);
              if (!id || seen.has(id)) return null;
              seen.add(id);
              return { _id: id, title: titleOf(m) };
            })
            .filter(Boolean);
        }
        if (mountedRef.current) setMovies(mvItems);
      } catch (e) {
        console.error("refreshAll error", e);
        if (mountedRef.current) {
          setMsgType("error");
          setMsg(e?.response?.data?.message || "Failed to load showtimes data.");
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [activeToken, isTheatreAdmin, theatreId]
  );

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const resetFlash = useCallback(() => {
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    flashTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setMsg("");
      flashTimeoutRef.current = null;
    }, 3000);
  }, []);

  const createShowtime = useCallback(
    async (e) => {
      e?.preventDefault();
      if (saving) return;
      if (!movieId || !screenId || !startTime) {
        setMsgType("error");
        setMsg("Select movie, screen and start time.");
        resetFlash();
        return;
      }

      setSaving(true);
      setMsg("");
      try {
        const iso = new Date(startTime);
        if (isNaN(iso)) throw new Error("Invalid date/time");
        const isoStr = iso.toISOString();

        const body = {
          movieId,
          screenId,
          movie: movieId,
          screen: screenId,
          theatreId,
          theaterId: theatreId,
          city,
          startTime: isoStr,
          startAt: isoStr,
          price: Number(basePrice),
          basePrice: Number(basePrice),
        };

        await tryPost([`/theatre/showtimes`, `/admin/showtimes`, `/showtimes`], body);

        // refresh list but keep message slot
        await refreshAll({ recent: true, keepMsg: true });

        // show success after refresh
        setMsgType("success");
        setMsg("Showtime created.");
        resetFlash();

        // reset form
        setMovieId("");
        setScreenId("");
        setStartTime("");
        setBasePrice(150);
      } catch (err) {
        console.error("create showtime err", err);
        setMsgType("error");
        setMsg(err?.response?.data?.message || err.message || "Failed to create showtime");
        resetFlash();
      } finally {
        setSaving(false);
      }
    },
    [movieId, screenId, startTime, basePrice, theatreId, city, refreshAll, saving, resetFlash]
  );

  const beginEdit = useCallback((st) => {
    const sid = idOf(st);
    setEditId(sid);
    const when = st.startTime || st.startAt || st.time || st.datetime;
    setEditStart(toLocalDatetimeInputValue(when));
    setMsg("");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditId("");
    setEditStart("");
  }, []);

  const saveEdit = useCallback(
    async () => {
      if (saving) return;
      if (!editId || !editStart) {
        setMsgType("error");
        setMsg("Please select a time.");
        resetFlash();
        return;
      }
      setSaving(true);
      setMsg("");
      try {
        const iso = new Date(editStart);
        if (isNaN(iso)) throw new Error("Invalid date/time");
        const isoStr = iso.toISOString();

        await tryPatchPut(
          [`/theatre/showtimes/${editId}`, `/admin/showtimes/${editId}`, `/showtimes/${editId}`],
          {
            startTime: isoStr,
            startAt: isoStr,
          }
        );

        await refreshAll({ keepMsg: true });

        setMsgType("success");
        setMsg("Showtime updated.");
        resetFlash();
        cancelEdit();
      } catch (err) {
        console.error("update showtime err", err);
        setMsgType("error");
        setMsg(err?.response?.data?.message || err.message || "Failed to update showtime");
        resetFlash();
      } finally {
        setSaving(false);
      }
    },
    [editId, editStart, cancelEdit, refreshAll, saving, resetFlash]
  );

  const removeShowtime = useCallback(
    async (id) => {
      if (saving) return;
      if (!id) return;
      if (!window.confirm("Delete this showtime? This action cannot be undone.")) return;

      setSaving(true);
      setMsg("");
      // optimistic remove locally
      const prev = [...showtimes];
      setShowtimes((s) => s.filter((x) => idOf(x) !== id));

      try {
        await tryDelete([`/theatre/showtimes/${id}`, `/admin/showtimes/${id}`, `/showtimes/${id}`]);

        await refreshAll({ keepMsg: true });

        setMsgType("success");
        setMsg("Showtime deleted.");
        resetFlash();
      } catch (err) {
        console.error("delete showtime err", err);
        setShowtimes(prev);
        setMsgType("error");
        setMsg(err?.response?.data?.message || err.message || "Failed to delete showtime");
        resetFlash();
      } finally {
        setSaving(false);
      }
    },
    [showtimes, refreshAll, saving, resetFlash]
  );

  // Guards
  if (!activeToken) return <Navigate to="/admin/login" replace />;
  if (!isTheatreAdmin) {
    return <div className="p-8 text-center text-rose-600 font-semibold">Access Denied</div>;
  }

  const formValid = Boolean(movieId && screenId && startTime);

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-5">
        <Card>
          <h2 className="text-lg font-extrabold text-[#0071DC]">Create Showtime</h2>
          <form
            onSubmit={createShowtime}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3"
            aria-label="Create showtime form"
          >
            <div>
              <label className="text-xs font-semibold block">Movie</label>
              <select
                value={movieId}
                onChange={(e) => setMovieId(e.target.value)}
                className="w-full border p-2 rounded-xl"
                disabled={loading}
                required
                aria-required="true"
              >
                <option value="">Select movie</option>
                {movies.map((m) => (
                  <option key={idOf(m) || m._id || m.id} value={idOf(m)}>
                    {titleOf(m)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold block">Screen</label>
              <select
                value={screenId}
                onChange={(e) => setScreenId(e.target.value)}
                className="w-full border p-2 rounded-xl"
                disabled={loading}
                required
                aria-required="true"
              >
                <option value="">Select screen</option>
                {screens.map((s) => (
                  <option key={idOf(s)} value={idOf(s)}>
                    {s.name || "Screen"} ({rowsOf(s) || "?"}×{colsOf(s) || "?"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold block">Start time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border p-2 rounded-xl"
                disabled={loading}
                required
                aria-required="true"
              />
            </div>

            <div>
              <label className="text-xs font-semibold block">Base price (₹)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={Number(basePrice)}
                onChange={(e) => setBasePrice(Number(e.target.value || 0))}
                className="w-full border p-2 rounded-xl"
                disabled={loading}
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={!formValid || saving}
                className="bg-[#0071DC] text-white rounded-full px-4 py-2 disabled:opacity-50"
                aria-disabled={!formValid || saving}
                aria-busy={saving}
              >
                {saving ? "Saving..." : "Create Showtime"}
              </button>
            </div>
          </form>
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
          <h3 className="font-semibold mb-3 text-[#0071DC]">Existing Showtimes</h3>
          {loading ? (
            <div className="space-y-2">
              <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-slate-200 rounded animate-pulse" />
            </div>
          ) : showtimes.length === 0 ? (
            <div className="text-sm text-slate-600">No showtimes found.</div>
          ) : (
            <ul className="space-y-3">
              {showtimes.map((s, idx) => {
                const sid = idOf(s);
                const movieTitle =
                  s.movie?.title || s.movie?.name || (typeof s.movie === "string" ? s.movie : titleOf(s));
                const when = s.startTime || s.startAt || s.time || s.datetime || "";
                const price = s.basePrice ?? s.price ?? s.amount ?? "";
                const editing = editId === sid;

                return (
                  <li key={sid || `showtime-temp-${idx}`} className="p-3 border rounded-xl flex flex-col gap-2">
                    {!editing ? (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold">{movieTitle}</div>
                          <div className="text-xs text-slate-600">
                            {when ? new Date(when).toLocaleString() : "—"}
                            {price !== "" ? ` · ₹${price}` : ""}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => beginEdit(s)}
                            className="px-3 py-1 rounded-full border border-slate-300"
                            aria-label={`Edit showtime ${movieTitle}`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeShowtime(sid)}
                            className="px-3 py-1 rounded-full border border-rose-200 text-rose-700"
                            aria-label={`Delete showtime ${movieTitle}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div className="sm:col-span-2">
                          <label className="text-xs font-semibold block">Start time</label>
                          <input
                            type="datetime-local"
                            value={editStart}
                            onChange={(e) => setEditStart(e.target.value)}
                            className="w-full border p-2 rounded-xl"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="px-4 py-2 rounded-full bg-[#0071DC] text-white disabled:opacity-50"
                            aria-busy={saving}
                          >
                            {saving ? "Saving..." : "Save"}
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
