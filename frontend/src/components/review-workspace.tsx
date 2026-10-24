import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Lightbulb, MessageCircle } from 'lucide-react'
import { AIChatPanel } from '@/components/ai-chat'
import { ErrorNotice, LoadingInline } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { AnswerSubmission, ChatMessage, LearningQuestion, ReviewResult, Topic } from '@/lib/types'

type Difficulty = NonNullable<AnswerSubmission['difficulty']>

type ReviewWorkspaceProps = {
  topic: Topic
  question: LearningQuestion
  answer: string
  review: ReviewResult
  difficulty: Difficulty | null
  ratingSaving: boolean
  error: string
  tutorMessages: ChatMessage[]
  onTutorMessages: (messages: ChatMessage[]) => void
  onDifficulty: (value: Difficulty) => void
  onContinue: () => void
  onTopic: () => void
  onDashboard: () => void
}

const bloomLabels = {
  Remember: 'ERINNERN',
  Understand: 'VERSTEHEN',
  Apply: 'ANWENDEN',
  Analyze: 'ANALYSIEREN',
  Evaluate: 'BEURTEILEN',
  Create: 'GESTALTEN',
} as const

export function ReviewWorkspace({ topic, question, answer, review, difficulty, ratingSaving, error, tutorMessages, onTutorMessages, onDifficulty, onContinue, onTopic, onDashboard }: ReviewWorkspaceProps) {
  const node = topic.nodes.find((item) => item.id === question.topicId)
  const style = review.correctness === 'strong' ? 'review-good' : review.correctness === 'partial' ? 'review-partial' : 'review-try'
  const Icon = review.correctness === 'strong' ? CheckCircle2 : review.correctness === 'partial' ? Lightbulb : ArrowUpRight
  const levels: { key: Difficulty; label: string }[] = [{ key: 'too-easy', label: 'Zu leicht' }, { key: 'about-right', label: 'Genau richtig' }, { key: 'too-hard', label: 'Zu schwer' }]
  const progress = node?.progress ?? topic.progress

  return <div className="mx-auto max-w-[1320px] space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" onClick={onTopic}><span className="inline-flex items-center gap-2"><ArrowLeft className="size-4" aria-hidden="true" /> Zum Lernpfad</span></Button><span className="text-xs text-muted-foreground">AUSWERTUNG DER ÜBUNG</span></div>

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.72fr)]">
      <Card className="panel min-w-0 gap-0 overflow-hidden p-0">
        <div className={`review-banner ${style} p-6 sm:p-8`}><div className="flex items-start gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card/75"><Icon className="size-6" aria-hidden="true" /></span><div><p className="eyebrow">{bloomLabels[question.stage]} · FEEDBACK</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{review.headline}</h1><p className="mt-3 max-w-2xl text-sm leading-7">{review.feedback}</p></div></div></div>

        <div className="space-y-7 p-6 sm:p-8">
          <section><p className="eyebrow">DEIN VERSUCH</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{question.prompt}</p><div className="mt-3 rounded-2xl bg-muted/70 p-4 text-sm leading-7 whitespace-pre-wrap">{answer}</div></section>

          <section><p className="eyebrow">LERNFORTSCHRITT</p><h2 className="mt-1 text-lg font-semibold">Dieser Versuch zählt</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Der Fortschritt zeigt die Qualität deiner Antwort und wie viel Unterstützung du genutzt hast. Er hilft dem Agenten, die nächste Übung sinnvoll zu wählen.</p><div className="mt-5 rounded-2xl bg-muted/70 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{review.evidenceLabel}</span><span className="text-sm font-semibold tabular-nums">{review.evidenceDelta > 0 ? `+${review.evidenceDelta}` : '±0'} Evidenz</span></div><div className="mt-4 flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">{node?.label ?? 'Thema'} Fortschritt</span><span className="font-semibold tabular-nums">{progress}%</span></div><Progress value={progress} aria-label={`${node?.label ?? 'Thema'} Fortschritt`} className="mt-2" /></div></section>

          <section><p className="text-sm font-semibold">Wie hat sich diese Aufgabe angefühlt?</p><p className="mt-1 text-xs text-muted-foreground">Deine Einschätzung hilft, den nächsten Schritt anzupassen – ohne Punktedruck.</p><div className="mt-3 flex flex-wrap gap-2">{levels.map((level) => <Button key={level.key} variant={difficulty === level.key ? 'secondary' : 'outline'} disabled={ratingSaving} onClick={() => onDifficulty(level.key)}>{level.label}</Button>)}</div>{ratingSaving && <div className="mt-2"><LoadingInline label="Einschätzung wird gespeichert …" /></div>}{difficulty && !ratingSaving && !error && <p className="mt-2 text-xs text-primary" role="status">Danke — deine Einschätzung ist für diese Übung gespeichert.</p>}{error && <div className="mt-3"><ErrorNotice message={error} /></div>}</section>
        </div>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <Card className="panel gap-0 bg-accent/50"><p className="eyebrow text-primary">EMPFOHLENER NÄCHSTER SCHRITT</p><span className="mt-4 flex size-10 items-center justify-center rounded-xl bg-card text-primary"><ArrowUpRight className="size-5" aria-hidden="true" /></span><h2 className="mt-4 text-lg font-semibold">{review.nextActivity}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{review.nextReason}</p><div className="mt-5 rounded-xl bg-card/75 p-3 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">Warum jetzt: </span>{review.correctness === 'incorrect' ? 'Ein kleinerer Schritt klärt zuerst den unsicheren Teil.' : `Deine Arbeit an «${node?.label ?? question.title}» macht diese nächste Herausforderung sinnvoll.`}</div><div className="mt-5 space-y-2"><Button variant="primary" onClick={onContinue}><span className="inline-flex items-center gap-2">Nächsten Schritt starten <ArrowRight className="size-4" aria-hidden="true" /></span></Button><div><Button variant="ghost" onClick={onDashboard}>Zum Dashboard</Button></div></div></Card>

        <div className="rounded-2xl border border-border bg-accent/35 p-4"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary"><MessageCircle className="size-4" aria-hidden="true" /></span><div><p className="text-sm font-semibold">Feedback gemeinsam verstehen</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Frag den KI-Coach, was hinter dem Feedback steckt. Er erklärt den nächsten Schritt, ohne ihn für dich zu lösen.</p></div></div></div>
        <AIChatPanel kind="tutor" chatId={`review-coach-${question.id}`} questionId={question.id} initialMessages={tutorMessages} title="KI-Feedback-Coach" detail="Feedback verstehen und gezielt verbessern" onMessagesChange={onTutorMessages} />
      </aside>
    </div>
  </div>
}
