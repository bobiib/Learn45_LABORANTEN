import { useRef, type ChangeEvent } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ArrowLeft, ArrowRight, FileText, Globe2, Search, Sparkles, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingInline } from '@/components/feedback'
import type { ReactNode } from 'react'

type TopicCreationDialogProps = {
  open: boolean
  step: 1 | 2
  hasSource: boolean
  sourceNames?: string[]
  hasGeneratedPlan: boolean
  uploading: boolean
  error: string
  aiInteraction?: ReactNode
  onOpenChange: (open: boolean) => void
  onStepChange: (step: 1 | 2) => void
  onUpload: (files: File[]) => void
  onViewPlan: () => void
}

export function TopicCreationDialog({ open, step, hasSource, sourceNames = [], hasGeneratedPlan, uploading, error, aiInteraction, onOpenChange, onStepChange, onUpload, onViewPlan }: TopicCreationDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length) onUpload(files)
    event.target.value = ''
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-[150] bg-foreground/30 backdrop-blur-sm" />
      <Dialog.Popup className="fixed left-1/2 top-1/2 z-[151] max-h-[min(92dvh,860px)] w-[calc(100%-24px)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-border bg-card p-5 text-foreground shadow-2xl outline-none sm:p-7">
        <input ref={fileInputRef} className="sr-only" type="file" multiple accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx" onChange={selectFile} aria-label="Choose source files for your new topic" tabIndex={-1} />
        <div className="flex items-start justify-between gap-4">
          <div><p className="eyebrow">CREATE A LEARNING SPACE</p><Dialog.Title className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Let’s build a learning plan</Dialog.Title><Dialog.Description className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Follow the steps to give Lea the material and context she needs to shape your plan.</Dialog.Description></div>
          <Dialog.Close render={<Button variant="ghost" size="icon-sm" aria-label="Close topic setup"><X className="size-4" aria-hidden="true" /></Button>} />
        </div>

        <ol aria-label="Topic creation steps" className="mt-6 flex items-start">
          {[{ number: 1, title: 'Source upload', note: 'Optional' }, { number: 2, title: 'Add details with AI', note: '' }].map((item, index) => {
            const active = step === item.number
            const complete = step > item.number
            return <li key={item.number} aria-current={active ? 'step' : undefined} className={`relative flex min-w-0 items-start gap-2 ${index === 0 ? 'flex-1' : 'pl-3'}`}>
              {index === 0 && <span aria-hidden="true" className="absolute left-7 right-0 top-3.5 h-px bg-border" />}
              <span className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${active ? 'border-primary bg-primary text-primary-foreground' : complete ? 'border-primary bg-accent text-primary' : 'border-border bg-background text-muted-foreground'}`}>{item.number}</span>
              <span className="relative z-10 min-w-0 bg-card pr-1"><span className={`block text-xs font-semibold sm:text-sm ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{item.title}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{item.note || 'Next step'}</span></span>
            </li>
          })}
        </ol>

        {step === 1 ? <section className="mt-5 rounded-2xl border border-border bg-background p-4 sm:p-5">
          <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><FileText className="size-5" aria-hidden="true" /></span><div><h2 className="text-base font-semibold">Start with your study material</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Upload notes or lecture files so Lea can build questions from your material. You can skip this for now.</p></div></div>
          {error && <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p>}
          {sourceNames.length > 0 && <div className="mt-4 rounded-xl border border-border bg-card p-3"><p className="text-xs font-medium text-muted-foreground">{sourceNames.length} {sourceNames.length === 1 ? 'source added' : 'sources added'}</p><ul className="mt-2 space-y-1 text-sm">{sourceNames.map((name, index) => <li key={`${name}-${index}`} className="truncate">{name}</li>)}</ul></div>}
          <div className="mt-5 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Starting without a source</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-background p-3"><span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Sparkles className="size-4" aria-hidden="true" /></span><h3 className="mt-2 text-sm font-semibold">Generate study content</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Ask AI to create a Markdown source for your topic.</p><span className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Not available yet</span></div>
              <div className="rounded-xl bg-background p-3"><span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Search className="size-4" aria-hidden="true" /></span><h3 className="mt-2 text-sm font-semibold">Search online for sources</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Find learning material on the web for your topic.</p><span className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"><Globe2 className="mr-1 size-3" aria-hidden="true" /> Not available yet</span></div>
            </div>
          </div>
          {uploading ? <div className="mt-5"><LoadingInline label="Adding your sources…" /></div> : <div className="mt-5 flex flex-wrap justify-end gap-2">{!hasSource && <Button variant="ghost" onClick={() => onStepChange(2)}>Continue without a source</Button>}<Button variant="outline" onClick={() => fileInputRef.current?.click()}><span className="inline-flex items-center gap-2"><Upload className="size-4" aria-hidden="true" /> Add sources</span></Button><Button variant="primary" disabled={!hasSource} onClick={() => onStepChange(2)}>Continue <ArrowRight className="ml-1 inline size-4" aria-hidden="true" /></Button></div>}
        </section> : <section className="mt-5 space-y-4">
          {hasSource ? <div className="space-y-3"><p className="text-sm leading-6 text-muted-foreground">Share your goal, exam date, available study time, or topics to focus on. Lea will combine these details with your source.</p>{aiInteraction}<div className="flex justify-end">{hasGeneratedPlan && <Button variant="primary" onClick={onViewPlan}><span className="inline-flex items-center gap-2">View learning plan <ArrowRight className="size-4" aria-hidden="true" /></span></Button>}</div></div> : <>
            <div className="rounded-2xl border border-border bg-background p-4"><h2 className="text-sm font-semibold">Add a source to continue</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">AI planning needs study material to work from. The source-free options are shown in Step 1 and are not available yet.</p></div>
            <div className="flex flex-wrap justify-between gap-2"><Button variant="ghost" onClick={() => onStepChange(1)}><span className="inline-flex items-center gap-2"><ArrowLeft className="size-4" aria-hidden="true" /> Back to source upload</span></Button><Dialog.Close render={<Button variant="outline">Close</Button>} /></div>
          </>}
        </section>}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}
