import { useState } from 'react'
import { ArrowRight, ArrowUpRight, Clock3, FileText, LoaderCircle, UsersRound } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BloomIndicator, LearningHelp, LearningModes, LearningPopover, LearningSurface, LearningTabs, type LearningTab } from '@/components/ui/learning'
import { LearningAnswer, canSubmitActivity, type AnswerDraft } from '@/components/learning-answer'
import { MentalModel } from '@/components/mental-model'
import { pairLearners, pairRoles, projectFor, theoryFor } from '@/lib/learning-content'
import type { ChatMessage, LearningActivity, LearningMode } from '@/lib/learning-types'

export type PairPhase = 'first' | 'handoff' | 'second' | 'compare'
type QuestionWorkspaceProps = {
  activity: LearningActivity; mode: LearningMode; onMode: (mode: LearningMode) => void
  draft: AnswerDraft; onDraft: (draft: AnswerDraft) => void; busy: boolean; error: string; onSubmit: () => void
  attemptNumber: number; partner: string; onPartner: (name: string) => void
  pairPhase: PairPhase; onPairPhase: (phase: PairPhase) => void
  pairRound: number
  firstDraft: AnswerDraft | null; secondDraft: AnswerDraft | null
  hintsUsed: number; restoredFileLost: boolean; onLeavePair: () => void
  messages: ChatMessage[]
  theoryViewed: boolean; onTheory: () => void
}

