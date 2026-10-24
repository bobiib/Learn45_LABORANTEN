import { ArrowRight, ArrowUpRight, Check, CheckCircle2, Circle, FileText, Lightbulb, RotateCcw, UserRound, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BloomIndicator, LearningPopover, LearningReveal, LearningSurface } from '@/components/ui/learning'
import { bloomLabels } from '@/lib/learning-engine'
import { activityTime } from '@/lib/learning-content'
import type { AnswerSubmission, LearningActivity, LearningMode, PracticeAttempt, ReviewResult } from '@/lib/types'
import type { AnswerDraft } from './learning-answer'

type ReviewWorkspaceProps = {
  activity: LearningActivity
  draft: AnswerDraft
  review: ReviewResult
  mode: LearningMode
  supported: boolean
  attempts: PracticeAttempt[]
  difficulty: AnswerSubmission['difficulty']
  ratingSaving: boolean
  error: string
  onDifficulty: (value: NonNullable<AnswerSubmission['difficulty']>) => void
  next: LearningActivity
  remainingMinutes: number
  onContinue: () => void
  onRetry: () => void
  onCoach: () => void
  onFinish: () => void
}

export function ReviewWorkspace(props: ReviewWorkspaceProps) {
  const { review, activity, draft, next, mode } = props
  const strong = review.correctness === 'strong' && !review.assessmentPending
  const timeFits = activityTime(next) <= props.remainingMinutes
  const recent = props.attempts.filter((attempt) => attempt.skillId === activity.skillId && attempt.stage === activity.stage && !attempt.supported && attempt.mode !== 'together').slice(-8)
  const evidence = review.assessmentPending ? 'Fachliche Prüfung steht aus' : mode === 'together' ? 'Gemeinsam erarbeitet' : props.supported ? 'Mit Unterstützung erarbeitet' : 'Selbstständig erarbeitet'
  const hasEnoughEvidence = recent.length >= 5
  const ratio = recent.length ? recent.filter((attempt) => attempt.correctness === 'strong').length / recent.length : 0
  const challenge = !hasEnoughEvidence ? 'Dein Lernniveau wird noch eingeordnet.' : ratio > .9 ? 'Bereit für mehr Herausforderung.' : ratio < .8 ? 'Ein kleinerer Schritt passt jetzt besser.' : 'Die Herausforderung passt zu deinen Versuchen.'
  const criteria = [...(review.criteria ?? [])].sort((first, second) => Number(first.met) - Number(second.met))
  const feedback = review.assessmentPending
    ? 'Die fachliche Prüfung steht noch aus. Dein Kompetenzstand bleibt vorerst unverändert.'
    : review.feedback.split(/(?<=[.!?])\s+/)[0]
  const renderCriterion = (criterion: NonNullable<ReviewResult['criteria']>[number]) => <li key={criterion.id} data-met={criterion.met}>
    <span className="learn-criterion-icon">{criterion.met ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}</span>
    <div><span>{criterion.label}</span>{!criterion.met && <span className="learn-criterion-detail">{criterion.explanation}</span>}</div>
  </li>

  return <LearningReveal><LearningSurface>
    <div className="learn-review-result">
      <div className="learn-review-outcome"><span className="learn-result-icon">{strong ? <Check className="size-4" /> : <Lightbulb className="size-4" />}</span><BloomIndicator stage={activity.stage} /></div>
      <h1 className="learn-title">{review.headline}</h1>
      <p className="learn-review-copy">{feedback}</p>
    </div>

    {!!criteria.length && <section className="learn-review-section">
      <div className="learn-section-heading"><h2>{review.assessmentPending ? 'Textmerkmale · noch kein Funktionstest' : 'Das zeigt dein Versuch'}</h2><LearningPopover label="Zur Auswertung" title="So entsteht die Rückmeldung"><p>{review.feedback}</p><p>Die Demo prüft deine Auswahl und sucht nach Merkmalen der festgelegten Kriterien. Das ersetzt keine fachliche KI-Prüfung und führt keinen Code aus.</p></LearningPopover></div>
      <ul className="learn-criteria">{criteria.slice(0, 2).map(renderCriterion)}</ul>
      {criteria.length > 2 && <details className="learn-review-details"><summary>Weitere Kriterien ({criteria.length - 2})</summary><ul className="learn-criteria">{criteria.slice(2).map(renderCriterion)}</ul></details>}
    </section>}

    <section className="learn-review-section"><details className="learn-review-details">
      <summary>{mode === 'together' ? 'Euer gemeinsames Ergebnis' : 'Deine Antwort'}</summary>
      <div className="learn-answer-review">{draft.selected.map((id) => <p key={id} className="mb-3">{activity.options?.find((option) => option.id === id)?.text}</p>)}{(draft.file || draft.fileName) && <p className="mb-3 flex items-center gap-2 text-foreground"><FileText className="size-4" /> {draft.file?.name ?? `${draft.fileName} · erneut auswählen`}</p>}{draft.text}</div>
      <LearningPopover label="Aufgabe ansehen" title={activity.title}><p>{activity.prompt}</p><p>{activity.scenario.text}</p></LearningPopover>
    </details></section>

    <section className="learn-review-section">
      <div className="learn-evidence-header"><span className="learn-evidence-label">{mode === 'together' ? <UsersRound className="size-4" /> : <UserRound className="size-4" />}<LearningPopover label={evidence} title="Was dieser Versuch zeigt" icon={false}><p>{review.assessmentPending ? 'Diese Arbeit verändert deinen Kompetenzstand erst nach einer fachlichen Prüfung.' : mode === 'together' || props.supported ? 'Ein neuer eigener Versuch zeigt, was du ohne Unterstützung anwenden kannst.' : strong ? 'Die Kriterien sind in diesem Versuch erkennbar. Ein neuer Fall prüft den Transfer.' : 'Ein Versuch zeigt einen Ansatzpunkt. Ein einzelner Fehler bestimmt nicht deinen Lernstand.'}</p></LearningPopover></span><LearningPopover label="Deine Lernzone" title={challenge}><p>Etwa 85 % erfolgreiche Versuche dienen als Orientierung für die Anpassung, nicht als Note oder allgemeingültiger Grenzwert.</p><p>Wir betrachten mehrere vergleichbare, eigenständige Versuche. Bisher in dieser Sitzung: {recent.length}. Bei wenigen Daten bleibt die Einordnung offen.</p></LearningPopover></div>
      <div className="mt-5"><h2 className="text-xs font-semibold">Wie war die Herausforderung für dich?</h2><div className="learn-rating" role="group" aria-label="Schwierigkeit einschätzen">{([{ value: 'too-easy', label: 'Zu leicht' }, { value: 'about-right', label: 'Passt gerade' }, { value: 'too-hard', label: 'Zu schwer' }] as const).map(({ value, label }) => <Button key={value} variant={props.difficulty === value ? 'secondary' : 'outline'} aria-pressed={props.difficulty === value} disabled={props.ratingSaving} onClick={() => props.onDifficulty(value)}>{label}</Button>)}</div>{props.ratingSaving && <p className="learn-footnote" role="status">Wird gespeichert …</p>}{props.error && <p className="learn-inline-error" role="alert">{props.error}</p>}</div>
    </section>

    <section className="learn-next">
      <div className="learn-meta">{timeFits && !review.assessmentPending ? `Nächster Schritt · ${bloomLabels[next.stage]} · ca. ${next.minutes} Min.` : 'Dein Abschluss'}</div>
      <h2>{timeFits ? review.assessmentPending ? 'Weiterarbeiten oder für heute abschliessen.' : next.title : 'Ein guter Punkt zum Aufhören.'}</h2>
      <LearningPopover label="Warum dieser Schritt?" title="So geht es weiter"><p>{!timeFits ? 'Für einen vollständigen nächsten Versuch ist heute wenig Zeit. Du kannst hier später wieder einsteigen.' : review.assessmentPending ? 'Die fachliche Prüfung steht aus. Du kannst deinen Versuch überarbeiten oder die Einheit abschliessen.' : next.rationale}</p><p>Die nächste Aufgabe benötigt etwa {next.minutes} Minuten. Heute bleiben ungefähr {props.remainingMinutes} Minuten, einschliesslich Abschluss.</p></LearningPopover>
      <div className="learn-next-actions">{!timeFits || review.assessmentPending ? <Button variant="primary" onClick={props.onFinish}>Einheit abschliessen <ArrowRight className="size-4" /></Button> : <Button variant="primary" onClick={props.onContinue} disabled={props.ratingSaving}>Nächsten Schritt ausprobieren <ArrowRight className="size-4" /></Button>}{!strong && !review.assessmentPending && <Button variant="outline" onClick={props.onCoach}>Mit dem Coach klären <ArrowUpRight className="size-3.5" /></Button>}<Button variant="ghost" onClick={props.onRetry}><RotateCcw className="size-3.5" /> Überarbeiten</Button></div>
    </section>
  </LearningSurface></LearningReveal>
}
