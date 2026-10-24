import { Dialog } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'

type AIConfirmationDialogProps = {
  open: boolean
  title: string
  description: string
  details: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function AIConfirmationDialog({ open, title, description, details, confirmLabel = 'Send to Gemini', onConfirm, onCancel }: AIConfirmationDialogProps) {
  return <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel() }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-[200] bg-foreground/45 backdrop-blur-[2px]" />
      <Dialog.Popup className="fixed left-1/2 top-1/2 z-[201] w-[calc(100%-24px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl outline-none sm:p-6">
        <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
        <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">{description}</Dialog.Description>
        <p className="mt-3 rounded-xl bg-muted/70 p-3 text-xs leading-5 text-foreground">{details}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}
