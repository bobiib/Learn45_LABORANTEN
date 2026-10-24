import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, BookOpen, CheckCircle2, RotateCcw, UsersRound } from 'lucide-react'
import { AIChatPanel } from './ai-chat'
import { QuestionWorkspace, type PairPhase } from './question-workspace'
import { ReviewWorkspace } from './review-workspace'
import { canSubmitActivity, emptyDraft, type AnswerDraft } from './learning-answer'
import { Button } from './ui/button'
import { LearningNavigation, LearningStart, LearningSteps, LearningSurface } from './ui/learning'
import { activityForQuestion, fitActivityToBudget, nextActivity } from '@/lib/learning-engine'
import { activityTime, pairLearners, pairRoles } from '@/lib/learning-content'
import { isDemoMode, learningApi } from '@/lib/api'
import type { AnswerSubmission, ChatMessage, LearningActivity, LearningMode, LearningQuestion, PracticeAttempt, ReviewResult, Topic } from '@/lib/types'

type Phase = 'question' | 'review' | 'summary'
type SavedDraft = { text: string; selected: string[]; hadFile: boolean; fileName?: string }
type SavedSession = {
  version: 2; questionId: string; activity: LearningActivity; draft: SavedDraft; phase: Phase
  attempts: PracticeAttempt[]; budget: number; elapsed: number; mode: LearningMode; supported: boolean
  partner: string; pairPhase: PairPhase; first: SavedDraft | null; second: SavedDraft | null
  review: ReviewResult | null; messages: ChatMessage[]; hints: number
  difficulty?: AnswerSubmission['difficulty']
  started?: boolean
  theoryViewed?: boolean
  coachOpen?: boolean
  pairRound?: number
  pairRoundComplete?: boolean
}

const packDraft = (draft: AnswerDraft): SavedDraft => ({ text: draft.text, selected: draft.selected, hadFile: !!(draft.file || draft.fileName), fileName: draft.file?.name ?? draft.fileName })
const unpackDraft = (draft: SavedDraft): AnswerDraft => ({ text: draft.text, selected: draft.selected, fileName: draft.fileName })
const intro = (activity: LearningActivity): ChatMessage[] => [{ id: `intro-${activity.id}`, role: 'assistant', text: activity.format === 'artifact' ? 'Welche Idee hast du für deinen ersten Schritt? Beschreibe deinen Ansatz oder die Stelle, an der du feststeckst.' : 'Nimm dir zuerst einen eigenen Gedanken zur Aufgabe. Wo möchtest du ansetzen?' }]

function loadSession(key: string, questionId: string): SavedSession | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? 'null') as SavedSession | null
    if (!saved || saved.version !== 2 || saved.questionId !== questionId || !saved.activity?.criteria || !Array.isArray(saved.attempts) || !saved.draft || !Array.isArray(saved.draft.selected) || !['question', 'review', 'summary'].includes(saved.phase)) return null
    return saved
  } catch { return null }
}

