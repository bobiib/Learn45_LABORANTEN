import { ArrowRight, ArrowUpRight, Clock3, FileText, LoaderCircle, UsersRound } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BloomIndicator, LearningModes, LearningPopover, LearningReveal, LearningSurface } from '@/components/ui/learning'
import { LearningAnswer, canSubmitActivity, type AnswerDraft } from '@/components/learning-answer'
import type { LearningActivity, LearningMode } from '@/lib/types'

export type PairPhase = 'first' | 'handoff' | 'second' | 'compare'

type QuestionWorkspaceProps = {
  activity: LearningActivity
  mode: LearningMode
  onMode: (mode: LearningMode) => void
  draft: AnswerDraft
  onDraft: (draft: AnswerDraft) => void
  busy: boolean
  error: string
  onSubmit: () => void
  attemptNumber: number
  partner: string
  onPartner: (name: string) => void
  pairPhase: PairPhase
  onPairPhase: (phase: PairPhase) => void
  firstDraft: AnswerDraft | null
  secondDraft: AnswerDraft | null
  hintsUsed: number
  restoredFileLost: boolean
  onLeavePair: () => void
}

const formatLabels = { write: 'Schreibwerkstatt', choose: 'Entscheiden & begründen', spot: 'Fehlerdetektiv', artifact: 'Eigene Arbeit' }

