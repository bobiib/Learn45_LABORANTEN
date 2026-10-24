import { useState } from 'react'
import { ArrowRight, ArrowUpRight, BookOpen, Clock3, FileText, LoaderCircle, UsersRound } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BloomIndicator, LearningModes, LearningPopover, LearningSurface, LearningTabs, type LearningTab } from '@/components/ui/learning'
import { LearningAnswer, canSubmitActivity, type AnswerDraft } from '@/components/learning-answer'
import { pairRoles, projectFor, theoryFor } from '@/lib/learning-content'
import type { LearningActivity, LearningMode } from '@/lib/types'

export type PairPhase = 'first' | 'handoff' | 'second' | 'compare'
type QuestionWorkspaceProps = {
  activity: LearningActivity; mode: LearningMode; onMode: (mode: LearningMode) => void
  draft: AnswerDraft; onDraft: (draft: AnswerDraft) => void; busy: boolean; error: string; onSubmit: () => void
  attemptNumber: number; partner: string; onPartner: (name: string) => void
  pairPhase: PairPhase; onPairPhase: (phase: PairPhase) => void
  firstDraft: AnswerDraft | null; secondDraft: AnswerDraft | null
  hintsUsed: number; restoredFileLost: boolean; onLeavePair: () => void
}

export function QuestionWorkspace(props: QuestionWorkspaceProps) {
  const { activity, mode, draft, busy, pairPhase } = props
  const [tab, setTab] = useState<LearningTab>('Aufgabe')
  const reduced = useReducedMotion()
  const paired = mode === 'together'
  const comparing = paired && pairPhase === 'compare'
  const roles = pairRoles(activity.stage)
  const theory = theoryFor(activity)
  const project = projectFor(activity)
  const testTurn = paired && pairPhase === 'second' && activity.stage === 'Create'
  const answerActivity: LearningActivity = testTurn ? { ...activity, format: 'write', options: undefined } : activity
  const ready = testTurn ? !!draft.text.trim() : canSubmitActivity(activity, draft)
  const phaseLabel = paired ? pairPhase === 'first' ? 'Leas Perspektive' : pairPhase === 'second' ? `${props.partner || 'Lernpartner:in'}s Perspektive` : 'Euer gemeinsames Ergebnis' : 'Dein Versuch'
  const submitLabel = paired && !comparing ? pairPhase === 'first' ? 'Antwort festhalten & weitergeben' : 'Perspektiven vergleichen' : 'Feedback erhalten'

  return <LearningSurface><div className="learn-paper">
    <div className="learn-workspace-topline"><LearningPopover label={`${project.title} · ${project.currentStep + 1}/3`} title="Dein Mini-Projekt" icon={false}><p>{project.goal}</p><ol className="learn-project-steps">{project.steps.map((step, index) => <li key={step} aria-current={index === project.currentStep ? 'step' : undefined}>{step}</li>)}</ol><p>Du bearbeitest passende Teilschritte innerhalb deines Zeitrahmens.</p></LearningPopover><LearningModes value={mode} onChange={props.onMode} disabled={busy || paired && pairPhase !== 'first'} /></div>
    <div className="learn-task-heading"><div className="learn-meta"><BloomIndicator stage={activity.stage} /><span><Clock3 className="size-3.5" />{activity.minutes} Min.</span>{activity.transfer && <span><ArrowUpRight className="size-3.5" />Transfer</span>}</div><div className="learn-why-row"><LearningPopover iconOnly label="Warum diese Aufgabe?" title="Dein nächster sinnvoller Schritt"><p>{activity.rationale}</p></LearningPopover><LearningPopover iconOnly label="Wie wird bewertet?" title="Darauf kommt es an">{activity.criteria.map((criterion) => <p key={criterion.id}><strong>{criterion.label}:</strong> {criterion.explanation}</p>)}<p>Der Demo-Check betrachtet Auswahl und Textmerkmale. Hochgeladener Code wird nicht ausgeführt.</p></LearningPopover></div></div>
    <h1 className="learn-title">{activity.title}</h1>
    {paired && pairPhase === 'handoff' ? <div className="learn-handoff"><span className="learn-handoff-mark"><UsersRound className="size-7" /></span><h2>Jetzt ist {props.partner || 'dein Gegenüber'} dran.</h2><p>Gebt den Bildschirm weiter. Leas Antwort und ihr Coach-Gespräch bleiben für diesen Versuch ausgeblendet.</p><Button variant="primary" onClick={() => props.onPairPhase('second')}>Ich bin {props.partner || 'bereit'} <ArrowRight className="size-4" /></Button></div> : <LearningTabs value={tab} onChange={setTab}>
      {tab === 'Kurz erklärt' ? <div className="learn-theory"><div className="learn-theory-heading"><BookOpen className="size-4" /><span>{theory.minutes} Min. Grundlage</span></div><h2>{theory.title}</h2><p>{theory.principle}</p>{theory.formula && <p className="learn-formula">{theory.formula}</p>}<div className="learn-example"><div><span>Ausgangslage</span><p>{theory.example.before}</p></div><div><span>Weitergedacht</span><p>{theory.example.after}</p></div></div><p className="learn-theory-note">{theory.example.explanation}</p><div className="learn-takeaway">{theory.takeaway}</div><Button variant="outline" onClick={() => setTab('Aufgabe')}>Selbst ausprobieren <ArrowRight className="size-4" /></Button></div> : tab === 'Material' ? <div className="learn-material"><div className="learn-context-heading"><FileText className="size-4" />{activity.scenario.title}</div><p>{activity.scenario.text}</p><small>{activity.scenario.source}</small><Button variant="outline" onClick={() => setTab('Aufgabe')}>Zur Aufgabe <ArrowRight className="size-4" /></Button></div> : <>
        <p className="learn-prompt">{activity.prompt}</p><Button variant="ghost" size="sm" className="learn-material-link" onClick={() => setTab('Material')}><FileText className="size-3.5" />Material öffnen <ArrowUpRight className="size-3" /></Button>
        {paired && <div className="learn-pair-banner"><div className="learn-pair-label"><UsersRound className="size-4" /><span>{comparing ? 'Zusammenführen' : `${pairPhase === 'first' ? 'Lea' : props.partner} · ${pairPhase === 'first' ? roles.first.name : roles.second.name}`}</span><small>{roles.goal}</small></div><p>{comparing ? roles.sharedPrompt : pairPhase === 'first' ? roles.first.prompt : roles.second.prompt}</p>{pairPhase === 'first' && <div className="learn-pair-names"><label htmlFor="partner-name">Mit wem?</label><Input id="partner-name" value={props.partner} onChange={(event) => props.onPartner(event.target.value)} placeholder="Name der zweiten Person" maxLength={40} disabled={busy} /></div>}</div>}
        <AnimatePresence mode="wait" initial={false}><motion.div key={paired ? pairPhase : 'answer'} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .18 }}>
          {comparing && <><div className="learn-comparison"><PairAnswer name="Lea" activity={activity} draft={props.firstDraft} /><PairAnswer name={props.partner || 'Lernpartner:in'} activity={activity} draft={props.secondDraft} /></div>{activity.format === 'artifact' && <div className="learn-rating">{props.firstDraft?.file && <Button variant="outline" type="button" onClick={() => props.onDraft({ ...draft, file: props.firstDraft!.file, fileText: props.firstDraft!.fileText })}>Leas Datei übernehmen</Button>}{props.secondDraft?.file && <Button variant="outline" type="button" onClick={() => props.onDraft({ ...draft, file: props.secondDraft!.file, fileText: props.secondDraft!.fileText })}>Datei von {props.partner} übernehmen</Button>}</div>}</>}
          <form onSubmit={(event) => { event.preventDefault(); props.onSubmit() }}><LearningAnswer activity={answerActivity} draft={draft} onChange={props.onDraft} disabled={busy} label={phaseLabel} />
            {props.restoredFileLost && <p className="learn-footnote">Dein Text wurde wiederhergestellt. Bitte wähle die Datei erneut aus.</p>}{props.error && <p className="learn-inline-error" role="alert">{props.error}</p>}
            <div className="learn-form-footer"><span>{busy ? 'Wird geprüft …' : props.hintsUsed ? 'Mit Unterstützung' : `Versuch ${props.attemptNumber}`}</span><Button type="submit" variant="primary" disabled={busy || !ready || paired && !props.partner.trim()}>{busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : null}{busy ? 'Wird geprüft' : submitLabel}{!busy && <ArrowRight className="size-4" />}</Button></div>
          </form>
        </motion.div></AnimatePresence>
      </>}
    </LearningTabs>}
    {paired && pairPhase !== 'first' && <div className="mt-4"><Button variant="ghost" size="sm" disabled={busy} onClick={props.onLeavePair}>Runde allein fortsetzen <ArrowUpRight className="size-3.5" /></Button></div>}
  </div></LearningSurface>
}

function PairAnswer({ name, activity, draft }: { name: string; activity: LearningActivity; draft: AnswerDraft | null }) {
  return <div><h3>{name}</h3>{draft?.selected.map((id) => <p key={id}>{activity.options?.find((option) => option.id === id)?.text}</p>)}{(draft?.file || draft?.fileName) && <p className="learn-code-note">Datei: {draft.file?.name ?? draft.fileName}</p>}<p>{draft?.text || 'Auswahl festgehalten.'}</p></div>
}
