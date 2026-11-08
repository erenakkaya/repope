import { Link, useNavigate } from "react-router-dom";
import { RefreshCw, LogOut, Shield, Trophy, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { tl } from "@/lib/api";
import { Brand } from "@/context/SiteContext";

export const Header = ({ onSports }) => {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const doLogout = () => { logout(); navigate("/login"); };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0B0E17]/80 border-b border-white/5">
      <div className="max-w-[1600px] mx-auto flex items-center gap-3 px-4 sm:px-8 h-16">
        <Link to="/" data-testid="header-brand-link" className="mr-auto">
          <Brand className="text-xl" />
        </Link>
        {onSports && (
          <Button data-testid="header-sports-button" variant="ghost" onClick={onSports} className="hidden sm:flex gap-2 text-gray-300 hover:text-amber-400">
            <Trophy className="h-4 w-4" /> Spor Bahisleri
          </Button>
        )}
        {user?.role === "admin" && (
          <Button asChild variant="ghost" className="gap-2 text-gray-300 hover:text-amber-400">
            <Link to="/admin" data-testid="header-admin-link"><Shield className="h-4 w-4" /><span className="hidden md:inline">Yönetim</span></Link>
          </Button>
        )}
        {!onSports && (
          <Button asChild variant="ghost" className="gap-2 text-gray-300 hover:text-amber-400">
            <Link to="/" data-testid="header-lobby-link"><LayoutGrid className="h-4 w-4" /><span className="hidden md:inline">Lobi</span></Link>
          </Button>
        )}
        <div className="flex items-center gap-2 rounded-full bg-[#141A26] border border-white/10 pl-4 pr-1 py-1">
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.username}</span>
          <span data-testid="player-balance-display" className="font-mono font-bold text-emerald-400">{tl(user?.balance)}</span>
          <button data-testid="refresh-balance-button" onClick={refresh} aria-label="Bakiyeyi yenile"
            className="h-8 w-8 grid place-items-center rounded-full hover:bg-white/10 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <Button data-testid="logout-button" variant="ghost" size="icon" onClick={doLogout} aria-label="Çıkış Yap">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};
