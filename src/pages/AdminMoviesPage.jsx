// src/pages/AdminMovies.jsx
import React, { useEffect, useRef, useState } from "react";
import api from "../api/api";
import Layout from "../components/Layout";

/* --------------------------- Walmart primitives --------------------------- */
const BLUE = "#0071DC";
const BLUE_DARK = "#0654BA";

/* Tailwind-friendly color usage (avoid dynamic bracket syntax which won't compile) */
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
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${className}`}
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
const API_BASE = import.meta.env.VITE_API_BASE || "https://movie-ticket-booking-backend-o1m2.onrender.com";
const FILES_BASE = API_BASE.replace(/\/api\/?$/, "");

/* ----------------------- Upload / Credentials Flags --------------------- */
const MAX_UPLOAD_RETRIES = 2;
const UPLOAD_WITH_CREDENTIALS = false;

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

function normalizeMovie(m = {}) {
  const title = m.title || "";
  const synopsis = m.synopsis ?? m.description ?? "";
  const runtime = m.runtime ?? m.durationMins ?? m.runtimeMinutes ?? "";
  const releaseDate = m.releaseDate ?? (m.releasedAt ? String(m.releasedAt).slice(0, 10) : "");
  const genresArr = Array.isArray(m.genres)
    ? m.genres
    : Array.isArray(m.genre)
    ? m.genre
    : toArray(m.genre || m.genres || "");
  const genresStr = genresArr.join(", ");
  const languages = Array.isArray(m.languages) ? m.languages : toArray(m.languages ?? m.language ?? "");

  // Defensive, shape-normalizing cast array
  const cast = Array.isArray(m.cast)
    ? m.cast.map((c) => {
        // handle many shapes: string, { name }, { actorName }, { actor: { name } }, { person: { name } }
        if (typeof c === "string") return { actorName: String(c), character: "" };
        if (!c || typeof c !== "object") return { actorName: String(c || ""), character: "" };
        const actorName =
          c.actorName ||
          c.name ||
          (c.actor && (c.actor.name || c.actor.fullName)) ||
          (c.person && (c.person.name || c.person.fullName)) ||
          "";
        const character = c.character || c.role || "";
        return { actorName: String(actorName), character: String(character) };
      })
    : [];

  // Defensive crew normalization
  const crew = Array.isArray(m.crew)
    ? m.crew.map((c) => {
        if (!c || typeof c !== "object") return { name: String(c || ""), role: "" };
        const name = c.name || c.fullName || (c.person && (c.person.name || c.person.fullName)) || "";
        const role = c.role || c.job || "";
        return { name: String(name), role: String(role) };
      })
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

/* ---------------------- Helper UI: List Editors + Language Tags --------- */

function IconButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-full p-1.5 border border-slate-200 bg-white shadow-sm ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* Dynamic list editor for cast (actorName + character) and crew (name + role) */
function ListEditor({ label, items, setItems, itemShape = { a: "", b: "" }, leftPlaceholder, rightPlaceholder }) {
  const updateAt = (i, patch) => {
    setItems((s) => s.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const add = () => setItems((s) => [...s, { ...itemShape }]);
  const removeAt = (i) => setItems((s) => s.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="block text-[12px] font-semibold text-slate-600 mb-1">{label}</label>
        <button type="button" onClick={add} className="text-sm text-blue-600 hover:underline">
          + Add
        </button>
      </div>

      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex gap-2">
            <Field
              value={String(it.actorName ?? it.name ?? "")}
              onChange={(e) => updateAt(idx, { actorName: e.target.value, name: e.target.value })}
              placeholder={leftPlaceholder}
            />
            <Field
              value={String(it.character ?? it.role ?? "")}
              onChange={(e) => updateAt(idx, { character: e.target.value, role: e.target.value })}
              placeholder={rightPlaceholder}
            />
            <IconButton onClick={() => removeAt(idx)} aria-label="Remove">
              ✕
            </IconButton>
          </div>
        ))}
        {items.length === 0 && <div className="text-xs text-slate-500">No entries yet — click “+ Add” to create one</div>}
      </div>
    </div>
  );
}

/* Language tag input (preset multi-select + custom tag add) */
const COMMON_LANGS = ["English", "Tamil", "Hindi", "Telugu", "Malayalam", "Kannada", "Bengali", "Marathi", "Punjabi"];

function LanguageEditor({ languages, setLanguages }) {
  const [custom, setCustom] = useState("");

  const togglePreset = (lang) => {
    setLanguages((s) => (s.includes(lang) ? s.filter((x) => x !== lang) : [...s, lang]));
  };
  const addCustom = () => {
    const v = (custom || "").trim();
    if (!v) return;
    if (languages.includes(v)) {
      setCustom("");
      return;
    }
    setLanguages((s) => [...s, v]);
    setCustom("");
  };
  const remove = (lang) => setLanguages((s) => s.filter((x) => x !== lang));

  return (
    <div>
      <div className="mb-2">
        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Languages</label>
        <div className="flex flex-wrap gap-2">
          {COMMON_LANGS.map((lang) => (
            <button
              type="button"
              key={lang}
              onClick={() => togglePreset(lang)}
              className={`text-sm px-3 py-1 rounded-full border ${languages.includes(lang) ? "bg-[#0071DC] text-white border-[#0071DC]" : "bg-white text-slate-700 border-slate-200"}`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 items-center mb-2">
        <Field value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add custom language e.g. 'Urdu'" />
        <PrimaryBtn type="button" onClick={addCustom}>Add</PrimaryBtn>
      </div>

      <div className="flex gap-2 flex-wrap">
        {languages.map((l) => (
          <span key={l} className="inline-flex items-center gap-2 text-sm px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
            <span>{l}</span>
            <button type="button" onClick={() => remove(l)} className="text-slate-500">✕</button>
          </span>
        ))}
        {languages.length === 0 && <div className="text-xs text-slate-500">No languages selected</div>}
      </div>
    </div>
  );
}

/* ------------------------- Movie Form Component ------------------------- */
function MovieForm({ initial = {}, onCancel, onSave, isSaving = false }) {
  const norm = normalizeMovie(initial || {});

  // defensive defaults
  const safeLanguages = Array.isArray(norm.languages) ? norm.languages : (norm.languages ? toArray(norm.languages) : []);
  const safeCast = Array.isArray(norm.cast) ? norm.cast : [];
  const safeCrew = Array.isArray(norm.crew) ? norm.crew : [];

  const [form, setForm] = useState({
    title: norm.title || "",
    synopsis: norm.synopsis || "",
    runtime: norm.runtime || "",
    genresStr: norm.genresStr || "",
    releaseDate: norm.releaseDate || "",
    posterUrl: norm.posterUrl || "",
  });
  const [languages, setLanguages] = useState(safeLanguages.length ? safeLanguages : ["English"]);
  const [cast, setCast] = useState(
    safeCast.length
      ? safeCast.map((c) => ({
          actorName: String(c.actorName || c.name || (c.actor && c.actor.name) || ""),
          character: String(c.character || c.role || ""),
        }))
      : []
  );
  const [crew, setCrew] = useState(
    safeCrew.length
      ? safeCrew.map((c) => ({ name: String(c.name || ""), role: String(c.role || c.job || "") }))
      : []
  );
  const [posterFile, setPosterFile] = useState(null);
  const [preview, setPreview] = useState(norm.posterUrl ? resolvePosterUrl(norm.posterUrl) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const n = normalizeMovie(initial || {});
    setForm({
      title: n.title || "",
      synopsis: n.synopsis || "",
      runtime: n.runtime || "",
      genresStr: n.genresStr || "",
      releaseDate: n.releaseDate || "",
      posterUrl: n.posterUrl || "",
    });
    setLanguages(Array.isArray(n.languages) && n.languages.length ? n.languages : ["English"]);
    setCast(
      Array.isArray(n.cast)
        ? n.cast.map((c) => ({
            actorName: String(c.actorName || c.name || (c.actor && c.actor.name) || ""),
            character: String(c.character || c.role || ""),
          }))
        : []
    );
    setCrew(
      Array.isArray(n.crew)
        ? n.crew.map((c) => ({ name: String(c.name || ""), role: String(c.role || c.job || "") }))
        : []
    );
    setPreview(n.posterUrl ? resolvePosterUrl(n.posterUrl) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const change = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Only JPG, PNG, or WEBP allowed.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert("Max file size 8MB.");
      return;
    }
    setPosterFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();

    // Build formData
    const data = new FormData();
    data.append("title", form.title);
    data.append("description", form.synopsis ?? "");
    if (form.runtime !== "" && form.runtime !== null) data.append("runtimeMinutes", String(Number(form.runtime)));
    else data.append("runtimeMinutes", "");
    data.append("genres", form.genresStr || "");
    data.append("releasedAt", form.releaseDate || "");
    // languages -> send as CSV (backend accepts CSV or JSON)
    data.append("languages", (languages || []).map((x) => String(x).trim()).filter(Boolean).join(","));
    // cast & crew -> JSON arrays (backend normalizer will parse)
    data.append(
      "cast",
      JSON.stringify(
        (cast || [])
          .filter((c) => (String(c?.actorName || "").trim()))
          .map((c) => ({ actorName: String(c.actorName).trim(), character: String(c.character || "").trim() }))
      )
    );
    data.append(
      "crew",
      JSON.stringify(
        (crew || [])
          .filter((c) => (String(c?.name || "").trim()))
          .map((c) => ({ name: String(c.name).trim(), role: String(c.role || "").trim() }))
      )
    );

    if (posterFile) {
      data.append("poster", posterFile);
    } else if (form.posterUrl) {
      data.append("posterUrl", form.posterUrl);
    }

    try {
      setSaving(true);
      await onSave(data);
    } catch (err) {
      console.error("Save failed (MovieForm):", err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
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

      {/* Languages */}
      <LanguageEditor languages={languages} setLanguages={setLanguages} />

      {/* Cast & Crew editors */}
      <div className="grid md:grid-cols-2 gap-4">
        <ListEditor
          label="Cast"
          items={cast}
          setItems={setCast}
          itemShape={{ actorName: "", character: "" }}
          leftPlaceholder="Actor name"
          rightPlaceholder="Character (optional)"
        />

        <ListEditor
          label="Crew"
          items={crew}
          setItems={setCrew}
          itemShape={{ name: "", role: "" }}
          leftPlaceholder="Name"
          rightPlaceholder="Role (Director, Writer, etc.)"
        />
      </div>

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
    setError("");
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const resp = await api.get("/movies/admin/list", { headers, params: { limit: 50, q } });

      const list = resp?.data?.data || resp?.data?.movies || resp?.data || [];
      setMovies((Array.isArray(list) ? list : []).map(normalizeMovie));
    } catch (err) {
      console.error("fetchMovies failed:", err);
      const server = err?.response?.data;
      setError(server?.message || "Unable to fetch movies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMovies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NEW: fetch single movie document for editing to ensure full shape (cast/crew/languages)
  async function openEdit(movieItem) {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const id = movieItem._id || movieItem.id;
      if (!id) {
        // fallback to using the provided item
        setEditing(normalizeMovie(movieItem));
        return;
      }
      const resp = await api.get(`/movies/${id}`, { headers });
      const serverMovie = resp?.data?.data || resp?.data || movieItem;
      setEditing(normalizeMovie(serverMovie));
    } catch (err) {
      console.error("openEdit failed:", err);
      const server = err?.response?.data;
      alert("Failed to load movie details: " + (server?.message || err.message));
    } finally {
      setLoading(false);
    }
  }

  const doCreate = async (formData) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        if (api?.defaults?.headers?.post) delete api.defaults.headers.post["Content-Type"];
      } catch (e) {}

      const resp = await api.post("/movies/admin", formData, { headers, withCredentials: UPLOAD_WITH_CREDENTIALS });
      const created = resp?.data?.data || resp?.data?.movie || resp?.data;
      if (created) setMovies((m) => [normalizeMovie(created), ...m]);
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
    if (submittingRef.current || !editing) return;
    submittingRef.current = true;
    try {
      const id = editing?._id || editing?.id;
      if (!id) throw new Error("Missing movie id for update");
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        if (api?.defaults?.headers?.post) delete api.defaults.headers.post["Content-Type"];
      } catch (e) {}

      const resp = await api.put(`/movies/admin/${id}`, formData, { headers, withCredentials: UPLOAD_WITH_CREDENTIALS });
      const updatedRaw = resp?.data?.data || resp?.data?.movie || resp?.data;
      const updated = normalizeMovie(updatedRaw);
      setMovies((m) => m.map((x) => ((x._id || x.id) === (updated._id || updated.id) ? updated : x)));
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
      await api.delete(`/movies/admin/${m._id || m.id}`, { headers });
      setMovies((x) => x.filter((t) => (t._id || t.id) !== (m._id || m.id)));
    } catch (err) {
      console.error("Delete failed:", err);
      const msg = err?.response?.data?.message || err.message;
      alert("Delete failed: " + msg);
    }
  };

  return (
    <Layout
      title=""
      rightSlot={
        <div className="flex items-center gap-2">
          <button className="rounded-full p-2 hover:bg-slate-50">🔔</button>
          <div className="inline-flex items-center gap-2">
            <div className="text-sm text-slate-600 hidden sm:block">Admins ▾</div>
          </div>
        </div>
      }
      maxWidth="max-w-6xl"
    >
      {/* Header card */}
      <div className="mb-6">
        <Card className="p-5 md:p-6">
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
      </div>

      {/* Movie grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <SecondaryBtn onClick={() => openEdit(m)} className="text-sm">Edit</SecondaryBtn>
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
    </Layout>
  );
}
