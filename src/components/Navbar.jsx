// src/components/Navbar.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useEffect, useState, useRef } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";
import api from "../api/api";
import { Bell, ChevronDown, Menu, X, UserRound, Shield, LogOut } from "lucide-react";

/* --------------------------- Walmart primitives --------------------------- */
const cn = (...xs) => xs.filter(Boolean).join(" ");

const Card = ({ className = "", as: Comp = "div", ...rest }) => (
  <Comp className={cn("bg-white border border-slate-200 rounded-2xl shadow-sm", className)} {...rest} />
);

function IconBtn({ className = "", ...rest }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center w-9 h-9 rounded-full",
        "border border-slate-300 bg-white text-slate-700",
        "hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC]",
        className
      )}
      {...rest}
    />
  );
}

function PrimaryBtn({ className = "", ...rest }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 text-[12px] font-semibold px-3.5 py-2 rounded-full",
        "bg-[#0071DC] text-white hover:bg-[#0654BA]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60",
        className
      )}
      {...rest}
    />
  );
}

function GhostLink({ active, className = "", ...rest }) {
  return (
    <button
      className={cn(
        "text-sm font-semibold transition-colors",
        active ? "text-[#0654BA]" : "text-slate-700 hover:text-[#0654BA]",
        className
      )}
      {...rest}
    />
  );
}

/* ------------------------------- Constants ------------------------------ */
const ADMIN_LINKS = [
  { label: "Admin Dashboard", to: "/admin" },
  { label: "Manage Theaters", to: "/admin/theaters" },
  { label: "Manage Screens", to: "/admin/screens" },
  { label: "Manage Showtimes", to: "/admin/showtimes" },
  { label: "Update Pricing", to: "/admin/pricing" },
  { label: "Admin Analytics", to: "/admin/analytics" },
  { label: "Manage Movies", to: "/admin/movies" },
];

