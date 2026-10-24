import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, CheckCircle2,
  ChevronDown, ChevronRight, Clock3, FileText, Flame, GraduationCap, Lightbulb, LockKeyhole,
  Info, LogOut, MessageCircle, Pencil, Plus, Settings2, Sparkles, Target, Trash2, Upload,
  UsersRound, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select as UISelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ErrorNotice, LoadingCard, LoadingInline, SavedNotice } from '@/components/feedback'
import { TopicPage as RedesignedTopicPage } from '@/components/topic-page'
import { getDeletedTopicIds, getStoredTopic, isDemoMode, learningApi, saveStoredTopic } from '@/lib/api'
import { bloomStages, initialDashboard, initialTopic, refreshEligibility } from '@/lib/fixtures'
import { readLearnerContext, writeLearnerContext } from '@/lib/storage'
import type { AnswerSubmission, BloomStage, ChatMessage, DashboardData, LearningQuestion, ReviewResult, Topic } from '@/lib/types'

const LearningGraph = lazy(() => import('@/components/learning-graph'))
const StageFilter = lazy(() => import('@/components/stage-filter'))
const AIChatPanel = lazy(() => import('@/components/ai-chat').then((module) => ({ default: module.AIChatPanel })))

type Page = 'dashboard' | 'topic' | 'question' | 'review'
type Difficulty = NonNullable<AnswerSubmission['difficulty']>
const learnerSkills = [
  { nodeId: 'prompt-goal', title: 'Zielgruppe bestimmen', Icon: Target },
  { nodeId: 'prompt-criteria', title: 'Qualitätskriterien setzen', Icon: CheckCircle2 },
  { nodeId: 'prompt-revise', title: 'Antworten prüfen', Icon: BookOpen },
] as const

const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } },
  exit: { opacity: 0, y: -5, transition: { duration: 0.14, ease: 'easeIn' } },
}

