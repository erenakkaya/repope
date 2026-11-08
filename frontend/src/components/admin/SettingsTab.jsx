import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSite } from "@/context/SiteContext";
import { api, errMsg } from "@/lib/api";

const field = "mt-1.5 bg-[#0B0E17] border-white/10";

export const SettingsTab = () => {
  const { reloadSite } = useSite();
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ site_name: "", viper_api_url: "", viper_api_key: "", viper_api_secret: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const apply = (data) => {
    setInfo(data);
    setForm({ site_name: data.site_name, viper_api_url: data.viper_api_url, viper_api_key: "", viper_api_secret: "" });
  };

  useEffect(() => { api.get("/admin/settings").then((r) => apply(r.data)).catch((e) => toast.error(errMsg(e))); }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put("/admin/settings", form);
      apply(data);
      reloadSite();
      toast.success("Ayarlar kaydedildi");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="max-w-2xl rounded-xl bg-[#141A26]/80 border border-white/10 p-4 sm:p-6 space-y-6" data-testid="settings-form">
      <div>
        <h3 className="text-lg font-semibold">Site</h3>
        <Label className="mt-4 block">Site Adı</Label>
        <Input data-testid="settings-site-name-input" value={form.site_name} onChange={set("site_name")} maxLength={40} className={field} />
      </div>
      <div className="border-t border-white/5 pt-6">
        <h3 className="text-lg font-semibold">Viper API</h3>
        <p className="text-xs text-muted-foreground mt-1">Anahtar ve secret alanlarını boş bırakırsanız mevcut değerler korunur.</p>
        <Label className="mt-4 block">API Adresi</Label>
        <Input data-testid="settings-api-url-input" value={form.viper_api_url} onChange={set("viper_api_url")} className={field} />
        <Label className="mt-4 block">API Key</Label>
        <Input data-testid="settings-api-key-input" value={form.viper_api_key} onChange={set("viper_api_key")} autoComplete="off"
          placeholder={info?.viper_api_key_masked ? `Mevcut: ${info.viper_api_key_masked}` : "Ayarlanmadı"} className={`${field} font-mono`} />
        <Label className="mt-4 block">API Secret</Label>
        <Input data-testid="settings-api-secret-input" type="password" value={form.viper_api_secret} onChange={set("viper_api_secret")} autoComplete="new-password"
          placeholder={info?.has_secret ? "•••••••• (kayıtlı)" : "Ayarlanmadı"} className={`${field} font-mono`} />
      </div>
      <Button data-testid="settings-save-button" type="submit" disabled={busy} className="rounded-full bg-amber-500 hover:bg-amber-400 text-[#0B0E17] font-bold px-8">Kaydet</Button>
    </form>
  );
};
