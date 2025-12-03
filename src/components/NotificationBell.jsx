import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

import {
  Bell,
  BellRing,
  CheckCheck,
  Loader2,
  Inbox,
  AlertTriangle,
  Film,
  Ticket,
  CalendarClock,
} from "lucide-react";

/* ---- Card ---- */
const Card = ({ as: Tag = "div", className = "", ...rest }) => (
  <Tag
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
    {...rest}
  />
);

/* ---------------- helpers ---------------- */
const toKey = (n) =>
  String(n?._id ?? n?.clientKey ?? (typeof n === "string" ? n : ""));

const makeId = () =>
  typeof crypto !== "undefined" && crypto?.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());

const isObjectId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

/* ---------------- icon picker ---------------- */
const pickIcon = (type) => {
  const t = String(type || "").toUpperCase();
  if (t.includes("TICKET")) return <Ticket className="h-4 w-4 text-[#0071DC]" />;
  if (t.includes("SHOWTIME"))
    return <CalendarClock className="h-4 w-4 text-[#0654BA]" />;
  if (t.includes("BOOKING")) return <Film className="h-4 w-4 text-emerald-600" />;
  if (t.includes("ERROR") || t.includes("FAIL"))
    return <AlertTriangle className="h-4 w-4 text-rose-500" />;
  return <Bell className="h-4 w-4 text-slate-600" />;
};

