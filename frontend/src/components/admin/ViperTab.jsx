import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, PlugZap, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViperStats } from "@/components/admin/ViperStats";
import { api, errMsg, API } from "@/lib/api";

const CALLBACK_URL = `${API}/viper/callback`;

const Stat = ({ label, value, testid, accent = "text-white" }) => (
  <div className="rounded-xl bg-[#0B0E17] border border-white/10 p-4">
    <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    <p data-testid={testid} className={`mt-2 font-mono text-2xl font-bold ${accent}`}>{value ?? "—"}</p>
  </div>
);

export const ViperTab = () => {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    api.get("/admin/viper/account").then((r) => setAccount(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  const saveCallback = async () => {
    try {
      await api.put("/admin/viper/callback", { callback_url: CALLBACK_URL });
      toast.success("Callback URL Viper'a kaydedildi");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const runTest = async () => {
    const t = toast.loading("Entegrasyon testi çalışıyor...");
    try {
      const { data } = await api.post("/admin/viper/integration-test");
      setTestResult(data);
      toast.success("Test tamamlandı", { id: t });
    } catch (e) {
      toast.error(errMsg(e), { id: t });
    }
  };

  return (
    <div className="space-y-6">
      {error && <div data-testid="viper-error-message" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Hesap Durumu" value={account?.status} testid="viper-account-status" accent="text-amber-400" />
        <Stat label="Faturalama" value={account?.billing_mode} testid="viper-billing-mode" />
        <Stat label="Oyun Açılabilir" value={account ? (account.can_play ? "Evet" : "Hayır") : null} testid="viper-can-play" accent={account?.can_play ? "text-emerald-400" : "text-red-400"} />
      </div>

      <div className="rounded-xl bg-[#141A26]/80 border border-white/10 p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-1">Entegrasyon</h3>
        <p className="text-sm text-muted-foreground mb-4">Viper cüzdan işlemlerini (bahis/kazanç/iade) bu adrese gönderir.</p>
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <code data-testid="viper-callback-url" className="flex-1 rounded-lg bg-[#0B0E17] border border-white/10 px-3 py-2.5 text-xs text-amber-300 break-all">{CALLBACK_URL}</code>
          <Button variant="ghost" size="icon" data-testid="copy-callback-url-button" onClick={() => { navigator.clipboard.writeText(CALLBACK_URL); toast.success("Kopyalandı"); }}><Copy className="h-4 w-4" /></Button>
          <Button data-testid="save-callback-url-button" onClick={saveCallback} className="rounded-full bg-amber-500 hover:bg-amber-400 text-[#0B0E17] font-bold gap-2"><PlugZap className="h-4 w-4" />Viper'a Kaydet</Button>
          <Button data-testid="run-integration-test-button" variant="outline" onClick={runTest} className="rounded-full border-white/15 gap-2"><FlaskConical className="h-4 w-4" />Testi Çalıştır</Button>
        </div>
        {testResult && (
          <pre data-testid="integration-test-result" className="mt-4 max-h-80 overflow-auto rounded-lg bg-[#0B0E17] border border-white/10 p-3 text-xs text-gray-300">{JSON.stringify(testResult, null, 2)}</pre>
        )}
      </div>

      <ViperStats />
    </div>
  );
};
