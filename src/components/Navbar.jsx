import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // Use Auth context to check login status
import Logo from "./Logo";
import {
  ChevronDown,
  Menu,
  X,
  UserRound,
  Shield,
  LogOut,
} from "lucide-react";
import NotificationBell from "./NotificationBell";

const cn = (...xs) => xs.filter(Boolean).join(" ");

const normalizePathForCompare = (urlOrPath = "") => {
  try {
    const u = new URL(
      urlOrPath,
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost"
    );
    const pathname = String(u.pathname).replace(/\/+$/, "") || "/";
    const search = u.search || "";
    return pathname + search;
  } catch (e) {
    return String(urlOrPath).replace(/\/+$/, "") || "/";
  }
};

const safeNavigate = (navigate, to, opts = {}) => {
  try {
    if (!to) return false;
    const current = normalizePathForCompare(
      window.location.pathname + window.location.search
    );
    const targetPath = normalizePathForCompare(to);
    if (current === targetPath) return false;
    navigate(to, { replace: false, ...opts });
    return true;
  } catch (e) {
    try {
      navigate(to, opts);
      return true;
    } catch {}
    return false;
  }
};

const Card = ({ className = "", as: Comp = "div", ...rest }) => (
  <Comp
    className={cn(
      "bg-white border border-slate-200 rounded-2xl shadow-sm",
      className
    )}
    {...rest}
  />
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

function MenuItemLink({ to, children, onClick }) {
  const navigate = useNavigate();
  const clickingRef = useRef(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        if (clickingRef.current) return;
        clickingRef.current = true;
        try {
          onClick?.();
          const didNavigate = safeNavigate(navigate, to);
          if (!didNavigate)
            navigate(to, { state: { __forceNav: Date.now() } });
        } finally {
          setTimeout(() => {
            clickingRef.current = false;
          }, 120);
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
  { label: "Manage Dashboard", to: "/admin/dashboard" },
  { label: "Manage Theaters", to: "/admin/theaters" },
  { label: "Manage Movies", to: "/admin/movies" },
  { label: "Manage Screens", to: "/admin/screens" },
  { label: "Manage Showtimes", to: "/admin/showtimes" },
  { label: "Update Pricing", to: "/admin/pricing" },
  { label: "Admin Analytics", to: "/admin/analytics" },
  { label: "Theatre Admins", to: "/super/theatre-admins" },
];

const THEATRE_ADMIN_LINKS = [
  { label: "Profile", to: "/theatre/profile" },
  { label: "Dashboard", to: "/theatre/dashboard" },
  { label: "Manage Screens", to: "/theatre/screens" },
  { label: "Manage Showtimes", to: "/theatre/showtimes" },
  { label: "Update Pricing", to: "/theatre/pricing" },
  { label: "Theatre Reports", to: "/theatre/reports" },
];

export default function Navbar() {
  const {
    user,
    logout,
    isAdmin,
    isSuperAdmin,
    isTheatreAdmin,
    isLoggedIn,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [adminMenu, setAdminMenu] = useState(false);

  /* ---------- Close Menus On Navigation ---------- */
  useEffect(() => {
    setAdminMenu(false);
  }, [location.pathname]);

  const profilePath = isSuperAdmin
    ? "/admin/profile"
    : isTheatreAdmin
    ? "/theatre/profile"
    : "/profile";

  const anyAdmin = isSuperAdmin || isAdmin || isTheatreAdmin;

  return (
    <header className="w-full sticky top-0 z-50">
      <div className="relative isolate z-50 backdrop-blur-md bg-white/85 border-b border-slate-200 shadow-sm overflow-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center gap-6">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 shrink-0">
              <Card className="p-1.5">
                <Logo size={36} />
              </Card>
              <div className="leading-tight">
                <div className="text-2xl font-extrabold text-[#0071DC]">
                  Cinema
                </div>
              </div>
            </Link>

            {/* Main Nav */}
            <nav className="hidden md:flex items-center gap-5 ml-8">
              <NavLink to="/movies" className={navLinkClasses}>
                Movies
              </NavLink>
              <NavLink to="/theaters" className={navLinkClasses}>
                Theaters
              </NavLink>
              {/* Only show the Showtimes link if logged in */}
              {isLoggedIn && (
                <NavLink to="/showtimes" className={navLinkClasses}>
                  Showtimes
                </NavLink>
              )}

              {isLoggedIn && !anyAdmin && (
                <NavLink to="/bookings" className={navLinkClasses}>
                  My Bookings
                </NavLink>
              )}
            </nav>

            <div className="ml-auto flex items-center gap-3 relative">
              {/* Logged out header (Admin / Login / Register) */}
              {!isLoggedIn && (
                <>
                  <Link
                    to="/admin/login"
                    className="text-sm font-semibold px-4 py-2 rounded-full border border-[#0071DC]/40 text-[#0071DC] hover:bg-[#E8F1FF] inline-flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4 inline-block" /> Admin
                  </Link>

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
              )}

              {/* Logged in user controls */}
              {isLoggedIn && (
                <div className="relative flex items-center gap-2">
                  {/* 🔔 Notification bell */}
                  <NotificationBell />

                  {/* User menu */}
                  <div className="relative">
                    <button
                      onClick={() => setAdminMenu((v) => !v)}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border border-slate-300 bg-white"
                    >
                      <UserRound className="w-5 h-5 text-[#0071DC]" />
                      <span className="max-w-[160px] truncate">
                        {user?.name || user?.email}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    </button>

                    {adminMenu && (
                      <Card className="absolute right-0 mt-2 w-64 p-1 bg-white z-50">
                        {/* 🔹 Show top Profile ONLY for non-theatre users */}
                        {!isTheatreAdmin && (
                          <MenuItemLink
                            to={profilePath}
                            onClick={() => setAdminMenu(false)}
                          >
                            Profile
                          </MenuItemLink>
                        )}

                        {!anyAdmin && (
                          <MenuItemLink
                            to="/bookings"
                            onClick={() => setAdminMenu(false)}
                          >
                            My Bookings
                          </MenuItemLink>
                        )}

                        {isSuperAdmin &&
                          SUPER_ADMIN_LINKS.map((item) => (
                            <MenuItemLink
                              key={item.to}
                              to={item.to}
                              onClick={() => setAdminMenu(false)}
                            >
                              {item.label}
                            </MenuItemLink>
                          ))}

                        {isTheatreAdmin &&
                          THEATRE_ADMIN_LINKS.map((item) => (
                            <MenuItemLink
                              key={item.to}
                              to={item.to}
                              onClick={() => setAdminMenu(false)}
                            >
                              {item.label}
                            </MenuItemLink>
                          ))}

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await logout();
                            } catch {}
                            finally {
                              setAdminMenu(false);
                              safeNavigate(navigate, "/", { replace: true });
                            }
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-xl font-semibold"
                        >
                          <LogOut className="inline w-4 h-4 mr-1" /> Logout
                        </button>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {/* Mobile menu button */}
              <IconBtn className="md:hidden" onClick={() => setOpen((v) => !v)}>
                {open ? <X /> : <Menu />}
              </IconBtn>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
