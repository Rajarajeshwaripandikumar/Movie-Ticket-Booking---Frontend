import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import {
  Inbox,
  CheckCheck,
  RefreshCcw,
  CalendarClock,
  Film,
  Ticket,
  AlertTriangle,
  BellRing,
} from "lucide-react";

// Helper to pick icons based on notification type
const pickIcon = (type) => {
  const t = String(type || "").toUpperCase();
  if (t.includes("TICKET")) return <Ticket className="h-4 w-4 text-[#0071DC]" />;
  if (t.includes("SHOWTIME"))
    return <CalendarClock className="h-4 w-4 text-[#0654BA]" />;
  if (t.includes("BOOKING")) return <Film className="h-4 w-4 text-emerald-600" />;
  if (t.includes("ERROR") || t.includes("FAIL"))
    return <AlertTriangle className="h-4 w-4 text-rose-500" />;
  return <BellRing className="h-4 w-4 text-slate-600" />;
};

// Helper to detect ObjectId format (valid MongoDB ObjectId)
const isObjectId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

const toKey = (n) => String(n?._id ?? n?.clientKey ?? "");

export default function TheatreNotifications() {
  const { token, user, role } = useAuth() || {};
  const navigate = useNavigate();

  const rawRole = (role || user?.role || "").toString().toUpperCase();
  const isSuperAdmin =
    rawRole === "SUPER_ADMIN" || rawRole === "ROLE_SUPER_ADMIN";
  const isTheatreAdmin =
    ["THEATRE_ADMIN", "THEATER_ADMIN", "ROLE_THEATRE_ADMIN"].includes(rawRole);

  const theatreId = useMemo(
    () =>
      user?.theatreId ||
      user?.theatre?._id ||
      user?.theatre ||
      user?.theaterId ||
      user?.theater ||
      null,
    [user]
  );

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const [filter, setFilter] = useState("all"); // 'all' | 'unread'

  const buildUrl = useCallback(() => {
    const base = "/notifications/mine?limit=1000";
    return theatreId ? `${base}&theatreId=${theatreId}` : base;
  }, [theatreId]);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get(buildUrl(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list =
        res?.data?.items ||
        (Array.isArray(res?.data) ? res.data : res?.data || []);
      setItems(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("load notifications", err?.response?.data || err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, buildUrl]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const markAll = async () => {
    if (!token) return;
    setBusyAll(true);
    try {
      await api.post(
        "/notifications/read-all",
        { theatreId: theatreId || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setItems((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
    } catch (err) {
      console.warn("markAll", err?.response?.data || err);
    } finally {
      setBusyAll(false);
    }
  };

  const getBookingId = (n) =>
    n?.booking?._id ||
    n?.data?.booking?._id ||
    n?.data?.bookingId ||
    n?.bookingId ||
    null;
  const getShowtimeId = (n) =>
    n?.showtime?._id ||
    n?.data?.showtime?._id ||
    n?.data?.showtimeId ||
    n?.showtimeId ||
    null;

  // Navigate to booking or showtime details (with special handling for demo/ref IDs)
  const openDetailsSafe = async (n) => {
    if (!n) return;
    const bookingId = getBookingId(n);
    const showtimeId = getShowtimeId(n);
    const t = String(n.type || "").toUpperCase();

    if (bookingId && t.includes("BOOKING")) {
      if (isObjectId(bookingId)) {
        // valid ID → navigate normal
        navigate(
          isSuperAdmin || isTheatreAdmin
            ? `/admin/bookings/${bookingId}`
            : `/bookings/${bookingId}`
        );
        return;
      }
      // demo/ref ID case
      try {
        const r = await api.get(`/bookings/resolve?ref=${encodeURIComponent(bookingId)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const resolved = r?.data?.booking;
        if (resolved && resolved._id) {
          navigate(
            isSuperAdmin || isTheatreAdmin
              ? `/admin/bookings/${resolved._id}`
              : `/bookings/${resolved._id}`
          );
          return;
        }
      } catch (err) {
        // ignore, will fallback below
      }
      // fallback: show search/list with filter
      if (isSuperAdmin || isTheatreAdmin) {
        navigate(`/admin/bookings?search=${encodeURIComponent(bookingId)}`);
      } else {
        navigate(`/bookings?search=${encodeURIComponent(bookingId)}`);
      }
      return;
    }

    if ((showtimeId && isObjectId(showtimeId)) || t.includes("SHOWTIME")) {
      const id = showtimeId;
      navigate(
        isSuperAdmin ? `/admin/showtimes/${id}` : isTheatreAdmin ? `/theatre/showtimes/${id}` : `/showtimes/${id}`
      );
      return;
    }

    if (isSuperAdmin) navigate("/admin/notifications");
    else if (isTheatreAdmin) navigate("/theatre/notifications");
    else navigate("/notifications");
  };

  const visible = items.filter((it) => (filter === "unread" ? !it.readAt : true));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">All Notifications</h1>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border">
            <RefreshCcw className="h-4 w-4" /> <span className="text-sm">Refresh</span>
          </button>
          <button onClick={markAll} disabled={busyAll} className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border">
            <CheckCheck className="h-4 w-4" /> <span className="text-sm">{busyAll ? "Marking..." : "Mark all read"}</span>
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="text-sm text-slate-600">Filter:</div>
        <button onClick={() => setFilter("all")} className={`px-3 py-1 rounded ${filter==="all"?"bg-slate-100":"bg-white"} border`}>All</button>
        <button onClick={() => setFilter("unread")} className={`px-3 py-1 rounded ${filter==="unread"?"bg-slate-100":"bg-white"} border`}>Unread</button>
        <div className="text-sm text-slate-500 ml-auto">{items.length} total</div>
      </div>

      {loading ? (
        <div className="p-6 text-center text-slate-500">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="p-8 border rounded text-center text-slate-500">
          <Inbox className="mx-auto mb-2" /> No notifications.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((n) => {
            const key = toKey(n);
            const unread = !n.readAt;
            const created = new Date(n.createdAt || Date.now());
            return (
              <div key={key} className={`border rounded-xl p-3 ${unread ? "bg-blue-50" : "bg-white"}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{pickIcon(n.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{n.title || "Notification"}</div>
                      <div className="text-xs text-slate-400">{isFinite(created.getTime()) ? created.toLocaleString() : ""}</div>
                    </div>
                    {n.message && <div className="text-sm text-slate-700 mt-1">{n.message}</div>}
                    <div className="mt-2 flex gap-2 justify-end">
                      <button onClick={() => openDetailsSafe(n)} className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs">Open details</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
