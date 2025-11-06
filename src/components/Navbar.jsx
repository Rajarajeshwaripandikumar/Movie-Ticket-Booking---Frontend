// src/components/Navbar.jsx
import React, { useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";
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
function MenuItemLink({ to, children, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className="block w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-slate-50 font-semibold"
      role="menuitem"
    >
      {children}
    </NavLink>
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

const THEATRE_ADMIN_LINKS = [
  { label: "My Theatre", to: "/theatre/my" },
  { label: "Manage Screens", to: "/theatre/screens" },
  { label: "Manage Showtimes", to: "/theatre/showtimes" },
  { label: "Update Pricing", to: "/theatre/pricing" }, // ✅ fixed path
  { label: "Theatre Reports", to: "/theatre/reports" },
];

/* -------------------------------------------------------------------------- */

export default function Navbar() {
  const { token, role, user, logout, isAdmin, isSuperAdmin, isTheatreAdmin, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [adminMenu, setAdminMenu] = useState(false);

  // ✅ Route to the correct profile per role
  const profilePath = isSuperAdmin ? "/admin/profile" : isTheatreAdmin ? "/theatre/profile" : "/profile";

  return (
    <header className="w-full sticky top-0 z-50">
      <div className="backdrop-blur-md bg-white/85 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-3">
              <Card className="p-1.5">
                <Logo size={36} />
              </Card>
              <div className="leading-tight">
                <div className="text-2xl font-extrabold text-[#0071DC]">Cinema</div>
              </div>
            </Link>

            {/* Main Links */}
            <nav className="hidden md:flex items-center gap-5">
              <NavLink to="/movies">
                {({ isActive }) => <GhostLink active={isActive}>Movies</GhostLink>}
              </NavLink>
              <NavLink to="/theaters">
                {({ isActive }) => <GhostLink active={isActive}>Theaters</GhostLink>}
              </NavLink>
              <NavLink to="/showtimes">
                {({ isActive }) => <GhostLink active={isActive}>Showtimes</GhostLink>}
              </NavLink>

              {isLoggedIn && !isAdmin && (
                <NavLink to="/bookings">
                  {({ isActive }) => <GhostLink active={isActive}>My Bookings</GhostLink>}
                </NavLink>
              )}
            </nav>

            {/* Right Controls */}
            <div className="flex items-center gap-3 relative">
              {/* If not logged in → Admin Login button */}
              {!isLoggedIn && (
                <button
                  onClick={() => navigate("/admin/login")}
                  className="text-sm font-semibold px-4 py-2 rounded-full border border-[#0071DC]/40 text-[#0071DC] hover:bg-[#E8F1FF]"
                >
                  <Shield className="w-4 h-4 inline-block" /> Admin
                </button>
              )}

              {/* Account Menu */}
              {isLoggedIn && (
                <div className="relative">
                  <button
                    onClick={() => setAdminMenu((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border border-slate-300 bg-white"
                  >
                    <UserRound className="w-5 h-5 text-[#0071DC]" />
                    {user?.name || user?.email}
                    <ChevronDown className="w-4 h-4 text-slate-600" />
                  </button>

                  {adminMenu && (
                    <Card className="absolute right-0 mt-2 w-60 p-1 bg-white">
                      {/* Profile routes by role */}
                      <MenuItemLink to={profilePath} onClick={() => setAdminMenu(false)}>
                        Profile
                      </MenuItemLink>

                      {/* User-only */}
                      {!isAdmin && (
                        <MenuItemLink to="/bookings" onClick={() => setAdminMenu(false)}>
                          My Bookings
                        </MenuItemLink>
                      )}

                      {/* Super Admin links */}
                      {isSuperAdmin &&
                        SUPER_ADMIN_LINKS.map((item) => (
                          <MenuItemLink key={item.to} to={item.to} onClick={() => setAdminMenu(false)}>
                            {item.label}
                          </MenuItemLink>
                        ))}

                      {/* Theatre Admin links */}
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
    </header>
  );
}
