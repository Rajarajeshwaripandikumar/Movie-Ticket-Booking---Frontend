// src/pages/super/TheatreAdmins.jsx
import { useEffect, useState } from "react";
import api from "../../api/api";

export default function TheatreAdmins() {
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const res = await api.get("/admin/theatre-admins");
      setAdmins(res.data);
    } catch (err) {
      console.error("Error fetching theatre admins:", err);
    }
  };

  return (
    <div className="p-6">
      <h1 className="font-semibold text-2xl mb-4">Theatre Admins</h1>

      <table className="w-full border text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 border">Name</th>
            <th className="p-3 border">Email</th>
            <th className="p-3 border">Theatre</th>
          </tr>
        </thead>

        <tbody>
          {admins.map((admin) => (
            <tr key={admin._id}>
              <td className="p-3 border">{admin.name}</td>
              <td className="p-3 border">{admin.email}</td>
              <td className="p-3 border">{admin.theatreName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
