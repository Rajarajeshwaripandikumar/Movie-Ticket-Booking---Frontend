// src/pages/AdminShowtimes.jsx — Walmart Style (clean, rounded, blue accents)
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
  <Tag
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

function Field({ as = "input", icon: Icon, className = "", ...props }) {
  const C = as;
  return (
    <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
      {Icon ? <Icon className="h-4 w-4 text-slate-700" /> : null}
      <C
        {...props}
        className={`w-full outline-none bg-transparent text-sm sm:text-base ${className}`}
      />
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

  /* ----------------------------- Helper: fetch ----------------------------- */
  async function tryFetchCandidates(candidates = []) {
    for (const ep of candidates) {
      try {
        const res = await api.get(ep);
        const payload = res?.data;
        if (Array.isArray(payload)) return payload;
        if (payload && typeof payload === "object") {
          const arr = Object.values(payload).find((v) => Array.isArray(v));
          if (arr) return arr;
        }
      } catch (_) {}
    }
    return [];
  }

  /* --------------------- Initial load based on role/token ------------------ */
  useEffect(() => {
    const r = role?.toLowerCase();
    const allowed =
      r === "admin" || r === "super_admin" || r === "theatre_admin";

    if (token && allowed) {
      loadMovies();
      loadTheaters();
    } else {
      setMovies([]);
      setTheaters([]);
      setScreens([]);
      setShowtimes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  /* ----------------------------- Load Movies ------------------------------- */
  async function loadMovies() {
    try {
      // baseURL already includes /api, so don't prefix with /api again
      const candidates = ["/movies", "/admin/movies"];
      const list = await tryFetchCandidates(candidates);
      setMovies(list);
      if (list?.length) {
        setMovieId((p) => p || list[0]._id || list[0].id || "");
      }
    } catch (err) {
      console.error("loadMovies error", err);
      setMsg("Failed to load movies.");
      setMsgType("error");
    }
  }

  /* ---------------------------- Load Theaters ------------------------------ */
  async function loadTheaters() {
    try {
      const candidates = ["/admin/theaters", "/theaters"];
      const list = await tryFetchCandidates(candidates);
      setTheaters(list);
      if (list?.length) {
        const first = list[0];
        const firstId = first._id || first.id || "";
        setTheaterId((p) => p || firstId);
        setCity((p) => p || first.city || first.location || "");
        if (firstId) {
          await loadScreensForTheater(firstId);
          await loadShowtimes(firstId); // load showtimes for the first theater
        }
      }
    } catch (err) {
      console.error("loadTheaters error", err);
      setMsg("Failed to load theaters.");
      setMsgType("error");
    }
  }

  /* ------------------------- Load Screens for Theater ---------------------- */
  async function loadScreensForTheater(id) {
    setScreens([]);
    setScreenId("");
    setRows(null);
    setCols(null);
    if (!id) return;

    try {
      const candidates = [
        `/admin/theaters/${id}/screens`,
        `/theaters/${id}/screens`,
      ];
      const list = await tryFetchCandidates(candidates);
      setScreens(list);
      if (list?.length) {
        const first = list[0];
        const firstId = first._id || first.id || "";
        setScreenId((p) => p || firstId);
        deriveRowsColsFromScreen(first);
      }
    } catch (err) {
      console.error("loadScreensForTheater error", err);
      setMsg("Failed to load screens.");
      setMsgType("error");
    }
  }

  function deriveRowsColsFromScreen(scr) {
    if (!scr) return;
    const r = scr.rows ?? scr.seatRows ?? scr.numRows ?? null;
    const c = scr.cols ?? scr.columns ?? scr.seatCols ?? scr.numCols ?? null;
    setRows(r);
    setCols(c);
  }

  /* ---------------------------- Load Showtimes ----------------------------- */
  async function loadShowtimes(theaterOverride) {
    try {
      const tId = theaterOverride || theaterId;
      let list = [];

      if (tId) {
        // matches backend: GET /api/showtimes/theaters/:id
        const res = await api.get(`/showtimes/theaters/${tId}`);
        list = Array.isArray(res.data) ? res.data : [];
      } else {
        // fallback: scoped to logged-in theatre user
        try {
          const resScoped = await api.get("/showtimes/my-theatre");
          list = Array.isArray(resScoped.data) ? resScoped.data : [];
        } catch {
          const res = await api.get("/showtimes");
          list = Array.isArray(res.data) ? res.data : [];
        }
      }

      setShowtimes(list);

      if (list?.length) {
        const first = list[0];
        setShowtimeId((p) => p || first._id || first.id || "");
        const st = first.startTime || first.date || null;
        if (st) setStartTime(toLocalDatetimeInputValue(st));
      }
    } catch (err) {
      console.error("loadShowtimes error", err);
      setMsg("Failed to load showtimes.");
      setMsgType("error");
    }
  }

  /* ---------------------- Datetime formatting helpers ---------------------- */
  function toLocalDatetimeInputValue(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* ----------------------------- Select Showtime --------------------------- */
  function handleSelectShowtime(id) {
    setShowtimeId(id);
    const st = showtimes.find((s) => s._id === id || s.id === id);
    if (st) {
      setStartTime(toLocalDatetimeInputValue(st.startTime || st.date));
      setBasePrice(st.basePrice ?? 200);
      setCity(st.theater?.city ?? st.city ?? "");
      if (st.screen) setScreenId(st.screen._id ?? st.screen);
      if (st.theater) setTheaterId(st.theater._id ?? st.theater);
    }
  }

  /* ----------------------------- Create Showtime --------------------------- */
  async function createShowtime(e) {
    e.preventDefault();
    if (!movieId || !theaterId || !screenId || !startTime) {
      setMsg("Movie, theater, screen, and start time are required.");
      setMsgType("error");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        movie: movieId,
        theater: theaterId, // 🔥 required by backend
        screen: screenId,
        startTime: new Date(startTime).toISOString(),
        basePrice: Number(basePrice),
        // rows/cols/city are derived in backend from Screen/Theater
      };

      // backend mount: /api/showtimes -> baseURL(/api) + "/showtimes"
      await api.post("/showtimes", payload);

      setMsg("Showtime created successfully!");
      setMsgType("success");
      await loadShowtimes(theaterId);
    } catch (err) {
      console.error("createShowtime error", err);
      setMsg(err?.response?.data?.message || "Failed to create showtime");
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------ Patch Showtime --------------------------- */
  async function patchShowtime(e) {
    e.preventDefault();
    if (!showtimeId) {
      setMsg("Select a showtime to update.");
      setMsgType("error");
      return;
    }
    setLoading(true);
    try {
      const iso = new Date(startTime).toISOString();

      await api.patch(`/showtimes/${showtimeId}`, { startTime: iso });

      setMsg("Showtime updated successfully!");
      setMsgType("success");
      await loadShowtimes(theaterId);
    } catch (err) {
      console.error("patchShowtime error", err);
      setMsg(err?.response?.data?.message || "Failed to update showtime");
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------- Theater / Screen change ---------------------- */
  function handleTheaterChange(id) {
    setTheaterId(id);
    const th = theaters.find((t) => String(t._id || t.id) === String(id));
    setCity(th?.city || th?.location || "");
    loadScreensForTheater(id);
    loadShowtimes(id);
  }

  function handleScreenChange(id) {
    setScreenId(id);
    const scr = screens.find((s) => String(s._id || s.id) === String(id));
    deriveRowsColsFromScreen(scr);
  }

  /* -------------------------------- Render -------------------------------- */
  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8 px-4 md:px-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <Card className="p-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <CalendarClock className="h-6 w-6" /> Manage Showtimes
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Create, update, and organize theater schedules.
            </p>
          </div>
          <SecondaryBtn onClick={() => loadShowtimes(theaterId)}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </SecondaryBtn>
        </Card>

        {/* Message banner */}
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
            <Field
              as="select"
              value={movieId}
              onChange={(e) => setMovieId(e.target.value)}
              icon={Film}
            >
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
                    {t.name} — {t.city || t.location}
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
                  const c =
                    s.cols ?? s.columns ?? s.seatCols ?? s.numCols ?? "";
                  return (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.name} {r && c ? `(${r}x${c})` : ""}
                    </option>
                  );
                })}
            </Field>

            <Field
              value={city}
              readOnly
              placeholder="City auto-selected from theater"
            />

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

            {/* Hidden derived fields (not needed by backend, but kept for possible future use) */}
            <input type="hidden" name="rows" value={rows ?? ""} />
            <input type="hidden" name="cols" value={cols ?? ""} />

            <div className="flex items-center justify-end">
              <PrimaryBtn disabled={loading}>
                {loading ? "Creating…" : <>Create Showtime</>}
              </PrimaryBtn>
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
                    {(s.movie?.title || s.movie?.name) ?? "Movie"} —{" "}
                    {s.city || s.theater?.city} —{" "}
                    {s.startTime
                      ? new Date(s.startTime).toLocaleString()
                      : "N/A"}{" "}
                    — ₹{s.basePrice}
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
              <PrimaryBtn disabled={loading}>
                {loading ? "Updating…" : "Update Showtime"}
              </PrimaryBtn>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
