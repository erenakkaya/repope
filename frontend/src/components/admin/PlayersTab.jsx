import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, UserPlus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreatePlayerDialog } from "@/components/admin/CreatePlayerDialog";
import { BalanceDialog } from "@/components/admin/BalanceDialog";
import { PasswordDialog } from "@/components/admin/PasswordDialog";
import { DeleteUserDialog } from "@/components/admin/DeleteUserDialog";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg, tl } from "@/lib/api";

const ROLE = { admin: ["Yönetici", "bg-amber-500/15 text-amber-400"], dealer: ["Bayi", "bg-cyan-500/15 text-cyan-400"], player: ["Oyuncu", "bg-white/5 text-gray-300"] };

export const PlayersTab = () => {
  const { user: me, refresh } = useAuth();
  const isAdmin = me?.role === "admin";
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [creating, setCreating] = useState(false);
  const [balanceFor, setBalanceFor] = useState(null);
  const [passwordFor, setPasswordFor] = useState(null);
  const [deleteFor, setDeleteFor] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/manage/users", { params: { q, role: role === "all" ? "" : role } });
      setUsers(data);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }, [q, role]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const changed = () => { load(); refresh(); };

  const toggleBlock = async (u) => {
    try {
      await api.patch(`/manage/users/${u.id}`, { blocked: !u.blocked });
      toast.success(u.blocked ? "Hesap açıldı" : "Hesap engellendi");
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
        {isAdmin && (
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger data-testid="admin-role-filter-select" className="w-40 bg-[#0B0E17] border-white/10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm roller</SelectItem>
              <SelectItem value="player">Oyuncular</SelectItem>
              <SelectItem value="dealer">Bayiler</SelectItem>
              <SelectItem value="admin">Yöneticiler</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button data-testid="admin-create-player-btn" onClick={() => setCreating(true)} className="sm:ml-auto rounded-full bg-amber-500 hover:bg-amber-400 text-[#0B0E17] font-bold gap-2">
          <UserPlus className="h-4 w-4" /> {isAdmin ? "Yeni Kullanıcı" : "Yeni Oyuncu"}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              <TableHead>Kullanıcı Adı</TableHead><TableHead>Rol</TableHead>{isAdmin && <TableHead>Bayi</TableHead>}
              <TableHead className="text-right">Bakiye</TableHead><TableHead>Durum</TableHead><TableHead>Oluşturma</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const self = u.id === me?.id;
              const [rl, rc] = ROLE[u.role] || [u.role, ""];
              return (
                <TableRow key={u.id} data-testid={`player-row-${u.username}`} className="border-white/5">
                  <TableCell className="font-semibold">{u.username}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${rc}`}>{rl}</span></TableCell>
                  {isAdmin && <TableCell className="text-xs text-muted-foreground">{u.parent_username || "—"}</TableCell>}
                  <TableCell className="text-right font-mono text-emerald-400" data-testid={`player-balance-${u.username}`}>{tl(u.balance)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch data-testid={`player-block-toggle-${u.username}`} checked={!u.blocked} disabled={self} onCheckedChange={() => toggleBlock(u)} />
                      <span className={`text-xs ${u.blocked ? "text-red-400" : "text-emerald-400"}`}>{u.blocked ? "Engelli" : "Aktif"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString("tr-TR")}</TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="outline" disabled={self} data-testid={`admin-adjust-balance-btn-${u.username}`} onClick={() => setBalanceFor(u)} className="border-white/15 hover:border-amber-500">Bakiye</Button>
                    <Button size="sm" variant="ghost" data-testid={`admin-password-btn-${u.username}`} onClick={() => setPasswordFor(u)}>Şifre</Button>
                    <Button size="icon" variant="ghost" disabled={self} data-testid={`admin-delete-user-btn-${u.username}`} onClick={() => setDeleteFor(u)} aria-label="Sil" className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {users.length === 0 && <p data-testid="players-empty-message" className="text-center text-muted-foreground py-12 text-sm">Henüz kullanıcı yok.</p>}
      </div>
      <CreatePlayerDialog open={creating} onOpenChange={setCreating} onDone={changed} isAdmin={isAdmin} />
      <BalanceDialog user={balanceFor} onClose={() => setBalanceFor(null)} onDone={changed} />
      <PasswordDialog user={passwordFor} onClose={() => setPasswordFor(null)} />
      <DeleteUserDialog user={deleteFor} onClose={() => setDeleteFor(null)} onDone={changed} />
    </div>
  );
};
