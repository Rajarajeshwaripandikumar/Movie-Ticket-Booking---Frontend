// src/layouts/AdminShell.jsx
import React from "react";
import { Outlet } from "react-router-dom";

export default function AdminShell() {
  return (
    <div className="min-h-screen bg-white text-slate-900 p-6">
      <Outlet />
    </div>
  );
}
