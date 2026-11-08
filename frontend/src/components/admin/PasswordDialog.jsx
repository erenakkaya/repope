import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, errMsg } from "@/lib/api";

export const PasswordDialog = ({ user, onClose }) => {
  const [password, setPassword] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/users/${user.id}`, { password });
      toast.success("Şifre güncellendi");
      setPassword("");
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#141A26] border-white/10" data-testid="password-dialog">
        <DialogHeader><DialogTitle className="font-display">Şifre Değiştir · {user?.username}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Input data-testid="new-password-input" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required placeholder="Yeni şifre (en az 6 karakter)" className="bg-[#0B0E17]" />
          <Button data-testid="new-password-submit-button" type="submit" className="w-full rounded-full bg-amber-500 hover:bg-amber-400 text-[#0B0E17] font-bold">Kaydet</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
