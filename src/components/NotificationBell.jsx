// src/components/NotificationBell.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
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

/* --------- Walmart card wrapper --------- */
const Card = ({ as: Tag = "div", className = "", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest} />
);

export default function NotificationBell() {
  const { token, role } = useAuth() || {};
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busyAll, setBusyAll] = useState(false);

  const wrapperRef = useRef(null);
  const listRef = useRef(null);
  const btnRef = useRef(null);

  const API_BASE = useMemo(
    () => (api?.defaults?.baseURL || "").replace(/\/+$/, ""),
    []
  );

  const unread = items.filter((n) => !n.readAt).length;
  const toKey = (n) => String(n?._id ?? n?.clientKey ?? "");
  const makeId = () =>
    crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

  const merge = useCallback((existing, incoming) => {
    const map = new Map(existing.map((x) => [toKey(x), x]));
    for (const n of incoming) {
      const k = toKey(n);
      map.set(k, { ...map.get(k), ...n });
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }, []);

  /* --------- Routing logic --------- */
  function resolvePath(n) {
    const t = String(n?.type || "").toUpperCase();
    const bookingId = n?.data?.bookingId || n?.bookingId || n?.data?._id || n?.entityId;
    const showtimeId = n?.data?.showtimeId || n?.showtimeId;
    if (bookingId && (t.includes("BOOKING") || t.includes("TICKET"))) {
      return role?.toLowerCase() === "admin"
        ? `/admin/bookings/${bookingId}`
        : `/bookings/${bookingId}`;
    }
    if (showtimeId) {
      return role?.toLowerCase() === "admin"
        ? `/admin/showtimes/${showtimeId}`
        : `/showtimes/${showtimeId}`;
    }
    return role?.toLowerCase() === "admin"
      ? "/admin/notifications"
      : "/bookings";
  }

  const pickIcon = (type) => {
    const t = String(type || "").toUpperCase();
    if (t.includes("TICKET")) return <Ticket className="h-4 w-4 text-[#0071DC]" />;
    if (t.includes("SHOWTIME")) return <CalendarClock className="h-4 w-4 text-[#0654BA]" />;
    if (t.includes("BOOKING")) return <Film className="h-4 w-4 text-emerald-600" />;
    if (t.includes("ERROR") || t.includes("FAIL")) return <AlertTriangle className="h-4 w-4 text-rose-500" />;
    return <BellRing className="h-4 w-4 text-slate-600" />;
  };

  async function markOneRead(id) {
    if (!token || !id) return;
    try {
      await api.patch(`/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems((prev) =>
        prev.map((n) =>
          String(n._id) === String(id)
            ? { ...n, readAt: n.readAt || new Date().toISOString() }
            : n
        )
      );
    } catch {}
  }

  /* --------- Initial Fetch --------- */
  useEffect(() => {
    if (!token) {
      setItems([]);
      return;
    }
    (async () => {
      try {
        const res = await api.get("/notifications/mine?limit=40", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const raw = res?.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];
        const normalized = list.map((n) =>
          n && n._id ? n : { ...n, clientKey: makeId() }
        );
        setItems((prev) => merge(prev, normalized).slice(0, 50));
      } catch {
        setItems([]);
      }
    })();
  }, [token, merge]);

  /* --------- SSE Stream --------- */
  const esRef = useRef(null);
  useEffect(() => {
    if (!token) return;
    let closed = false;
    let backoff = 1000;
    const url = `${API_BASE}/notifications/stream?token=${encodeURIComponent(token)}`;

    const connect = () => {
      if (closed) return;
      const es = new EventSource(url);
      esRef.current = es;

      const handleMsg = (ev) => {
        if (!ev.data) return;
        try {
          const msg = JSON.parse(ev.data);
          const payload = msg?.payload || msg;
          const item = {
            _id: payload._id,
            clientKey: payload._id ? undefined : makeId(),
            title: payload.title || "Notification",
            message: payload.message || payload.body || "",
            createdAt: payload.createdAt || new Date().toISOString(),
            readAt: payload.readAt,
            type: payload.type,
            data: payload.data,
          };
          setItems((prev) => merge(prev, [item]).slice(0, 50));
        } catch {}
      };

      es.addEventListener("notification", handleMsg);
      es.onmessage = handleMsg;
      es.onerror = () => {
        es.close();
        if (closed) return;
        setTimeout(connect, Math.min((backoff *= 2), 30000));
      };
    };

    connect();
    return () => {
      closed = true;
      esRef.current?.close();
    };
  }, [token, API_BASE, merge]);

  /* --------- Outside click / ESC --------- */
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

  /* --------- Mark all --------- */
  const markAll = async () => {
    if (!token || items.length === 0) return;
    try {
      setBusyAll(true);
      await api.post("/notifications/read-all", {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
    } finally {
      setBusyAll(false);
    }
  };

  /* --------- Render --------- */
  return (
    <div className="relative" ref={wrapperRef}>
      <button
        ref={btnRef}
        onClick={() => {
          if (!token) return navigate("/login");
          setOpen((v) => !v);
        }}
        className="relative inline-flex items-center justify-center rounded-full p-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] transition"
        aria-label="Notifications"
        title="Notifications"
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
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between rounded-t-2xl">
            <div className="text-xs font-bold tracking-wide uppercase text-slate-700">
              Notifications
            </div>
            <button
              onClick={markAll}
              disabled={busyAll || unread === 0}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              {busyAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5" />
              )}
              Mark all
            </button>
          </div>

          {/* List */}
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500 flex flex-col items-center">
              <Inbox className="h-6 w-6 mb-2 text-slate-400" />
              No notifications yet.
            </div>
          ) : (
            <ul ref={listRef} className="p-2 space-y-2">
              {items.map((n) => {
                const to = resolvePath(n);
                const isUnread = !n.readAt;
                return (
                  <li key={toKey(n)}>
                    <Link
                      to={to}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                        if (n._id && !n.readAt) markOneRead(n._id);
                      }}
                      className={`flex items-start gap-2 rounded-xl px-3 py-2 border border-transparent hover:bg-slate-50 transition ${
                        isUnread ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="mt-1">{pickIcon(n.type)}</div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-900">
                          {n.title || "Notification"}
                        </div>
                        {n.message && (
                          <div className="text-xs text-slate-600 whitespace-pre-line leading-snug">
                            {n.message}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1">
                          {new Date(n.createdAt || Date.now()).toLocaleString("en-IN")}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-2 text-right rounded-b-2xl">
            <Link
              to={role?.toLowerCase() === "admin" ? "/admin/notifications" : "/bookings"}
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-[#0071DC] hover:text-[#0654BA] underline underline-offset-4"
            >
              View all
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