const defaultSetupMessages: ChatMessage[] = [{ id: 'setup-welcome', role: 'assistant', text: 'Lass uns einen Lernpfad für deine Notizen gestalten. Was möchtest du erreichen und welche Inhalte sind dafür am wichtigsten?' }]

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [dashboard, setDashboard] = useState<DashboardData>(initialDashboard)
  const [topic, setTopic] = useState<Topic>(initialTopic)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [activeQuestion, setActiveQuestion] = useState<LearningQuestion>(initialTopic.questions[0])
  const [review, setReview] = useState<ReviewResult | null>(null)
  const [reviewError, setReviewError] = useState('')
  const [ratingSaving, setRatingSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [topicLoading, setTopicLoading] = useState(false)
  const [uploadingSource, setUploadingSource] = useState(false)
  const [appLoading, setAppLoading] = useState(true)
  const [error, setError] = useState('')
  const [topicError, setTopicError] = useState('')
  const [setupMode, setSetupMode] = useState(false)
  const [setupDone, setSetupDone] = useState(false)
  const [planChatOpen, setPlanChatOpen] = useState(false)
  const [setupMessages, setSetupMessages] = useState<ChatMessage[]>(defaultSetupMessages)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [hintsOpen, setHintsOpen] = useState(false)
  const [tutorOpen, setTutorOpen] = useState(false)
  const [reviewTutorOpen, setReviewTutorOpen] = useState(false)
  const [tutorMessages, setTutorMessages] = useState<ChatMessage[]>([{ id: 'tutor-intro', role: 'assistant', text: 'I can help you think it through without giving away the answer. What part feels unclear?' }])
  const [answer, setAnswer] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [questionFilters, setQuestionFilters] = useState({ short: false, partner: false, stage: 'All stages' })
  const [search, setSearch] = useState('')
  const [contextDraft, setContextDraft] = useState(topic.context)
  const [contextSaving, setContextSaving] = useState(false)
  const [contextSaved, setContextSaved] = useState(false)
  const [sourceBusyId, setSourceBusyId] = useState('')
  const [editingSource, setEditingSource] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [showAllQuestions, setShowAllQuestions] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const answerRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const scrollToTop = useCallback(() => {
    // Page changes should always start at the beginning; smooth scrolling can
    // leave the new screen midway down if its content height changes.
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [])

  const updateTopic = useCallback((next: Topic) => {
    const refreshed = refreshEligibility(next)
    setTopic(refreshed)
    setContextDraft(refreshed.context)
    if (isDemoMode) saveStoredTopic(refreshed)
    setDashboard((current) => ({
      ...current,
      topics: current.topics.some((item) => item.id === refreshed.id)
        ? current.topics.map((item) => item.id === refreshed.id ? refreshed : item)
        : [refreshed, ...current.topics],
    }))
  }, [])

  const handleScopedTopic = useCallback((next: Topic) => {
    updateTopic(next)
    setSetupDone(true)
    setSetupMode(false)
    setPlanChatOpen(true)
    window.localStorage.setItem(`learn45.topic.ready.${next.id}`, 'true')
  }, [updateTopic])

  const loadHome = useCallback(async () => {
    setAppLoading(true)
    setError('')
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const data = await learningApi.getDashboard(controller.signal)
      const storedTopics: Topic[] = []
      if (isDemoMode) {
        for (let index = 0; index < window.localStorage.length; index += 1) {
          const key = window.localStorage.key(index)
          if (!key?.startsWith('learn45.topic.')) continue
          try {
            const stored = window.localStorage.getItem(key)
            if (stored) storedTopics.push(JSON.parse(stored) as Topic)
          } catch { /* Ignore an invalid local cache entry and keep loading the rest. */ }
        }
      }
      const deletedIds = isDemoMode ? new Set(getDeletedTopicIds()) : new Set<string>()
      const combined = [...storedTopics, ...data.topics].filter((item, index, all) => !deletedIds.has(item.id) && all.findIndex((candidate) => candidate.id === item.id) === index)
      const lastSessionTopic = combined.find((item) => item.id === data.lastSession.topicId)
      const nextTopic = lastSessionTopic ?? combined[0]
      const lastSession = lastSessionTopic
        ? data.lastSession
        : nextTopic
          ? { topicId: nextTopic.id, title: nextTopic.title, detail: nextTopic.questions[0]?.title ?? 'Lernplan ansehen', progress: nextTopic.progress }
          : { topicId: '', title: 'Noch kein Lernthema', detail: 'Füge Lernmaterial hinzu, um zu starten.', progress: 0 }
      setDashboard({ ...data, topics: combined, lastSession })
      const primary = combined[0] ?? initialTopic
      setTopic(primary)
      setContextDraft(isDemoMode ? readLearnerContext(primary.context) : primary.context)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load Lea’s learning dashboard.')
    } finally {
      setAppLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHome()
    return () => abortRef.current?.abort()
  }, [loadHome])

  useLayoutEffect(() => {
    scrollToTop()
  }, [page, scrollToTop])

  const readyKey = `learn45.topic.ready.${topic.id}`
  useEffect(() => {
    setSetupDone(isDemoMode ? window.localStorage.getItem(readyKey) === 'true' || topic.id === initialTopic.id : topic.nodes.length > 0 && topic.questions.length > 0)
  }, [readyKey, topic.id, topic.nodes.length, topic.questions.length])

  const openTopic = useCallback(async (topicId: string, isNew = false, focus?: { nodeId: string; partner: boolean }) => {
    scrollToTop()
    setPage('topic')
    setTopicError('')
    setTopicLoading(true)
    setBusy(true)
    setSetupMode(isNew)
    setSetupDone(!isNew)
    setPlanChatOpen(false)
    setSetupMessages(defaultSetupMessages)
    setSelectedNode(focus?.nodeId ?? null)
    setQuestionFilters({ short: false, partner: focus?.partner ?? false, stage: 'All stages' })
    try {
      const next = await learningApi.getTopic(topicId)
      setTopic(next)
      setContextDraft(isDemoMode ? readLearnerContext(next.context) : next.context)
      setSetupDone(isDemoMode ? window.localStorage.getItem(`learn45.topic.ready.${topicId}`) === 'true' || topicId === initialTopic.id : next.nodes.length > 0 && next.questions.length > 0)
    } catch (cause) {
      const cached = getStoredTopic(topicId)
      if (cached && isDemoMode) setTopic(cached)
      else setTopicError(cause instanceof Error ? cause.message : 'Could not load this topic.')
    } finally {
      setTopicLoading(false)
      setBusy(false)
    }
  }, [scrollToTop])

  const beginUpload = useCallback(async (file: File, existingTopicId?: string) => {
    setBusy(true)
    setUploadingSource(true)
    setError('')
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const next = await learningApi.uploadSource(file, existingTopicId, controller.signal)
      updateTopic(next)
      if (!existingTopicId) {
        setSetupMode(true)
        setSetupDone(false)
        window.localStorage.removeItem(`learn45.topic.ready.${next.id}`)
        setPage('topic')
        setSetupMessages(defaultSetupMessages)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add this file.')
    } finally {
      setUploadingSource(false)
      setBusy(false)
    }
  }, [updateTopic])

  function handleFileChange(event: ChangeEvent<HTMLInputElement>, existingTopicId?: string) {
    const file = event.target.files?.[0]
    if (file) void beginUpload(file, existingTopicId)
    event.target.value = ''
  }

  async function saveContext(event: FormEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault()
    setContextSaving(true)
    setContextSaved(false)
    try {
      const saved = await learningApi.updateContext(topic.id, contextDraft)
      if (isDemoMode) writeLearnerContext(saved)
      updateTopic({ ...topic, context: saved })
      setContextSaved(true)
      window.setTimeout(() => setContextSaved(false), 2500)
      return true
    } catch (cause) {
      setTopicError(cause instanceof Error ? cause.message : 'Your learning context was not saved.')
      return false
    } finally {
      setContextSaving(false)
    }
  }

  async function renameSource(sourceId: string) {
    if (!sourceName.trim()) return
    setSourceBusyId(sourceId)
    try {
      updateTopic(await learningApi.renameSource(topic.id, sourceId, sourceName.trim()))
      setEditingSource(null)
    } catch (cause) {
      setTopicError(cause instanceof Error ? cause.message : 'Could not rename this source.')
    } finally {
      setSourceBusyId('')
    }
  }

  async function deleteSource(sourceId: string) {
    setSourceBusyId(sourceId)
    try {
      updateTopic(await learningApi.deleteSource(topic.id, sourceId))
    } catch (cause) {
      setTopicError(cause instanceof Error ? cause.message : 'Could not remove this source.')
    } finally {
      setSourceBusyId('')
    }
  }

  async function deleteTopicFromDashboard(topicId: string): Promise<boolean> {
    setError('')
    try {
      await learningApi.deleteTopic(topicId)
      setDashboard((current) => {
        const topics = current.topics.filter((item) => item.id !== topicId)
        const lastSessionTopic = topics.find((item) => item.id === current.lastSession.topicId) ?? topics[0]
        const lastSession = lastSessionTopic
          ? current.lastSession.topicId === lastSessionTopic.id
            ? current.lastSession
            : { topicId: lastSessionTopic.id, title: lastSessionTopic.title, detail: lastSessionTopic.questions[0]?.title ?? 'Lernplan ansehen', progress: lastSessionTopic.progress }
          : { topicId: '', title: 'Noch kein Lernthema', detail: 'Füge Lernmaterial hinzu, um zu starten.', progress: 0 }
        return { ...current, topics, lastSession }
      })
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Das Thema konnte nicht gelöscht werden.')
      return false
    }
  }

  function startQuestion(question: LearningQuestion, withTutor = false) {
    setActiveQuestion(question)
    setAnswer('')
    setHintsUsed(0)
    setHintsOpen(false)
    setTutorOpen(withTutor)
    setReviewTutorOpen(false)
    setTutorMessages([{ id: 'tutor-intro', role: 'assistant', text: withTutor ? 'Wir klären die Aufgabe mit kurzen Rückfragen. Für wen ist die Zusammenfassung, wie lang soll sie sein und welche Angaben müssen hinein?' : 'Ich helfe dir mit Rückfragen, ohne die Antwort vorwegzunehmen. Was ist noch unklar?' }])
    setReview(null)
    setReviewError('')
    setDifficulty(null)
    setPage('question')
    scrollToTop()
  }

  function startDashboardMission(topicId: string, questionId: string, withTutor: boolean) {
    const selectedTopic = dashboard.topics.find((item) => item.id === topicId)
    const question = selectedTopic?.questions.find((item) => item.id === questionId)
    if (!selectedTopic || !question) return
    setTopic(selectedTopic)
    setContextDraft(isDemoMode ? readLearnerContext(selectedTopic.context) : selectedTopic.context)
    setTopicError('')
    setSelectedNode(question.topicId)
    setQuestionFilters({ short: false, partner: false, stage: 'All stages' })
    startQuestion(question, withTutor)
  }

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!answer.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await learningApi.submitAnswer({ questionId: activeQuestion.id, answer, hintsUsed, tutorUsed: tutorMessages.some((message) => message.role === 'user'), difficulty: null })
      setReview(result)
      const updated = topic.nodes.map((node) => {
        if (node.id !== activeQuestion.topicId || result.evidenceDelta === 0) return node
        const stageCaps: Record<BloomStage, number> = { Remember: 25, Understand: 50, Apply: 75, Analyze: 100, Evaluate: 100, Create: 100 }
        const progress = Math.max(node.progress, Math.min(stageCaps[activeQuestion.stage], node.progress + result.evidenceDelta))
        return { ...node, progress, evidence: { ...node.evidence, [activeQuestion.stage]: Math.min(100, node.evidence[activeQuestion.stage] + result.evidenceDelta) } }
      })
      const progress = Math.max(topic.progress, Math.round(updated.reduce((sum, node) => sum + node.progress, 0) / updated.length))
      updateTopic({ ...topic, nodes: updated, progress })
      setDashboard((current) => ({ ...current, lastSession: { topicId: topic.id, title: topic.title, detail: activeQuestion.title, progress } }))
      setPage('review')
      scrollToTop()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your answer could not be submitted.')
    } finally {
      setBusy(false)
    }
  }

  function addHint() {
    if (hintsUsed >= 3) return
    setHintsUsed((count) => count + 1)
    setHintsOpen(true)
  }

  async function recordDifficulty(value: Difficulty) {
    setDifficulty(value)
    setRatingSaving(true)
    setReviewError('')
    try {
      await learningApi.rateDifficulty(activeQuestion.id, value)
    } catch (cause) {
      setReviewError(cause instanceof Error ? cause.message : 'Your rating could not be saved.')
    } finally {
      setRatingSaving(false)
    }
  }

  const visibleQuestions = useMemo(() => {
    return topic.questions.filter((question) => {
      const matchesNode = !selectedNode || question.topicId === selectedNode
      const matchesSearch = `${question.title} ${question.prompt}`.toLowerCase().includes(search.toLowerCase())
      const matchesStage = questionFilters.stage === 'All stages' || question.stage === questionFilters.stage
      const matchesPartner = !questionFilters.partner || question.mode === 'Partner'
      const matchesLength = !questionFilters.short || parseInt(question.duration, 10) <= 5
      return matchesNode && matchesSearch && matchesStage && matchesPartner && matchesLength
    })
  }, [questionFilters, search, selectedNode, topic.questions])

  const selectedTopicNode = topic.nodes.find((node) => node.id === selectedNode) ?? null
  return <div className="app-frame min-h-screen bg-background text-foreground">
    <input ref={fileInputRef} className="sr-only" type="file" accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx" onChange={(event) => handleFileChange(event)} aria-label="Lernmaterial zum Hochladen auswählen" />
    <AppHeader learnerName={dashboard.learnerName} />
    <main className="mx-auto min-h-[calc(100vh-88px)] w-full max-w-[1440px] px-4 pb-16 pt-3 sm:px-6 sm:pt-4 lg:px-10 lg:pt-5">
      {error && <div className="mb-6"><ErrorNotice message={error} onRetry={() => { setError(''); if (page === 'dashboard') void loadHome() }} /></div>}
      {appLoading ? <LoadingCard title="Opening Lea’s learning space" detail="Lernbereiche und Fortschritt werden geladen…" /> : <AnimatePresence mode="wait" initial={false}>
        <motion.div key={page} variants={pageVariants} initial="initial" animate="animate" exit="exit">
          {page === 'dashboard' && <>{uploadingSource && <div className="mb-5"><LoadingInline label="Preparing your learning material…" /></div>}<DashboardPage dashboard={dashboard} busy={busy} onOpenTopic={(id) => void openTopic(id)} onStartSuggested={(topicId, questionId, withTutor) => startDashboardMission(topicId, questionId, withTutor)} onDeleteTopic={deleteTopicFromDashboard} onUpload={() => fileInputRef.current?.click()} onSetWeeklyGoal={async (minutes) => {
            try {
              const weeklyGoalMinutes = await learningApi.updateWeeklyGoal(minutes)
              setDashboard((current) => ({ ...current, weeklyGoalMinutes }))
              return true
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Could not update your weekly goal.')
              return false
            }
          }} onContinue={() => {
            const nextTopic = dashboard.topics.find((item) => item.id === dashboard.lastSession.topicId) ?? topic
            setTopic(nextTopic)
            const nextQuestion = nextTopic.questions.find((question) => question.title === dashboard.lastSession.detail) ?? nextTopic.questions.find((question) => question.topicId === 'prompt-criteria') ?? nextTopic.questions[0]
            startQuestion(nextQuestion)
          }} /></>}
          {page === 'topic' && (topicLoading ? <LoadingCard title="Themenbereich wird geöffnet" detail="Lernmaterial, Fortschritt und Lernpfad werden geladen…" /> : <RedesignedTopicPage topic={topic} uploading={uploadingSource} setupMode={setupMode && !setupDone} planChatOpen={planChatOpen} setupMessages={setupMessages} setupError={topicError} selectedNode={selectedNode} selectedTopicNode={selectedTopicNode} questions={visibleQuestions} questionFilters={questionFilters} search={search} context={contextDraft} contextSaving={contextSaving} contextSaved={contextSaved} showAllQuestions={showAllQuestions} onBack={() => setPage('dashboard')} onUpload={(file) => void beginUpload(file, topic.id)} onSelectNode={setSelectedNode} onFilter={setQuestionFilters} onSearch={setSearch} onStartQuestion={startQuestion} onToggleAllQuestions={() => setShowAllQuestions((show) => !show)} onTopicUpdated={handleScopedTopic} onTogglePlanChat={() => setPlanChatOpen((open) => !open)} onSaveContext={saveContext} onContextChange={setContextDraft} onRenameStart={(id, name) => { setEditingSource(id); setSourceName(name) }} editingSource={editingSource} sourceName={sourceName} onSourceNameChange={setSourceName} onRenameSource={(id) => void renameSource(id)} onCancelRename={() => setEditingSource(null)} onDeleteSource={(id) => void deleteSource(id)} sourceBusyId={sourceBusyId} onBackToDashboard={() => setPage('dashboard')} onRetry={() => void openTopic(topic.id, setupMode)} />)}
          {page === 'question' && <QuestionPage topic={topic} question={activeQuestion} answer={answer} hintsUsed={hintsUsed} hintsOpen={hintsOpen} tutorOpen={tutorOpen && topic.context.tutorEnabled} tutorEnabled={topic.context.tutorEnabled} tutorMessages={tutorMessages} busy={busy} error={error} answerRef={answerRef} onBack={() => setPage('topic')} onAnswer={setAnswer} onSubmit={submitAnswer} onHint={addHint} onToggleHints={() => setHintsOpen((open) => !open)} onToggleTutor={() => setTutorOpen((open) => !open)} onTutorMessages={setTutorMessages} />}
          {page === 'review' && review && <ReviewPage topic={topic} question={activeQuestion} review={review} difficulty={difficulty} ratingSaving={ratingSaving} error={reviewError} tutorOpen={reviewTutorOpen} tutorMessages={tutorMessages} onToggleTutor={() => setReviewTutorOpen((open) => !open)} onTutorMessages={setTutorMessages} onDifficulty={(value) => void recordDifficulty(value)} onContinue={() => {
            const suggested = topic.questions.find((question) => question.id === review.nextQuestionId) ?? topic.questions.find((question) => question.id !== activeQuestion.id) ?? activeQuestion
            startQuestion(suggested)
          }} onTopic={() => setPage('topic')} onDashboard={() => setPage('dashboard')} />}
        </motion.div>
      </AnimatePresence>}
    </main>
    <footer className="mx-auto max-w-[1440px] px-4 pb-8 pt-1 text-center text-[11px] leading-5 text-muted-foreground sm:px-6 lg:px-10"><p>Synthetisches Beispielprofil Lea · Übungsfortschritt zeigt Lernaktivitäten, keine Kompetenzdiagnose.</p></footer>
  </div>
}

