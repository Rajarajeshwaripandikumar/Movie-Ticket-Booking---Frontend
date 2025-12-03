// src/layouts/AdminShell.jsx
import React from "react";
import { Outlet } from "react-router-dom";

export default function AdminShell() {
  return (
    <div className="min-h-[70vh] flex">
      {/* sidebar / topbar here */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
