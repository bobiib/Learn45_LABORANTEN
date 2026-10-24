import { ArrowRight, ArrowUpRight, Check, CheckCircle2, Circle, FileText, Lightbulb, RotateCcw, UserRound, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BloomIndicator, LearningPopover, LearningReveal, LearningSurface } from '@/components/ui/learning'
import { bloomLabels } from '@/lib/learning-engine'
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
  const timeFits = next.minutes + 2 <= props.remainingMinutes
  const recent = props.attempts.filter((attempt) => attempt.skillId === activity.skillId && attempt.stage === activity.stage && !attempt.supported && attempt.mode !== 'together').slice(-8)
  const evidence = review.assessmentPending ? 'Fachliche Prüfung steht aus' : mode === 'together' ? 'Gemeinsam erarbeitet' : props.supported ? 'Mit Unterstützung erarbeitet' : 'Selbstständig erarbeitet'
  const hasEnoughEvidence = recent.length >= 5
  const ratio = recent.length ? recent.filter((attempt) => attempt.correctness === 'strong').length / recent.length : 0
  const challenge = !hasEnoughEvidence ? 'Dein Lernniveau wird noch eingeordnet.' : ratio > .9 ? 'Bereit für mehr Herausforderung.' : ratio < .8 ? 'Ein kleinerer Schritt passt jetzt besser.' : 'Die Herausforderung passt zu deinen Versuchen.'

  return <LearningReveal><LearningSurface>
    <div className="learn-review-result">
      <div className="learn-review-heading"><span className="learn-result-icon">{strong ? <Check className="size-4" /> : <Lightbulb className="size-4" />}</span><span>{review.assessmentPending ? 'ARBEIT FESTGEHALTEN' : strong ? 'GUT WEITERGEDACHT' : 'DEIN NÄCHSTER ANSATZ'}</span></div>
      <div className="learn-meta"><BloomIndicator stage={activity.stage} /><span>{activity.title}</span></div>
      <h1 className="learn-title">{review.headline}</h1>
      <p className="learn-review-copy">{review.feedback}</p>
    </div>

    {!!review.criteria?.length && <section className="learn-review-section"><div className="learn-section-heading"><h2>{review.assessmentPending ? 'Im Text erkennbar · noch kein Funktionstest' : 'Das zeigt dein Versuch'}</h2><LearningPopover label="Zur Auswertung" title="Transparente Rückmeldung"><p>Die Demo prüft deine Auswahl und sucht nach Merkmalen der vorab festgelegten Kriterien. Das ersetzt keine fachliche KI-Prüfung.</p><p>Eine richtige Auswahl mit passender Begründung ist ein anderes Lernsignal als ein Ergebnis mit Unterstützung. Beides wird getrennt festgehalten.</p></LearningPopover></div><ul className="learn-criteria">{review.criteria.map((criterion) => <li key={criterion.id} data-met={criterion.met}><span className="learn-criterion-icon">{criterion.met ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}</span><div><span>{criterion.label}</span>{!criterion.met && <span className="learn-criterion-detail">{criterion.explanation}</span>}</div></li>)}</ul></section>}

    <section className="learn-review-section"><div className="learn-section-heading"><h2>{mode === 'together' ? 'Euer gemeinsames Ergebnis' : 'Deine Antwort'}</h2><LearningPopover label="Aufgabe ansehen" title={activity.title}><p>{activity.prompt}</p><p>{activity.scenario.text}</p></LearningPopover></div><div className="learn-answer-review">{draft.selected.map((id) => <p key={id} className="mb-3">{activity.options?.find((option) => option.id === id)?.text}</p>)}{(draft.file || draft.fileName) && <p className="mb-3 flex items-center gap-2 text-primary"><FileText className="size-4" /> {draft.file?.name ?? `${draft.fileName} · erneut auswählen`}</p>}{draft.text}</div></section>

    <section className="learn-review-section"><div className="learn-evidence-header"><span className="learn-evidence-label">{mode === 'together' ? <UsersRound className="size-4" /> : <UserRound className="size-4" />}{evidence}</span><LearningPopover label="Deine Lernzone" title="Passend gefordert statt perfekt"><p>Wir orientieren uns an einer Lernzone, in der die meisten eigenen Versuche gelingen und einzelne Fehler neue Lerngelegenheiten bieten.</p><p>Etwa 85 % erfolgreiche Versuche sind eine Arbeitshypothese für die Anpassung, keine Note und kein wissenschaftlich gesicherter Grenzwert für jede Aufgabe.</p><p>Wir betrachten mehrere vergleichbare, eigenständige Versuche. Bei wenigen Daten zeigen wir keine scheinbar genaue Erfolgswahrscheinlichkeit.</p><p>{recent.length} eigenständige Versuche zu diesem Teilziel in dieser Sitzung.</p></LearningPopover></div><p className="learn-evidence-note">{review.assessmentPending ? 'Diese Arbeit verändert deinen Kompetenzstand erst nach einer fachlichen Prüfung.' : mode === 'together' || props.supported ? 'Der nächste eigene Versuch an einem anderen Beispiel zeigt, was du selbst anwenden kannst.' : strong ? 'Du hast die Kriterien in diesem Versuch selbst aufgegriffen. Ein neuer Fall prüft den Transfer.' : 'Ein Versuch zeigt, wo wir ansetzen können. Ein einzelner Fehler bestimmt nicht deinen Lernstand.'}</p><p className="learn-evidence-note">{challenge}</p>
      <div className="mt-5"><h2 className="text-xs font-semibold">Wie war die Herausforderung für dich?</h2><div className="learn-rating" role="group" aria-label="Schwierigkeit einschätzen">{([{ value: 'too-easy', label: 'Zu leicht' }, { value: 'about-right', label: 'Passt gerade' }, { value: 'too-hard', label: 'Zu schwer' }] as const).map(({ value, label }) => <Button key={value} variant={props.difficulty === value ? 'secondary' : 'outline'} aria-pressed={props.difficulty === value} disabled={props.ratingSaving} onClick={() => props.onDifficulty(value)}>{label}</Button>)}</div>{props.ratingSaving && <p className="learn-footnote" role="status">Wird gespeichert …</p>}{props.error && <p className="learn-inline-error" role="alert">{props.error}</p>}</div>
    </section>

    <section className="learn-next"><p className="learn-kicker learn-kicker-primary">DEIN NÄCHSTER SCHRITT <span className="mx-1">↗</span> {timeFits ? `${bloomLabels[next.stage]} · ca. ${next.minutes} Min.` : 'FÜR HEUTE ABRUNDEN'}</p><h2>{timeFits ? review.assessmentPending ? 'Deine Arbeit ist festgehalten.' : next.title : 'Ein guter Punkt zum Aufhören.'}</h2><p>{!timeFits ? 'Für einen vollständigen nächsten Versuch ist heute wenig Zeit. Halte deinen Lernstand fest und setze hier später wieder an.' : review.assessmentPending ? 'Bis zur fachlichen Prüfung kannst du an deiner Arbeit weiterarbeiten oder die Einheit abschliessen.' : strong ? 'Gleiche Idee, anderer Kontext. Probiere den nächsten Fall zuerst wieder ohne Unterstützung.' : 'Wir greifen einen einzelnen Gedanken heraus. Ein kurzer Impuls kann dir beim nächsten eigenen Versuch helfen.'}</p>
      <LearningPopover label="Warum dieser Schritt?" title="So passt sich dein Lernweg an"><p>{next.rationale}</p><p>Die Aufgabe benötigt etwa {next.minutes} Minuten. Für heute bleiben ungefähr {props.remainingMinutes} Minuten, einschliesslich Abschluss.</p></LearningPopover>
      <div className="learn-next-actions">{!timeFits || review.assessmentPending ? <Button variant="primary" onClick={props.onFinish}>Einheit abschliessen <ArrowRight className="size-4" /></Button> : <Button variant="primary" onClick={props.onContinue} disabled={props.ratingSaving}>Nächsten Schritt ausprobieren <ArrowRight className="size-4" /></Button>}{!strong && !review.assessmentPending && mode !== 'together' && <Button variant="outline" onClick={props.onCoach}>Mit dem Coach klären <ArrowUpRight className="size-3.5" /></Button>}<Button variant="ghost" onClick={props.onRetry}><RotateCcw className="size-3.5" /> Überarbeiten</Button></div>
    </section>
  </LearningSurface></LearningReveal>
}
