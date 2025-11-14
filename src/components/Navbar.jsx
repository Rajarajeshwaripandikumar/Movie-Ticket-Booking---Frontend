// src/components/Navbar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";
import { ChevronDown, Menu, X, UserRound, Shield, LogOut, Bell } from "lucide-react";
import api from "../api/api";

const cn = (...xs) => xs.filter(Boolean).join(" ");

/* ---------- small UI helpers ---------- */
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

const navLinkClasses = ({ isActive }) =>
  cn(
    "text-sm font-semibold transition-colors",
    isActive ? "text-[#0654BA]" : "text-slate-700 hover:text-[#0654BA]"
  );

/* ---------- FIXED: DIRECT Navigation MenuItem (no safeNavigate) ---------- */
function MenuItemLink({ to, children, onClick }) {
  const navigate = useNavigate();
  const clickingRef = useRef(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();

        if (clickingRef.current) return;
        clickingRef.current = true;

        try {
          onClick?.();
          navigate(to); // DIRECT navigation → no redirect bug
        } catch (err) {
          console.error("[MenuItemLink] navigate error:", err);
        } finally {
          setTimeout(() => (clickingRef.current = false), 150);
        }
      }}
      className="block w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-slate-50 font-semibold"
      role="menuitem"
    >
      {children}
    </button>
  );
}

/* ---------- Admin / Theatre link lists ---------- */
const SUPER_ADMIN_LINKS = [
  { label: "Manage Theaters", to: "/admin/theaters" },
  { label: "Manage Movies", to: "/admin/movies" },
  { label: "Manage Screens", to: "/admin/screens" },
  { label: "Manage Showtimes", to: "/admin/showtimes" },
  { label: "Update Pricing", to: "/admin/pricing" },
  { label: "Admin Analytics", to: "/admin/analytics" },
  { label: "Theatre Admins", to: "/super/theatre-admins" },
];

const THEATRE_ADMIN_LINKS = [
  { label: "Dashboard", to: "/theatre/my" },
  { label: "Manage Screens", to: "/theatre/screens" },
  { label: "Manage Showtimes", to: "/theatre/showtimes" },
  { label: "Update Pricing", to: "/theatre/pricing" },
  { label: "Theatre Reports", to: "/theatre/reports" },
  { label: "My Theatre", to: "/theatre/profile" },
];

/* ---------- Normalize notifications ---------- */
const normalizeNotifications = (raw) => {
  const arr =
    Array.isArray(raw) ? raw :
    Array.isArray(raw?.items) ? raw.items :
    Array.isArray(raw?.data) ? raw.data :
    Array.isArray(raw?.content) ? raw.content :
    Array.isArray(raw?.notifications) ? raw.notifications : [];

  return {
    items: arr.map((n, i) => ({
      id: n._id ?? n.id ?? `n-${i}`,
      type: n.type ?? n.kind ?? "",
      title: n.title ?? n.subject ?? "Notification",
      message: n.message ?? n.body ?? n.text ?? "",
      createdAt: n.createdAt ?? new Date().toISOString(),
      readAt: n.readAt ?? (n.read ? new Date().toISOString() : null),
    })),
  };
};

