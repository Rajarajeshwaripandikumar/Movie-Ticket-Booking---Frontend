// src/layouts/AdminShell.jsx
import useSSE from "../hooks/useSSE";

export default function AdminShell({ children }) {
  useSSE(); // ✅ SSE mounted once and stable
  return <>{children}</>;
}
