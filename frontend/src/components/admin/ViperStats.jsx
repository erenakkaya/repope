import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, errMsg } from "@/lib/api";

const firstArray = (obj) => {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") for (const v of Object.values(obj)) if (Array.isArray(v) && v.length && typeof v[0] === "object") return v;
  return [];
};

const flatten = (obj, prefix = "") =>
  Object.entries(obj || {}).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? (prefix ? [] : flatten(v, `${k}.`)) : Array.isArray(v) ? [] : [[prefix + k, v]]
  );

export const ViperStats = () => {
  const [stats, setStats] = useState(null);
  const [ggr, setGgr] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/viper/stats").then((r) => setStats(r.data)).catch((e) => setError(errMsg(e)));
    api.get("/admin/viper/ggr").then((r) => setGgr(firstArray(r.data))).catch(() => {});
  }, []);

  const xKey = ggr[0] ? (["date", "day", "period"].find((k) => k in ggr[0]) || Object.keys(ggr[0])[0]) : "date";
  const data = ggr.map((r) => ({ ...r, ggr: Number(r.ggr ?? 0) }));

  return (
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
      <div className="rounded-xl bg-[#141A26]/80 border border-white/10 p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4">Günlük GGR (son 30 gün)</h3>
        <div className="h-72" data-testid="viper-ggr-chart">
          {data.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F59E0B" stopOpacity={0.5} /><stop offset="100%" stopColor="#F59E0B" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey={xKey} stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ background: "#141A26", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="ggr" stroke="#F59E0B" fill="url(#g)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground pt-24 text-center">GGR verisi yok.</p>}
        </div>
      </div>
      <div className="rounded-xl bg-[#141A26]/80 border border-white/10 p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4">İstatistikler</h3>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <dl data-testid="viper-stats-list" className="space-y-2.5 max-h-72 overflow-auto">
          {flatten(stats).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 text-sm border-b border-white/5 pb-2">
              <dt className="text-muted-foreground">{k}</dt><dd className="font-mono text-white">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
};
