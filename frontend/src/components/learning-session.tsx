import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, BookOpen, CheckCircle2, Clock3, RotateCcw } from 'lucide-react'
import { AIChatPanel } from './ai-chat'
import { QuestionWorkspace, type PairPhase } from './question-workspace'
import { ReviewWorkspace } from './review-workspace'
import { canSubmitActivity, emptyDraft, type AnswerDraft } from './learning-answer'
import { Button } from './ui/button'
import { LearningNavigation, LearningSteps, LearningSurface } from './ui/learning'
import { activityForQuestion, nextActivity } from '@/lib/learning-engine'
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
  const [activity, setActivity] = useState(() => saved?.activity ?? activityForQuestion(question))
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? 'question')
  const [draft, setDraft] = useState<AnswerDraft>(() => saved ? unpackDraft(saved.draft) : emptyDraft())
  const [mode, setMode] = useState<LearningMode>(saved?.mode ?? (question.mode === 'Partner' ? 'together' : 'solo'))
  const [supported, setSupported] = useState(saved?.supported ?? false)
  const [attempts, setAttempts] = useState<PracticeAttempt[]>(saved?.attempts ?? [])
  const [review, setReview] = useState<ReviewResult | null>(saved?.review ?? null)
  const [messages, setMessages] = useState<ChatMessage[]>(saved?.messages ?? intro(activity))
  const [hints, setHints] = useState(saved?.hints ?? 0)
  const [budget, setBudget] = useState(saved?.budget ?? Math.max(5, Math.min(90, parseInt(topic.context.timeAvailable, 10) || Number(topic.context.timeAvailable.match(/\d+/)?.[0]) || 15)))
  const [elapsed, setElapsed] = useState(saved?.elapsed ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ratingSaving, setRatingSaving] = useState(false)
  const [difficulty, setDifficulty] = useState<AnswerSubmission['difficulty']>(saved?.difficulty ?? null)
  const [ratingError, setRatingError] = useState('')
  const [partner, setPartner] = useState(saved?.partner ?? '')
  const [pairPhase, setPairPhase] = useState<PairPhase>(saved?.pairPhase ?? 'first')
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
    if (phase === 'summary') return
    let last = Date.now()
    const reset = () => { last = Date.now() }
    const timer = window.setInterval(() => {
      const now = Date.now()
      if (!document.hidden) setElapsed((value) => value + Math.min(5, (now - last) / 1000))
      last = now
    }, 1000)
    document.addEventListener('visibilitychange', reset)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', reset) }
  }, [phase])

  useEffect(() => {
    const snapshot: SavedSession = { version: 2, questionId: question.id, activity, draft: packDraft(draft), phase, attempts, budget, elapsed, mode, supported, partner, pairPhase, first: first ? packDraft(first) : null, second: second ? packDraft(second) : null, review, messages, hints, difficulty }
    snapshotRef.current = snapshot
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(storageKey, JSON.stringify(snapshot)); setSaveFailed(false) } catch { setSaveFailed(true) }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [question.id, activity, draft, phase, attempts, budget, elapsed, mode, supported, partner, pairPhase, first, second, review, messages, hints, difficulty, storageKey])

  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => () => { try { if (snapshotRef.current) window.localStorage.setItem(storageKey, JSON.stringify(snapshotRef.current)) } catch { /* Keep the live session usable if browser storage is full. */ } }, [storageKey])

  const onMessages = useCallback((value: ChatMessage[]) => setMessages(value), [])
  const onSupport = useCallback(() => { setSupported(true); setHints((value) => value + 1) }, [])

  function changeMode(value: LearningMode) {
    if (busy || mode === 'together' && pairPhase !== 'first') return
    setMode(value)
    if (value === 'together' && messages.some((message) => message.role === 'user')) setSupported(true)
    if (value === 'together') { setFirst(null); setSecond(null); setPairPhase('first') }
  }

  function activateCoach() {
    setMode('coach')
    window.setTimeout(() => coachRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true }), 0)
  }

  function leavePair() {
    if (busy) return
    if (first) setDraft(first)
    if (pairPhase === 'compare') setSupported(true)
    setMode('solo')
    setPairPhase('first')
    setFirst(null)
    setSecond(null)
  }

  async function submit() {
    if (!canSubmitActivity(activity, draft) || submitLock.current) return
    if (mode === 'together') {
      if (!partner.trim()) return
      if (pairPhase === 'first') { setFirst(draft); setDraft(emptyDraft()); setPairPhase('handoff'); return }
      if (pairPhase === 'second') { setSecond(draft); setDraft(emptyDraft()); setPairPhase('compare'); return }
    }
    submitLock.current = true
    setBusy(true)
    setError('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await learningApi.submitAnswer({ questionId: question.id, activity, answer: draft.text, selectedOptions: draft.selected, attachment: draft.file, attachmentText: draft.fileText, hintsUsed: hints, tutorUsed: supported, learningMode: mode, difficulty: null }, controller.signal)
      if (controller.signal.aborted) return
      setReview(result)
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
    if (next.minutes + 2 > remaining) { setPhase('summary'); return }
    const repeated = attempts.filter((item) => item.skillId === activity.skillId && item.correctness !== 'strong').length >= 2
    const needsCoach = review?.correctness !== 'strong' && (repeated || difficulty === 'too-hard')
    setActivity(next)
    setDraft(emptyDraft())
    setReview(null)
    setDifficulty(null)
    setRatingError('')
    setMode(needsCoach && topic.context.tutorEnabled ? 'coach' : 'solo')
    setSupported(false)
    setHints(0)
    setMessages(needsCoach ? [{ id: `intro-${next.id}`, role: 'assistant', text: 'Lass uns einen Gedanken klären, bevor du selbst entscheidest. ' + next.hints[0] }] : intro(next))
    // An automatically offered, displayed hint is support, even before a chat message is sent.
    if (needsCoach && topic.context.tutorEnabled) { setSupported(true); setHints(1) }
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
    setPhase('question')
    setError('')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function restart() {
    setActivity(activityForQuestion(question)); setDraft(emptyDraft()); setMode(question.mode === 'Partner' ? 'together' : 'solo'); setSupported(false); setAttempts([]); setReview(null); setMessages(intro(activityForQuestion(question))); setHints(0); setElapsed(0); setDifficulty(null); setRatingError(''); setPairPhase('first'); setFirst(null); setSecond(null); setFileLost(false); setPhase('question')
  }

  const finish = () => { if (!busy) { setPhase('summary'); window.scrollTo({ top: 0, behavior: 'instant' }) } }
  const independent = attempts.filter((attempt) => attempt.correctness === 'strong' && !attempt.supported && attempt.mode !== 'together')

  return <MotionConfig reducedMotion="user"><div className="learning-session">
    <LearningNavigation topic={topic.title} onBack={onBack} minutes={remaining} budget={budget} onBudget={(minutes) => setBudget((value) => value + minutes)} phase={phase} onFinish={finish} />
    <LearningSteps phase={phase} hasAnswer={!!(draft.text.trim() || draft.selected.length || draft.file)} />
    <AnimatePresence mode="wait" initial={false}>
      {phase === 'summary' ? <motion.div key="summary" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="learn-session-summary">
        <LearningSurface className="learn-paper"><div className="learn-review-heading"><span className="learn-result-icon"><CheckCircle2 className="size-4" /></span><span>FÜR HEUTE FESTGEHALTEN</span></div><h1 className="learn-title">Ein guter Schritt.<br />Morgen geht’s weiter.</h1><p className="learn-review-copy">{attempts.length ? 'Du hast dir Zeit genommen, ausprobiert und weitergedacht. Hier ist dein Zwischenstand.' : draft.text || draft.file ? 'Dein angefangener Versuch bleibt für die nächste Runde erhalten.' : 'Deine nächste Übung wartet auf dich. Du kannst mit einem frischen Gedanken zurückkommen.'}</p><div className="learn-summary-grid"><div className="learn-summary-stat"><strong>{attempts.length}</strong><span>ausgewertete Versuche</span></div><div className="learn-summary-stat"><strong>{Math.max(1, Math.round(elapsed / 60))} Min.</strong><span>aktive Lernzeit</span></div></div><div className="learn-summary-list"><div className="learn-summary-item"><CheckCircle2 className="size-4" /><span>{independent.length ? `${independent.length} ${independent.length === 1 ? 'Versuch ist' : 'Versuche sind'} im Demo-Check selbstständig gelungen.` : 'Eigenständige Anwendung wird im nächsten passenden Versuch sichtbar.'}</span></div><div className="learn-summary-item"><BookOpen className="size-4" /><span>{review?.assessmentPending ? 'Die fachliche Prüfung deiner Datei steht noch aus. Wähle sie beim nächsten Öffnen erneut aus.' : phase === 'summary' && review ? `Zum Weiterlernen: ${next.title}` : `Zum Weiterlernen: ${activity.title}`}</span></div><div className="learn-summary-item"><Clock3 className="size-4" /><span>Dein Zeitrahmen bleibt flexibel. Eine neue Einheit beginnt mit einem frischen Budget.</span></div></div><div className="learn-next-actions"><Button variant="primary" onClick={onHome}>Zur Lernübersicht <ArrowRight className="size-4" /></Button><Button variant="outline" onClick={() => { setBudget((value) => Math.max(value, Math.ceil(elapsed / 60) + 5)); setPhase(review ? 'review' : 'question') }}>An dieser Stelle fortsetzen</Button><Button variant="ghost" onClick={restart}><RotateCcw className="size-3.5" /> Neue Einheit</Button></div><p className="learn-saving-note">{saveFailed ? 'Der Browser konnte den Zwischenstand nicht speichern. Lass diese Seite geöffnet, um hier fortzusetzen.' : 'Text, Lernverlauf und deine Stelle im Ablauf sind in diesem Browser gespeichert. Dateien bleiben nur in der geöffneten Sitzung.'}</p></LearningSurface>
      </motion.div> : <motion.div key="workspace" className="learn-grid" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="learn-main"><AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${activity.id}-${phase}`} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -4 }} transition={{ duration: .2 }}>
            {phase === 'question' ? <QuestionWorkspace activity={activity} mode={mode} onMode={changeMode} draft={draft} onDraft={(value) => { setDraft(value); if (value.file) setFileLost(false) }} busy={busy} error={error} onSubmit={() => void submit()} attemptNumber={attempts.length + 1} partner={partner} onPartner={setPartner} pairPhase={pairPhase} onPairPhase={setPairPhase} onLeavePair={leavePair} firstDraft={first} secondDraft={second} hintsUsed={hints} restoredFileLost={fileLost} /> : review && <ReviewWorkspace activity={activity} draft={draft} review={review} mode={mode} supported={supported} attempts={attempts} difficulty={difficulty} ratingSaving={ratingSaving} error={ratingError} onDifficulty={(value) => void rate(value)} next={next} remainingMinutes={remaining} onContinue={continueLearning} onRetry={retry} onCoach={activateCoach} onFinish={finish} />}
          </motion.div>
        </AnimatePresence>{saveFailed && <p className="learn-saving-note" role="status">Der Zwischenstand konnte nicht im Browser gespeichert werden. Deine aktuelle Arbeit bleibt auf dieser Seite erhalten.</p>}</div>
        <aside ref={coachRef} className="learn-sidebar"><AIChatPanel key={`${activity.id}-${phase}`} kind="tutor" workspace chatId={`practice-${activity.id}-${phase}`} questionId={question.id} topicId={topic.id} initialMessages={messages} title={phase === 'review' ? 'Dein Feedback-Coach' : 'Dein Lerncoach'} detail="Gemeinsam weiterdenken" activity={activity} learnerAnswer={draft.text} review={phase === 'review' ? review : null} mode={mode} active={mode === 'coach' && topic.context.tutorEnabled} onActivate={topic.context.tutorEnabled ? activateCoach : undefined} onSupport={phase === 'question' ? onSupport : undefined} onMessagesChange={onMessages} disabled={busy} />{!topic.context.tutorEnabled && <p className="learn-coach-caption">Der KI-Coach ist in deinem Lernkontext deaktiviert.</p>}{isDemoMode && <p className="learn-coach-caption">Demo mit vorbereiteten Lernimpulsen. <span>Deine Antworten bleiben hier im Browser.</span></p>}</aside>
      </motion.div>}
    </AnimatePresence>
  </div></MotionConfig>
}
