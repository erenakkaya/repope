import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { api, errMsg, tl } from "@/lib/api";

export const DeleteUserDialog = ({ user, onClose, onDone }) => {
  const confirm = async () => {
    try {
      await api.delete(`/manage/users/${user.id}`);
      toast.success(`${user.username} silindi`);
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      onClose();
    }
  };

  return (
    <AlertDialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="bg-[#141A26] border-white/10" data-testid="delete-user-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{user?.username} silinsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            Hesap listeden kalkar ve giriş yapamaz; geçmiş işlemler saklanır.
            {Number(user?.balance) > 0 && ` Kalan ${tl(user?.balance)} bakiye iade edilir.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="delete-user-cancel-button">Vazgeç</AlertDialogCancel>
          <AlertDialogAction data-testid="delete-user-confirm-button" onClick={confirm} className="bg-red-500 hover:bg-red-400 text-white">Sil</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
