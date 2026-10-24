import type { FormEvent, RefObject } from 'react'
import { ArrowLeft, ArrowRight, ChevronRight, Clock3, Info, Lightbulb, MessageCircle, UsersRound } from 'lucide-react'
import { AIChatPanel } from '@/components/ai-chat'
import { ErrorNotice } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ChatMessage, LearningQuestion, Topic } from '@/lib/types'

type QuestionWorkspaceProps = {
  topic: Topic
  question: LearningQuestion
  answer: string
  hintsUsed: number
  hintsOpen: boolean
  tutorEnabled: boolean
  tutorMessages: ChatMessage[]
  busy: boolean
  error: string
  answerRef: RefObject<HTMLTextAreaElement | null>
  onBack: () => void
  onAnswer: (answer: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onHint: () => void
  onToggleHints: () => void
  onTutorMessages: (messages: ChatMessage[]) => void
}

const hints = [
  'Beginne damit, zu benennen, wer die Zusammenfassung liest und was diese Person danach tun soll.',
  'Für eine Projektleitung sind Entscheidungen, Zuständigkeiten und nächste Schritte oft hilfreicher als eine chronologische Nacherzählung.',
  'Bitte um ein kurzes Update für die Projektleitung, nenne Entscheidungen und Verantwortliche und markiere fehlende Angaben in den Notizen.',
]

const bloomLabels = {
  Remember: 'ERINNERN',
  Understand: 'VERSTEHEN',
  Apply: 'ANWENDEN',
  Analyze: 'ANALYSIEREN',
  Evaluate: 'BEURTEILEN',
  Create: 'GESTALTEN',
} as const

export function QuestionWorkspace(props: QuestionWorkspaceProps) {
  const relatedNode = props.topic.nodes.find((node) => node.id === props.question.topicId)
  const rationale = relatedNode
    ? `Diese Übung vertieft «${relatedNode.label}»: ${relatedNode.description}`
    : `Diese Übung gehört zu deinem Lernpfad «${props.topic.title}».`
  const wordCount = props.answer.trim().split(/\s+/).filter(Boolean).length

  return <div className="mx-auto max-w-[1320px] space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" onClick={props.onBack}><span className="inline-flex items-center gap-2"><ArrowLeft className="size-4" aria-hidden="true" /> Zum Lernpfad</span></Button>
      <span className="text-xs text-muted-foreground">{props.topic.title} <ChevronRight className="mx-1 inline size-3" aria-hidden="true" /> Übung</span>
    </div>

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.72fr)]">
      <Card className="panel question-workspace min-w-0 gap-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{props.question.mode === 'Partner' ? 'GEMEINSAME ÜBUNG' : 'EIGENSTÄNDIGE ÜBUNG'} · {bloomLabels[props.question.stage]}</p>
            <h1 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">{props.question.title}</h1>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true" /> {props.question.duration}</span>
        </div>

        <div className="mt-6 rounded-2xl bg-accent/40 p-5 sm:p-6">
          <p className="eyebrow text-primary">DEINE AUFGABE</p>
          <p className="mt-3 text-base leading-8">{props.question.prompt}</p>
          {props.question.mode === 'Partner' && <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-xs leading-5 text-muted-foreground"><UsersRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> Diese Aufgabe eignet sich besonders für den Austausch mit einer Kollegin oder einem Kollegen. Du kannst sie auch allein lösen und deine Begründung anschliessend mit dem Feedback vergleichen.</div>}
          <div className="mt-5 border-t border-primary/10 pt-4"><p className="text-xs font-semibold text-foreground">Warum jetzt?</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{rationale}</p></div>
        </div>

        <form className="mt-6" onSubmit={props.onSubmit}>
          <label htmlFor="answer" className="text-sm font-semibold">Deine Antwort</label>
          <Textarea ref={props.answerRef} id="answer" value={props.answer} onChange={(event) => props.onAnswer(event.target.value)} rows={8} disabled={props.busy} required placeholder="Nimm dir einen Moment zum Nachdenken. Dein erster Versuch muss nicht perfekt sein …" className="mt-2 min-h-48 resize-y rounded-2xl bg-background p-4 text-sm leading-7" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">{wordCount} Wörter · Hinweise genutzt: {props.hintsUsed}/3 <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-xs" className="rounded-full" aria-label="Wie der Fortschritt gezählt wird"><Info className="size-3.5" aria-hidden="true" /></Button>} /><TooltipContent className="max-w-xs">Unabhängige, treffende Antworten zählen am stärksten. Hinweise und Teilantworten können trotzdem Lernfortschritt zeigen. Das ist ein Lernsignal, keine Note.</TooltipContent></Tooltip></span>
            <Button variant="primary" type="submit" disabled={props.busy || !props.answer.trim()}><span className="inline-flex items-center gap-2">{props.busy ? <><span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />Wird ausgewertet</> : <>Feedback erhalten <ArrowRight className="size-4" aria-hidden="true" /></>}</span></Button>
          </div>
        </form>

        {props.error && <div className="mt-4"><ErrorNotice message={props.error} /></div>}

        <div className="mt-6 border-t border-border pt-5">
          <Button variant="outline" onClick={props.onToggleHints}><span className="inline-flex items-center gap-2"><Lightbulb className="size-4" aria-hidden="true" /> {props.hintsOpen ? 'Hinweise ausblenden' : 'Einen Hinweis holen'} <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{props.hintsUsed}/3</span></span></Button>
          {props.hintsOpen && <div className="mt-4 space-y-2" aria-live="polite">{hints.slice(0, props.hintsUsed).map((hint, index) => <div key={hint} className="flex gap-3 rounded-xl bg-muted/65 p-3 text-sm leading-6"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold">{index + 1}</span>{hint}</div>)}<Button variant="ghost" disabled={props.hintsUsed >= 3} onClick={props.onHint}>{props.hintsUsed < 3 ? `Hinweis ${props.hintsUsed + 1} anzeigen` : 'Alle Hinweise angezeigt'} <ArrowRight className="ml-1 size-4" aria-hidden="true" /></Button></div>}
        </div>
      </Card>

      <aside className="min-w-0 lg:sticky lg:top-24">
        <div className="mb-3 flex items-start gap-3 rounded-2xl border border-border bg-accent/35 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary"><MessageCircle className="size-4" aria-hidden="true" /></span>
          <div><p className="text-sm font-semibold">Denken statt vorsagen</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Der KI-Coach stellt Rückfragen und hilft dir beim Strukturieren. Die Antwort formulierst du selbst.</p></div>
        </div>
        {props.tutorEnabled
          ? <AIChatPanel kind="tutor" chatId={`tutor-${props.question.id}`} questionId={props.question.id} initialMessages={props.tutorMessages} title="KI-Coach" detail="Fragen und Hinweise – keine fertige Lösung" onMessagesChange={props.onTutorMessages} />
          : <Card className="panel"><p className="text-sm font-semibold">KI-Coach ist deaktiviert</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Aktiviere den Coach in deinem Lernkontext, wenn du beim Nachdenken begleitet werden möchtest.</p></Card>}
      </aside>
    </div>
  </div>
}
