import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { GameCard } from "@/components/GameCard";
import { GameModal } from "@/components/GameModal";
import { LobbyFilters } from "@/components/LobbyFilters";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";

const PER_PAGE = 48;

export default function Lobby() {
  const { user, refresh } = useAuth();
  const [meta, setMeta] = useState({ providers: [], categories: [], total: 0 });
  const [filters, setFilters] = useState({ category: "", provider: "", search: "" });
  const [search, setSearch] = useState("");
  const [games, setGames] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(null);

  useEffect(() => {
    api.get("/casino/providers").then((r) => setMeta(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(filters.search.trim()), 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  const load = useCallback(async (p) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/casino/games", {
        category: filters.category || null, provider: filters.provider || null, search: search || null, page: p, per_page: PER_PAGE,
      });
      setGames((g) => (p === 1 ? data.games || [] : [...g, ...(data.games || [])]));
      setTotal(data.total || 0);
      setPage(p);
    } catch (e) {
      setError(errMsg(e, "Oyunlar yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.provider, search]);

  useEffect(() => { load(1); }, [load]);

  const play = async (game) => {
    const t = toast.loading(`${game.name} açılıyor...`);
    try {
      const { data } = await api.post("/casino/launch", { game_id: game.id, return_url: window.location.origin });
      setActive({ name: game.name, url: data.url });
      toast.dismiss(t);
    } catch (e) {
      toast.error(errMsg(e, "Oyun açılamadı"), { id: t });
    }
  };

  const openSports = async () => {
    try {
      const { data } = await api.post("/casino/games", { category: "sports", per_page: 10 });
      if (!data.games?.length) return toast.error("Spor bahisleri şu an kullanılamıyor");
      play(data.games[0]);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const closeGame = () => { setActive(null); refresh(); };

  return (
    <div className="relative z-10">
      <Header onSports={openSports} />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <section className="mb-10 rise">
          <p className="font-mono text-xs tracking-[0.3em] text-amber-400 mb-3">HOŞ GELDİN, {user?.username?.toUpperCase()}</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">Oyun Lobisi</h1>
          <p className="text-sm text-muted-foreground mt-3">
            <span className="font-mono text-white" data-testid="lobby-total-games">{meta.total || total}</span> oyun, {meta.providers?.length || 0} sağlayıcı
          </p>
        </section>

        <LobbyFilters meta={meta} filters={filters} setFilters={setFilters} />

        {error && (
          <div data-testid="lobby-error-message" className="mt-8 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0" /> {error}
          </div>
        )}

        <div data-testid="game-grid" className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {games.map((g, i) => <GameCard key={`${g.id}-${i}`} game={g} index={i % PER_PAGE} onPlay={play} />)}
        </div>

        {!loading && !error && games.length === 0 && (
          <p data-testid="lobby-empty-message" className="text-center text-muted-foreground py-20">Oyun bulunamadı.</p>
        )}
        {loading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>}
        {!loading && games.length < total && (
          <div className="flex justify-center mt-10">
            <Button data-testid="load-more-games-button" variant="outline" onClick={() => load(page + 1)}
              className="rounded-full px-8 border-white/15 hover:border-amber-500 hover:text-amber-400">
              Daha fazla yükle ({games.length}/{total})
            </Button>
          </div>
        )}
      </main>
      <GameModal game={active} onClose={closeGame} />
    </div>
  );
}
