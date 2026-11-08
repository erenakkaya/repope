import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Lock, User, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";
import { Brand } from "@/context/SiteContext";

const HERO = "https://images.unsplash.com/photo-1726003906867-081fc895ce5d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(errMsg(err, "Geçersiz kullanıcı adı veya şifre"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative z-10 min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden lg:block relative overflow-hidden">
        <img src={HERO} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0E17]/40 via-[#0B0E17]/70 to-[#0B0E17]" />
        <div className="absolute bottom-16 left-14 max-w-md rise">
          <p className="text-amber-400 font-mono text-xs tracking-[0.3em] mb-4">CASINO · SPOR · CANLI</p>
          <h2 className="text-5xl font-extrabold leading-[1.05] text-white">Masaya otur.<br />Şansını konuştur.</h2>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <form onSubmit={submit} className="w-full max-w-sm rise" data-testid="login-form">
          <div className="mb-12">
            <Brand className="text-2xl" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">Giriş Yap</h1>
          <p className="text-sm text-muted-foreground mb-10">Kullanıcı adın ve şifrenle devam et.</p>

          <label className="text-xs uppercase tracking-widest text-muted-foreground">Kullanıcı Adı</label>
          <div className="relative mt-2 mb-6">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input data-testid="login-username-input" value={username} onChange={(e) => setUsername(e.target.value)}
              className="h-12 pl-10 bg-[#141A26] border-white/10 focus-visible:ring-amber-500" autoComplete="username" required />
          </div>

          <label className="text-xs uppercase tracking-widest text-muted-foreground">Şifre</label>
          <div className="relative mt-2 mb-6">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input data-testid="login-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="h-12 pl-10 bg-[#141A26] border-white/10 focus-visible:ring-amber-500" autoComplete="current-password" required />
          </div>

          {error && <p data-testid="login-error-message" className="text-sm text-red-400 mb-4">{error}</p>}

          <Button data-testid="login-submit-button" type="submit" disabled={busy}
            className="w-full h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-[#0B0E17] font-bold text-base transition-colors">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Giriş Yap"}
          </Button>
          <p className="text-xs text-muted-foreground mt-8">Hesaplar yalnızca sistem yöneticisi tarafından oluşturulur.</p>
        </form>
      </div>
    </div>
  );
}
