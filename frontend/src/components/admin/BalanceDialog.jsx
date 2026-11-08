import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api, errMsg, tl } from "@/lib/api";

export const BalanceDialog = ({ user, onClose, onDone }) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (sign) => {
    const value = amount.replace(",", ".");
    if (!(Number(value) > 0)) return toast.error("Geçerli bir tutar girin");
    setBusy(true);
    try {
      await api.post(`/admin/users/${user.id}/balance`, { amount: sign < 0 ? `-${value}` : value, note: note || null });
      toast.success(sign > 0 ? "Bakiye eklendi" : "Bakiye düşüldü");
      setAmount(""); setNote("");
      onClose();
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#141A26] border-white/10" data-testid="balance-dialog">
        <DialogHeader><DialogTitle className="font-display">Bakiye · {user?.username}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Mevcut bakiye: <span className="font-mono text-emerald-400">{tl(user?.balance)}</span></p>
        <div><Label>Tutar (TRY)</Label>
          <Input data-testid="balance-amount-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100.00" className="mt-1.5 bg-[#0B0E17] font-mono text-lg h-12" /></div>
        <div><Label>Not (opsiyonel)</Label>
          <Input data-testid="balance-note-input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className="mt-1.5 bg-[#0B0E17]" /></div>
        <div className="grid grid-cols-2 gap-3">
          <Button data-testid="balance-add-button" disabled={busy} onClick={() => send(1)} className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#0B0E17] font-bold">+ Bakiye Ekle</Button>
          <Button data-testid="balance-deduct-button" disabled={busy} onClick={() => send(-1)} className="rounded-full bg-red-500 hover:bg-red-400 text-white font-bold">− Bakiye Düş</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
