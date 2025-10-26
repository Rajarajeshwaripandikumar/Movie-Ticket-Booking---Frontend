// src/pages/AdminShowtimes.jsx — vertical stack enforced with local CSS override
import { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import {
  Film,
  Building2,
  LayoutGrid,
  CalendarClock,
  CircleDollarSign,
  RefreshCcw,
  PlusCircle,
  PencilLine,
} from "lucide-react";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`admin-card bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ as = "input", icon: Icon, className = "", ...props }) {
  const C = as;
  return (
    <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
      {Icon ? <Icon className="h-4 w-4 text-slate-700" /> : null}
      <C {...props} className={`w-full outline-none bg-transparent text-sm sm:text-base ${className}`} />
    </div>
  );
}

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
function SecondaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* --------------------------------- Logic ---------------------------------- */
export default function AdminShowtimes() {
  const { token, role } = useAuth() || {};
  const [movies, setMovies] = useState([]);
  const [theaters, setTheaters] = useState([]);
  const [screens, setScreens] = useState([]);
  const [showtimes, setShowtimes] = useState([]);

  const [movieId, setMovieId] = useState("");
  const [theaterId, setTheaterId] = useState("");
  const [screenId, setScreenId] = useState("");
  const [city, setCity] = useState("");
  const [startTime, setStartTime] = useState("");
  const [basePrice, setBasePrice] = useState(200);

  const [rows, setRows] = useState(null);
  const [cols, setCols] = useState(null);

  const [showtimeId, setShowtimeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  /* Try multiple candidate endpoints and return the first array of items found */
  async function tryFetchCandidates(candidates = []) {
    for (const ep of candidates) {
      try {
        const res = await api.get(ep);
        const payload = res?.data;
        if (Array.isArray(payload)) return payload;
        if (payload && typeof payload === "object") {
          if (Array.isArray(payload.data)) return payload.data;
          for (const key of Object.keys(payload)) {
            if (Array.isArray(payload[key])) return payload[key];
          }
        }
      } catch (_) {}
    }
    return [];
  }

  useEffect(() => {
    if (token && role?.toLowerCase() === "admin") {
      loadMovies();
      loadTheaters();
      loadShowtimes();
    } else {
      setMovies([]); setTheaters([]); setShowtimes([]); setScreens([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  async function loadMovies() {
    try {
      const candidates = ["/movies", "/admin/movies", "/api/movies", "/movies/admin/list"];
      const list = await tryFetchCandidates(candidates);
      setMovies(list);
      if (list?.length) setMovieId((p) => p || list[0]._id || list[0].id || "");
    } catch (err) {
      console.error("loadMovies error", err);
      setMsg("Failed to load movies."); setMsgType("error");
    }
  }

  async function loadTheaters() {
    try {
      const candidates = ["/admin/theaters", "/theaters", "/api/theaters", "/theaters/admin/list"];
      const list = await tryFetchCandidates(candidates);
      setTheaters(list);
      if (list?.length) {
        const first = list[0];
        const firstId = first._id || first.id || "";
        setTheaterId((p) => p || firstId);
        setCity((p) => p || first.city || first.location || "");
        if (firstId) await loadScreensForTheater(firstId);
      }
    } catch (err) {
      console.error("loadTheaters error", err);
      setMsg("Failed to load theaters."); setMsgType("error");
    }
  }

  async function loadScreensForTheater(id) {
    setScreens([]); setScreenId(""); setRows(null); setCols(null);
    if (!id) return;
    try {
      const candidates = [
        `/admin/theaters/${id}/screens`,
        `/theaters/${id}/screens`,
        `/api/theaters/${id}/screens`,
        `/screens?theaterId=${id}`,
      ];
      const list = await tryFetchCandidates(candidates);
      setScreens(list);
      if (list?.length) {
        const first = list[0];
        setScreenId((p) => p || first._id || first.id || "");
        deriveRowsColsFromScreen(first);
      }
    } catch (err) {
      console.error("loadScreensForTheater error", err);
      setMsg("Failed to load screens."); setMsgType("error");
    }
  }

  function deriveRowsColsFromScreen(scr) {
    if (!scr) return;
    const r = scr.rows ?? scr.seatRows ?? scr.numRows ?? null;
    const c = scr.cols ?? scr.columns ?? scr.seatCols ?? scr.numCols ?? null;
    setRows(r); setCols(c);
  }

  async function loadShowtimes() {
    try {
      const candidates = ["/admin/showtimes", "/showtimes", "/api/showtimes", "/showtimes/admin/list"];
      const list = await tryFetchCandidates(candidates);
      setShowtimes(list);
      if (list?.length) {
        setShowtimeId((p) => p || list[0]._id || list[0].id || "");
        const st = list[0].startTime || list[0].date || list[0].datetime || null;
        if (st) setStartTime(toLocalDatetimeInputValue(st));
      }
    } catch (err) {
      console.error("loadShowtimes error", err);
      setMsg("Failed to load showtimes."); setMsgType("error");
    }
  }

  function toLocalDatetimeInputValue(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function handleSelectShowtime(id) {
    setShowtimeId(id);
    const st = showtimes.find((s) => s._id === id || s.id === id);
    if (st) {
      setStartTime(toLocalDatetimeInputValue(st.startTime ?? st.date ?? st.datetime));
      setBasePrice(st.basePrice ?? st.amount ?? 200);
      setCity(st.theater?.city ?? st.city ?? "");
      if (st.screen) setScreenId(st.screen._id ?? st.screen);
      if (st.theater) setTheaterId(st.theater._id ?? st.theater);
      if (st.movie) setMovieId(st.movie._id ?? st.movie);
    }
  }

  async function createShowtime(e) {
    e.preventDefault();
    if (!movieId || !screenId || !city || !startTime) {
      setMsg("Movie, screen, city, and start time are required.");
      setMsgType("error");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        movie: movieId,
        screen: screenId,
        city,
        startTime: new Date(startTime).toISOString(),
        basePrice: Number(basePrice),
        rows: rows ?? undefined,
        cols: cols ?? undefined,
      };

      const createCandidates = ["/admin/showtimes", "/showtimes", "/api/showtimes", "/showtimes/admin"];
      let created = false;
      for (const ep of createCandidates) {
        try {
          await api.post(ep, payload);
          created = true;
          break;
        } catch (_) {}
      }
      if (!created) throw new Error("Create endpoint not found");

      setMsg("Showtime created successfully!"); setMsgType("success");
      await loadShowtimes();
    } catch (err) {
      console.error("createShowtime error", err);
      setMsg(err?.response?.data?.message || "Failed to create showtime"); setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  async function patchShowtime(e) {
    e.preventDefault();
    if (!showtimeId) return setMsg("Select a showtime to update.");
    setLoading(true);
    try {
      const iso = new Date(startTime).toISOString();
      const candidates = [
        `/admin/showtimes/${showtimeId}`,
        `/showtimes/${showtimeId}`,
        `/api/showtimes/${showtimeId}`,
      ];
      let patched = false;
      for (const ep of candidates) {
        try {
          await api.patch(ep, { startTime: iso });
          patched = true;
          break;
        } catch (_) {}
      }
      if (!patched) throw new Error("Update endpoint not found");

      setMsg("Showtime updated successfully!"); setMsgType("success");
      await loadShowtimes();
    } catch (err) {
      console.error("patchShowtime error", err);
      setMsg(err?.response?.data?.message || "Failed to update showtime"); setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  function handleTheaterChange(id) {
    setTheaterId(id);
    const th = theaters.find((t) => String(t._id || t.id) === String(id));
    setCity(th?.city || th?.location || "");
    loadScreensForTheater(id);
  }

  function handleScreenChange(id) {
    setScreenId(id);
    const scr = screens.find((s) => String(s._id || s.id) === String(id));
    deriveRowsColsFromScreen(scr);
  }

  /* -------------------------------- Render -------------------------------- */
  return (
    <main className="admin-showtimes-root min-h-screen bg-slate-50 text-slate-900 py-8 px-4 md:px-6">
      {/* Local CSS override to force vertical stacking & full width of cards.
          We keep this small and scoped to .admin-showtimes-root so it won't leak. */}
      <style>{`
        .admin-showtimes-root .stack { display: flex !important; flex-direction: column !important; gap: 1.5rem !important; }
        .admin-showtimes-root .admin-card { display: block !important; width: 100% !important; }
      `}</style>

      <div className="w-full max-w-5xl mx-auto stack">
        {/* Header */}
        <Card className="p-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <CalendarClock className="h-6 w-6" /> Manage Showtimes
            </h1>
            <p className="text-sm text-slate-600 mt-1">Create, update, and organize theater schedules.</p>
          </div>
          <SecondaryBtn onClick={loadShowtimes}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </SecondaryBtn>
        </Card>

        {/* Message */}
        {msg && (
          <Card
            className={`p-3 font-semibold ${
              msgType === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : msgType === "error"
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}
          >
            {msg}
          </Card>
        )}

        {/* CREATE SHOWTIME */}
        <Card className="p-5">
          <h2 className="text-lg font-extrabold border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
            <PlusCircle className="h-5 w-5" /> Create Showtime
          </h2>

          <form onSubmit={createShowtime} className="space-y-3">
            <Field as="select" value={movieId} onChange={(e) => setMovieId(e.target.value)} icon={Film}>
              <option value="">-- Select Movie --</option>
              {Array.isArray(movies) &&
                movies.map((m) => (
                  <option key={m._id || m.id} value={m._id || m.id}>
                    {m.title || m.name}
                  </option>
                ))}
            </Field>

            <Field
              as="select"
              value={theaterId}
              onChange={(e) => handleTheaterChange(e.target.value)}
              icon={Building2}
            >
              <option value="">-- Select Theater --</option>
              {Array.isArray(theaters) &&
                theaters.map((t) => (
                  <option key={t._id || t.id} value={t._id || t.id}>
                    {t.name} — {t.city || t.location || ""}
                  </option>
                ))}
            </Field>

            <Field
              as="select"
              value={screenId}
              onChange={(e) => handleScreenChange(e.target.value)}
              icon={LayoutGrid}
              disabled={!theaterId}
            >
              <option value="">-- Select Screen --</option>
              {Array.isArray(screens) &&
                screens.map((s) => {
                  const r = s.rows ?? s.seatRows ?? s.numRows ?? "";
                  const c = s.cols ?? s.columns ?? s.seatCols ?? s.numCols ?? "";
                  return (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.name} {r && c ? `(${r}x${c})` : ""}
                    </option>
                  );
                })}
            </Field>

            <Field value={city} readOnly placeholder="City auto-selected from theater" />

            <Field
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              icon={CalendarClock}
            />

            <Field
              type="number"
              placeholder="Base Price"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              icon={CircleDollarSign}
              min="0"
              step="1"
            />

            <input type="hidden" name="rows" value={rows ?? ""} />
            <input type="hidden" name="cols" value={cols ?? ""} />

            <div className="flex items-center justify-end">
              <PrimaryBtn disabled={loading}>{loading ? "Creating…" : "Create Showtime"}</PrimaryBtn>
            </div>
          </form>
        </Card>

        {/* UPDATE SHOWTIME */}
        <Card className="p-5">
          <h2 className="text-lg font-extrabold border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
            <PencilLine className="h-5 w-5" /> Update Showtime
          </h2>

          <form onSubmit={patchShowtime} className="space-y-3">
            <Field
              as="select"
              value={showtimeId}
              onChange={(e) => handleSelectShowtime(e.target.value)}
              icon={CalendarClock}
            >
              <option value="">-- Select Showtime --</option>
              {Array.isArray(showtimes) &&
                showtimes.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {(s.movie?.title || s.movie?.name || (s.movie && String(s.movie)) || "Movie")} — {s.city || ""} —{" "}
                    {s.startTime ? new Date(s.startTime).toLocaleString() : s.date ? new Date(s.date).toLocaleString() : "—"} — ₹{s.basePrice ?? s.amount ?? ""}
                  </option>
                ))}
            </Field>

            <Field
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              icon={CalendarClock}
            />

            <div className="flex items-center justify-end">
              <PrimaryBtn disabled={loading}>{loading ? "Updating…" : "Update Showtime"}</PrimaryBtn>
            </div>
          </form>
        </Card>

        {/* EXISTING SHOWTIMES */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-3">Existing Showtimes</h3>
          {loading ? (
            <div>Loading...</div>
          ) : showtimes.length === 0 ? (
            <div className="text-slate-600">No showtimes found</div>
          ) : (
            <div className="space-y-3">
              {showtimes.map((s) => {
                const movieTitle =
                  (s.movie && (s.movie.title || s.movie.name)) ||
                  (typeof s.movie === "string" ? s.movie : "Unknown movie");
                const theaterName = (s.theater && (s.theater.name || s.theater.title)) || s.city || "";
                const start = s.startTime || s.date || s.datetime || "";
                return (
                  <div key={s._id || s.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3">
                    <div>
                      <div className="font-semibold">{movieTitle}</div>
                      <div className="text-sm text-slate-600">
                        {theaterName} • {s.screen?.name || s.screen || "screen"} • {start ? new Date(start).toLocaleString() : "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <SecondaryBtn
                        onClick={() => {
                          handleSelectShowtime(s._id || s.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Edit
                      </SecondaryBtn>
                      <SecondaryBtn
                        onClick={async () => {
                          if (!window.confirm("Delete this showtime?")) return;
                          try {
                            const id = s._id || s.id;
                            const candidates = [`/admin/showtimes/${id}`, `/showtimes/${id}`, `/api/showtimes/${id}`];
                            let deleted = false;
                            for (const ep of candidates) {
                              try {
                                await api.delete(ep);
                                deleted = true;
                                break;
                              } catch (_) {}
                            }
                            if (!deleted) throw new Error("Delete endpoint not found");
                            setMsg("Showtime deleted"); setMsgType("success");
                            await loadShowtimes();
                          } catch (err) {
                            console.error("delete showtime error", err);
                            setMsg("Delete failed"); setMsgType("error");
                          }
                        }}
                      >
                        Delete
                      </SecondaryBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