function AppHeader({ learnerName }: { learnerName: string }) {
  const [notice, setNotice] = useState<'settings' | 'logout' | null>(null)
  return <header className="app-header border-b border-border/80 bg-card/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <span className="brand-mark flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><GraduationCap className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0"><p className="brand-name truncate text-lg font-semibold tracking-tight">learn<span>45</span></p><p className="hidden text-[11px] text-muted-foreground sm:block">Lernen, das weiterbringt</p></div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" aria-label={`${learnerName} Profilmenü`} aria-haspopup="menu"><span className="inline-flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{learnerName.slice(0, 1)}</span><span className="hidden sm:inline">{learnerName}</span><ChevronDown className="size-4" aria-hidden="true" /></span></Button>} />
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup><DropdownMenuLabel><span className="block text-sm font-semibold text-foreground">{learnerName} · Profil</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Demo mit Lea</span></DropdownMenuLabel></DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setNotice('settings')}><Settings2 aria-hidden="true" /> Einstellungen</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setNotice('logout')}><LogOut aria-hidden="true" /> Abmelden</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {notice && <div className="fixed inset-0 z-[120] grid place-items-center bg-foreground/30 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNotice(null) }}><section role="dialog" aria-modal="true" aria-labelledby="profile-action-title" className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl"><p className="eyebrow">LEA · DEMO</p><h2 id="profile-action-title" className="mt-1 text-lg font-semibold">{notice === 'settings' ? 'Einstellungen' : 'Abmelden'}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{notice === 'settings' ? 'Deine Lerneinstellungen kannst du im Lernbereich über „Lernkontext bearbeiten“ anpassen.' : 'Du bist in einer Demo ohne echtes Benutzerkonto. Es wird kein Konto abgemeldet.'}</p><div className="mt-5 flex justify-end"><Button variant="primary" onClick={() => setNotice(null)}>Verstanden</Button></div></section></div>}
    </div>
  </header>
}

