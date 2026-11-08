import { Users, Receipt, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/Header";
import { PlayersTab } from "@/components/admin/PlayersTab";
import { TransactionsTab } from "@/components/admin/TransactionsTab";
import { useAuth } from "@/context/AuthContext";
import { tl } from "@/lib/api";

const trigger = "gap-2 rounded-full px-5 data-[state=active]:bg-amber-500 data-[state=active]:text-[#0B0E17]";

export default function Dealer() {
  const { user } = useAuth();
  return (
    <div className="relative z-10">
      <Header />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="flex flex-col md:flex-row md:items-end gap-6 mb-10">
          <div className="mr-auto">
            <p className="font-mono text-xs tracking-[0.3em] text-amber-400 mb-3">BAYİ PANELİ</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Oyuncularım</h1>
          </div>
          <div className="rounded-xl bg-[#141A26] border border-amber-500/30 px-6 py-4 flex items-center gap-4">
            <Wallet className="h-6 w-6 text-amber-400" />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Bayi Bakiyem</p>
              <p data-testid="dealer-balance-display" className="font-mono text-2xl font-bold text-emerald-400">{tl(user?.balance)}</p>
            </div>
          </div>
        </div>
        <Tabs defaultValue="players">
          <TabsList className="bg-[#141A26] border border-white/10 rounded-full h-12 p-1 mb-8">
            <TabsTrigger value="players" data-testid="dealer-tab-players" className={trigger}><Users className="h-4 w-4" />Oyuncular</TabsTrigger>
            <TabsTrigger value="transactions" data-testid="dealer-tab-transactions" className={trigger}><Receipt className="h-4 w-4" />İşlemler</TabsTrigger>
          </TabsList>
          <TabsContent value="players"><PlayersTab /></TabsContent>
          <TabsContent value="transactions"><TransactionsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