export default function Navbar() {
  const { token, role, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [adminMenu, setAdminMenu] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const isAdmin = String(role || "").toUpperCase() === "ADMIN";
  const isLoggedIn = !!token;
  const isAdminRoute = location.pathname.startsWith("/admin");
  const API_BASE = api.defaults.baseURL?.replace(/\/+$/, "") || "";

  // ---------- utils ----------
  const newId = () =>
    (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now() + Math.random());

  const toKey = (n) => String(n?._id ?? n?.clientKey ?? "");

  function mergeNotifications(existing, incoming) {
    const map = new Map(existing.map((x) => [toKey(x), x]));
    for (const n of incoming) {
      const k = toKey(n);
      map.set(k, { ...map.get(k), ...n });
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  // ---------- navigation helpers ----------
  function resolveNotificationPath(n) {
    const t = String(n?.type || "").toUpperCase();
    const bookingId = n?.data?.bookingId || n?.bookingId || n?.data?._id || n?.entityId;
    const showtimeId = n?.data?.showtimeId || n?.showtimeId;

    if (bookingId && (t.includes("BOOKING") || t.includes("TICKET"))) {
      return isAdmin ? `/admin/bookings/${bookingId}` : `/bookings/${bookingId}`;
    }
    if (showtimeId) {
      return isAdmin ? `/admin/showtimes/${showtimeId}` : `/showtimes/${showtimeId}`;
    }
    return isAdmin ? "/admin" : "/bookings";
  }

  async function markOneRead(id) {
    if (!token || !id) return;
    try {
      await api.patch(`/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications((prev) =>
        prev.map((n) => (String(n._id) === String(id) ? { ...n, readAt: n.readAt || new Date().toISOString() } : n))
      );
    } catch { /* ignore */ }
  }

  // ---------- initial load ----------
  useEffect(() => {
    if (!token) {
      setNotifications([]);
      return;
    }
    api
      .get("/notifications/mine?limit=40", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const raw = res?.data;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        const normalized = list.map((n) => (n && n._id ? n : { ...n, clientKey: newId() }));
        setNotifications((prev) => mergeNotifications(prev, normalized).slice(0, 50));
      })
      .catch(() => setNotifications([]));
  }, [token]);

  // ---------- SSE live updates ----------
  const esRef = useRef(null);
  useEffect(() => {
    if (!token) return;
    const url = `${API_BASE}/notifications/stream?token=${encodeURIComponent(token)}&seed=1`;
    let closed = false;
    let backoff = 1000;

    const connect = () => {
      if (closed) return;
      const es = new EventSource(url);
      esRef.current = es;

      const handleNotification = (ev) => {
        if (!ev.data) return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg && typeof msg === "object") {
            const item = {
              _id: msg._id,
              clientKey: msg._id ? undefined : newId(),
              title: msg.title || "Notification",
              message: msg.message || msg.body || "",
              createdAt: msg.createdAt || new Date().toISOString(),
              readAt: msg.readAt,
              type: msg.type,
              data: msg.data,
            };
            setNotifications((prev) => mergeNotifications(prev, [item]).slice(0, 50));
          }
        } catch {
          const item = {
            clientKey: newId(),
            title: "Notification",
            message: ev.data,
            createdAt: new Date().toISOString(),
          };
          setNotifications((prev) => mergeNotifications(prev, [item]).slice(0, 50));
        }
      };

      es.addEventListener("notification", handleNotification);
      es.addEventListener("connected", () => { backoff = 1000; });
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
  }, [token, API_BASE]);

  // ---------- ui helpers ----------
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setAdminMenu(false);
      setNotifOpen(false);
      navigate("/", { replace: true });
    }
  };

  const handleAdminClick = () => {
    if (!isLoggedIn) navigate("/admin/login");
    else if (isAdmin) navigate("/admin");
  };

  const closeAllMenus = () => {
    setOpen(false);
    setAdminMenu(false);
    setNotifOpen(false);
  };

  const unread = notifications.filter((n) => !n.readAt).length;

  /* -------------------------------- render -------------------------------- */
  return (
    <header className="w-full sticky top-0 z-50">
      {/* Soft app bar */}
      <div className="backdrop-blur-md bg-white/85 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Brand */}
            <Link to="/" onClick={closeAllMenus} className="flex items-center gap-3" title="Go home">
              <Card className="p-1.5">
                <Logo size={36} />
              </Card>
              <div className="leading-tight">
                <div className="text-2xl font-extrabold tracking-tight text-[#0071DC]">Cinema</div>
                <div className="text-[11px] text-slate-500 -mt-0.5 font-medium">by Site</div>
              </div>
            </Link>

            {/* Main nav */}
            <nav className="hidden md:flex items-center gap-5">
              {[
                { to: "/movies", label: "Movies" },
                { to: "/theaters", label: "Theaters" },
                { to: "/showtimes", label: "Showtimes" },
                ...(isLoggedIn && !isAdmin ? [{ to: "/bookings", label: "My Bookings" }] : []),
              ].map((item) => (
                <NavLink key={item.to} to={item.to} onClick={closeAllMenus} className="focus:outline-none">
                  {({ isActive }) => <GhostLink active={isActive}>{item.label}</GhostLink>}
                </NavLink>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3 relative">
              {/* Notifications */}
              {isLoggedIn && (
                <div className="relative">
                  <IconBtn
                    aria-label="Notifications"
                    onClick={() => { setNotifOpen((v) => !v); setAdminMenu(false); }}
                    title="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                  </IconBtn>
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 text-[10px] leading-none px-1.5 py-0.5 rounded-full border border-white bg-rose-600 text-white shadow-sm">
                      {unread}
                    </span>
                  )}

                  {notifOpen && (
                    <Card
                      className="absolute right-0 mt-3 w-80 bg-white max-h-96 overflow-auto p-0"
                      onClick={(e) => e.stopPropagation()}
                      role="menu"
                      aria-label="Notifications"
                    >
                      {/* Mark all as read */}
                      {notifications.length > 0 && (
                        <div className="sticky top-0 bg-white border-b border-slate-200 p-2 text-right">
                          <button
                            className="text-[11px] px-2 py-1 rounded-full border border-slate-300 bg-white hover:bg-slate-50 font-semibold"
                            onClick={async () => {
                              try {
                                await api.post("/notifications/read-all", {}, { headers: { Authorization: `Bearer ${token}` } });
                                setNotifications((prev) =>
                                  prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
                                );
                              } catch { /* ignore */ }
                            }}
                          >
                            Mark all as read
                          </button>
                        </div>
                      )}

                      {notifications.length === 0 ? (
                        <div className="p-4 text-sm text-slate-600 text-center">No notifications yet.</div>
                      ) : (
                        <ul>
                          {notifications.map((n) => {
                            const to = resolveNotificationPath(n);
                            return (
                              <li key={toKey(n)}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNotifOpen(false);
                                    if (n._id && !n.readAt) markOneRead(n._id);
                                    navigate(to || (isAdmin ? "/admin" : "/bookings"));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.stopPropagation();
                                      setNotifOpen(false);
                                      navigate(to || (isAdmin ? "/admin" : "/bookings"));
                                    }
                                  }}
                                  className={cn(
                                    "w-full text-left p-3 border-b border-slate-200 last:border-b-0",
                                    "hover:bg-slate-50 focus:bg-slate-50 outline-none",
                                    !n.readAt && "bg-yellow-50/70"
                                  )}
                                  title="Open notification"
                                  role="menuitem"
                                >
                                  <div className="flex items-start gap-2">
                                    {!n.readAt && (
                                      <span className="mt-1 inline-block w-2 h-2 rounded-full bg-rose-500" />
                                    )}
                                    <div className="flex-1">
                                      <div className="text-sm font-extrabold text-slate-900">
                                        {n.title || "Notification"}
                                      </div>
                                      <div className="text-xs text-slate-700 whitespace-pre-line">
                                        {n.message || n.body || ""}
                                      </div>
                                      <div className="text-[10px] text-slate-500 mt-1">
                                        {new Date(n.createdAt || Date.now()).toLocaleString()}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Card>
                  )}
                </div>
              )}

              {/* Admin (visible when logged OUT) */}
              {!isLoggedIn && (
                <PrimaryBtn onClick={handleAdminClick} className="hidden sm:inline-flex">
                  <Shield className="w-4 h-4" />
                  Admin
                </PrimaryBtn>
              )}

              {/* Auth menu */}
              {isLoggedIn ? (
                <div className="relative">
                  <button
                    onClick={() => { setAdminMenu((s) => !s); setNotifOpen(false); }}
                    className={cn(
                      "flex items-center gap-2 text-sm px-3 py-2 rounded-full",
                      "border border-slate-300 bg-white hover:bg-slate-50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC]"
                    )}
                  >
                    <UserRound className="w-4 h-4 text-[#0071DC]" />
                    <span className="font-semibold text-slate-800">
                      {user?.name || user?.email || "Account"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-600" />
                  </button>

                  {adminMenu && (
                    <Card className="absolute right-0 mt-2 w-60 p-1 bg-white" onMouseLeave={() => setAdminMenu(false)}>
                      <button
                        onClick={() => {
                          setAdminMenu(false);
                          navigate(isAdmin ? "/admin/profile" : "/profile");
                        }}
                        className="block w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-slate-50 font-semibold"
                      >
                        Profile
                      </button>

                      {!isAdmin && (
                        <button
                          onClick={() => {
                            setAdminMenu(false);
                            navigate("/bookings");
                          }}
                          className="block w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-slate-50 font-semibold"
                        >
                          My Bookings
                        </button>
                      )}

                      {isAdmin && (
                        <>
                          <div className="my-1 h-px bg-slate-200" />
                          {ADMIN_LINKS.map((item) => (
                            <button
                              key={item.to}
                              onClick={() => {
                                setAdminMenu(false);
                                navigate(item.to);
                              }}
                              className="block w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-slate-50 font-semibold"
                            >
                              {item.label}
                            </button>
                          ))}
                        </>
                      )}

                      <div className="my-1 h-px bg-slate-200" />
                      <button
                        onClick={handleLogout}
                        className="w-full inline-flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-xl font-semibold"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </Card>
                  )}
                </div>
              ) : (
                !isAdminRoute && (
                  <div className="hidden sm:flex items-center gap-2">
                    {/* Upgraded Login button (desktop) */}
                    <button
                      onClick={() => {
                        closeAllMenus();
                        navigate("/login");
                      }}
                      className={cn(
                        "inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200",
                        "border border-[#0071DC]/30 text-[#0071DC]",
                        "bg-gradient-to-r from-[#E8F1FF] to-white",
                        "hover:from-[#0071DC] hover:to-[#0654BA] hover:text-white hover:shadow-md",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC]"
                      )}
                      aria-label="Login"
                    >
                      <UserRound className="w-4 h-4" />
                      Login
                    </button>

                    {/* Register stays as PrimaryBtn (filled) to pair with Login */}
                    <PrimaryBtn
                      onClick={() => {
                        closeAllMenus();
                        navigate("/register");
                      }}
                    >
                      Register
                    </PrimaryBtn>
                  </div>
                )
              )}

              {/* Mobile Toggle */}
              <IconBtn
                className="md:hidden"
                onClick={() => setOpen((s) => !s)}
                aria-expanded={open}
                aria-label="Toggle menu"
                title="Menu"
              >
                {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </IconBtn>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">
            <NavLink to="/movies" onClick={closeAllMenus} className="block">
              {({ isActive }) => <GhostLink active={isActive}>Movies</GhostLink>}
            </NavLink>
            <NavLink to="/theaters" onClick={closeAllMenus} className="block">
              {({ isActive }) => <GhostLink active={isActive}>Theaters</GhostLink>}
            </NavLink>
            <NavLink to="/showtimes" onClick={closeAllMenus} className="block">
              {({ isActive }) => <GhostLink active={isActive}>Showtimes</GhostLink>}
            </NavLink>
            {isLoggedIn && !isAdmin && (
              <NavLink to="/bookings" onClick={closeAllMenus} className="block">
                {({ isActive }) => <GhostLink active={isActive}>My Bookings</GhostLink>}
              </NavLink>
            )}

            <div className="pt-2" />

            {!isLoggedIn && (
              <PrimaryBtn
                className="w-full justify-center"
                onClick={() => {
                  closeAllMenus();
                  handleAdminClick();
                }}
              >
                <Shield className="w-4 h-4" />
                Admin
              </PrimaryBtn>
            )}

            {isLoggedIn ? (
              <>
                <button
                  onClick={() => {
                    closeAllMenus();
                    navigate(isAdmin ? "/admin/profile" : "/profile");
                  }}
                  className="block w-full text-left text-sm font-semibold hover:text-[#0654BA]"
                >
                  Profile
                </button>

                {isAdmin && (
                  <>
                    <div className="mt-2 mb-1 text-[11px] font-extrabold uppercase text-slate-500">
                      Admin
                    </div>
                    {ADMIN_LINKS.map((item) => (
                      <button
                        key={item.to}
                        onClick={() => {
                          closeAllMenus();
                          navigate(item.to);
                        }}
                        className="block w-full text-left text-sm py-1.5 font-semibold hover:text-[#0654BA]"
                      >
                        {item.label}
                      </button>
                    ))}
                  </>
                )}

                <button
                  onClick={() => {
                    closeAllMenus();
                    handleLogout();
                  }}
                  className="block w-full text-left text-sm text-rose-600 font-semibold"
                >
                  Logout
                </button>
              </>
            ) : (
              !isAdminRoute && (
                <>
                  {/* Upgraded mobile Login (full-width pill) */}
                  <button
                    onClick={() => {
                      closeAllMenus();
                      navigate("/login");
                    }}
                    className={cn(
                      "w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200",
                      "border border-[#0071DC]/30 text-[#0071DC] bg-white",
                      "hover:bg-[#0071DC] hover:text-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC]"
                    )}
                    aria-label="Login"
                  >
                    <UserRound className="w-4 h-4" />
                    Login
                  </button>

                  <PrimaryBtn
                    className="w-full justify-center"
                    onClick={() => {
                      closeAllMenus();
                      navigate("/register");
                    }}
                  >
                    Register
                  </PrimaryBtn>
                </>
              )
            )}
          </div>
        </div>
      )}
    </header>
  );
}
