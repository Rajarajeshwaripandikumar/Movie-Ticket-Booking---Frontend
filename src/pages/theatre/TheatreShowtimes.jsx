// src/pages/theatre/TheatreShowtimes.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-4 ${className}`}>{children}</div>
);

export default function TheatreShowtimes() {
  const { token, user, role } = useAuth();
  const theatreId = user?.theatreId;
  const [screens, setScreens] = useState([]);
  const [movieId, setMovieId] = useState("");
  const [screenId, setScreenId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [basePrice, setBasePrice] = useState(150);
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    if (!theatreId || !token) return;
    (async () => {
      try {
        const hdr = { headers: { Authorization: `Bearer ${token}` } };
        const sRes = await api.get(`/admin/theaters/${theatreId}/screens`, hdr);
        setScreens(sRes?.data || sRes || []);
        const mRes = await api.get("/movies", hdr);
        setMovies(mRes?.data || mRes || []);
      } catch (err) {
        console.error("load showtime data", err);
      }
    })();
  }, [theatreId, token]);

  async function createShowtime(e) {
    e?.preventDefault();
    if (!movieId || !screenId || !startTime) return alert("Select movie, screen and start time");
    try {
      const hdr = { headers: { Authorization: `Bearer ${token}` } };
      await api.post("/admin/showtimes", {
        movie: movieId,
        screen: screenId,
        city: "", // backend infers from screen/theatre if necessary
        startTime,
        basePrice,
      }, hdr);
      alert("Showtime created");
      setMovieId(""); setScreenId(""); setStartTime(""); setBasePrice(150);
    } catch (err) {
      console.error("create showtime err", err);
      alert(err?.response?.data?.message || err.message || "Failed to create showtime");
    }
  }

  if (role !== "THEATRE_ADMIN") return <div className="p-8 text-center text-rose-600 font-semibold">Access Denied</div>;

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-5">
        <Card>
          <h2 className="text-lg font-bold">Create Showtime</h2>

          <form onSubmit={createShowtime} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-xs font-semibold">Movie</label>
              <select value={movieId} onChange={(e) => setMovieId(e.target.value)} className="w-full border p-2 rounded-xl">
                <option value="">Select movie</option>
                {movies.map((m) => <option key={m._id} value={m._id}>{m.title}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold">Screen</label>
              <select value={screenId} onChange={(e) => setScreenId(e.target.value)} className="w-full border p-2 rounded-xl">
                <option value="">Select screen</option>
                {screens.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.rows}×{s.cols})</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold">Start time</label>
              <input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="YYYY-MM-DDTHH:MM" className="w-full border p-2 rounded-xl" />
            </div>

            <div>
              <label className="text-xs font-semibold">Base price</label>
              <input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="w-full border p-2 rounded-xl" />
            </div>

            <div className="sm:col-span-2">
              <button className="bg-[#0071DC] text-white rounded-full px-4 py-2">Create Showtime</button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