function SectionHeading({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>{detail && <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p>}</div>{action}
  </div>
}

function ProgressBar({ value, label, className = '' }: { value: number; label?: string; className?: string }) {
  return <Progress value={value} aria-label={label ?? 'Gesamtfortschritt'} className={`progress-bar ${className}`}><div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">{label ?? 'Gesamtfortschritt'}</span><span className="font-semibold tabular-nums">{value}%</span></div></Progress>
}

function formatExamCountdown(date: string) {
  if (!date) return 'Exam date not set'
  const target = new Date(`${date}T00:00:00`).getTime()
  if (!Number.isFinite(target)) return 'Exam date not set'
  const remaining = Math.ceil((target - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  return remaining > 0 ? `Exam in ${remaining} days` : remaining === 0 ? 'Exam today' : 'Exam date passed'
}

function SkillProgressPanel({ topic, focusNodeId, compact = false }: { topic: Topic; focusNodeId?: string; compact?: boolean }) {
  const reduceMotion = useReducedMotion()
  const skills = learnerSkills.flatMap((skill) => {
    const node = topic.nodes.find((item) => item.id === skill.nodeId)
    return node ? [{ ...skill, node }] : []
  })
  if (!skills.length) return null

  return <section className={'skill-progress-panel' + (compact ? ' skill-progress-panel--compact' : '')} aria-label="Skills im Aufbau">
    <div className="skill-progress-heading">
      <div><p className="eyebrow">DEINE SKILLS</p><p className="skill-progress-note">Übungsfortschritt, keine Kompetenzdiagnose</p></div>
      {focusNodeId && <span className="skill-focus-label">Diese Runde</span>}
    </div>
    <ul className="skill-progress-grid">
      {skills.map((skill, index) => {
        const Icon = skill.Icon
        const focused = focusNodeId === skill.nodeId
        const status = focused ? 'In dieser Runde geübt' : skill.node.progress > 0 ? 'Schon geübt' : 'Als Nächstes'
        return <motion.li key={skill.nodeId} className={'skill-progress-card' + (focused ? ' skill-progress-card--focus' : '')} aria-current={focused ? 'step' : undefined} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : index * .07, duration: reduceMotion ? 0 : .28 }}>
          <div className="skill-progress-card-header">
            <span className="skill-progress-icon"><Icon className="size-4" aria-hidden="true" /></span>
            <span className="skill-progress-copy"><span className="skill-progress-title">{skill.title}</span><span className="skill-progress-status">{status}</span></span>
            <span className="skill-progress-value">{skill.node.progress}%</span>
          </div>
          <div className="skill-progress-track" role="progressbar" aria-label={'Übungsstand: ' + skill.title} aria-valuenow={skill.node.progress} aria-valuemin={0} aria-valuemax={100}><motion.span initial={reduceMotion ? false : { width: 0 }} animate={{ width: skill.node.progress + '%' }} transition={{ duration: reduceMotion ? 0 : .7, delay: reduceMotion ? 0 : index * .07, ease: 'easeOut' }} /></div>
        </motion.li>
      })}
    </ul>
  </section>
}
function DashboardPage({ dashboard, busy, onOpenTopic, onStartSuggested, onDeleteTopic, onUpload, onContinue, onSetWeeklyGoal }: { dashboard: DashboardData; busy: boolean; onOpenTopic: (id: string) => void; onStartSuggested: (topicId: string, questionId: string, withTutor: boolean) => void; onDeleteTopic: (id: string) => Promise<boolean>; onUpload: () => void; onContinue: () => void; onSetWeeklyGoal: (minutes: number) => Promise<boolean> }) {
  const reduceMotion = useReducedMotion()
  const [goalMenuOpen, setGoalMenuOpen] = useState(false)
  const [topicToDelete, setTopicToDelete] = useState<Topic | null>(null)
  const [deletingTopic, setDeletingTopic] = useState(false)
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalMenuPosition, setGoalMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const goalAnchorRef = useRef<HTMLDivElement>(null)
  const goalMenuRef = useRef<HTMLDivElement>(null)
  const percent = Math.min(100, Math.round(dashboard.studyMinutes / dashboard.weeklyGoalMinutes * 100))
  const hasTopics = dashboard.topics.length > 0
  const suggestionTopic = dashboard.topics.find((item) => item.id === dashboard.lastSession.topicId) ?? dashboard.topics[0]
  const suggestionNode = suggestionTopic?.nodes.filter((node) => node.eligible && node.progress < 100).sort((left, right) => left.progress - right.progress)[0] ?? suggestionTopic?.nodes[0]
  const eligibleQuestions = suggestionTopic ? suggestionTopic.questions.filter((question) => suggestionTopic.nodes.some((node) => node.id === question.topicId && node.eligible)) : []
  const suggestionQuestion = eligibleQuestions.find((question) => question.topicId === suggestionNode?.id && question.status !== 'completed') ?? eligibleQuestions[0] ?? suggestionTopic?.questions[0]
  const coachingQuestion = suggestionTopic?.questions.find((question) => question.id === 'q-criteria') ?? suggestionQuestion
  const independentQuestion = suggestionTopic?.questions.find((question) => question.id === 'q-revise') ?? suggestionQuestion
  const practicedSteps = suggestionTopic?.nodes.filter((node) => node.progress > 0).length ?? 0
  const totalSteps = suggestionTopic?.nodes.length ?? 0
  const coachingMinutes = Number.parseInt(coachingQuestion?.duration ?? '5 min', 10) || 5
  const practiceMinutes = Number.parseInt(independentQuestion?.duration ?? '7 min', 10) || 7
  const missionMinutes = coachingMinutes + practiceMinutes
  const isLeaScenario = suggestionTopic?.id === initialTopic.id
  const suggestionReason = isLeaScenario
    ? 'Bei zwei Versuchen blieb „kurz und professionell“ noch zu ungenau. Der KI-Coach klärt Zielgruppe, Länge und Pflichtangaben. Danach formulierst du den Auftrag selbst mit höchstens fünf Stichpunkten und prüfst ihn an neuen Notizen.'
    : `Der Vorschlag knüpft an „${dashboard.lastSession.detail}“ an. Der KI-Coach hilft dir kurz beim nächsten Schritt; danach probierst du das Gelernte selbst an einem neuen Fall aus.`
  const missionStages = [
    { id: 'attempt', state: 'done', title: 'Allein versucht', detail: 'Zwei ungenaue Versuche' },
    { id: 'coach', state: 'current', title: 'Mit KI klären', detail: 'Zielgruppe · Länge · Muss-Inhalte' },
    { id: 'apply', state: 'next', title: 'Allein anwenden', detail: 'Neue Notizen prüfen · ' + practiceMinutes + ' Min.' },
  ] as const
  useEffect(() => {
    if (!topicToDelete) return
    document.getElementById('cancel-topic-delete')?.focus()
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !deletingTopic) setTopicToDelete(null) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [topicToDelete, deletingTopic])
  useEffect(() => {
    if (!goalMenuOpen) { setGoalMenuPosition(null); return }
    const positionMenu = () => {
      const anchor = goalAnchorRef.current?.getBoundingClientRect()
      if (!anchor) return
      const menuWidth = Math.min(208, window.innerWidth - 24)
      const menuHeight = goalMenuRef.current?.getBoundingClientRect().height ?? 224
      const margin = 12
      const left = Math.max(margin, Math.min(anchor.right - menuWidth, window.innerWidth - menuWidth - margin))
      const aboveTop = anchor.top - menuHeight - 8
      const roomBelow = window.innerHeight - anchor.bottom - 8 - margin
      const top = aboveTop >= margin
        ? aboveTop
        : roomBelow >= Math.min(menuHeight, 240)
          ? anchor.bottom + 8
          : Math.max(margin, window.innerHeight - menuHeight - margin)
      setGoalMenuPosition({ top, left })
    }
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !goalAnchorRef.current?.contains(event.target) && !goalMenuRef.current?.contains(event.target)) setGoalMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setGoalMenuOpen(false) }
    positionMenu()
    window.addEventListener('resize', positionMenu)
    window.addEventListener('scroll', positionMenu, true)
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('resize', positionMenu)
      window.removeEventListener('scroll', positionMenu, true)
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [goalMenuOpen])
  async function confirmTopicDelete() {
    if (!topicToDelete || deletingTopic) return
    setDeletingTopic(true)
    try {
      const deleted = await onDeleteTopic(topicToDelete.id)
      if (deleted) setTopicToDelete(null)
    } finally {
      setDeletingTopic(false)
    }
  }

  return <div className="space-y-7">
    <section className="dashboard-hero relative overflow-hidden rounded-[1.75rem] bg-primary px-5 py-6 text-primary-foreground sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <div className="hero-orb hero-orb-one" aria-hidden="true" /><div className="hero-orb hero-orb-two" aria-hidden="true" /><div className="hero-orb hero-orb-three" aria-hidden="true" /><div className="hero-orb hero-orb-four" aria-hidden="true" />
      <div className="relative z-10 grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.68fr)] lg:items-center lg:gap-12">
        <div className="max-w-2xl"><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-primary-foreground/70"><span className="flex size-7 items-center justify-center rounded-full border border-primary-foreground/25"><Sparkles className="size-3.5" aria-hidden="true" /></span> Dein Lernraum · Lea <span className="rounded-full border border-primary-foreground/20 px-2 py-1 text-[9px] tracking-[.12em]">SYNTHETISCHE DEMO</span></p><h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-.045em] sm:text-5xl">Wissen wächst<br /><span className="text-primary-foreground/60">Schritt für Schritt.</span></h1><p className="mt-4 max-w-lg text-sm leading-6 text-primary-foreground/80">Schön, dass du wieder da bist. Deine Übungen zeigen, was du ausprobiert hast und welcher nächste Schritt passen könnte.</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-primary-foreground/75"><span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-sky-200" aria-hidden="true" /> {dashboard.completedSessions} Einheiten geübt</span></div>
        </div>
        <div className="hero-rhythm-card rounded-[1.4rem] border border-primary-foreground/15 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4"><div><span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-primary-foreground/70"><Clock3 className="size-3.5 text-sky-200" aria-hidden="true" /> Dein Wochenrhythmus</span><p className="mt-2 text-sm text-primary-foreground/75">Jeder Lernmoment zählt. Du gibst das Tempo vor.</p></div><div className="hero-progress-value" role="progressbar" aria-label="Wochenziel" aria-valuenow={Math.min(100, percent)} aria-valuemin={0} aria-valuemax={100}><span>{percent}%</span><span>erreicht</span></div></div>
          <div className="mt-4 border-t border-primary-foreground/15 pt-4"><div className="flex items-baseline justify-between gap-3"><p className="text-2xl font-semibold tracking-tight">{dashboard.studyMinutes}<span className="ml-1 text-sm font-normal text-primary-foreground/65">/ {dashboard.weeklyGoalMinutes} Min.</span></p><p className="text-right text-xs text-primary-foreground/70">{Math.max(0, dashboard.weeklyGoalMinutes - dashboard.studyMinutes)} Min. bis zum Ziel</p></div><div className="mt-3 flex items-center justify-between gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary-foreground/20" aria-hidden="true"><motion.div className="h-full rounded-full bg-sky-200" initial={{ width: reduceMotion ? `${percent}%` : '0%' }} animate={{ width: `${percent}%` }} transition={{ duration: reduceMotion ? 0 : 1.15, ease: 'easeOut' }} /></div><div ref={goalAnchorRef}><Button variant="secondary" className="px-3 py-2 text-xs" aria-expanded={goalMenuOpen} aria-haspopup="menu" onClick={() => setGoalMenuOpen((open) => !open)}>Ziel ändern</Button></div></div></div>
        </div>
      </div>
    </section>

    <div className="continue-row grid gap-4 lg:grid-cols-[minmax(0,1fr)_11rem] lg:items-center"><Card className="continue-card panel relative mx-auto flex w-full flex-col justify-between gap-5 overflow-hidden sm:flex-row sm:items-center sm:gap-8"><div className="continue-card-mark" aria-hidden="true">45</div><div className="relative min-w-0 flex-1"><p className="eyebrow">LETZTE LERNEINHEIT</p><h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{hasTopics ? 'Dort weitermachen, wo du warst' : 'Lege ein neues Thema an'}</h2>{hasTopics ? <><div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><span className="font-semibold">{dashboard.lastSession.title}</span><span className="text-muted-foreground">{dashboard.lastSession.detail}</span></div><ProgressBar value={dashboard.lastSession.progress} label="Übungsstand" className="mt-4 max-w-lg" /></> : <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Füge Lernmaterial hinzu, um einen neuen Lernbereich und deinen Lernplan anzulegen.</p>}</div><Button variant="primary" className="relative mt-1 shrink-0 sm:mt-0" disabled={busy} onClick={hasTopics ? onContinue : onUpload}><span className="inline-flex items-center gap-2">{hasTopics ? 'Lerneinheit fortsetzen' : 'Lernmaterial auswählen'} <ArrowRight className="size-4" aria-hidden="true" /></span></Button></Card><Card className="streak-card panel mx-auto flex size-36 flex-col items-center justify-center gap-1 border-border bg-card p-4 lg:mx-0 lg:size-44"><Flame className="streak-flame size-20 text-streak" aria-hidden="true" /><div className="text-center"><p className="text-4xl font-bold leading-none tracking-tight text-foreground">{dashboard.streak}</p><p className="mt-1 text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">Lerntage</p></div></Card></div>

    <section>
      <SectionHeading eyebrow="DEINE LERNBEREICHE" title="Woran möchtest du arbeiten?" detail={dashboard.topics.length === 1 ? '1 Thema wartet auf dich' : `${dashboard.topics.length} Themen warten auf dich`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{dashboard.topics.map((item, index) => <motion.article key={item.id} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : index * .12 + .15, duration: reduceMotion ? 0 : .45, ease: 'easeOut' }} className="topic-card panel group flex min-h-56 flex-col justify-between transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl motion-reduce:transition-none">
          <div><div className="mb-5 flex items-start justify-between gap-2"><span className="topic-card-mark flex size-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><BookOpen className="size-5" aria-hidden="true" /></span><div className="flex items-center gap-2"><span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{item.subject}</span><Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive focus-visible:ring-destructive/40" aria-label={`Thema „${item.title}“ löschen`} title="Thema löschen" disabled={deletingTopic} onClick={() => setTopicToDelete(item)}><Trash2 className="size-3.5" aria-hidden="true" /></Button></div></div><h3 className="text-lg font-semibold tracking-tight">{item.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.description}</p></div>
          <div className="mt-5"><ProgressBar value={item.progress} label={`${item.nodes.filter((node) => node.progress > 0).length} von ${item.nodes.length} Lernschritten geübt · ${item.sources.length} Materialien`} /><div className="mt-4 flex items-center justify-between"><span className="text-xs text-muted-foreground">{item.updatedLabel}</span><Button variant="ghost" onClick={() => onOpenTopic(item.id)}><span className="inline-flex items-center gap-1.5">Thema öffnen <ArrowRight className="size-4" aria-hidden="true" /></span></Button></div></div>
        </motion.article>)}
        <motion.article initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : dashboard.topics.length * .12 + .15, duration: reduceMotion ? 0 : .45, ease: 'easeOut' }} className="add-topic-card flex min-h-56 flex-col justify-between rounded-[1.5rem] border border-dashed border-border bg-card p-5 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl motion-reduce:transition-none sm:p-6"><div><div className="add-topic-mark mb-5 flex size-11 items-center justify-center rounded-2xl bg-muted text-primary-foreground"><Plus className="size-5" aria-hidden="true" /></div><p className="eyebrow">LERNBEREICHE ERWEITERN</p><h3 className="mt-1 text-lg font-semibold tracking-tight">Neues Fach oder neuen Ordner anlegen</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Füge Lernmaterial hinzu, um einen neuen Lernbereich anzulegen. Der Lernagent erstellt passende Lernfragen und einen Lernplan.</p></div><div className="mt-5"><Button variant="outline" disabled={busy} onClick={onUpload}><span className="inline-flex items-center gap-2"><Upload className="size-4" aria-hidden="true" /> Notizen auswählen</span></Button></div></motion.article>
      </div>
    </section>
    {suggestionTopic && coachingQuestion && independentQuestion && <motion.section initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .5, ease: 'easeOut' }}>
      <SectionHeading eyebrow="VORSCHLAG AUS DEINEM LERNVERLAUF" title="Dein nächster Lernschritt" detail="Der Agent erklärt den Vorschlag. Du entscheidest, ob du mit KI oder allein startest." />
      <Card className="mission-card panel gap-0 overflow-hidden p-0">
        <div className="mission-card-glow" aria-hidden="true" />
        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="relative z-10 min-w-0 p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mission-pill mission-pill--signal"><Sparkles className="size-3.5" aria-hidden="true" /> 2 Versuche · gleiche Lücke</span>
              <span className="mission-pill"><Clock3 className="size-3.5" aria-hidden="true" /> {missionMinutes} Min. · passt ins 15-Minuten-Fenster</span>
            </div>
            <h3 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">Qualitätskriterien konkret machen</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{suggestionReason}</p>
            <div className="mt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Leas Lernweg</p>
                <p className="text-xs font-medium text-foreground">{practicedSteps} von {totalSteps} Lernschritten geübt</p>
              </div>
              <ol aria-label="Leas Lernweg: zwei eigene Versuche, KI-Coaching, eigener Transfer" className="mission-steps grid gap-2 sm:grid-cols-3">
                {missionStages.map((stage, index) => <motion.li key={stage.id} aria-current={stage.state === 'current' ? 'step' : undefined} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : .08 * index, duration: reduceMotion ? 0 : .32 }} className={`mission-step mission-step--${stage.state}`}>
                  <span className="mission-step-icon" aria-hidden="true">{stage.state === 'done' ? <CheckCircle2 className="size-4" /> : stage.state === 'current' ? <Sparkles className="size-4" /> : <Target className="size-4" />}</span>
                  <span className="mission-step-copy"><span className="mission-step-title">{stage.title}</span><span className="mission-step-detail">{stage.detail}</span></span>
                </motion.li>)}
              </ol>
            </div>
            <div className="mission-progress mt-5" aria-label={`Übungsstand ${suggestionTopic.progress} Prozent; ${practicedSteps} von ${totalSteps} Lernschritten geübt`}>
              <div className="mission-progress-track"><motion.span initial={reduceMotion ? false : { width: 0 }} animate={{ width: `${suggestionTopic.progress}%` }} transition={{ duration: reduceMotion ? 0 : .9, delay: reduceMotion ? 0 : .2, ease: 'easeOut' }} /></div>
              <span className="mission-progress-value">{suggestionTopic.progress}% Übungsstand</span>
            </div>
            <SkillProgressPanel topic={suggestionTopic} compact />
          </div>
          <aside className="mission-action-panel relative z-10 flex flex-col justify-center gap-3 p-5 sm:p-6">
            <div><p className="eyebrow text-primary">JETZT EMPFOHLEN · {coachingMinutes} MIN.</p><h4 className="mt-1 text-lg font-semibold">Mit Rückfragen klären</h4><p className="mt-1 text-sm leading-5 text-muted-foreground">Zielgruppe, Länge und Pflichtangaben festlegen.</p></div>
            <Button variant="primary" className="w-full" disabled={busy} onClick={() => onStartSuggested(suggestionTopic.id, coachingQuestion.id, true)}><span className="inline-flex items-center gap-2">Mit KI-Coach starten <ArrowRight className="size-4" aria-hidden="true" /></span></Button>
            <Button variant="outline" className="w-full" disabled={busy} onClick={() => onStartSuggested(suggestionTopic.id, coachingQuestion.id, false)}>Lieber allein versuchen</Button>
          </aside>
        </div>
      </Card>
    </motion.section>}
{topicToDelete && createPortal(<div className="fixed inset-0 z-[120] grid place-items-center bg-foreground/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingTopic) setTopicToDelete(null) }}><section role="alertdialog" aria-modal="true" aria-labelledby="delete-topic-title" aria-describedby="delete-topic-description" className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><p className="eyebrow text-destructive">THEMA LÖSCHEN</p><h2 id="delete-topic-title" className="mt-1 text-lg font-semibold">„{topicToDelete.title}“ löschen?</h2><p id="delete-topic-description" className="mt-2 text-sm leading-6 text-muted-foreground">Das Thema mit seinen Lernmaterialien, Fragen und Fortschritten wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.</p><div className="mt-5 flex flex-wrap justify-end gap-2"><Button id="cancel-topic-delete" variant="outline" disabled={deletingTopic} onClick={() => setTopicToDelete(null)}>Abbrechen</Button><Button variant="destructive" disabled={deletingTopic} onClick={() => void confirmTopicDelete()}>{deletingTopic ? <LoadingInline label="Wird gelöscht…" /> : <span className="inline-flex items-center gap-2"><Trash2 className="size-4" aria-hidden="true" /> Thema löschen</span>}</Button></div></section></div>, document.body)}    {goalMenuOpen && createPortal(<div id="weekly-goal-menu" ref={goalMenuRef} className="fixed z-[100] w-52 rounded-xl border border-border bg-card p-2 text-foreground shadow-xl" style={{ top: goalMenuPosition?.top ?? 0, left: goalMenuPosition?.left ?? 0, visibility: goalMenuPosition ? 'visible' : 'hidden', maxHeight: 'min(240px, calc(100dvh - 24px))', overflowY: 'auto' }} role="menu" aria-label="Wochenziel auswählen"><p className="px-3 py-2 text-xs font-semibold text-muted-foreground">Wochenziel</p>{[60,120,180,240].map((minutes) => <Button key={minutes} variant={minutes === dashboard.weeklyGoalMinutes ? 'secondary' : 'ghost'} className="w-full justify-start px-3 py-2 text-sm" role="menuitem" disabled={goalSaving} onClick={async () => { setGoalSaving(true); const saved = await onSetWeeklyGoal(minutes); setGoalSaving(false); if (saved) setGoalMenuOpen(false) }}>{goalSaving ? <span className="inline-flex items-center gap-2"><span className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />Wird gespeichert</span> : `${minutes} Min.`}</Button>)}</div>, document.body)}
  </div>
}

function TopicPage(props: {
  topic: Topic; uploading: boolean; setupMode: boolean; planChatOpen: boolean; setupMessages: ChatMessage[]; setupError: string; selectedNode: string | null; selectedTopicNode: Topic['nodes'][number] | null; questions: LearningQuestion[]; questionFilters: { short: boolean; partner: boolean; stage: string }; search: string; context: Topic['context']; contextSaving: boolean; contextSaved: boolean; showAllQuestions: boolean; editingSource: string | null; sourceName: string; sourceBusyId: string;
  onBack: () => void; onUpload: (file: File) => void; onSelectNode: (id: string | null) => void; onFilter: (filters: { short: boolean; partner: boolean; stage: string }) => void; onSearch: (query: string) => void; onStartQuestion: (question: LearningQuestion) => void; onToggleAllQuestions: () => void; onTopicUpdated: (topic: Topic) => void; onTogglePlanChat: () => void; onSaveContext: (event: FormEvent<HTMLFormElement>) => Promise<boolean>; onContextChange: (context: Topic['context']) => void; onRenameStart: (id: string, name: string) => void; onSourceNameChange: (name: string) => void; onRenameSource: (id: string) => void; onCancelRename: () => void; onDeleteSource: (id: string) => void; onBackToDashboard: () => void; onRetry: () => void;
}) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const recommendedQuestion = props.topic.questions.find((question) => question.status === 'recommended' && props.topic.nodes.find((node) => node.id === question.topicId)?.eligible) ?? props.topic.questions.find((question) => props.topic.nodes.find((node) => node.id === question.topicId)?.eligible) ?? props.topic.questions[0]
  return <div className="space-y-4">
    <input ref={uploadRef} className="sr-only" type="file" accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx" aria-label="Upload another source" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onUpload(file); event.target.value = '' }} />
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" onClick={props.onBack}><span className="inline-flex items-center gap-2"><ArrowLeft className="size-4" aria-hidden="true" /> Back to my learning</span></Button><span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden="true" /> {formatExamCountdown(props.context.examDate)}</span></div>
    {props.setupMode ? <SetupPanel topic={props.topic} messages={props.setupMessages} error={props.setupError} onTopicUpdated={props.onTopicUpdated} onRetry={props.onRetry} /> : <>
      <section className="topic-banner grid gap-4 rounded-[1.5rem] border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"><div><p className="eyebrow">{props.topic.subject.toUpperCase()} · LEARNING SPACE</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{props.topic.title}</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{props.topic.description}</p></div><div className="flex flex-wrap items-center gap-4"><div className="min-w-[180px] flex-1 sm:flex-none sm:min-w-[190px]"><ProgressBar value={props.topic.progress} label="Topic progress" /></div><Button variant="primary" disabled={!recommendedQuestion} onClick={() => recommendedQuestion && props.onStartQuestion(recommendedQuestion)}><span className="inline-flex items-center gap-2">Start recommended <ArrowRight className="size-4" aria-hidden="true" /></span></Button></div></section>
      {props.setupError && <ErrorNotice message={props.setupError} onRetry={props.onRetry} />}
      <TopicSources topic={props.topic} uploading={props.uploading} onAdd={() => uploadRef.current?.click()} editingSource={props.editingSource} sourceName={props.sourceName} sourceBusyId={props.sourceBusyId} onRenameStart={props.onRenameStart} onSourceNameChange={props.onSourceNameChange} onRenameSource={props.onRenameSource} onCancelRename={props.onCancelRename} onDeleteSource={props.onDeleteSource} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)]">
        <TopicPlanPanel topic={props.topic} selectedTopicNode={props.selectedTopicNode} selectedNode={props.selectedNode} onSelectNode={props.onSelectNode} />
        <aside className="space-y-3 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto"><div className="xl:sticky xl:top-0 xl:z-10"><LearningContextCard context={props.context} saving={props.contextSaving} saved={props.contextSaved} onChange={props.onContextChange} onSave={props.onSaveContext} /></div><PlanConversation topicId={props.topic.id} open={props.planChatOpen} messages={props.setupMessages} onTopicUpdated={props.onTopicUpdated} onToggle={props.onTogglePlanChat} /></aside>
      </div>
      <TopicQuestionsPanel topic={props.topic} selectedTopicNode={props.selectedTopicNode} questions={props.questions} questionFilters={props.questionFilters} search={props.search} showAllQuestions={props.showAllQuestions} onFilter={props.onFilter} onSearch={props.onSearch} onStartQuestion={props.onStartQuestion} onToggleAllQuestions={props.onToggleAllQuestions} />
    </>}
  </div>
}

