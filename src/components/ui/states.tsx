import { AlertCircle, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function LoadingState({
  label = "Laden…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 gap-3 text-center text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin" />
      <p className="text-xs">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Er ging iets mis",
  description,
  onRetry,
  icon: Icon = AlertCircle,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 gap-3 text-center",
        className,
      )}
      role="alert"
    >
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <Icon className="h-6 w-6 text-destructive" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
        )}
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Opnieuw proberen
        </Button>
      )}
    </div>
  );
}

export function SkeletonRows({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-5" />
          ))}
        </div>
      ))}
    </div>
  );
}