export default function NotificationBell() {
  const { token, role, user } = useAuth() || {};
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);

  const wrapperRef = useRef(null);
  const esRef = useRef(null);
  const listenersRef = useRef(new Map());

  const API_BASE = useMemo(() => (api?.defaults?.baseURL || "").replace(/\/+$/, ""), []);

  // role detection (defensive)
  const rawRole = String(role || user?.role || "").toUpperCase();
  const isSuperAdmin = rawRole === "SUPER_ADMIN" || rawRole === "ROLE_SUPER_ADMIN";
  const isTheatreAdmin =
    rawRole === "THEATRE_ADMIN" ||
    rawRole === "THEATER_ADMIN" ||
    rawRole === "ROLE_THEATRE_ADMIN";

  /* ------------------ MERGE ------------------ */
  const merge = useCallback((existing, incoming) => {
    const map = new Map(existing.map((x) => [toKey(x), x]));
    for (const n of incoming) {
      const k = toKey(n);
      const prev = map.get(k) || {};
      map.set(k, { ...prev, ...n });
    }
    return Array.from(map.values()).sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
  }, []);

  const unread = items.filter((n) => !n.readAt).length;

  /* ---------------------------------------------------------------------- */
  /*                         BOOKING + SHOWTIME HELPERS                     */
  /* ---------------------------------------------------------------------- */
  const getBookingId = (n) =>
    n?.booking?._id || n?.data?.booking?._id || n?.data?.bookingId || n?.bookingId || null;

  const getShowtimeId = (n) =>
    n?.showtime?._id || n?.data?.showtime?._id || n?.data?.showtimeId || n?.showtimeId || null;

  /* ------------------ PATH ROUTER (preview) ------------------ */
  const getDetailPath = (n) => {
    if (!n) return null;
    if (n.link) return n.link;

    const type = String(n.type || "").toUpperCase();
    const bookingId = getBookingId(n);
    const showtimeId = getShowtimeId(n);

    // Booking
    if (bookingId && type.includes("BOOKING")) {
      if (isSuperAdmin) return `/admin/bookings/${bookingId}`;
      if (isTheatreAdmin) return `/admin/bookings/${bookingId}`;
      return `/bookings/${bookingId}`;
    }

    // Showtime
    if (showtimeId || type.includes("SHOWTIME")) {
      const id = showtimeId;
      if (isSuperAdmin) return `/admin/showtimes/${id}`;
      if (isTheatreAdmin) return `/theatre/showtimes/${id}`;
      return `/showtimes/${id}`;
    }

    // fallback
    if (isSuperAdmin) return "/admin/notifications";
    if (isTheatreAdmin) return "/theatre/notifications";
    return "/notifications";
  };

  /* ------------------ SAFE OPEN (avoid invalid ids) ------------------ */
  const openDetailsSafe = async (n) => {
    if (!n) return;
    const bookingId = getBookingId(n);
    const showtimeId = getShowtimeId(n);
    const type = String(n.type || "").toUpperCase();

    // Booking notifications
    if (bookingId && type.includes("BOOKING")) {
      // If looks like real ObjectId -> go direct
      if (isObjectId(bookingId)) {
        const path = isSuperAdmin || isTheatreAdmin ? `/admin/bookings/${bookingId}` : `/bookings/${bookingId}`;
        navigate(path);
        return;
      }

      // Optionally try server-side resolution (if you implement /bookings/resolve)
      try {
        const resp = await api.get(`/bookings/resolve?ref=${encodeURIComponent(bookingId)}`);
        const resolved = resp?.data?.booking;
        if (resolved && resolved._id) {
          const rid = resolved._id;
          const path = isSuperAdmin || isTheatreAdmin ? `/admin/bookings/${rid}` : `/bookings/${rid}`;
          navigate(path);
          return;
        }
      } catch (err) {
        // ignore - fall back below
      }

      // Fallback: go to bookings list or admin bookings with a search param
      if (isSuperAdmin || isTheatreAdmin) {
        navigate(`/admin/bookings?q=${encodeURIComponent(bookingId)}`);
      } else {
        navigate(`/bookings?q=${encodeURIComponent(bookingId)}`);
      }
      return;
    }

    // Showtime notifications
    if ((showtimeId && isObjectId(showtimeId)) || type.includes("SHOWTIME")) {
      const id = showtimeId;
      const path = isSuperAdmin ? `/admin/showtimes/${id}` : isTheatreAdmin ? `/theatre/showtimes/${id}` : `/showtimes/${id}`;
      navigate(path);
      return;
    }

    // Final fallback to role-specific notifications
    if (isSuperAdmin) navigate("/admin/notifications");
    else if (isTheatreAdmin) navigate("/theatre/notifications");
    else navigate("/notifications");
  };

  /* ------------------ READ/OPEN (dropdown row click) ------------------ */
  async function handleRowClick(n) {
    if (!n) return;
    const key = toKey(n);
    setSelectedKey((prev) => (prev === key ? null : key));

    // optimistic local mark-read
    setItems((prev) =>
      prev.map((x) => (toKey(x) === key ? { ...x, readAt: x.readAt || new Date().toISOString() } : x))
    );

    // also tell server
    if (token && n._id) {
      try {
        const res = await api.post(`/notifications/${n._id}/open`, {}, { headers: { Authorization: `Bearer ${token}` } });
        const doc = res?.data?.notification || {};
        setItems((prev) => prev.map((x) => (String(x._id) === String(doc._id) ? { ...x, readAt: doc.readAt, readBy: doc.readBy } : x)));
      } catch (err) {
        console.warn("🔔 open error:", err?.message, err?.response?.status, err?.response?.data);
      }
    }
  }

  /* ----------------- INITIAL FETCH ----------------- */
  useEffect(() => {
    if (!token) {
      setItems([]);
      return;
    }

    (async () => {
      try {
        let url = "/notifications/mine?limit=50";

        // theatre-scope
        if (isTheatreAdmin && user) {
          const theatreId = user?.theatreId || user?.theatre?._id || user?.theatre || user?.theaterId || user?.theater || null;
          if (theatreId) url += `&theatreId=${theatreId}`;
        }

        const res = await api.get(url, { headers: { Authorization: `Bearer ${token}` } });
        const list = res?.data?.items || (Array.isArray(res?.data) ? res.data : res?.data || []);
        const normalized = (Array.isArray(list) ? list : []).map((n) => (n && n._id ? n : { ...n, clientKey: makeId() }));
        setItems((prev) => merge(prev, normalized).slice(0, 50));
      } catch (err) {
        console.error("🔔 initial fetch failed:", err?.message, err?.response?.status, err?.response?.data);
        setItems([]);
      }
    })();
  }, [token, isTheatreAdmin, user, merge]);

  /* ------------------ SSE STREAM ------------------ */
  useEffect(() => {
    if (!token) return;

    const apiBase = API_BASE || "";
    const originMatch = apiBase.match(/^https?:\/\/[^/]+/);
    const origin = originMatch ? originMatch[0] : window.location.origin;

    let closed = false;
    let backoff = 1000;

    // scope: admin for super-admin connections, user for everyone else (theatre admins included)
    const scope = isSuperAdmin ? "admin" : "user";

    const theatreIdParam = isTheatreAdmin
      ? (user?.theatreId || user?.theatre?._id || user?.theatre || user?.theaterId || user?.theater)
      : null;

    const buildUrl = () => {
      const url = new URL("/api/notifications/stream", origin);
      url.searchParams.set("token", token);
      url.searchParams.set("scope", scope);
      if (theatreIdParam) url.searchParams.set("theatreId", String(theatreIdParam));
      url.searchParams.set("seed", Date.now().toString());
      return url.toString();
    };

    const cleanupES = () => {
      const es = esRef.current;
      if (!es) return;
      const map = listenersRef.current;
      for (const [ev, fn] of map.entries()) {
        try {
          es.removeEventListener(ev, fn);
        } catch (e) {
          // ignore
        }
      }
      map.clear();
      try {
        es.close();
      } catch (e) {}
      esRef.current = null;
    };

    const connect = () => {
      if (closed) return;
      cleanupES();

      const url = buildUrl();
      try {
        console.debug("🔔 connecting SSE ->", url);
      } catch (e) {}

      const es = new EventSource(url);
      esRef.current = es;

      const handleMsg = (ev) => {
        if (!ev.data) return;
        try {
          const payload = JSON.parse(ev.data);
          const item = {
            _id: payload._id,
            clientKey: payload._id ? undefined : makeId(),
            title: payload.title,
            message: payload.message,
            createdAt: payload.createdAt || new Date().toISOString(),
            readAt: payload.readAt,
            type: payload.type,
            data: payload.data,
            link: payload.link,
            bookingId: payload.bookingId || payload.data?.bookingId || payload.data?.booking?._id,
            showtimeId: payload.showtimeId || payload.data?.showtimeId || payload.data?.showtime?._id,
          };
          setItems((prev) => merge(prev, [item]).slice(0, 50));
        } catch (err) {
          console.warn("🔔 SSE bad payload:", ev.data, err);
        }
      };

      const onOpen = () => {
        // reset backoff on successful open
        backoff = 1000;
      };

      const onError = () => {
        try {
          es.close();
        } catch (e) {}
        if (closed) return;
        setTimeout(() => {
          backoff = Math.min(backoff * 2, 20000);
          connect();
        }, backoff);
      };

      listenersRef.current.set("notification", handleMsg);
      try {
        es.addEventListener("notification", handleMsg);
        es.onmessage = handleMsg;
        es.onopen = onOpen;
        es.onerror = onError;
      } catch (err) {
        console.warn("🔔 SSE attach error:", err);
      }
    };

    connect();
    return () => {
      closed = true;
      cleanupES();
    };
  }, [token, API_BASE, merge, isSuperAdmin, isTheatreAdmin, user]);

  /* ------------------- CLOSE ON OUTSIDE CLICK ------------------- */
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  /* ------------------- MARK ALL ------------------- */
  const markAll = async () => {
    if (!token) return;
    try {
      setBusyAll(true);
      await api.post("/notifications/read-all", {}, { headers: { Authorization: `Bearer ${token}` } });
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    } catch (err) {
      console.warn("🔔 markAll error:", err?.message, err?.response?.data);
    } finally {
      setBusyAll(false);
    }
  };

  /* ---------------------------- UI ---------------------------- */
  return (
    <div className="relative" ref={wrapperRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          if (!token) return navigate("/login");
          setOpen((v) => !v);
        }}
        className="relative inline-flex items-center justify-center rounded-full p-2 border border-slate-300 bg-white hover:bg-slate-50"
        aria-label="Notifications"
      >
        {unread > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center text-[10px] bg-rose-600 text-white rounded-full border-2 border-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <Card className="absolute right-0 mt-2 w-80 bg-white max-h-96 overflow-auto z-50">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b px-3 py-2 flex items-center justify-between">
            <div className="text-xs font-bold uppercase text-slate-700">Notifications</div>
            <button onClick={markAll} disabled={busyAll || unread === 0} className="text-xs px-2 py-1 border rounded-full">
              {busyAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all
            </button>
          </div>

          {/* List */}
          {items.length === 0 ? (
            <div className="p-6 text-center text-slate-500 flex flex-col items-center">
              <Inbox className="h-6 w-6 mb-2" />
              No notifications yet.
            </div>
          ) : (
            <ul className="p-2 space-y-2">
              {items.map((n) => {
                const key = toKey(n);
                const isSelected = selectedKey === key;
                const isUnread = !n.readAt;
                const detailPath = getDetailPath(n);

                const created = new Date(n.createdAt || Date.now());
                const createdStr = Number.isFinite(created.getTime()) ? created.toLocaleString("en-IN") : "";

                return (
                  <li key={key}>
                    <button
                      onClick={() => handleRowClick(n)}
                      className={[
                        "w-full flex items-start gap-2 rounded-xl px-3 py-2 border hover:bg-slate-50",
                        isUnread ? "bg-blue-50" : "",
                        isSelected ? "ring-1 ring-blue-500/60" : "",
                      ].join(" ")}
                    >
                      <div className="mt-1">{pickIcon(n.type)}</div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{n.title || "Notification"}</div>
                        {n.message && <div className="text-xs text-slate-600 line-clamp-2">{n.message}</div>}
                        <div className="text-[10px] text-slate-400 mt-1">{createdStr}</div>
                      </div>
                    </button>

                    {/* Expand */}
                    {isSelected && n.message && (
                      <div className="mt-1 ml-9 mr-1 mb-1">
                        <div className="text-xs bg-slate-50 p-2 rounded-xl">{n.message}</div>
                        {detailPath && (
                          <div className="mt-2 flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetailsSafe(n);
                                setOpen(false);
                              }}
                              className="text-xs px-3 py-1.5 rounded-full bg-blue-600 text-white"
                            >
                              Open details
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t p-2 text-right">
            <button
              onClick={() => {
                setOpen(false);
                if (isSuperAdmin) navigate("/admin/notifications");
                else if (isTheatreAdmin) navigate("/theatre/notifications");
                else navigate("/notifications");
              }}
              className="text-xs font-semibold text-blue-700 underline"
            >
              View all
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
