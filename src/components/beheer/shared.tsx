import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DataTable({
  headers,
  rows,
  emptyMessage = "Geen data.",
  emptyAction,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="px-3 py-10 text-center">
                <div className="text-xs text-muted-foreground mb-3">{emptyMessage}</div>
                {emptyAction}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-accent/40 align-top">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2">
                  {c ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RowActions({
  onEdit,
  onDelete,
  extra,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex justify-end gap-1">
      {extra}
      {onEdit && (
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      {onDelete && (
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function ConfirmDelete({
  open,
  onOpenChange,
  onConfirm,
  title = "Item verwijderen?",
  description = "Deze actie kan niet ongedaan worden gemaakt.",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Verwijderen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(size === "lg" ? "max-w-2xl" : "max-w-lg")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function FormRow({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  return <div className={cn("grid gap-3", cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : "grid-cols-3")}>{children}</div>;
}

export function FormField({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
