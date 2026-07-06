import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Database, Sun, Moon, Bell, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { getGlobalDirty, onGlobalDirtyChange } from "@/lib/dirty-state";
import { useNotificatieBadge } from "@/lib/leersysteem/hooks";

import terrevoltIcon from "@/assets/terrevolt-icon.png.asset.json";
import terrevoltIconWhite from "@/assets/terrevolt-icon-white-print.svg.asset.json";

const items = [
  { to: "/cases", label: "Cases", icon: LayoutGrid },
  { to: "/beheer", label: "Beheer", icon: Database },
  { to: "/notificaties", label: "Notificaties", icon: Bell },
];

function TerreVoltLogo({ dark, className }: { dark: boolean; className?: string }) {
  // In donker thema tonen we het witte icoon; in licht thema
  // blijft het compacte gekleurde icoon staan.
  if (dark) {
    return <img src={terrevoltIconWhite.url} alt="TerreVolt" className={className} />;
  }
  return <img src={terrevoltIcon.url} alt="TerreVolt" className={className} />;
}


export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [isDirty, setIsDirty] = useState(getGlobalDirty());
  const { data: notificatieCount = 0 } = useNotificatieBadge();

  useEffect(() => onGlobalDirtyChange(setIsDirty), []);

  function handleNav(e: React.MouseEvent, to: string) {
    if (pathname === to) return;
    e.preventDefault();
    if (
      isDirty &&
      !confirm("Je hebt niet-opgeslagen wijzigingen. Weet je zeker dat je wilt navigeren?")
    ) {
      return;
    }
    navigate({ to });
  }

  return (
    <aside
      className="w-[72px] shrink-0 flex flex-col items-center py-4 gap-3 sticky top-0 h-screen z-40"
      style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}
    >
      <Link
        to="/cases"
        title="TerreVolt"
        className="flex items-center justify-center mb-2 w-12 h-12 rounded-xl"
      >
        <TerreVoltLogo dark={theme === "dark"} className={theme === "dark" ? "w-8 h-8" : "w-7 h-8"} />
      </Link>

      <div className="flex flex-col gap-2">
        {items.map((it) => {
          const active = pathname === it.to || pathname.startsWith(it.to + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={(e) => handleNav(e, it.to)}
              title={it.label}
              className={cn(
                "relative w-12 h-12 rounded-full flex items-center justify-center transition-all group",
                active
                  ? "bg-primary text-white shadow-md"
                  : "text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="w-5 h-5" />
              {it.to === "/notificaties" && notificatieCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-[color:var(--sidebar)]">
                  {notificatieCount > 9 ? "9+" : notificatieCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          onClick={toggle}
          title={theme === "dark" ? "Licht thema" : "Donker thema"}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button
          type="button"
          title="Instellingen"
          className="w-12 h-12 rounded-full flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
}
