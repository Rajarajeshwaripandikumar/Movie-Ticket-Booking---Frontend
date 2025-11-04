// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * ProtectedRoute wrapper — accepts roles prop as string or array
 * Usage: <ProtectedRoute roles={['SUPER_ADMIN']}><MyPage/></ProtectedRoute>
 */
export default function ProtectedRoute({ children, roles }) {
  const { token, role } = useAuth();
  const have = String(role || "").toUpperCase();

  if (!token) {
    // Choose login page depending on whether any admin role is requested
    const wantsAdmin = (roles || []).concat([]).some((r) => String(r || "").toUpperCase().includes("ADMIN"));
    return <Navigate to={wantsAdmin ? "/admin/login" : "/login"} replace />;
  }

  if (!roles || (Array.isArray(roles) && roles.length === 0)) return children;

  const wanted = Array.isArray(roles) ? roles.map((r) => String(r).toUpperCase()) : [String(roles).toUpperCase()];

  if (wanted.includes(have)) return children;

  // Allow SUPER_ADMIN to see THEATRE_ADMIN pages (optional)
  // if (have === "SUPER_ADMIN" && wanted.includes("THEATRE_ADMIN")) return children;

  if (have.includes("ADMIN")) return <Navigate to="/admin" replace />;

  return <Navigate to="/" replace />;
}
