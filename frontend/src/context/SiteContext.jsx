import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const SiteCtx = createContext({ siteName: "", reloadSite: () => {} });

export function SiteProvider({ children }) {
  const [siteName, setSiteName] = useState("");

  const reloadSite = useCallback(async () => {
    try {
      const { data } = await api.get("/public/settings");
      setSiteName(data.site_name);
      document.title = data.site_name;
    } catch {
      setSiteName("Casino");
    }
  }, []);

  useEffect(() => { reloadSite(); }, [reloadSite]);

  return <SiteCtx.Provider value={{ siteName, reloadSite }}>{children}</SiteCtx.Provider>;
}

export const useSite = () => useContext(SiteCtx);

export const Brand = ({ className = "" }) => {
  const { siteName } = useSite();
  return (
    <span data-testid="site-brand-name" className={`font-display font-extrabold tracking-tight ${className}`}>
      {siteName}<span className="text-amber-400">.</span>
    </span>
  );
};