function TopicSources({ topic, uploading, onAdd, editingSource, sourceName, sourceBusyId, onRenameStart, onSourceNameChange, onRenameSource, onCancelRename, onDeleteSource }: {
  topic: Topic; uploading: boolean; onAdd: () => void; editingSource: string | null; sourceName: string; sourceBusyId: string;
  onRenameStart: (id: string, name: string) => void; onSourceNameChange: (name: string) => void; onRenameSource: (id: string) => void; onCancelRename: () => void; onDeleteSource: (id: string) => void;
}) {
  return <Card className="gap-0 rounded-2xl border border-border px-3 py-2.5 sm:px-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><FileText className="size-4 text-primary" aria-hidden="true" /><h2 className="text-sm font-semibold">Sources</h2><span className="text-xs text-muted-foreground">{topic.sources.length}</span></div><Button variant="outline" className="px-3 py-2 text-xs" disabled={uploading} onClick={onAdd}><span className="inline-flex items-center gap-1.5">{uploading ? <LoadingInline label="Adding source" /> : <><Upload className="size-3.5" aria-hidden="true" /> Add source</>}</span></Button></div>
    {topic.sources.length ? <ul className="mt-2 flex flex-wrap gap-2">{topic.sources.map((source) => <li key={source.id} className="source-chip flex max-w-full items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5">{editingSource === source.id ? <form className="flex min-w-0 flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); onRenameSource(source.id) }}><Input autoFocus value={sourceName} onChange={(event) => onSourceNameChange(event.target.value)} className="h-8 min-w-0 w-40 rounded-lg px-2 py-1.5 text-xs" aria-label="Source name" /><Button variant="primary" type="submit" size="sm" disabled={sourceBusyId === source.id}>{sourceBusyId === source.id ? <LoadingInline label="Saving" /> : 'Save'}</Button><Button variant="ghost" size="sm" onClick={onCancelRename}>Cancel</Button></form> : <><FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="max-w-[min(48vw,260px)] truncate text-xs font-medium" title={source.name}>{source.name}</span><span className="hidden text-[10px] text-muted-foreground sm:inline">{source.kind}</span><Button variant="ghost" size="icon-sm" aria-label={`Rename ${source.name}`} onClick={() => onRenameStart(source.id, source.name)}><Pencil className="size-3.5" aria-hidden="true" /></Button><Button variant="ghost" size="icon-sm" aria-label={`Delete ${source.name}`} disabled={sourceBusyId === source.id} onClick={() => onDeleteSource(source.id)}>{sourceBusyId === source.id ? <LoadingInline label="Removing" /> : <Trash2 className="size-3.5" aria-hidden="true" />}</Button></>}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">Add lecture notes to shape this plan.</p>}
  </Card>
}

function TopicPlanPanel({ topic, selectedTopicNode, selectedNode, onSelectNode }: {
  topic: Topic; selectedTopicNode: Topic['nodes'][number] | null; selectedNode: string | null; onSelectNode: (id: string | null) => void;
}) {
  return <Card className="panel min-w-0 gap-0 p-4 sm:p-5 xl:sticky xl:top-20 xl:self-start"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">YOUR LEARNING PATH</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Learning plan</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Arrows point from prerequisites to the topics they unlock. Select a node to focus questions.</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"><Sparkles className="size-3.5" aria-hidden="true" /> AI-shaped</span></div>
    <Suspense fallback={<div className="flow-shell flex h-[300px] items-center justify-center rounded-2xl border border-border bg-background"><LoadingInline label="Preparing the learning map…" /></div>}><LearningGraph topic={topic} selectedNode={selectedNode} onSelect={onSelectNode} /></Suspense>
    {selectedTopicNode && <div className="mt-3 rounded-xl bg-accent/40 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{selectedTopicNode.eligible ? 'Ready to practice' : 'Waiting for prerequisites'}</p><h3 className="mt-0.5 text-sm font-semibold">{selectedTopicNode.label}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedTopicNode.description}</p>{selectedTopicNode.prerequisites.length > 0 && <p className="mt-1 text-[10px] text-muted-foreground">Needs: {selectedTopicNode.prerequisites.map((id) => topic.nodes.find((node) => node.id === id)?.label ?? id).join(' · ')}</p>}</div><div className="w-full max-w-[220px]"><ProgressBar value={selectedTopicNode.progress} label="Subtopic progress" /></div></div><div className="mt-3 border-t border-primary/10 pt-2"><p className="mb-2 text-[10px] font-semibold">Bloom evidence · final three stages are parallel choices</p><div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">{bloomStages.map((stage) => <div key={stage} className="rounded-md bg-card/70 px-2 py-1.5"><div className="flex items-center justify-between gap-1 text-[9px]"><span className="font-medium">{stage}</span><span className="tabular-nums text-muted-foreground">{selectedTopicNode.evidence[stage]}%</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${selectedTopicNode.evidence[stage]}%` }} /></div></div>)}</div></div></div>}
  </Card>
}

function TopicQuestionsPanel({ topic, selectedTopicNode, questions, questionFilters, search, showAllQuestions, onFilter, onSearch, onStartQuestion, onToggleAllQuestions }: {
  topic: Topic; selectedTopicNode: Topic['nodes'][number] | null; questions: LearningQuestion[]; questionFilters: { short: boolean; partner: boolean; stage: string }; search: string; showAllQuestions: boolean;
  onFilter: (filters: { short: boolean; partner: boolean; stage: string }) => void; onSearch: (query: string) => void; onStartQuestion: (question: LearningQuestion) => void; onToggleAllQuestions: () => void;
}) {
  const groupedQuestions = bloomStages.map((stage) => ({ stage, items: questions.filter((question) => question.stage === stage) })).filter((group) => group.items.length > 0)
  return <section className="panel p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">PRACTICE LIBRARY</p><h2 className="mt-1 text-xl font-semibold">Questions to try</h2><p className="mt-1 text-xs text-muted-foreground">{selectedTopicNode ? `Focused on ${selectedTopicNode.label}` : 'Grouped by Bloom’s taxonomy'}</p></div><span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">{questions.length} available</span></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_auto_auto_200px] xl:items-center"><label className="sr-only" htmlFor="question-search">Search questions</label><Input id="question-search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Find a question…" className="h-11 w-full rounded-xl bg-background px-3 text-sm" /><label className="flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-xs"><Switch size="sm" checked={questionFilters.short} onCheckedChange={(checked) => onFilter({ ...questionFilters, short: checked })} aria-label="Filter short questions" /> Short (≤ 5 min)</label><label className="flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-xs"><Switch size="sm" checked={questionFilters.partner} onCheckedChange={(checked) => onFilter({ ...questionFilters, partner: checked })} aria-label="Filter partner questions" /> Partner</label><Suspense fallback={<div className="flex h-11 items-center rounded-xl border border-border px-3"><LoadingInline label="Loading stages" /></div>}><StageFilter value={questionFilters.stage} onChange={(stage) => onFilter({ ...questionFilters, stage })} /></Suspense></div>
    {groupedQuestions.length === 0 ? <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">No questions match those filters. Try another stage or clear a filter.</p> : <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{groupedQuestions.map(({ stage, items }) => <section key={stage} className="min-w-0"><p className="eyebrow mb-2">{stage.toUpperCase()} <span className="font-normal tracking-normal">· {items.length}</span></p><div className="space-y-2">{(showAllQuestions ? items : items.slice(0, 2)).map((question) => <QuestionCard key={question.id} question={question} locked={!topic.nodes.find((node) => node.id === question.topicId)?.eligible} onStart={onStartQuestion} />)}</div></section>)}</div>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">{questions.length > 2 && <Button variant="ghost" onClick={onToggleAllQuestions}><span className="inline-flex items-center gap-1.5">{showAllQuestions ? 'Show fewer' : 'Show all matching questions'} <ChevronDown className={`size-4 transition-transform ${showAllQuestions ? 'rotate-180' : ''}`} aria-hidden="true" /></span></Button>}<div className="rounded-xl border border-border/70 bg-muted/50 px-3 py-2"><div className="flex items-center gap-2 text-xs font-medium"><UsersRound className="size-3.5 text-primary" aria-hidden="true" /> Partner activities need another person</div><p className="mt-1 text-[10px] leading-4 text-muted-foreground">No partner available? Choose a solo question with the same objective.</p></div></div>
  </section>
}

function SetupPanel({ topic, messages, error, onTopicUpdated, onRetry }: { topic: Topic; messages: ChatMessage[]; error: string; onTopicUpdated: (topic: Topic) => void; onRetry: () => void }) {
  return <section className="setup-shell mx-auto grid max-w-5xl overflow-hidden rounded-[1.75rem] border border-border bg-card lg:grid-cols-[.8fr_1.2fr]">
    <div className="setup-aside bg-accent/55 p-6 sm:p-8"><Button variant="ghost" onClick={onRetry}><span className="inline-flex items-center gap-2"><ArrowLeft className="size-4" aria-hidden="true" /> Back to topic</span></Button><span className="mt-10 flex size-12 items-center justify-center rounded-2xl bg-card text-primary"><Upload className="size-5" aria-hidden="true" /></span><p className="eyebrow mt-6">FIRST-TIME SETUP</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Your material is in.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Now let’s focus on the parts that matter most to you. The plan and questions will adapt to your goal.</p><div className="mt-7 rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-muted text-primary"><FileText className="size-5" aria-hidden="true" /></span><div className="min-w-0"><p className="truncate text-sm font-medium">{topic.sources[0]?.name ?? 'Learning notes'}</p><p className="mt-1 text-xs text-muted-foreground">Added for this demo</p></div></div></div><ol className="mt-7 space-y-3 text-sm"><li className="flex items-center gap-3"><span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span> Add your focus</li><li className="flex items-center gap-3 text-muted-foreground"><span className="flex size-6 items-center justify-center rounded-full bg-card text-xs">2</span> Review your plan</li><li className="flex items-center gap-3 text-muted-foreground"><span className="flex size-6 items-center justify-center rounded-full bg-card text-xs">3</span> Start practicing</li></ol></div>
    <div className="flex min-h-[570px] flex-col p-5 sm:p-8"><p className="eyebrow">FIRST-TIME SETUP</p><h2 className="mt-1 text-xl font-semibold">What are you working toward?</h2><p className="mt-1 text-sm text-muted-foreground">A little context helps us shape useful questions.</p>{error && <div className="mt-3"><ErrorNotice message={error} /></div>}<div className="mt-5"><Suspense fallback={<LoadingCard title="Opening the learning partner" detail="Preparing the streaming conversation…" />}><AIChatPanel kind="scope" chatId={`scope-${topic.id}`} topicId={topic.id} initialMessages={messages} title="Learning partner" detail="Tell Lea’s coach what to focus on" onTopicUpdated={onTopicUpdated} /></Suspense></div><p className="mt-3 text-xs text-muted-foreground">The demo uses scripted streaming responses. Source contents are not extracted yet.</p></div>
  </section>
}

function PlanConversation({ topicId, open, messages, onTopicUpdated, onToggle }: { topicId: string; open: boolean; messages: ChatMessage[]; onTopicUpdated: (topic: Topic) => void; onToggle: () => void }) {
  return <div className="panel"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary"><MessageCircle className="size-5" aria-hidden="true" /></span><div><p className="eyebrow">AI LEARNING PARTNER</p><h2 className="mt-1 text-base font-semibold">Talk through your plan</h2></div></div><Button variant="outline" aria-expanded={open} onClick={onToggle}>{open ? 'Close chat' : 'Open chat'}</Button></div>{open && <div className="mt-4"><Suspense fallback={<LoadingInline label="Opening the learning partner…" />}><AIChatPanel kind="scope" compact chatId={`scope-${topicId}`} topicId={topicId} initialMessages={messages} title="Plan conversation" detail="Adjust the focus, pace, or learning facts" onTopicUpdated={onTopicUpdated} /></Suspense></div>}</div>
}

function LearningContextCard({ context, saving, saved, onChange, onSave }: { context: Topic['context']; saving: boolean; saved: boolean; onChange: (context: Topic['context']) => void; onSave: (event: FormEvent<HTMLFormElement>) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  return <Card className="panel context-card gap-0 p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">WHAT THE AGENT KNOWS</p><h2 className="mt-1 text-base font-semibold">Learning context</h2><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Facts guiding this plan and practice.</p></div><Button variant="ghost" className="px-3 py-2" aria-label={editing ? 'Close context editing' : 'Edit learning context'} onClick={() => setEditing((value) => !value)}>{editing ? <X className="size-4" aria-hidden="true" /> : <Pencil className="size-4" aria-hidden="true" />}</Button></div>
    {editing ? <form className="mt-3 grid gap-2.5 sm:grid-cols-2" onSubmit={async (event) => { if (await onSave(event)) setEditing(false) }}><label className="block text-[11px] font-medium">Exam date<Input type="date" value={context.examDate} onChange={(event) => onChange({ ...context, examDate: event.target.value })} className="mt-1 h-9 w-full rounded-xl px-3 text-xs" /></label><label className="block text-[11px] font-medium">Time available<Input value={context.timeAvailable} onChange={(event) => onChange({ ...context, timeAvailable: event.target.value })} className="mt-1 h-9 w-full rounded-xl px-3 text-xs" /></label><label className="block text-[11px] font-medium sm:col-span-2">Focus<Input value={context.focus} onChange={(event) => onChange({ ...context, focus: event.target.value })} className="mt-1 h-9 w-full rounded-xl px-3 text-xs" /></label><label className="block text-[11px] font-medium">Preferred question length<UISelect value={context.preferredLength} onValueChange={(value) => { if (value) onChange({ ...context, preferredLength: value as Topic['context']['preferredLength'] }) }}><SelectTrigger className="mt-1 h-9 w-full rounded-xl px-3 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Short">Short</SelectItem><SelectItem value="Balanced">Balanced</SelectItem><SelectItem value="Detailed">Detailed</SelectItem></SelectContent></UISelect></label><label className="flex items-center justify-between rounded-xl bg-muted/70 p-2.5 text-[11px]"><span><span className="block font-medium">AI tutor</span><span className="mt-0.5 block text-muted-foreground">Available in practice</span></span><Switch checked={context.tutorEnabled} onCheckedChange={(checked) => onChange({ ...context, tutorEnabled: checked })} aria-label="Enable AI tutor" /></label><div className="flex items-center gap-2 sm:col-span-2"><Button variant="primary" type="submit" size="sm" disabled={saving}>{saving ? <LoadingInline label="Saving" /> : 'Save context'}</Button><Button variant="ghost" size="sm" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>{saved && <SavedNotice>Saved to this browser</SavedNotice>}</div></form> : <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2"><FactRow icon={<CalendarDays className="size-4" />} label="Exam date" value={context.examDate || 'Not set'} /><FactRow icon={<Clock3 className="size-4" />} label="Time available" value={context.timeAvailable} /><FactRow icon={<Target className="size-4" />} label="Current focus" value={context.focus} /><FactRow icon={<MessageCircle className="size-4" />} label="Question style" value={`${context.preferredLength} · Tutor ${context.tutorEnabled ? 'on' : 'off'}`} /></div>}
  </Card>
}

function FactRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-start gap-3"><span className="mt-0.5 text-primary">{icon}</span><div className="min-w-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium leading-5">{value}</p></div></div>
}

function QuestionCard({ question, locked, onStart }: { question: LearningQuestion; locked: boolean; onStart: (question: LearningQuestion) => void }) {
  return <article className={`question-card rounded-xl border border-border p-3 transition-colors hover:border-primary/25 ${locked ? 'bg-muted/60' : 'bg-card'}`}><div className="flex items-start gap-3"><span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Lightbulb className="size-4" aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><p className="text-sm font-medium">{question.title}</p>{locked && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"><LockKeyhole className="size-3" aria-hidden="true" /> Waiting</span>}</div><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{question.prompt}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"><span className="rounded-full bg-muted px-2 py-1">{question.stage}</span><span>{question.duration}</span>{question.mode === 'Partner' && <span className="inline-flex items-center gap-1"><UsersRound className="size-3" aria-hidden="true" /> Partner</span>}</div></div></div>{!locked && <div className="mt-2 flex justify-end"><Button variant="ghost" onClick={() => onStart(question)}><span className="inline-flex items-center gap-1.5 text-xs">Start <ArrowRight className="size-3.5" aria-hidden="true" /></span></Button></div>}</article>
}

function QuestionPage(props: { topic: Topic; question: LearningQuestion; answer: string; hintsUsed: number; hintsOpen: boolean; tutorOpen: boolean; tutorEnabled: boolean; tutorMessages: ChatMessage[]; busy: boolean; error: string; answerRef: RefObject<HTMLTextAreaElement | null>; onBack: () => void; onAnswer: (answer: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onHint: () => void; onToggleHints: () => void; onToggleTutor: () => void; onTutorMessages: (messages: ChatMessage[]) => void }) {
  const relatedNode = props.topic.nodes.find((node) => node.id === props.question.topicId)
  const rationale = relatedNode
    ? `This question builds the subtopic “${relatedNode.label}”: ${relatedNode.description}`
    : `This question is part of your ${props.topic.title} learning plan.`
  const progressExplanation = 'Progress grows from answer quality and support used. Independent correct answers count most; hints and partial answers can still add some evidence. This is a prototype signal, not a grade.'
  const hints = [
    'Start by naming who will read the summary and what they need to do next.',
    'A project lead may need decisions, owners, and next steps more than a chronological retelling.',
    'Try a prompt that asks for a concise update for the project lead, lists decisions and owners, and flags anything missing from the notes.',
  ]
  return <div className={`space-y-6 ${props.tutorOpen ? '' : 'mx-auto max-w-4xl'}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" onClick={props.onBack}><span className="inline-flex items-center gap-2"><ArrowLeft className="size-4" aria-hidden="true" /> Back to topic</span></Button><span className="text-xs text-muted-foreground">{props.topic.title} <ChevronRight className="mx-1 inline size-3" aria-hidden="true" /> Practice</span></div>
    <div className={`grid items-start gap-5 ${props.tutorOpen ? 'lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)]' : ''}`}>
      <Card className="panel question-workspace min-w-0 gap-0"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{props.question.mode === 'Partner' ? 'PARTNER PRACTICE' : 'SOLO PRACTICE'} · {props.question.stage.toUpperCase()}</p><h1 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">{props.question.title}</h1></div><span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true" /> {props.question.duration}</span></div>
        <div className="mt-6 rounded-2xl bg-accent/40 p-5 sm:p-6"><div className="flex items-center gap-2"><p className="eyebrow text-primary">YOUR CHALLENGE</p><Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-xs" className="rounded-full" aria-label="Why this question"><Info className="size-3.5 text-muted-foreground" aria-hidden="true" /></Button>} /><TooltipContent>{rationale}</TooltipContent></Tooltip></div><p className="mt-3 text-base leading-8">{props.question.prompt}</p>{props.question.mode === 'Partner' && <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-xs leading-5 text-muted-foreground"><UsersRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> This activity works best with a colleague. Practicing solo is also okay: explain your choice aloud, then compare it with the feedback below.</div>}</div>
        <form className="mt-6" onSubmit={props.onSubmit}><label htmlFor="answer" className="text-sm font-semibold">Your answer</label><Textarea ref={props.answerRef} id="answer" value={props.answer} onChange={(event) => props.onAnswer(event.target.value)} rows={7} disabled={props.busy} required placeholder="Take a moment to think it through. There’s no need to get it perfect on the first try…" className="mt-2 min-h-40 resize-y rounded-2xl bg-background p-4 text-sm leading-7" /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">{props.answer.trim().split(/\s+/).filter(Boolean).length} words · Hints used: {props.hintsUsed}/3 <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-xs" className="rounded-full" aria-label="How progress is counted"><Info className="size-3.5" aria-hidden="true" /></Button>} /><TooltipContent className="max-w-xs">{progressExplanation}</TooltipContent></Tooltip></span><Button variant="primary" type="submit" disabled={props.busy || !props.answer.trim()}><span className="inline-flex items-center gap-2">{props.busy ? <><span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />Reviewing</> : <>Submit for feedback <ArrowRight className="size-4" aria-hidden="true" /></>}</span></Button></div></form>
        {props.error && <div className="mt-4"><ErrorNotice message={props.error} /></div>}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5"><Button variant="outline" onClick={props.onToggleHints}><span className="inline-flex items-center gap-2"><Lightbulb className="size-4" aria-hidden="true" /> {props.hintsOpen ? 'Hide hints' : 'Get a hint'} <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{props.hintsUsed}/3</span></span></Button>{props.tutorEnabled && <Button variant={props.tutorOpen ? 'secondary' : 'outline'} aria-expanded={props.tutorOpen} onClick={props.onToggleTutor}><span className="inline-flex items-center gap-2"><MessageCircle className="size-4" aria-hidden="true" /> {props.tutorOpen ? 'Close AI tutor' : 'Ask the AI tutor'}</span></Button>}</div>
        {props.hintsOpen && <div className="mt-4 space-y-2" aria-live="polite">{hints.slice(0, props.hintsUsed).map((hint, index) => <div key={hint} className="flex gap-3 rounded-xl bg-muted/65 p-3 text-sm leading-6"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold">{index + 1}</span>{hint}</div>)}<Button variant="ghost" disabled={props.hintsUsed >= 3} onClick={props.onHint}>{props.hintsUsed < 3 ? `Reveal hint ${props.hintsUsed + 1}` : 'All hints revealed'} <ArrowRight className="ml-1 size-4" aria-hidden="true" /></Button></div>}
      </Card>
      {props.tutorOpen && <aside className="min-w-0 lg:sticky lg:top-24"><TutorPanel questionId={props.question.id} initialMessages={props.tutorMessages} onMessagesChange={props.onTutorMessages} /></aside>}
    </div>
  </div>
}

function TutorPanel({ questionId, initialMessages, onMessagesChange, title = 'AI tutor', detail = 'Hints and questions, no answer spoilers' }: { questionId: string; initialMessages: ChatMessage[]; onMessagesChange: (messages: ChatMessage[]) => void; title?: string; detail?: string }) {
  return <Suspense fallback={<LoadingCard title="Opening the AI tutor" detail="Preparing the streamed chat…" />}><AIChatPanel kind="tutor" chatId={`tutor-${questionId}`} questionId={questionId} initialMessages={initialMessages} title={title} detail={detail} onMessagesChange={onMessagesChange} /></Suspense>
}

function ReviewPage({ topic, question, review, difficulty, ratingSaving, error, tutorOpen, tutorMessages, onToggleTutor, onTutorMessages, onDifficulty, onContinue, onTopic, onDashboard }: { topic: Topic; question: LearningQuestion; review: ReviewResult; difficulty: Difficulty | null; ratingSaving: boolean; error: string; tutorOpen: boolean; tutorMessages: ChatMessage[]; onToggleTutor: () => void; onTutorMessages: (messages: ChatMessage[]) => void; onDifficulty: (value: Difficulty) => void; onContinue: () => void; onTopic: () => void; onDashboard: () => void }) {
  const style = review.correctness === 'strong' ? 'review-good' : review.correctness === 'partial' ? 'review-partial' : 'review-try'
  const Icon = review.correctness === 'strong' ? CheckCircle2 : review.correctness === 'partial' ? Lightbulb : ArrowDownRight
  const node = topic.nodes.find((item) => item.id === question.topicId)
  const levels: { key: Difficulty; label: string }[] = [{ key: 'too-easy', label: 'Too easy' }, { key: 'about-right', label: 'About right' }, { key: 'too-hard', label: 'Too hard' }]
  return <div className="mx-auto max-w-4xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" onClick={onTopic}><span className="inline-flex items-center gap-2"><ArrowLeft className="size-4" aria-hidden="true" /> Back to learning plan</span></Button><span className="text-xs text-muted-foreground">SESSION REVIEW</span></div>
    <Card className="panel gap-0 overflow-hidden p-0"><div className={`review-banner ${style} p-6 sm:p-8`}><div className="flex items-start gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card/75"><Icon className="size-6" aria-hidden="true" /></span><div><p className="eyebrow">{question.stage.toUpperCase()} · SESSION FEEDBACK</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{review.headline}</h1><p className="mt-3 max-w-2xl text-sm leading-7">{review.feedback}</p></div></div></div>
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_.85fr]"><div><p className="eyebrow">EVIDENCE OF LEARNING</p><h2 className="mt-1 text-lg font-semibold">This attempt counts</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Progress reflects the quality of this answer and how much support you used. It is one signal to help choose a useful next activity.</p><div className="mt-5 rounded-2xl bg-muted/70 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{review.evidenceLabel}</span><span className="text-sm font-semibold tabular-nums">{review.evidenceDelta > 0 ? `+${review.evidenceDelta}` : '±0'} evidence</span></div><ProgressBar value={node?.progress ?? topic.progress} label={`${node?.label ?? 'Topic'} progress`} className="mt-4" /></div>
          <div className="mt-6"><p className="text-sm font-semibold">How did this question feel?</p><p className="mt-1 text-xs text-muted-foreground">Your rating helps tune the next step. No numeric target.</p><div className="mt-3 flex flex-wrap gap-2">{levels.map((level) => <Button key={level.key} variant={difficulty === level.key ? 'secondary' : 'outline'} disabled={ratingSaving} onClick={() => onDifficulty(level.key)}>{level.label}</Button>)}</div>{ratingSaving && <div className="mt-2"><LoadingInline label="Saving your rating…" /></div>}{difficulty && !ratingSaving && !error && <p className="mt-2 text-xs text-primary" role="status">Thanks — your rating is saved for this session.</p>}{error && <div className="mt-3"><ErrorNotice message={error} /></div>}</div>
        </div><aside className="rounded-2xl bg-accent/50 p-5"><p className="eyebrow text-primary">YOUR NEXT RECOMMENDATION</p><span className="mt-4 flex size-10 items-center justify-center rounded-xl bg-card text-primary"><ArrowUpRight className="size-5" aria-hidden="true" /></span><h2 className="mt-4 text-lg font-semibold">{review.nextActivity}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{review.nextReason}</p><div className="mt-5 rounded-xl bg-card/75 p-3 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">Why now: </span>{review.correctness === 'incorrect' ? 'A smaller step can clarify the part that is still uncertain.' : `Your work on “${node?.label ?? question.title}” makes this a useful next challenge.`}</div><div className="mt-5 space-y-2"><Button variant="primary" onClick={onContinue}><span className="inline-flex items-center gap-2">Try the next step <ArrowRight className="size-4" aria-hidden="true" /></span></Button><div><Button variant="ghost" onClick={onDashboard}>Return to dashboard</Button></div></div></aside></div>
    </Card>
    <SkillProgressPanel topic={topic} focusNodeId={question.topicId} />
    <Card className="panel gap-0"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Want to talk through the feedback?</p><p className="mt-1 text-xs text-muted-foreground">The tutor can help you understand the suggestion without writing the next answer for you.</p></div><Button variant={tutorOpen ? 'secondary' : 'outline'} onClick={onToggleTutor}><span className="inline-flex items-center gap-2"><MessageCircle className="size-4" aria-hidden="true" />{tutorOpen ? 'Close AI tutor' : 'Ask the AI tutor'}</span></Button></div>{tutorOpen && <div className="mt-4"><TutorPanel questionId={question.id} initialMessages={tutorMessages} onMessagesChange={onTutorMessages} title="AI feedback coach" detail="Explain the feedback and suggest how to improve" /></div>}</Card>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-4"><div><p className="text-sm font-medium">Keep this learning plan in view</p><p className="mt-1 text-xs text-muted-foreground">Review your sources, progress, and topic relationships.</p></div><Button variant="outline" onClick={onTopic}>Open topic plan</Button></div>
  </div>
}

export default App
