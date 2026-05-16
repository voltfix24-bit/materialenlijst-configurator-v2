import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Database, Sun, Moon, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { getGlobalDirty, onGlobalDirtyChange } from "@/lib/dirty-state";
import { useNotificatieBadge } from "@/lib/leersysteem/hooks";

const items = [
  { to: "/cases", label: "Cases", icon: LayoutGrid },
  { to: "/beheer", label: "Beheer", icon: Database },
  { to: "/notificaties", label: "Notificaties", icon: Bell },
];

function TerreVoltLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 130" className={className} fill="none" aria-hidden>
      <path
        d="M55 5L10 65h35L30 115l60-70H55L70 5z"
        fill="#2db85a"
        stroke="#2db85a"
        strokeWidth="2"
      />
      <rect x="20" y="108" width="60" height="6" rx="3" fill="#eaab20" />
      <rect x="30" y="116" width="40" height="4" rx="2" fill="#eaab20" />
      <rect x="40" y="122" width="20" height="3" rx="1.5" fill="#eaab20" />
    </svg>
  );
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
      className="w-16 shrink-0 flex flex-col items-center py-4 gap-2 sticky top-0 h-screen z-40"
      style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}
    >
      <Link to="/cases" title="TerreVolt" className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-[#0e1e35] ring-1 ring-white/5">
        <TerreVoltLogo className="w-6 h-7" />
      </Link>

      <div className="flex flex-col gap-1.5">
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
                "relative w-11 h-11 rounded-xl flex items-center justify-center transition-all group",
                active
                  ? "bg-primary/15 text-white border-l-2 border-primary"
                  : "text-[color:var(--sidebar-foreground)] hover:bg-[color:var(--sidebar-accent)] hover:text-white",
              )}
            >
              <Icon className="w-5 h-5" />
              {it.to === "/notificaties" && notificatieCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-[color:var(--sidebar)]">
                  {notificatieCount > 9 ? "9+" : notificatieCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={toggle}
        title={theme === "dark" ? "Licht thema" : "Donker thema"}
        className="mt-auto w-11 h-11 rounded-xl flex items-center justify-center text-[color:var(--sidebar-foreground)] hover:bg-[color:var(--sidebar-accent)] hover:text-white transition-colors"
      >
        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
    </aside>
  );
}
