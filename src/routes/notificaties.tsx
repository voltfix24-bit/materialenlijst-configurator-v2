import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/notificaties')({
  component: NotificatiesPage,
})

function NotificatiesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">Notificaties</h1>
      <p className="text-muted-foreground text-sm">
        Wordt volledig uitgewerkt in de volgende stap.
      </p>
    </div>
  )
}
