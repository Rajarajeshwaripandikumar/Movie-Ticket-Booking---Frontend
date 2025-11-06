// src/components/Navbar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";
import { ChevronDown, Menu, X, UserRound, Shield, LogOut, Bell } from "lucide-react";
import api from "../api/api";

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

/* -------------------------- Menu Navigation Item -------------------------- */
/* Changed to imperative navigation so clicks inside popover always work */
function MenuItemLink({ to, children, onClick }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick?.();        // close the menu first
        navigate(to);       // then navigate
      }}
      className="block w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-slate-50 font-semibold"
      role="menuitem"
    >
      {children}
    </button>
  );
}

/* ------------------------------ Menu Groups ------------------------------ */
const SUPER_ADMIN_LINKS = [
  { label: "Manage Theaters", to: "/admin/theaters" },
  { label: "Manage Movies", to: "/admin/movies" },
  { label: "Manage Screens", to: "/admin/screens" },
  { label: "Manage Showtimes", to: "/admin/showtimes" },
  { label: "Update Pricing", to: "/admin/pricing" },
  { label: "Admin Analytics", to: "/admin/analytics" },
  { label: "Theatre Admins", to: "/super/theatre-admins" },
];

// ✅ cleaned & aligned with routes
const THEATRE_ADMIN_LINKS = [
  { label: "Dashboard", to: "/theatre/my" },
  { label: "Manage Screens", to: "/theatre/screens" },
  { label: "Manage Showtimes", to: "/theatre/showtimes" },
  { label: "Update Pricing", to: "/theatre/pricing" },
  { label: "Theatre Reports", to: "/theatre/reports" },
  { label: "My Theatre", to: "/theatre/profile" },
];

/* --------------------------- Notifications utils -------------------------- */
const normalizeNotifications = (raw) => {
  const arr =
    Array.isArray(raw) ? raw :
    Array.isArray(raw?.items) ? raw.items :
    Array.isArray(raw?.data) ? raw.data :
    Array.isArray(raw?.content) ? raw.content :
    Array.isArray(raw?.notifications) ? raw.notifications : [];

  const unreadFallback = Number(
    raw?.unread ?? raw?.unreadCount ?? raw?.meta?.unread ?? 0
  );

  return {
    items: arr.map((n, i) => ({
      id: n._id ?? n.id ?? `n-${i}`,
      type: n.type ?? n.kind ?? "",
      title: n.title ?? n.subject ?? "Notification",
      message: n.message ?? n.body ?? n.text ?? "",
      createdAt: n.createdAt ?? n.timestamp ?? n.time ?? new Date().toISOString(),
      readAt: n.readAt ?? (n.read === true ? new Date().toISOString() : null),
    })),
    unreadFallback,
  };
};

