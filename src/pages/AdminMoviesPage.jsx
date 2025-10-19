
// ------------------------------------------------------------------
// File: src/pages/AdminMovies.jsx (updated)
import React, { useEffect, useRef, useState } from "react";
import api from "../api/api";

/* --------------------------- Walmart primitives --------------------------- */
const BLUE = "#0071DC";
const BLUE_DARK = "#0654BA";

const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ as = "input", className = "", ...props }) {
  const C = as;
  return (
    <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
      <C {...props} className={`w-full outline-none bg-transparent text-sm sm:text-base ${className}`} />
    </div>
  );
}

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[${BLUE}] hover:bg-[${BLUE_DARK}] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[${BLUE}] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[${BLUE}] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------- Inline Default Poster -------------------------- */
const DEFAULT_POSTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='120' height='170'>
      <rect width='100%' height='100%' fill='#e5e7eb'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
            font-family='Arial' font-size='14' fill='#6b7280'>No Image</text>
    </svg>
  `);

/* -------------------------- Backend base URL -------------------------- */
const API_BASE = import.meta.env.VITE_API_BASE || "https://movie-ticket-booking-backend-o1m2.onrender.com/api";
const FILES_BASE = API_BASE.replace(/\/api\/?$/, "");

/* ----------------------------- Helpers -------------------------------- */
function resolvePosterUrl(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `${FILES_BASE}${url}`;
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Normalize movie from API into UI-friendly shape */
function normalizeMovie(m = {}) {
  const title = m.title || "";
  const synopsis = m.synopsis ?? m.description ?? "";
  const runtime = m.runtime ?? m.durationMins ?? "";
  const releaseDate = m.releaseDate ?? "";
  const genresArr = Array.isArray(m.genres)
    ? m.genres
    : Array.isArray(m.genre)
    ? m.genre
    : toArray(m.genre || "");
  const genresStr = genresArr.join(", ");
  const languages = Array.isArray(m.languages) ? m.languages : toArray(m.languages ?? m.language ?? "");
  const cast = Array.isArray(m.cast)
    ? m.cast.map((c) => (typeof c === "string" ? { actorName: c } : c))
    : [];
  const crew = Array.isArray(m.crew)
    ? m.crew.map((c) =>
        c && typeof c === "object"
          ? { name: c.name || c.actorName || "", role: c.role || c.job || "" }
          : { name: String(c || ""), role: "" }
      )
    : [];

  return {
    ...m,
    title,
    synopsis,
    runtime,
    genresStr,
    releaseDate,
    languages,
    cast,
    crew,
    posterUrl: m.posterUrl || m.poster || "",
  };
}

/* ------------------------- Movie Form Component ------------------------- */
function MovieForm({ initial = {}, onCancel, onSave, isSaving = false }) {
  const norm = normalizeMovie(initial);
  const [form, setForm] = useState({
    title: norm.title,
    synopsis: norm.synopsis,
    runtime: norm.runtime,
    genresStr: norm.genresStr,
    releaseDate: norm.releaseDate,
    posterUrl: norm.posterUrl,
  });
  const [languages, setLanguages] = useState(norm.languages);
  const [cast, setCast] = useState(
    norm.cast.map((c) => ({ actorName: c.actorName || c.name || "", character: c.character || "" }))
  );
  const [crew, setCrew] = useState(
    norm.crew.map((c) => ({ name: c.name || "", role: c.role || c.job || "" }))
  );
  const [posterFile, setPosterFile] = useState(null);
  const [preview, setPreview] = useState(norm.posterUrl ? resolvePosterUrl(norm.posterUrl) : "");
  const [saving, setSaving] = useState(false);

  const change = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  /* ----------------------- Handle File Selection ----------------------- */
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    console.log("handleFile selected:", file);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Only JPG, PNG, or WEBP allowed.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert("Max file size 3MB.");
      return;
    }
    setPosterFile(file);
    setPreview(URL.createObjectURL(file));
  };

  /* -------------------------- Submit Form -------------------------- */
  const submit = async (e) => {
    e.preventDefault();
    console.log("submit called, posterFile:", posterFile);

    const data = new FormData();
    data.append("title", form.title);
    data.append("description", form.synopsis ?? "");
    data.append("durationMins", form.runtime !== "" ? Number(form.runtime) : "");
    data.append("genre", form.genresStr || "");
    data.append("releaseDate", form.releaseDate || "");
    data.append("languages", (languages || []).map((x) => String(x).trim()).filter(Boolean).join(","));
    data.append("cast", JSON.stringify((cast || []).filter((c) => (c?.actorName || "").trim())));
    data.append("crew", JSON.stringify((crew || []).filter((c) => (c?.name || "").trim())));

    if (posterFile) {
      data.append("image", posterFile);
      console.log("Appended image:", posterFile.name, posterFile.type, posterFile.size);
    } else if (form.posterUrl) {
      data.append("posterUrl", form.posterUrl);
      console.log("No new file, keeping old posterUrl:", form.posterUrl);
    } else {
      console.log("No image or posterUrl provided.");
    }

    try {
      setSaving(true);
      await onSave(data);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* --- form fields same as before --- */}
      <div>
        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Title</label>
        <Field required value={form.title} onChange={change("title")} />
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Synopsis</label>
        <Field as="textarea" rows={3} value={form.synopsis} onChange={change("synopsis")} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1">Runtime (min)</label>
          <Field type="number" value={String(form.runtime ?? "")} onChange={change("runtime")} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1">Genres (comma)</label>
          <Field value={form.genresStr ?? ""} onChange={change("genresStr")} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1">Release Date</label>
          <Field
            type="date"
            value={form.releaseDate ? String(form.releaseDate).slice(0, 10) : ""}
            onChange={change("releaseDate")}
          />
        </div>
      </div>

      {/* Poster Upload */}
      <div>
        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Poster Image</label>
        <input type="file" accept="image/*" onChange={handleFile} />
        {preview && (
          <img
            src={preview}
            alt="Poster Preview"
            className="mt-2 h-48 w-32 object-cover border border-slate-200 rounded-xl shadow-sm"
          />
        )}
      </div>

      <div className="sticky bottom-0 bg-white pt-2">
        <div className="flex gap-2 justify-end border-t border-slate-200 pt-3">
          <SecondaryBtn type="button" onClick={onCancel}>
            Cancel
          </SecondaryBtn>
          <PrimaryBtn type="submit" disabled={saving || isSaving}>
            {saving || isSaving ? "Saving…" : "Save"}
          </PrimaryBtn>
        </div>
      </div>
    </form>
  );
}

/* -------------------------- Admin Movies Page --------------------------- */
export default function AdminMoviesPage() {
  const submittingRef = useRef(false);
  const [movies, setMovies] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function fetchMovies() {
    setLoading(true);
    try {
      // NOTE: api.baseURL already includes /api, so call /movies (not /api/movies)
      const resp = await api.get("/movies", { params: { limit: 50, q } });
      const list = resp.data.movies || resp.data || [];
      setMovies(list.map(normalizeMovie));
    } catch (err) {
      setError("Unable to fetch movies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMovies();
  }, []);

  const doCreate = async (formData) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      // POST to /admin/movies because api.baseURL already contains /api
      const resp = await api.post("/admin/movies", formData, { headers });
      console.log("Create response:", resp.status, resp.data);
      const created = resp?.data?.data || resp?.data?.movie || resp?.data;
      setMovies((m) => [normalizeMovie(created), ...m]);
      setCreating(false);
    } catch (err) {
      console.error("Create failed (full error):", err);
      const serverMsg = err?.response?.data;
      alert("Create failed: " + (serverMsg?.message || JSON.stringify(serverMsg) || err.message));
    } finally {
      submittingRef.current = false;
    }
  };

  const doUpdate = async (formData) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const id = editing?._id || editing?.id;
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      console.trace("doUpdate called");
      const resp = await api.put(`/admin/movies/${id}`, formData, { headers });
      console.log("Update response:", resp.status, resp.data);
      const updated = normalizeMovie(resp?.data?.data || resp?.data?.movie || resp?.data);
      setMovies((m) =>
        m.map((x) => ((x._id || x.id) === (updated._id || updated.id) ? updated : x))
      );
      setEditing(null);
    } catch (err) {
      console.error("Update failed (full error):", err);
      const serverMsg = err?.response?.data;
      alert("Update failed: " + (serverMsg?.message || JSON.stringify(serverMsg) || err.message));
    } finally {
      submittingRef.current = false;
    }
  };

  const doDelete = async (m) => {
    if (!window.confirm(`Delete "${m.title}" ?`)) return;
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await api.delete(`/admin/movies/${m._id || m.id}`, { headers });
      setMovies((x) => x.filter((t) => (t._id || t.id) !== (m._id || m.id)));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Delete failed: " + (err?.response?.data?.message || err.message));
    }
  };

  return (
    <main className="min-h-screen w-screen bg-slate-50 text-slate-900 py-8 px-4 md:px-6">
      <Card className="max-w-6xl mx-auto mb-6 p-5 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold">Manage Movies</h1>
            <p className="text-sm text-slate-600 mt-1">Create, edit, and organize your catalog.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-56">
              <Field placeholder="Search title" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <SecondaryBtn onClick={fetchMovies}>Search</SecondaryBtn>
            <PrimaryBtn onClick={() => setCreating(true)}>Add Movie</PrimaryBtn>
          </div>
        </div>
        {error && (
          <Card className="mt-3 p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">{error}</Card>
        )}
      </Card>

      {/* Movie grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <Card className="col-span-full p-4">Loading...</Card>
        ) : movies.length === 0 ? (
          <Card className="col-span-full p-4">No movies found</Card>
        ) : (
          movies.map((m) => (
            <Card key={m._id || m.id} className="p-3 flex gap-3">
              <img
                src={resolvePosterUrl(m.posterUrl) || DEFAULT_POSTER}
                alt={m.title}
                className="h-48 w-32 object-cover rounded-xl border border-slate-200 shadow-sm"
                onError={(e) => (e.currentTarget.src = DEFAULT_POSTER)}
              />
              <div className="flex-1">
                <h3 className="font-extrabold text-slate-900">{m.title}</h3>
                <div className="text-sm text-slate-700">{m.genresStr || "—"}</div>
                <div className="text-sm text-slate-600">
                  Runtime: {m.runtime || m.durationMins || "—"} min
                </div>
                {m.languages?.length > 0 && (
                  <div className="text-xs text-slate-600 mt-1">Languages: {m.languages.join(", ")}</div>
                )}
                <div className="mt-3 flex gap-2">
                  <SecondaryBtn onClick={() => setEditing(m)} className="text-sm">Edit</SecondaryBtn>
                  <SecondaryBtn onClick={() => doDelete(m)} className="text-sm">Delete</SecondaryBtn>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-extrabold">Create Movie</h2>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              <MovieForm initial={{}} onCancel={() => setCreating(false)} onSave={doCreate} />
            </div>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-extrabold">Edit Movie</h2>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              <MovieForm
                initial={editing}
                onCancel={() => setEditing(null)}
                onSave={doUpdate}
                isSaving={submittingRef.current}
              />
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
