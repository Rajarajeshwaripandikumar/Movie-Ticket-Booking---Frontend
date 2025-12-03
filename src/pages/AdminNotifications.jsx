// src/pages/AdminNotifications.jsx
import React, { useEffect, useState } from "react";
import api from "../api/api"; // your api helper

export default function AdminNotifications() {
  const [items, setItems] = useState([]); // default to array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await api.get("/notifications"); // or however your api helper works
        // If api.get already returns the parsed body, `res` is the body.
        // If it returns an object { status, data }, adapt as needed.
        console.log("[AdminNotifications] raw response:", res);

        // Normalize the response into an array as robustly as possible:
        let arr = [];

        // Case 1: API returns array directly: [{...}, {...}]
        if (Array.isArray(res)) {
          arr = res;
        } else if (res && Array.isArray(res.data)) {
          // Case 2: { data: [...] }
          arr = res.data;
        } else if (res && Array.isArray(res.items)) {
          // Case 3: { items: [...] }
          arr = res.items;
        } else if (res && Array.isArray(res.notifications)) {
          // Case 4: { notifications: [...] }
          arr = res.notifications;
        } else if (res && typeof res === "object") {
          // Fallback: maybe the API returned a keyed object, try to pluck arrays
          const possibleArrays = Object.values(res).filter(Array.isArray);
          if (possibleArrays.length > 0) arr = possibleArrays[0];
          else {
            // If it's a single object, wrap it into an array so map works.
            arr = [res];
          }
        } else {
          // If it's something else (null/undefined/primitive), keep empty array
          arr = [];
        }

        if (mounted) setItems(arr);
      } catch (err) {
        console.error("[AdminNotifications] fetch error:", err);
        if (mounted) setError(err.message || "Failed to load notifications");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div>Loading notifications…</div>;
  if (error) return <div style={{ color: "red" }}>Error: {error}</div>;

  if (!Array.isArray(items) || items.length === 0) {
    return <div>No notifications found.</div>;
  }

  return (
    <div>
      <h2>Notifications</h2>
      <ul>
        {items.map((it, idx) => (
          <li key={it._id || it.id || idx}>
            {/* adapt fields to your notification model */}
            <strong>{it.title || it.subject || "Untitled"}</strong>
            <div>{it.body || it.message || JSON.stringify(it).slice(0, 120)}</div>
            <small>{it.createdAt || it.date || ""}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
