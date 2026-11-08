import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg, tl } from "@/lib/api";

const MODES = [
  ["add", "Ekle", "bg-emerald-500 hover:bg-emerald-400 text-[#0B0E17]"],
  ["deduct", "Düş", "bg-red-500 hover:bg-red-400 text-white"],
  ["set", "Düzelt", "bg-amber-500 hover:bg-amber-400 text-[#0B0E17]"],
];

export const BalanceDialog = ({ user, onClose, onDone }) => {
  const { user: me } = useAuth();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (mode) => {
    const value = amount.replace(",", ".");
    if (!(Number(value) > 0) && !(mode === "set" && Number(value) === 0 && value !== "")) return toast.error("Geçerli bir tutar girin");
    setBusy(true);
    try {
      await api.post(`/manage/users/${user.id}/balance`, { amount: value, mode, note: note || null });
      toast.success({ add: "Bakiye eklendi", deduct: "Bakiye düşüldü", set: "Bakiye düzeltildi" }[mode]);
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
        {me?.role === "dealer" && <p className="text-xs text-muted-foreground">Eklenen tutar bayi bakiyenizden düşülür, düşülen tutar bayi bakiyenize eklenir.</p>}
        <div><Label>Tutar (TRY)</Label>
          <Input data-testid="balance-amount-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100.00" className="mt-1.5 bg-[#0B0E17] font-mono text-lg h-12" /></div>
        <div><Label>Not (opsiyonel)</Label>
          <Input data-testid="balance-note-input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className="mt-1.5 bg-[#0B0E17]" /></div>
        <div className="grid grid-cols-3 gap-3">
          {MODES.map(([mode, label, cls]) => (
            <Button key={mode} data-testid={`balance-${mode}-button`} disabled={busy} onClick={() => send(mode)} className={`rounded-full font-bold ${cls}`}>{label}</Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">"Düzelt" bakiyeyi doğrudan girdiğiniz tutara ayarlar.</p>
      </DialogContent>
    </Dialog>
  );
};