export function LearningSession({ topic, question, onBack, onHome, onProgress }: { topic: Topic; question: LearningQuestion; onBack: () => void; onHome: () => void; onProgress: (topic: Topic) => void }) {
  const storageKey = `learn45.practice.v2.${topic.id}.${question.id}`
  const [saved] = useState(() => loadSession(storageKey, question.id))
  const [started, setStarted] = useState(saved ? saved.started !== false : false)
  const [activity, setActivity] = useState(() => saved?.activity ?? activityForQuestion(question))
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? 'question')
  const [draft, setDraft] = useState<AnswerDraft>(() => saved ? unpackDraft(saved.draft) : emptyDraft())
  const [mode, setMode] = useState<LearningMode>(saved?.mode ?? (question.mode === 'Partner' ? 'together' : 'solo'))
  const [supported, setSupported] = useState(saved?.supported ?? false)
  const [theoryViewed, setTheoryViewed] = useState(saved?.theoryViewed ?? false)
  const [coachOpen, setCoachOpen] = useState(saved?.coachOpen ?? saved?.messages.some((message) => message.role === 'user') ?? false)
  const [attempts, setAttempts] = useState<PracticeAttempt[]>(saved?.attempts ?? [])
  const [review, setReview] = useState<ReviewResult | null>(saved?.review ?? null)
  const [messages, setMessages] = useState<ChatMessage[]>(saved?.messages ?? intro(activity))
  const [hints, setHints] = useState(saved?.hints ?? 0)
  const [budget, setBudget] = useState(saved?.budget ?? 15)
  const [elapsed, setElapsed] = useState(saved?.elapsed ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ratingSaving, setRatingSaving] = useState(false)
  const [difficulty, setDifficulty] = useState<AnswerSubmission['difficulty']>(saved?.difficulty ?? null)
  const [ratingError, setRatingError] = useState('')
  const [partner, setPartner] = useState(saved?.partner ?? '')
  const [pairPhase, setPairPhase] = useState<PairPhase>(saved?.pairPhase ?? 'first')
  const [pairRound, setPairRound] = useState(saved?.pairRound ?? 0)
  const [pairRoundComplete, setPairRoundComplete] = useState(saved?.pairRoundComplete ?? (saved?.mode === 'together' && !!saved.review))
  const [first, setFirst] = useState<AnswerDraft | null>(saved?.first ? unpackDraft(saved.first) : null)
  const [second, setSecond] = useState<AnswerDraft | null>(saved?.second ? unpackDraft(saved.second) : null)
  const [fileLost, setFileLost] = useState(saved?.draft.hadFile ?? false)
  const [saveFailed, setSaveFailed] = useState(false)
  const submitLock = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const coachRef = useRef<HTMLElement>(null)
  const snapshotRef = useRef<SavedSession | null>(null)
  const reduced = useReducedMotion()
  const remaining = Math.max(0, Math.ceil(budget - elapsed / 60))
  const next = useMemo(() => {
    if (!isDemoMode && review) {
      const recommended = topic.questions.find((item) => item.id === review.nextQuestionId)
      if (recommended) return { ...activityForQuestion(recommended), rationale: review.nextReason }
    }
    return nextActivity(activity, review ?? { correctness: 'partial' } as ReviewResult, attempts, difficulty)
  }, [activity, review, attempts, difficulty, topic.questions])

  useEffect(() => {
    if (phase === 'summary' || !started) return
    let last = Date.now()
    const reset = () => { last = Date.now() }
    const timer = window.setInterval(() => {
      const now = Date.now()
      if (!document.hidden) setElapsed((value) => value + Math.min(5, (now - last) / 1000))
      last = now
    }, 1000)
    document.addEventListener('visibilitychange', reset)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', reset) }
  }, [phase, started])

  useEffect(() => {
    const snapshot: SavedSession = { version: 2, questionId: question.id, activity, draft: packDraft(draft), phase, attempts, budget, elapsed, mode, supported, partner, pairPhase, first: first ? packDraft(first) : null, second: second ? packDraft(second) : null, review, messages, hints, difficulty, started, theoryViewed, coachOpen, pairRound, pairRoundComplete }
    snapshotRef.current = snapshot
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(storageKey, JSON.stringify(snapshot)); setSaveFailed(false) } catch { setSaveFailed(true) }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [question.id, activity, draft, phase, attempts, budget, elapsed, mode, supported, partner, pairPhase, first, second, review, messages, hints, difficulty, storageKey, started, theoryViewed, coachOpen, pairRound, pairRoundComplete])

  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => () => { try { if (snapshotRef.current) window.localStorage.setItem(storageKey, JSON.stringify(snapshotRef.current)) } catch { /* Keep the live session usable if browser storage is full. */ } }, [storageKey])

  const onMessages = useCallback((value: ChatMessage[]) => setMessages(value), [])
  const onSupport = useCallback(() => { setSupported(true); setHints((value) => value + 1) }, [])
  const onTheory = useCallback(() => { setTheoryViewed(true); setSupported(true) }, [])

  function changeMode(value: LearningMode) {
    if (busy || mode === 'together' && pairPhase !== 'first') return
    setMode(value)
    setCoachOpen(value === 'coach')
    if (!draft.text.trim() && !draft.selected.length && !draft.file) {
      const fitted = fitActivityToBudget(activity, remaining, value)
      if (fitted !== activity) { setActivity(fitted); setMessages(intro(fitted)) }
    }
    if (value === 'together' && messages.some((message) => message.role === 'user')) setSupported(true)
    if (value === 'together') { setFirst(null); setSecond(null); setPairPhase('first') }
  }

  function activateCoach() {
    setCoachOpen(true)
    if (mode !== 'together') setMode('coach')
    window.setTimeout(() => coachRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true }), 0)
  }

  function changePairPhase(value: PairPhase) {
    setMessages(intro(activity))
    setCoachOpen(false)
    setPairPhase(value)
  }

  function startSession() {
    const fitted = fitActivityToBudget(activityForQuestion(question), budget, mode)
    setActivity(fitted)
    setMessages(intro(fitted))
    setTheoryViewed(false)
    setCoachOpen(false)
    setStarted(true)
  }

  function leavePair() {
    if (busy) return
    if (first) setDraft(first)
    if (pairPhase === 'compare') setSupported(true)
    setMode('solo')
    setCoachOpen(false)
    setPairPhase('first')
    setFirst(null)
    setSecond(null)
  }

  async function submit() {
    const testTurn = mode === 'together' && pairPhase === 'second' && activity.stage === 'Create'
    if (!(testTurn ? !!draft.text.trim() : canSubmitActivity(activity, draft)) || submitLock.current) return
    if (mode === 'together') {
      if (!partner.trim()) return
      if (pairPhase === 'first') { setFirst(draft); setDraft(emptyDraft()); changePairPhase('handoff'); return }
      if (pairPhase === 'second') { setSecond(draft); setDraft(emptyDraft()); changePairPhase('compare'); return }
    }
    submitLock.current = true
    setBusy(true)
    setError('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await learningApi.submitAnswer({ questionId: question.id, activity, answer: draft.text, selectedOptions: draft.selected, attachment: draft.file, attachmentText: draft.fileText, hintsUsed: hints, tutorUsed: hints > 0, theoryUsed: theoryViewed, supportUsed: supported, learningMode: mode, difficulty: null }, controller.signal)
      if (controller.signal.aborted) return
      setReview(result)
      if (mode === 'together') setPairRoundComplete(true)
      if (!result.assessmentPending) {
        const attempt: PracticeAttempt = { activityId: activity.id, skillId: activity.skillId, stage: activity.stage, correctness: result.correctness, supported, mode, at: Date.now() }
        setAttempts((value) => [...value, attempt])
        // Assisted and joint work are retained in the session; only an independent result changes mastery.
        if (!supported && mode !== 'together' && result.evidenceDelta > 0) {
          const nodes = topic.nodes.map((node) => node.id === activity.skillId ? { ...node, progress: Math.min(100, node.progress + result.evidenceDelta), evidence: { ...node.evidence, [activity.stage]: Math.min(100, node.evidence[activity.stage] + result.evidenceDelta) } } : node)
          const average = nodes.length ? Math.round(nodes.reduce((sum, node) => sum + node.progress, 0) / nodes.length) : topic.progress
          onProgress({ ...topic, nodes, progress: Math.max(topic.progress, average) })
        }
      }
      setPhase('review')
      window.scrollTo({ top: 0, behavior: 'instant' })
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Dein Versuch konnte nicht geprüft werden. Bitte versuche es erneut.')
    } finally { setBusy(false); submitLock.current = false }
  }

  async function rate(value: NonNullable<AnswerSubmission['difficulty']>) {
    if (ratingSaving) return
    setRatingSaving(true)
    setRatingError('')
    try { await learningApi.rateDifficulty(question.id, value); setDifficulty(value) }
    catch { setRatingError('Deine Einschätzung konnte nicht gespeichert werden. Bitte versuche es erneut.') }
    finally { setRatingSaving(false) }
  }

  function continueLearning() {
    if (activityTime(next) > remaining) { setPhase('summary'); return }
    if (pairRoundComplete) { setPairRound((value) => value + 1); setPairRoundComplete(false) }
    const repeated = attempts.filter((item) => item.skillId === activity.skillId && item.correctness !== 'strong').length >= 2
    const needsCoach = review?.correctness !== 'strong' && (repeated || difficulty === 'too-hard')
    setActivity(next)
    setDraft(emptyDraft())
    setReview(null)
    setDifficulty(null)
    setRatingError('')
    setMode(needsCoach && topic.context.tutorEnabled ? 'coach' : 'solo')
    setSupported(false)
    setTheoryViewed(false)
    setCoachOpen(false)
    setHints(0)
    setMessages(intro(next))
    setPairPhase('first')
    setFirst(null)
    setSecond(null)
    setFileLost(false)
    setPhase('question')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function retry() {
    // Keep the same task and original answer. Feedback exposure remains recorded as support.
    setSupported(true)
    setReview(null)
    setDifficulty(null)
    setRatingError('')
    setPhase('question')
    setError('')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function restart() {
    if (pairRoundComplete) { setPairRound((value) => value + 1); setPairRoundComplete(false) }
    setTheoryViewed(false); setCoachOpen(false)
    setStarted(false); setBudget(15); setActivity(activityForQuestion(question)); setDraft(emptyDraft()); setMode(question.mode === 'Partner' ? 'together' : 'solo'); setSupported(false); setAttempts([]); setReview(null); setMessages(intro(activityForQuestion(question))); setHints(0); setElapsed(0); setDifficulty(null); setRatingError(''); setPairPhase('first'); setFirst(null); setSecond(null); setFileLost(false); setPhase('question')
  }

  const finish = () => { if (!busy) { setPhase('summary'); window.scrollTo({ top: 0, behavior: 'instant' }) } }
  const independent = attempts.filter((attempt) => attempt.correctness === 'strong' && !attempt.supported && attempt.mode !== 'together')
  const roles = pairRoles(activity.stage)
  const learners = pairLearners(partner, pairRound)
  const turnContext = mode === 'together' ? pairPhase === 'first' ? `${learners.first}: ${roles.first.name}. ${roles.first.prompt}` : pairPhase === 'second' ? `${learners.second}: ${roles.second.name}. ${roles.second.prompt}` : roles.sharedPrompt : undefined

  return <MotionConfig reducedMotion="user"><div className="learning-session">
    <LearningStart open={!started} minutes={budget} onMinutes={setBudget} onStart={startSession} onBack={onBack} />
    <LearningNavigation topic={topic.title} onBack={onBack} minutes={remaining} budget={budget} onBudget={(minutes) => setBudget((value) => value + minutes)} phase={phase} onFinish={finish} />
    <LearningSteps phase={phase} hasAnswer={!!(draft.text.trim() || draft.selected.length || draft.file)} />
    <AnimatePresence mode="wait" initial={false}>
      {phase === 'summary' ? <motion.div key="summary" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="learn-session-summary">
        <LearningSurface className="learn-paper"><div className="learn-review-heading"><span className="learn-result-icon"><CheckCircle2 className="size-4" /></span><span>Für heute festgehalten</span></div><h1 className="learn-title">Ein guter Schritt.<br />Hier geht es später weiter.</h1><div className="learn-summary-grid"><div className="learn-summary-stat"><strong>{attempts.length}</strong><span>ausgewertete Versuche</span></div><div className="learn-summary-stat"><strong>{elapsed < 60 ? '< 1' : Math.round(elapsed / 60)} Min.</strong><span>aktive Lernzeit</span></div></div><div className="learn-summary-list">{independent.length > 0 && <div className="learn-summary-item"><CheckCircle2 className="size-4" /><span>{independent.length} selbstständig gelungen im Demo-Check</span></div>}<div className="learn-summary-item"><BookOpen className="size-4" /><span>{review?.assessmentPending ? 'Die fachliche Prüfung deiner Datei steht noch aus.' : `Zum Weiterlernen: ${review ? next.title : activity.title}`}</span></div></div><div className="learn-next-actions"><Button variant="primary" onClick={onHome}>Zur Lernübersicht <ArrowRight className="size-4" /></Button><Button variant="outline" onClick={() => { setBudget((value) => Math.max(value, Math.ceil(elapsed / 60) + 5)); setPhase(review ? 'review' : 'question') }}>An dieser Stelle fortsetzen</Button><Button variant="ghost" onClick={restart}><RotateCcw className="size-3.5" /> Neue Einheit</Button></div><p className="learn-saving-note">{saveFailed ? 'Speichern fehlgeschlagen. Lass die Seite geöffnet, um fortzusetzen.' : 'Text und Lernverlauf sind hier gespeichert. Dateien bitte beim nächsten Öffnen erneut auswählen.'}</p></LearningSurface>
      </motion.div> : <motion.div key="workspace" className="learn-grid" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="learn-main"><AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${activity.id}-${phase}`} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -4 }} transition={{ duration: .2 }}>
            {phase === 'question' ? <QuestionWorkspace activity={activity} mode={mode} onMode={changeMode} draft={draft} onDraft={(value) => { setDraft(value); if (value.file) setFileLost(false) }} busy={busy} error={error} onSubmit={() => void submit()} attemptNumber={attempts.length + 1} partner={partner} onPartner={setPartner} pairRound={pairRound} pairPhase={pairPhase} onPairPhase={changePairPhase} onLeavePair={leavePair} firstDraft={first} secondDraft={second} hintsUsed={hints} theoryViewed={theoryViewed} onTheory={onTheory} restoredFileLost={fileLost} /> : review && <ReviewWorkspace activity={activity} draft={draft} review={review} mode={mode} supported={supported} attempts={attempts} difficulty={difficulty} ratingSaving={ratingSaving} error={ratingError} onDifficulty={(value) => void rate(value)} next={next} remainingMinutes={remaining} onContinue={continueLearning} onRetry={retry} onCoach={activateCoach} onFinish={finish} />}
          </motion.div>
        </AnimatePresence>{saveFailed && <p className="learn-saving-note" role="status">Der Zwischenstand konnte nicht im Browser gespeichert werden. Deine aktuelle Arbeit bleibt auf dieser Seite erhalten.</p>}</div>
        <aside ref={coachRef} className="learn-sidebar">{mode === 'together' && pairPhase === 'handoff' ? <LearningSurface className="learn-coach-pause"><UsersRound className="size-6" /><h2>Ein Moment für den Wechsel.</h2><p>Der Coach startet für die nächste Person mit einem neuen Gespräch.</p></LearningSurface> : <AIChatPanel key={`${activity.id}-${phase}-${mode === 'together' ? pairPhase : 'single'}`} kind="tutor" workspace chatId={`practice-${activity.id}-${phase}-${mode === 'together' ? pairPhase : 'single'}`} questionId={question.id} topicId={topic.id} initialMessages={messages} title="Lerncoach" detail="Gemeinsam weiterdenken" activity={activity} learnerAnswer={draft.text} turnContext={turnContext} review={phase === 'review' ? review : null} mode={mode} active={coachOpen && topic.context.tutorEnabled} onActivate={topic.context.tutorEnabled ? activateCoach : undefined} onSupport={phase === 'question' ? onSupport : undefined} onMessagesChange={onMessages} disabled={busy} />}{!topic.context.tutorEnabled && <p className="learn-coach-caption">KI-Coach im Lernkontext deaktiviert.</p>}{isDemoMode && <p className="learn-coach-caption">Demo · vorbereitete Lernimpulse</p>}</aside>
      </motion.div>}
    </AnimatePresence>
  </div></MotionConfig>
}
