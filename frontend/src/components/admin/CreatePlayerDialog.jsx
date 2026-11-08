import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errMsg } from "@/lib/api";

const EMPTY = { username: "", password: "", balance: "0", role: "player" };

export const CreatePlayerDialog = ({ open, onOpenChange, onDone }) => {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/admin/users", { ...form, balance: form.balance.replace(",", ".") || "0" });
      toast.success(`${form.username} oluşturuldu`);
      setForm(EMPTY);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141A26] border-white/10" data-testid="create-player-dialog">
        <DialogHeader><DialogTitle className="font-display">Yeni Oyuncu Oluştur</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Kullanıcı Adı</Label>
            <Input data-testid="create-player-username-input" value={form.username} onChange={set("username")} required minLength={3} maxLength={32} pattern="[A-Za-z0-9_.\-]+" className="mt-1.5 bg-[#0B0E17]" /></div>
          <div><Label>Şifre</Label>
            <Input data-testid="create-player-password-input" value={form.password} onChange={set("password")} required minLength={6} className="mt-1.5 bg-[#0B0E17]" /></div>
          <div><Label>Açılış Bakiyesi (TRY)</Label>
            <Input data-testid="create-player-balance-input" inputMode="decimal" value={form.balance} onChange={set("balance")} className="mt-1.5 bg-[#0B0E17] font-mono" /></div>
          <div><Label>Rol</Label>
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
              <SelectTrigger data-testid="create-player-role-select" className="mt-1.5 bg-[#0B0E17]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="player">Oyuncu</SelectItem><SelectItem value="admin">Yönetici</SelectItem></SelectContent>
            </Select></div>
          <Button data-testid="create-player-submit-button" type="submit" disabled={busy} className="w-full rounded-full bg-amber-500 hover:bg-amber-400 text-[#0B0E17] font-bold">Oluştur</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
