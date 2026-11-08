import { X } from "lucide-react";

export const GameModal = ({ game, onClose }) => {
  if (!game) return null;
  return (
    <div data-testid="game-launch-modal" className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="h-12 flex items-center justify-between px-4 border-b border-white/10">
        <span className="font-display font-semibold truncate">{game.name}</span>
        <button data-testid="game-modal-close-button" onClick={onClose} aria-label="Kapat"
          className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/10 transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>
      <iframe data-testid="game-iframe" title={game.name} src={game.url} className="flex-1 w-full border-0"
        allow="autoplay; fullscreen; encrypted-media" allowFullScreen />
    </div>
  );
};
