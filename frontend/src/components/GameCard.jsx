import { Play, Wrench } from "lucide-react";

const FALLBACK = "https://images.unsplash.com/photo-1518895312237-a9e23508077d?crop=entropy&cs=srgb&fm=jpg&q=70&w=400";

export const GameCard = ({ game, onPlay, index }) => (
  <button
    data-testid="game-card-item"
    onClick={() => !game.maintenance && onPlay(game)}
    disabled={game.maintenance}
    style={{ animationDelay: `${Math.min(index, 24) * 25}ms` }}
    className="rise group relative text-left rounded-xl overflow-hidden bg-[#141A26] border border-white/5 hover:border-amber-500/60 hover:-translate-y-1 transition-[transform,border-color] duration-300 disabled:opacity-50"
  >
    <div className="aspect-[4/5] overflow-hidden">
      <img src={game.thumbnail || FALLBACK} alt={game.name} loading="lazy"
        onError={(e) => { e.currentTarget.src = FALLBACK; }}
        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
    </div>
    <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E17] via-[#0B0E17]/10 to-transparent" />
    <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
      <span data-testid="play-game-button" className="h-14 w-14 rounded-full bg-amber-500 text-[#0B0E17] grid place-items-center shadow-[0_0_30px_rgba(245,158,11,0.5)]">
        {game.maintenance ? <Wrench className="h-5 w-5" /> : <Play className="h-6 w-6 fill-current ml-0.5" />}
      </span>
    </div>
    <div className="absolute bottom-0 inset-x-0 p-3">
      <p className="text-sm font-semibold text-white truncate">{game.name}</p>
      <p className="text-[11px] uppercase tracking-wider text-amber-400/80 truncate">{game.provider}</p>
    </div>
    {game.maintenance && (
      <span className="absolute top-2 left-2 text-[10px] font-bold bg-red-500/90 text-white px-2 py-0.5 rounded-full">BAKIMDA</span>
    )}
  </button>
);
