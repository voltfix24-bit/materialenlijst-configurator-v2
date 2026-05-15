import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Database, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { getGlobalDirty, onGlobalDirtyChange } from "@/lib/dirty-state";

const items = [
  { to: "/cases", label: "Cases", icon: LayoutGrid },
  { to: "/beheer", label: "Beheer", icon: Database },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [isDirty, setIsDirty] = useState(getGlobalDirty());

  useEffect(() => onGlobalDirtyChange(setIsDirty), []);

  function handleNav(e: React.MouseEvent, to: string) {
    if (pathname === to) return;
    e.preventDefault();
    if (isDirty && !confirm("Je hebt niet-opgeslagen wijzigingen. Weet je zeker dat je wilt navigeren?")) {
      return;
    }
    navigate({ to });
  }

  return (
    <aside className="w-14 shrink-0 border-r border-border bg-sidebar flex flex-col items-center py-3 gap-1 sticky top-0 h-screen z-40">
      <div className="w-8 h-8 rounded-md bg-primary/15 text-primary flex items-center justify-center font-semibold text-sm mb-2">
        M
      </div>
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
              "w-10 h-10 rounded-md flex items-center justify-center text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors",
              active && "bg-sidebar-accent text-foreground",
            )}
          >
            <Icon className="w-5 h-5" />
          </Link>
        );
      })}
      <button
        type="button"
        onClick={toggle}
        title={theme === "dark" ? "Licht thema" : "Donker thema"}
        className="mt-auto w-10 h-10 rounded-md flex items-center justify-center text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
      >
        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
    </aside>
  );
}
