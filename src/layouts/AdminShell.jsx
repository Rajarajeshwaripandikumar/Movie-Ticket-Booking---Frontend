// src/layouts/AdminShell.jsx
import React from "react";
import { Outlet } from "react-router-dom";

export default function AdminShell({ children }) {
  // Prefer Outlet for nested admin routes; if someone passes children, render that.
  return (
    <div className="min-h-screen bg-white text-slate-900 p-6">
      {children ?? <Outlet />}
    </div>
  );
}