/* ---------- Navbar component ---------- */
export default function Navbar() {
  const {
    user,
    logout,
    isAdmin,
    isSuperAdmin,
    isTheatreAdmin,
    isLoggedIn,
    token: userToken,
    adminToken,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [adminMenu, setAdminMenu] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const notifRef = useRef(null);

  const token =
    adminToken ||
    userToken ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    "";

  const unread = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications]);

  /* -------- Load notifications -------- */
  useEffect(() => {
    if (!isLoggedIn || !token) return;

    let alive = true;

    const load = async () => {
      try {
        const res = await api.get("/notifications/mine", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const { items } = normalizeNotifications(res.data);
        if (alive) setNotifications(items);
      } catch {
        if (alive) setNotifications([]);
      }
    };

    load();
    const t = setInterval(load, 30000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [isLoggedIn, token]);

  /* -------- Close popups on outside click -------- */
  useEffect(() => {
    const onDocClick = (e) => {
      if (!notifRef.current) return;
      if (!notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  /* -------- Close menus on route change -------- */
  useEffect(() => {
    setNotifOpen(false);
    setAdminMenu(false);
  }, [location.pathname]);

  const toKey = (n) => n.id || `${n.type}-${n.createdAt}`;

  const resolveNotificationPath = (n) => {
    const t = String(n.type || "").toLowerCase();
    if (t.includes("booking")) return "/bookings";
    if (t.includes("showtime")) {
      if (isSuperAdmin) return "/admin/showtimes";
      if (isTheatreAdmin) return "/theatre/showtimes";
      return "/admin/showtimes";
    }
    if (isTheatreAdmin) return "/theatre/my";
    if (isSuperAdmin || isAdmin) return "/admin/dashboard";
    return "/bookings";
  };

  const markOneRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch {}

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n))
    );
  };

  const profilePath =
    isSuperAdmin ? "/admin/profile" :
    isTheatreAdmin ? "/theatre/profile" :
    "/profile";

  const anyAdmin = isSuperAdmin || isAdmin || isTheatreAdmin;

  /* ---------------------------------------------------------------------- */
  /* --------------------------- RENDER NAVBAR ---------------------------- */
  /* ---------------------------------------------------------------------- */
  return (
    <header className="w-full sticky top-0 z-50">
      <div className="relative isolate z-50 backdrop-blur-md bg-white/85 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center gap-6">
            
            {/* Brand */}
            <Link to="/" className="flex items-center gap-3 shrink-0">
              <Card className="p-1.5">
                <Logo size={36} />
              </Card>
              <div className="leading-tight">
                <div className="text-2xl font-extrabold text-[#0071DC]">Cinema</div>
              </div>
            </Link>

            {/* Middle Links */}
            <nav className="hidden md:flex items-center gap-5 ml-8">
              <NavLink to="/movies" className={navLinkClasses}>Movies</NavLink>
              <NavLink to="/theaters" className={navLinkClasses}>Theaters</NavLink>
              <NavLink to="/showtimes" className={navLinkClasses}>Showtimes</NavLink>

              {isLoggedIn && !anyAdmin && (
                <NavLink to="/bookings" className={navLinkClasses}>
                  My Bookings
                </NavLink>
              )}
            </nav>

            {/* Right Controls */}
            <div className="ml-auto flex items-center gap-3 relative">

              {/* Notifications */}
              {isLoggedIn && (
                <div className="relative z-50" ref={notifRef}>
                  <IconBtn
                    onClick={() => {
                      setNotifOpen((v) => !v);
                      setAdminMenu(false);
                    }}
                  >
                    <Bell className="w-5 h-5" />
                  </IconBtn>

                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-600 text-white shadow-sm">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}

                  {notifOpen && (
                    <Card className="absolute right-0 mt-3 w-80 bg-white max-h-96 overflow-auto p-0 z-50">
                      {notifications.length > 0 && (
                        <div className="sticky top-0 bg-white border-b p-2 text-right">
                          <button
                            className="text-[11px] px-2 py-1 rounded-full border border-slate-300 hover:bg-slate-50 font-semibold"
                            onClick={async () => {
                              try {
                                await api.post("/notifications/read-all", {}, { headers: { Authorization: `Bearer ${token}` } });
                                setNotifications((prev) =>
                                  prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
                                );
                              } catch {}
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
                                    if (!n.readAt) markOneRead(n.id);
                                    navigate(to);
                                  }}
                                  className={cn(
                                    "w-full text-left p-3 border-b border-slate-200 last:border-b-0",
                                    "hover:bg-slate-50",
                                    !n.readAt && "bg-yellow-50/70"
                                  )}
                                >
                                  <div className="flex items-start gap-2">
                                    {!n.readAt && <span className="mt-1 w-2 h-2 rounded-full bg-current inline-block" />}
                                    <div className="flex-1">
                                      <div className="text-sm font-extrabold">{n.title}</div>
                                      <div className="text-xs text-slate-700 whitespace-pre-line">{n.message}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">
                                        {new Date(n.createdAt).toLocaleString()}
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

              {/* Logged Out */}
              {!isLoggedIn && (
                <>
                  <button
                    onClick={() => navigate("/admin/login")}
                    className="text-sm font-semibold px-4 py-2 rounded-full border border-[#0071DC]/40 text-[#0071DC] hover:bg-[#E8F1FF]"
                  >
                    <Shield className="w-4 h-4 inline-block" /> Admin
                  </button>
                  <Link to="/login" className="text-sm font-semibold px-4 py-2 rounded-full border">
                    Login
                  </Link>
                  <Link to="/register" className="text-sm font-semibold px-4 py-2 rounded-full bg-[#0071DC] text-white hover:bg-[#0654BA]">
                    Register
                  </Link>
                </>
              )}

              {/* Logged In */}
              {isLoggedIn && (
                <div className="relative">
                  <button
                    onClick={() => setAdminMenu((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border bg-white"
                  >
                    <UserRound className="w-5 h-5 text-[#0071DC]" />
                    <span className="max-w-[160px] truncate">{user?.name || user?.email}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {adminMenu && (
                    <Card className="absolute right-0 mt-2 w-64 p-1 bg-white z-50">

                      <MenuItemLink to={profilePath} onClick={() => setAdminMenu(false)}>
                        Profile
                      </MenuItemLink>

                      {!anyAdmin && (
                        <MenuItemLink to="/bookings" onClick={() => setAdminMenu(false)}>
                          My Bookings
                        </MenuItemLink>
                      )}

                      {isSuperAdmin &&
                        SUPER_ADMIN_LINKS.map((item) => (
                          <MenuItemLink key={item.to} to={item.to} onClick={() => setAdminMenu(false)}>
                            {item.label}
                          </MenuItemLink>
                        ))}

                      {isTheatreAdmin &&
                        THEATRE_ADMIN_LINKS.map((item) => (
                          <MenuItemLink key={item.to} to={item.to} onClick={() => setAdminMenu(false)}>
                            {item.label}
                          </MenuItemLink>
                        ))}

                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setAdminMenu(false);
                          navigate("/", { replace: true });
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut className="inline w-4 h-4 mr-1" /> Logout
                      </button>
                    </Card>
                  )}
                </div>
              )}

              {/* Mobile Menu Button */}
              <IconBtn className="md:hidden" onClick={() => setOpen((v) => !v)}>
                {open ? <X /> : <Menu />}
              </IconBtn>
            </div>
          </div>
        </div>
      </div>

      {(location.pathname.startsWith("/admin") || location.pathname.startsWith("/theatre")) &&
        <div className="h-0 md:h-0" />}
    </header>
  );
}