export function QuestionWorkspace(props: QuestionWorkspaceProps) {
  const { activity, mode, draft, busy, pairPhase } = props
  const [tab, setTab] = useState<LearningTab>('Aufgabe')
  const reduced = useReducedMotion()
  const paired = mode === 'together'
  const comparing = paired && pairPhase === 'compare'
  const roles = pairRoles(activity.stage)
  const learners = pairLearners(props.partner, props.pairRound)
  const theory = theoryFor(activity)
  const project = projectFor(activity)
  const testTurn = paired && pairPhase === 'second' && activity.stage === 'Create'
  const answerActivity: LearningActivity = testTurn ? { ...activity, format: 'write', options: undefined } : activity
  const coachCompletedTurn = props.messages.some((message, index) => message.role === 'user' && props.messages.slice(index + 1).some((next) => next.role === 'assistant'))
  const ready = activity.format === 'tutor' ? coachCompletedTurn : testTurn ? !!draft.text.trim() : canSubmitActivity(activity, draft)
  const phaseLabel = paired ? pairPhase === 'first' ? `${possessive(learners.first)} Perspektive` : pairPhase === 'second' ? `${possessive(learners.second)} Perspektive` : 'Euer gemeinsames Ergebnis' : 'Dein Versuch'
  const submitLabel = activity.format === 'tutor' ? 'Gespräch auswerten' : paired && !comparing ? pairPhase === 'first' ? 'Antwort festhalten & weitergeben' : 'Perspektiven vergleichen' : 'Feedback erhalten'

  return <LearningSurface><div className="learn-paper">
    <div className="learn-workspace-topline"><LearningPopover label={`${project.title} · ${project.currentStep + 1}/3`} title="Dein Mini-Projekt" icon={false}><p>{project.goal}</p><ol className="learn-project-steps">{project.steps.map((step, index) => <li key={step} aria-current={index === project.currentStep ? 'step' : undefined}>{step}</li>)}</ol><p>Du bearbeitest passende Teilschritte innerhalb deines Zeitrahmens.</p></LearningPopover><LearningModes value={mode} onChange={props.onMode} disabled={busy || activity.format === 'tutor' || paired && pairPhase !== 'first'} /></div>
    <div className="learn-task-heading"><div className="learn-meta"><BloomIndicator stage={activity.stage} /><span><Clock3 className="size-3.5" />{activity.minutes} Min.</span>{activity.transfer && <span><ArrowUpRight className="size-3.5" />Transfer</span>}</div><LearningPopover label="Zur Aufgabe" title="Aufgabe und Kriterien"><h3>Warum diese Aufgabe?</h3><p>{activity.rationale}</p>{activity.criteria.length > 0 && <h3>Darauf kommt es an</h3>}{activity.criteria.map((criterion) => <p key={criterion.id}><strong>{criterion.label}:</strong> {criterion.explanation}</p>)}<p>Der Demo-Check betrachtet Auswahl und Textmerkmale. Hochgeladener Code wird nicht ausgeführt.</p></LearningPopover></div>
    <div className="flex flex-wrap items-center gap-2"><h1 className="learn-title">{activity.title}</h1>{activity.difficultyLabel && <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{activity.difficultyLabel}</span>}</div>
    {paired && pairPhase === 'handoff' ? <div className="learn-handoff"><span className="learn-handoff-mark"><UsersRound className="size-7" /></span><h2>Jetzt ist {learners.second} dran.</h2><p>Gebt den Bildschirm weiter. Die erste Antwort und das bisherige Coach-Gespräch bleiben für diesen Versuch ausgeblendet.</p><Button variant="primary" onClick={() => props.onPairPhase('second')}>Ich bin {learners.second} <ArrowRight className="size-4" /></Button></div> : <LearningTabs value={tab} onChange={setTab}>
      {tab === 'Material' ? <div className="learn-material"><div className="learn-context-heading"><FileText className="size-4" />{activity.scenario.title}</div><p>{activity.scenario.text}</p><small>{activity.scenario.source}</small><Button variant="outline" onClick={() => setTab('Aufgabe')}>Zurück zur Aufgabe <ArrowRight className="size-4" /></Button></div> : <>
        <p className="learn-prompt">{activity.prompt}</p><Button variant="ghost" size="sm" className="learn-material-link" onClick={() => setTab('Material')}><FileText className="size-3.5" />Material öffnen <ArrowUpRight className="size-3" /></Button>
        <MentalModel graph={activity.reasoningGraph} />
        {activity.format === 'tutor' && <div className="learn-guided-task" role="status"><strong>Gemeinsam mit dem KI-Coach</strong><p>Bearbeite diese Aufgabe im Gespräch rechts. Der Coach führt dich Schritt für Schritt durch den Denkweg. Wenn ihr einen tragfähigen Ansatz erreicht habt, kannst du das Gespräch zur Rückmeldung einreichen.</p></div>}
        <LearningHelp key={`${activity.id}-${pairPhase}`} content={theory} viewed={props.theoryViewed} onOpen={props.onTheory} disabled={busy} />
        {paired && <div className="learn-pair-banner"><div className="learn-pair-label"><UsersRound className="size-4" /><span>{comparing ? 'Zusammenführen' : `${pairPhase === 'first' ? learners.first : learners.second} · ${pairPhase === 'first' ? roles.first.name : roles.second.name}`}</span><small>{roles.goal}</small></div><p>{comparing ? roles.sharedPrompt : pairPhase === 'first' ? roles.first.prompt : roles.second.prompt}</p>{pairPhase === 'first' && <><p className="learn-pair-next">{props.pairRound % 2 ? 'Rollen gewechselt. ' : ''}Danach: {learners.second} · {roles.second.name}</p><div className="learn-pair-names"><label htmlFor="partner-name">Mit wem?</label><Input id="partner-name" value={props.partner} onChange={(event) => props.onPartner(event.target.value)} placeholder="Name der zweiten Person" maxLength={40} disabled={busy} /></div></>}</div>}
        <AnimatePresence mode="wait" initial={false}><motion.div key={paired ? pairPhase : 'answer'} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .18 }}>
          {comparing && <><div className="learn-comparison"><PairAnswer name={learners.first} activity={activity} draft={props.firstDraft} /><PairAnswer name={learners.second} activity={activity} draft={props.secondDraft} /></div>{activity.format === 'artifact' && <div className="learn-rating">{props.firstDraft?.file && <Button variant="outline" type="button" onClick={() => props.onDraft({ ...draft, file: props.firstDraft!.file, fileText: props.firstDraft!.fileText })}>{possessive(learners.first)} Datei übernehmen</Button>}{props.secondDraft?.file && <Button variant="outline" type="button" onClick={() => props.onDraft({ ...draft, file: props.secondDraft!.file, fileText: props.secondDraft!.fileText })}>Datei von {learners.second} übernehmen</Button>}</div>}</>}
          <form onSubmit={(event) => { event.preventDefault(); props.onSubmit() }}>{activity.format !== 'tutor' && <LearningAnswer activity={answerActivity} draft={draft} onChange={props.onDraft} disabled={busy} label={phaseLabel} />}
            {props.restoredFileLost && <p className="learn-footnote">Dein Text wurde wiederhergestellt. Bitte wähle die Datei erneut aus.</p>}{props.error && <p className="learn-inline-error" role="alert">{props.error}</p>}
            <div className="learn-form-footer"><span>{busy ? 'Wird geprüft …' : props.hintsUsed ? 'Mit Unterstützung' : props.theoryViewed ? 'Mit Lernhilfe' : `Versuch ${props.attemptNumber}`}</span><Button type="submit" variant="primary" disabled={busy || !ready || paired && !props.partner.trim()}>{busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : null}{busy ? 'Wird geprüft' : submitLabel}{!busy && <ArrowRight className="size-4" />}</Button></div>
          </form>
        </motion.div></AnimatePresence>
      </>}
    </LearningTabs>}
    {paired && pairPhase !== 'first' && <div className="mt-4"><Button variant="ghost" size="sm" disabled={busy} onClick={props.onLeavePair}>Runde allein fortsetzen <ArrowUpRight className="size-3.5" /></Button></div>}
  </div></LearningSurface>
}

function possessive(name: string) { return /[sxzß]$/i.test(name) ? `${name}’` : `${name}s` }

function PairAnswer({ name, activity, draft }: { name: string; activity: LearningActivity; draft: AnswerDraft | null }) {
  return <div><h3>{name}</h3>{draft?.selected.map((id) => <p key={id}>{activity.options?.find((option) => option.id === id)?.text}</p>)}{(draft?.file || draft?.fileName) && <p className="learn-code-note">Datei: {draft.file?.name ?? draft.fileName}</p>}<p>{draft?.text || 'Auswahl festgehalten.'}</p></div>
}
