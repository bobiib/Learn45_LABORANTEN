import { AlertCircle, CheckCircle2, LoaderCircle, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export function LoadingInline({ label = 'Wird geladen' }: { label?: string }) {
  return <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{label}</span>
}

export function LoadingCard({ title = 'Dein Lernbereich wird vorbereitet', detail = 'Das kann einen Moment dauern.' }: { title?: string; detail?: string }) {
  return <div className="panel flex min-h-56 flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
    <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary"><Sparkles className="size-5" aria-hidden="true" /></span>
    <div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div>
    <span className="sr-only">Wird geladen</span>
  </div>
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-warning/60 bg-warning/40 p-4 text-warning-foreground" role="alert">
    <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
    <div className="min-w-0"><p className="font-semibold">Dieser Schritt konnte nicht abgeschlossen werden</p><p className="mt-1 text-sm leading-6">{message}</p>{onRetry && <div className="mt-3"><Button variant="outline" onClick={onRetry}>Erneut versuchen</Button></div>}</div>
  </div>
}

export function SavedNotice({ children }: { children: ReactNode }) {
  return <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary"><CheckCircle2 className="size-3.5" aria-hidden="true" />{children}</p>
}
