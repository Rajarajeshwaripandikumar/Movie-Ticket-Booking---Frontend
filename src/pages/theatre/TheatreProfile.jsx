// src/pages/theatre/TheatreProfile.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";

export default function TheatreProfile() {
  const { user, refreshProfile } = useAuth();
  const theatreId =
    user?.theatreId || user?.theaterId || user?.theatre?._id || user?.theater?._id || "";

  const [theatre, setTheatre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/theatre/me`);
        setTheatre(res.data?.theatre || res.data?.theater || res.data || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    try {
      setSaving(true);
      await api.put(`/theatre/me`, theatre);
      await refreshProfile();
      alert("Updated successfully");
    } catch (err) {
      console.error(err);
      alert("Failed to update");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-center">Loading…</div>;
  if (!theatre) return <div className="p-6 text-center">Theatre not found</div>;

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My Theatre Profile</h1>

      <div className="space-y-4 bg-white border p-6 rounded-2xl shadow-sm">
        <div>
          <label className="block text-sm font-semibold text-slate-600">Name</label>
          <input
            className="w-full border rounded-xl p-2 mt-1"
            value={theatre.name || ""}
            onChange={(e) => setTheatre({ ...theatre, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-600">City</label>
          <input
            className="w-full border rounded-xl p-2 mt-1"
            value={theatre.city || ""}
            onChange={(e) => setTheatre({ ...theatre, city: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-600">Address</label>
          <input
            className="w-full border rounded-xl p-2 mt-1"
            value={theatre.address || ""}
            onChange={(e) => setTheatre({ ...theatre, address: e.target.value })}
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="bg-[#0071DC] text-white px-4 py-2 rounded-full"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </main>
  );
}
