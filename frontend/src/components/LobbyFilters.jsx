import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const chip = (active) =>
  `shrink-0 px-4 h-9 rounded-full text-sm font-semibold border transition-colors ${
    active ? "bg-amber-500 text-[#0B0E17] border-amber-500" : "bg-[#141A26] text-gray-300 border-white/10 hover:border-amber-500/50"
  }`;

export const LobbyFilters = ({ meta, filters, setFilters }) => {
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
      <div className="flex gap-2 overflow-x-auto pb-1 flex-1" data-testid="category-filter-list">
        <button data-testid="category-chip-all" className={chip(!filters.category)} onClick={() => set("category", "")}>Tümü</button>
        {(meta.categories || []).map((c) => (
          <button key={c.code} data-testid={`category-chip-${c.code}`} className={chip(filters.category === c.code)}
            onClick={() => set("category", c.code)}>
            <span className="capitalize">{c.name}</span>
            <span className="ml-1.5 opacity-60 font-mono text-xs">{c.games}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <Select value={filters.provider || "all"} onValueChange={(v) => set("provider", v === "all" ? "" : v)}>
          <SelectTrigger data-testid="provider-filter-select" className="w-48 h-10 bg-[#141A26] border-white/10">
            <SelectValue placeholder="Sağlayıcı" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="all">Tüm sağlayıcılar</SelectItem>
            {(meta.providers || []).map((p) => (
              <SelectItem key={p.code} value={p.code}>{p.name} ({p.games})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="game-search-input" placeholder="Oyun ara..." value={filters.search} maxLength={64}
            onChange={(e) => set("search", e.target.value)} className="h-10 pl-9 bg-[#141A26] border-white/10" />
        </div>
      </div>
    </div>
  );
};
