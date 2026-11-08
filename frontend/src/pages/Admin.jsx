import { Users, Receipt, Activity, Settings } from "lucide-react";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/Header";
import { PlayersTab } from "@/components/admin/PlayersTab";
import { TransactionsTab } from "@/components/admin/TransactionsTab";
import { ViperTab } from "@/components/admin/ViperTab";

const trigger = "gap-2 rounded-full px-5 data-[state=active]:bg-amber-500 data-[state=active]:text-[#0B0E17]";

export default function Admin() {
  return (
    <div className="relative z-10">
      <Header />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <p className="font-mono text-xs tracking-[0.3em] text-amber-400 mb-3">YÖNETİM MERKEZİ</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-10">Kontrol Paneli</h1>
        <Tabs defaultValue="players">
          <TabsList className="bg-[#141A26] border border-white/10 rounded-full h-12 p-1 mb-8">
            <TabsTrigger value="players" data-testid="admin-tab-players" className={trigger}><Users className="h-4 w-4" />Oyuncular</TabsTrigger>
            <TabsTrigger value="transactions" data-testid="admin-tab-transactions" className={trigger}><Receipt className="h-4 w-4" />İşlemler</TabsTrigger>
            <TabsTrigger value="viper" data-testid="admin-tab-viper" className={trigger}><Activity className="h-4 w-4" />Viper</TabsTrigger>
            <TabsTrigger value="settings" data-testid="admin-tab-settings" className={trigger}><Settings className="h-4 w-4" />Ayarlar</TabsTrigger>
          </TabsList>
          <TabsContent value="players"><PlayersTab /></TabsContent>
          <TabsContent value="transactions"><TransactionsTab /></TabsContent>
          <TabsContent value="viper"><ViperTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