export function QuestionWorkspace(props: QuestionWorkspaceProps) {
  const { activity, mode, draft, busy, pairPhase } = props
  const reduced = useReducedMotion()
  const paired = mode === 'together'
  const comparing = paired && pairPhase === 'compare'
  const phaseLabel = paired ? pairPhase === 'first' ? 'Leas Perspektive' : pairPhase === 'second' ? `${props.partner || 'Lernpartner:in'}s Perspektive` : 'Euer gemeinsames Ergebnis' : 'Dein Versuch'
  const submitLabel = paired && pairPhase !== 'compare' ? pairPhase === 'first' ? 'Antwort festhalten & weitergeben' : 'Perspektiven vergleichen' : 'Feedback erhalten'

  return <LearningReveal>
    <LearningSurface>
      <div className="learn-paper">
        <div className="learn-workspace-topline"><p className="learn-kicker">ÜBUNG {String(props.attemptNumber).padStart(2, '0')} <span className="mx-2 text-border">/</span> {formatLabels[activity.format]}</p><LearningModes value={mode} onChange={props.onMode} disabled={busy || paired && pairPhase !== 'first'} /></div>
        <div className="learn-meta"><BloomIndicator stage={activity.stage} /><span><Clock3 className="size-3.5" /> Ca. {activity.minutes} Min.</span>{activity.transfer && <span><ArrowUpRight className="size-3.5" /> Neuer Kontext</span>}</div>
        <h1 className="learn-title">{activity.title}</h1>
        <p className="learn-prompt">{activity.prompt}</p>
        <div className="learn-why-row"><LearningPopover label="Warum diese Aufgabe?" title="Dein nächster sinnvoller Schritt"><p>{activity.rationale}</p></LearningPopover><LearningPopover label="Wie wird bewertet?" title="Darauf kommt es an"><p>{activity.format === 'spot' ? 'Du vergleichst die Aussagen mit der Quelle und begründest deine Auswahl.' : 'Deine Überlegungen werden an den Kriterien dieser Aufgabe betrachtet.'}</p>{activity.criteria.map((criterion) => <p key={criterion.id}><strong>{criterion.label}:</strong> {criterion.explanation}</p>)}<p>Die lokale Demo nutzt transparente Kriterien und Textmerkmale. Eine fachliche KI-Auswertung wird über das Backend angebunden.</p></LearningPopover></div>

        {!(paired && pairPhase === 'handoff') && <div className="learn-context"><div className="learn-context-heading"><FileText className="size-3.5" />{activity.scenario.title}</div><p>{activity.scenario.text}</p><small className="learn-context-source">{activity.scenario.source}</small></div>}

        {paired && pairPhase === 'first' && <div className="learn-pair-banner"><p className="learn-pair-label"><UsersRound className="size-4" /> Zwei Köpfe. Erst einmal getrennt.</p><p>Lea beginnt. Danach gebt ihr den Bildschirm weiter. Eure Antworten werden erst nach beiden Versuchen nebeneinander gezeigt.</p><div className="learn-pair-names"><label htmlFor="partner-name">Wer lernt mit?</label><Input id="partner-name" value={props.partner} onChange={(event) => props.onPartner(event.target.value)} placeholder="Name der zweiten Person" maxLength={40} disabled={busy} /></div></div>}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={paired ? pairPhase : 'answer'} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .2 }}>
            {paired && pairPhase === 'handoff' ? <div className="learn-handoff"><span className="learn-handoff-mark"><UsersRound className="size-7" /></span><p className="learn-kicker">BILDSCHIRM WEITERGEBEN</p><h2>Jetzt ist {props.partner || 'dein Gegenüber'} dran.</h2><p>Leas Antwort ist für den nächsten Versuch ausgeblendet. Lies die Aufgabe selbst und halte deinen eigenen Gedanken fest.</p><Button variant="primary" onClick={() => props.onPairPhase('second')}>Ich bin {props.partner || 'bereit'} <ArrowRight className="size-4" /></Button><p className="learn-footnote">Eine Übergabe zum eigenständigen Denken, kein privater Kontobereich.</p></div> : <>
              {comparing && <><div className="learn-pair-banner"><p className="learn-pair-label"><UsersRound className="size-4" /> Wo denkt ihr gleich, wo unterschiedlich?</p><p>Erklärt einander zuerst eure Gründe. Formuliert danach ein gemeinsames Ergebnis, das beide vertreten können.</p></div><div className="learn-comparison"><PairAnswer name="Lea" activity={activity} draft={props.firstDraft} /><PairAnswer name={props.partner || 'Lernpartner:in'} activity={activity} draft={props.secondDraft} /></div>{activity.format === 'artifact' && <div className="learn-rating">{props.firstDraft?.file && <Button variant="outline" type="button" onClick={() => props.onDraft({ ...draft, file: props.firstDraft!.file, fileText: props.firstDraft!.fileText })}>Leas Datei übernehmen</Button>}{props.secondDraft?.file && <Button variant="outline" type="button" onClick={() => props.onDraft({ ...draft, file: props.secondDraft!.file, fileText: props.secondDraft!.fileText })}>Datei von {props.partner} übernehmen</Button>}</div>}</>}
              {paired && pairPhase === 'second' && <p className="learn-footnote">Jetzt antwortet {props.partner || 'die zweite Person'} unabhängig. Lea hört zunächst zu.</p>}
              <form onSubmit={(event) => { event.preventDefault(); props.onSubmit() }}>
                <LearningAnswer activity={activity} draft={draft} onChange={props.onDraft} disabled={busy} label={phaseLabel} />
                {props.restoredFileLost && <p className="learn-footnote">Dein Text wurde wiederhergestellt. Bitte wähle die Datei erneut aus; Dateien werden nicht im Browser gespeichert.</p>}
                {props.error && <p className="learn-inline-error" role="alert">{props.error}</p>}
                <div className="learn-form-footer"><span>{busy ? 'Dein Versuch wird betrachtet …' : paired ? phaseLabel : props.hintsUsed ? 'Mit einem Impuls weitergedacht.' : 'Ein eigener Gedanke ist ein guter Anfang.'}</span><Button type="submit" variant="primary" disabled={busy || !canSubmitActivity(activity, draft) || paired && !props.partner.trim()}>{busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : null}{busy ? 'Wird geprüft' : submitLabel}{!busy && <ArrowRight className="size-4" />}</Button></div>
              </form>
              <p className="learn-footnote">{activity.format === 'artifact' ? 'Dein Werk zählt mehr als die Länge deiner Erläuterung.' : 'Du kannst deinen Versuch überarbeiten und Unterstützung holen.'}</p>
            </>}
          </motion.div>
        </AnimatePresence>
        {paired && pairPhase !== 'first' && <div className="mt-4"><Button variant="ghost" size="sm" disabled={busy} onClick={props.onLeavePair}>Runde allein fortsetzen <ArrowUpRight className="size-3.5" /></Button></div>}
      </div>
    </LearningSurface>
  </LearningReveal>
}

function PairAnswer({ name, activity, draft }: { name: string; activity: LearningActivity; draft: AnswerDraft | null }) {
  return <div><h3>{name}</h3>{draft?.selected.map((id) => <p key={id} className="mb-2">{activity.options?.find((option) => option.id === id)?.text}</p>)}{draft?.file && <p className="learn-code-note">Datei: {draft.file.name}</p>}<p>{draft?.text || 'Auswahl festgehalten.'}</p></div>
}
