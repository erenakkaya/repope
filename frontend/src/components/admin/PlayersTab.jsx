import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreatePlayerDialog } from "@/components/admin/CreatePlayerDialog";
import { BalanceDialog } from "@/components/admin/BalanceDialog";
import { PasswordDialog } from "@/components/admin/PasswordDialog";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg, tl } from "@/lib/api";

export const PlayersTab = () => {
  const { user: me, refresh } = useAuth();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [balanceFor, setBalanceFor] = useState(null);
  const [passwordFor, setPasswordFor] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/users", { params: { q } });
      setUsers(data);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const changed = () => { load(); refresh(); };

  const toggleBlock = async (u) => {
    try {
      await api.patch(`/admin/users/${u.id}`, { blocked: !u.blocked });
      toast.success(u.blocked ? "Hesap açıldı" : "Hesap kilitlendi");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="rounded-xl bg-[#141A26]/80 border border-white/10 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="admin-player-search-input" placeholder="Kullanıcı adı ara" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 bg-[#0B0E17] border-white/10" />
        </div>
        <Button data-testid="admin-create-player-btn" onClick={() => setCreating(true)} className="sm:ml-auto rounded-full bg-amber-500 hover:bg-amber-400 text-[#0B0E17] font-bold gap-2">
          <UserPlus className="h-4 w-4" /> Yeni Oyuncu
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              <TableHead>Kullanıcı Adı</TableHead><TableHead>Rol</TableHead><TableHead className="text-right">Bakiye</TableHead>
              <TableHead>Durum</TableHead><TableHead>Oluşturma</TableHead><TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} data-testid={`player-row-${u.username}`} className="border-white/5">
                <TableCell className="font-semibold">{u.username}</TableCell>
                <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-amber-500/15 text-amber-400" : "bg-white/5 text-gray-300"}`}>{u.role === "admin" ? "Yönetici" : "Oyuncu"}</span></TableCell>
                <TableCell className="text-right font-mono text-emerald-400" data-testid={`player-balance-${u.username}`}>{tl(u.balance)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch data-testid={`player-block-toggle-${u.username}`} checked={!u.blocked} disabled={u.id === me?.id} onCheckedChange={() => toggleBlock(u)} />
                    <span className={`text-xs ${u.blocked ? "text-red-400" : "text-emerald-400"}`}>{u.blocked ? "Kilitli" : "Aktif"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString("tr-TR")}</TableCell>
                <TableCell className="text-right space-x-2 whitespace-nowrap">
                  <Button size="sm" variant="outline" data-testid={`admin-adjust-balance-btn-${u.username}`} onClick={() => setBalanceFor(u)} className="border-white/15 hover:border-amber-500">Bakiye</Button>
                  <Button size="sm" variant="ghost" data-testid={`admin-password-btn-${u.username}`} onClick={() => setPasswordFor(u)}>Şifre</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <CreatePlayerDialog open={creating} onOpenChange={setCreating} onDone={changed} />
      <BalanceDialog user={balanceFor} onClose={() => setBalanceFor(null)} onDone={changed} />
      <PasswordDialog user={passwordFor} onClose={() => setPasswordFor(null)} />
    </div>
  );
};
