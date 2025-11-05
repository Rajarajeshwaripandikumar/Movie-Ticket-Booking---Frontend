// src/pages/super/TheatreAdmins.jsx
import { useEffect, useState } from "react";
import api from "../../api/api";

export default function TheatreAdmins() {
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/superadmin/theatre-admins");
        setAdmins(res?.data?.data || []);
      } catch (e) {
        console.error("Failed to load theatre admins", e);
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="font-semibold text-2xl mb-4">Theatre Admins</h1>
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
                {a.theatreId?.name} {a.theatreId?.city ? `(${a.theatreId.city})` : ""}
              </td>
              <td className="p-3 border">
                {a.createdAt ? new Date(a.createdAt).toLocaleString() : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
