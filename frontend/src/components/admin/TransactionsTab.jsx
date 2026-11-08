import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errMsg, tl } from "@/lib/api";

const LABELS = {
  bet: ["Bahis", "text-red-400 bg-red-500/10"],
  win: ["Kazanç", "text-emerald-400 bg-emerald-500/10"],
  rollback: ["İade", "text-cyan-400 bg-cyan-500/10"],
  admin_credit: ["Yükleme", "text-amber-400 bg-amber-500/10"],
  admin_debit: ["Çekim", "text-orange-400 bg-orange-500/10"],
  transfer_out: ["Bayi → Oyuncu", "text-violet-300 bg-violet-500/10"],
  transfer_in: ["Oyuncu → Bayi", "text-sky-300 bg-sky-500/10"],
};

export const TransactionsTab = () => {
  const [rows, setRows] = useState([]);
  const [username, setUsername] = useState("");
  const [action, setAction] = useState("all");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/manage/transactions", { params: { username, action: action === "all" ? "" : action } });
      setRows(data);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }, [username, action]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  return (
    <div className="rounded-xl bg-[#141A26]/80 border border-white/10 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Input data-testid="tx-username-filter-input" placeholder="Kullanıcı adı" value={username} onChange={(e) => setUsername(e.target.value)} className="max-w-xs bg-[#0B0E17] border-white/10" />
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger data-testid="tx-action-filter-select" className="w-44 bg-[#0B0E17] border-white/10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm işlemler</SelectItem>
            {Object.entries(LABELS).map(([k, [l]]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              <TableHead>Tarih</TableHead><TableHead>Kullanıcı</TableHead><TableHead>Tür</TableHead>
              <TableHead className="text-right">Tutar</TableHead><TableHead className="text-right">Sonraki Bakiye</TableHead>
              <TableHead>Durum</TableHead><TableHead>Detay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => {
              const [label, cls] = LABELS[t.action] || [t.action, ""];
              return (
                <TableRow key={t.tx_id} data-testid="tx-row" className="border-white/5">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(t.created_at).toLocaleString("tr-TR")}</TableCell>
                  <TableCell className="font-semibold">{t.username}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span></TableCell>
                  <TableCell className="text-right font-mono">{tl(t.amount)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{t.balance_after ? tl(t.balance_after) : "—"}</TableCell>
                  <TableCell className="text-xs">
                    {t.status === "ok" ? (t.rolled_back ? <span className="text-cyan-400">İade edildi</span> : <span className="text-emerald-400">Tamam</span>)
                      : <span className="text-red-400">{t.error_code || t.status}</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">{[t.note || t.provider || t.round_id, t.by && `(${t.by})`].filter(Boolean).join(" ")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {rows.length === 0 && <p data-testid="tx-empty-message" className="text-center text-muted-foreground py-12 text-sm">Henüz işlem yok.</p>}
      </div>
    </div>
  );
};
