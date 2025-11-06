import { useEffect, useState } from "react";
import api from "../../api/api";
import { RefreshCcw, Search, UserRound, Mail, Building2 } from "lucide-react";

export default function TheatreAdmins() {
  const [admins, setAdmins] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  async function loadAdmins() {
    try {
      const res = await api.get("/superadmin/theatre-admins");
      const list = res?.data?.data || [];
      setAdmins(list);
      setFiltered(list);
      setErr("");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load theatre admins");
    }
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  useEffect(() => {
    const s = search.toLowerCase();
    setFiltered(
      admins.filter(
        (a) =>
          a.name?.toLowerCase().includes(s) ||
          a.email?.toLowerCase().includes(s) ||
          a.theatreId?.name?.toLowerCase().includes(s) ||
          a.theatreId?.city?.toLowerCase().includes(s)
      )
    );
  }, [search, admins]);

  const fmt = (d) => (d ? new Date(d).toLocaleString() : "-");

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex justify-between items-center">
          <h1 className="text-2xl font-extrabold flex gap-2 items-center">
            <UserRound className="h-6 w-6 text-[#0071DC]" /> Theatre Admins
          </h1>
          <button
            onClick={loadAdmins}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 transition"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {/* Search */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-3 border border-slate-300 rounded-xl px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-[#0071DC]">
            <Search className="h-5 w-5 text-slate-600" />
            <input
              type="text"
              placeholder="Search admin or theatre..."
              className="w-full outline-none text-sm bg-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Message */}
        {err && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 font-semibold p-3 rounded-xl">
            {err}
          </div>
        )}

        {/* Admins List */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="text-slate-500 italic text-center py-4">
              No theatre admins found.
            </p>
          ) : (
            <table className="w-full table-fixed text-left text-sm">
              {/* Lock column widths so cells stay aligned */}
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "28%" }} />
                <col style={{ width: "23%" }} />
                <col style={{ width: "15%" }} />
              </colgroup>

              <thead className="border-b bg-slate-100 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Theatre</th>
                  <th className="py-3 px-3">Created</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filtered.map((a) => (
                  <tr key={a._id} className="hover:bg-slate-50 align-middle">
                    {/* Name */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200 grid place-items-center text-slate-700 font-bold">
                          {a.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate" title={a.name}>
                            {a.name || "—"}
                          </div>
                          <div className="text-xs text-slate-500">OWNER</div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                        <span className="truncate" title={a.email}>
                          {a.email || "—"}
                        </span>
                      </div>
                    </td>

                    {/* Theatre */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
                        <span
                          className="truncate"
                          title={
                            a.theatreId?.name
                              ? `${a.theatreId.name}${a.theatreId?.city ? " • " + a.theatreId.city : ""}`
                              : ""
                          }
                        >
                          {a.theatreId?.name ? (
                            <>
                              {a.theatreId.name}
                              {a.theatreId?.city && (
                                <span className="text-slate-500"> • {a.theatreId.city}</span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Created */}
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {fmt(a.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