/* -------------------------------------------------------------------------- */

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

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifRef = useRef(null);

  // Prefer admin token, then context user token, then localStorage fallback
  const token =
    adminToken ||
    userToken ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    "";

  const unread = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications]);

  // Load notifications (✅ uses /notifications/mine)
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let alive = true;

    const load = async () => {
      try {
        const res = await api.get("/notifications/mine", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const { items } = normalizeNotifications(res.data);
        if (!alive) return;
        setNotifications(items);
      } catch {
        if (alive) setNotifications([]);
      }
    };

    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [isLoggedIn, token]);

  // Close dropdowns on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!notifRef.current) return;
      if (!notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setNotifOpen(false);
    setAdminMenu(false);
  }, [location.pathname]);

  const toKey = (n) => n.id || `${n.type || "n"}-${n.createdAt || Math.random()}`;

  // ✅ theatre admins deep-link to /theatre/showtimes
  const resolveNotificationPath = (n) => {
    const t = (n.type || "").toLowerCase();
    if (t.includes("booking")) {
      return "/bookings"; // user booking list (admins usually have per-id route)
    }
    if (t.includes("showtime")) {
      if (isSuperAdmin) return "/admin/showtimes";
      if (isTheatreAdmin) return "/theatre/showtimes";
      if (isAdmin) return "/admin/showtimes";
      return "/showtimes";
    }
    // default landing by role
    if (isTheatreAdmin) return "/theatre/my";
    if (isSuperAdmin || isAdmin) return "/admin";
    return "/bookings";
  };

  // ✅ PATCH for read
  const markOneRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch { /* ignore */ }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n))
    );
  };

  const profilePath =
    isSuperAdmin ? "/admin/profile"
    : isTheatreAdmin ? "/theatre/profile"
    : "/profile";

  const anyAdmin = isSuperAdmin || isAdmin || isTheatreAdmin;

  return (
    <header className="w-full sticky top-0 z-50">
      <div className="relative isolate z-50 backdrop-blur-md bg-white/85 border-b border-slate-200 shadow-sm overflow-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* ROW: logo | middle nav | right controls */}
          <div className="h-16 flex items-center gap-6">
            {/* Brand (left) */}
            <Link to="/" className="flex items-center gap-3 shrink-0">
              <Card className="p-1.5">
                <Logo size={36} />
              </Card>
              <div className="leading-tight">
                <div className="text-2xl font-extrabold text-[#0071DC]">Cinema</div>
              </div>
            </Link>

            {/* Main Links (middle) */}
            <nav className="hidden md:flex items-center gap-5 ml-8">
              <NavLink to="/movies">
                {({ isActive }) => <GhostLink active={isActive}>Movies</GhostLink>}
              </NavLink>
              <NavLink to="/theaters">
                {({ isActive }) => <GhostLink active={isActive}>Theaters</GhostLink>}
              </NavLink>
              <NavLink to="/showtimes">
                {({ isActive }) => <GhostLink active={isActive}>Showtimes</GhostLink>}
              </NavLink>
              {/* Hide "My Bookings" for ALL admin roles */}
              {isLoggedIn && !anyAdmin && (
                <NavLink to="/bookings">
                  {({ isActive }) => <GhostLink active={isActive}>My Bookings</GhostLink>}
                </NavLink>
              )}
            </nav>

            {/* Right Controls (pushed right) */}
            <div className="ml-auto flex items-center gap-3 relative">
              {/* Notifications */}
              {isLoggedIn && (
                <div className="relative z-50" ref={notifRef}>
                  <IconBtn
                    aria-label="Notifications"
                    title="Notifications"
                    onClick={() => { setNotifOpen((v) => !v); setAdminMenu(false); }}
                  >
                    <Bell className="w-5 h-5" />
                  </IconBtn>

                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 text-[10px] leading-none px-1.5 py-0.5 rounded-full border border-white bg-rose-600 text-white shadow-sm">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}

                  {notifOpen && (
                    <Card
                      className="absolute right-0 mt-3 w-80 bg-white max-h-96 overflow-auto p-0 z-50"
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
                                    if (n.id && !n.readAt) markOneRead(n.id);
                                    navigate(to);
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
                                    {!n.readAt && <span className="mt-1 inline-block w-2 h-2 rounded-full bg-rose-500" />}
                                    <div className="flex-1">
                                      <div className="text-sm font-extrabold text-slate-900">
                                        {n.title || "Notification"}
                                      </div>
                                      <div className="text-xs text-slate-700 whitespace-pre-line">
                                        {n.message || ""}
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

              {/* Admin access / login + Login/Register pills */}
              {!isLoggedIn ? (
                <>
                  <button
                    onClick={() => navigate("/admin/login")}
                    className="text-sm font-semibold px-4 py-2 rounded-full border border-[#0071DC]/40 text-[#0071DC] hover:bg-[#E8F1FF]"
                  >
                    <Shield className="w-4 h-4 inline-block" /> Admin
                  </button>
                  <Link
                    to="/login"
                    className="text-sm font-semibold px-4 py-2 rounded-full border border-slate-300 text-slate-800 hover:bg-slate-50"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm font-semibold px-4 py-2 rounded-full bg-[#0071DC] text-white hover:bg-[#0654BA]"
                  >
                    Register
                  </Link>
                </>
              ) : null}

              {/* Account Menu — only when logged in */}
              {isLoggedIn && (
                <div className="relative">
                  <button
                    onClick={() => setAdminMenu((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border border-slate-300 bg-white"
                  >
                    <UserRound className="w-5 h-5 text-[#0071DC]" />
                    <span className="max-w-[160px] truncate">{user?.name || user?.email}</span>
                    <ChevronDown className="w-4 h-4 text-slate-600" />
                  </button>

                  {adminMenu && (
                    <Card className="absolute right-0 mt-2 w-64 p-1 bg-white z-50">
                      <MenuItemLink to={profilePath} onClick={() => setAdminMenu(false)}>
                        Profile
                      </MenuItemLink>

                      {/* Hide My Bookings for ALL admin roles */}
                      {!(isSuperAdmin || isAdmin || isTheatreAdmin) && (
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
                        onClick={async () => {
                          await logout();
                          setAdminMenu(false);
                          setNotifOpen(false);
                          navigate("/", { replace: true });
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-xl font-semibold"
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

      {/* Spacer in case sticky header overlaps admin pages */}
      {(location.pathname || "").startsWith("/admin") || (location.pathname || "").startsWith("/theatre")
        ? <div className="h-0 md:h-0" />
        : null}
    </header>
  );
}
