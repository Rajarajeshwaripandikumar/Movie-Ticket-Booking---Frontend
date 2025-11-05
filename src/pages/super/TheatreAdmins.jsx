import { useEffect, useState } from "react";
import api from "../../api/api";

export default function TheatreAdmins() {
  const [admins, setAdmins] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/superadmin/theatre-admins");
        setAdmins(res?.data?.data || []);
      } catch (e) {
        setErr(e?.response?.data?.message || "Failed to load admins");
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Theatre Admins</h1>
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <div className="overflow-x-auto">
        <table className="w-full border text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 border">Name</th>
              <th className="p-3 border">Email</th>
              <th className="p-3 border">Theatre</th>
              <th className="p-3 border">Created</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a._id}>
                <td className="p-3 border">{a.name}</td>
                <td className="p-3 border">{a.email}</td>
                <td className="p-3 border">
                  {a.theatreId?.name}
                  {a.theatreId?.city ? ` (${a.theatreId.city})` : ""}
                </td>
                <td className="p-3 border">
                  {a.createdAt ? new Date(a.createdAt).toLocaleString() : "-"}
                </td>
              </tr>
            ))}
            {!admins.length && (
              <tr>
                <td className="p-3 border italic text-gray-500" colSpan={4}>
                  No theatre admins yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
