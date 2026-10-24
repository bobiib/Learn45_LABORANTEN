import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CheckCircle2,
  ChevronDown, ChevronRight, Clock3, Flame, GraduationCap, Lightbulb,
  Info, LogOut, MessageCircle, Plus, Settings2, Sparkles, Upload,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ErrorNotice, LoadingCard, LoadingInline } from '@/components/feedback'
import { TopicPage } from '@/components/topic-page'
import { getStoredTopic, isDemoMode, learningApi, saveStoredTopic } from '@/lib/api'
import { initialDashboard, initialTopic, refreshEligibility } from '@/lib/fixtures'
import { readLearnerContext, writeLearnerContext } from '@/lib/storage'
import type { AnswerSubmission, BloomStage, ChatMessage, DashboardData, LearningQuestion, ReviewResult, Topic } from '@/lib/types'

const AIChatPanel = lazy(() => import('@/components/ai-chat').then((module) => ({ default: module.AIChatPanel })))

type Page = 'dashboard' | 'topic' | 'question' | 'review'
type Difficulty = NonNullable<AnswerSubmission['difficulty']>

const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } },
  exit: { opacity: 0, y: -5, transition: { duration: 0.14, ease: 'easeIn' } },
}

const defaultSetupMessages: ChatMessage[] = [{ id: 'setup-welcome', role: 'assistant', text: 'Let’s shape a learning plan around your notes. What are you preparing for, and which parts would be most useful to focus on first?' }]

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
    setSelectedNode((current) => (current && next.nodes.some((n) => n.id === current) ? current : (next.nodes.find((n) => n.eligible)?.id ?? next.nodes[0]?.id ?? null)))
    setSetupDone(true)
    setSetupMode(false)
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
          if (!key?.startsWith('learn45.topic.') || key.startsWith('learn45.topic.ready.')) continue
          try {
            const stored = window.localStorage.getItem(key)
            if (stored) { const parsed = JSON.parse(stored); if (parsed && typeof parsed === 'object' && Array.isArray(parsed.nodes)) storedTopics.push(parsed as Topic); }
          } catch { /* Ignore an invalid local cache entry and keep loading the rest. */ }
        }
      }
      const combined = [...storedTopics, ...data.topics].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
      setDashboard({ ...data, topics: combined })
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

  const openTopic = useCallback(async (topicId: string, isNew = false) => {
    scrollToTop()
    setPage('topic')
    setTopicError('')
    setTopicLoading(true)
    setBusy(true)
    setSetupMode(isNew)
    setSetupDone(!isNew)
    setPlanChatOpen(false)
    setSetupMessages(defaultSetupMessages)
    setSelectedNode(null)
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

  function startQuestion(question: LearningQuestion) {
    setActiveQuestion(question)
    setAnswer('')
    setHintsUsed(0)
    setHintsOpen(false)
    setTutorOpen(false)
    setReviewTutorOpen(false)
    setTutorMessages([{ id: 'tutor-intro', role: 'assistant', text: 'I can help you think it through without giving away the answer. What part feels unclear?' }])
    setReview(null)
    setReviewError('')
    setDifficulty(null)
    setPage('question')
    scrollToTop()
  }

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!answer.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await learningApi.submitAnswer({ questionId: activeQuestion.id, answer, hintsUsed, tutorUsed: tutorMessages.some((message) => message.role === 'user'), difficulty: null })
      const updatedNodes = topic.nodes.map((node) => {
        if (node.id !== activeQuestion.topicId || result.evidenceDelta === 0) return node
        const stageCaps: Record<BloomStage, number> = { Remember: 25, Understand: 50, Apply: 75, Analyze: 100, Evaluate: 100, Create: 100 }
        const progress = Math.max(node.progress, Math.min(stageCaps[activeQuestion.stage], node.progress + result.evidenceDelta))
        return { ...node, progress, evidence: { ...node.evidence, [activeQuestion.stage]: Math.min(100, node.evidence[activeQuestion.stage] + result.evidenceDelta) } }
      })
      const updatedQuestions: LearningQuestion[] = topic.questions.map((q) => {
        if (q.id === activeQuestion.id && result.correctness !== 'incorrect') {
          return { ...q, status: 'completed' as const }
        }
        return q
      })
      const blockQuestions = updatedQuestions.filter((q) => q.topicId === activeQuestion.topicId)
      const currentIdx = blockQuestions.findIndex((q) => q.id === activeQuestion.id)
      const nextInBlock = currentIdx >= 0 ? blockQuestions[currentIdx + 1] : undefined
      const refreshedTopic = refreshEligibility({
        ...topic,
        nodes: updatedNodes,
        questions: updatedQuestions,
        progress: Math.max(topic.progress, Math.round(updatedNodes.reduce((sum, node) => sum + node.progress, 0) / updatedNodes.length)),
      })

      let nextQuestionId = result.nextQuestionId
      let nextActivity = result.nextActivity
      let nextReason = result.nextReason

      if (result.correctness === 'incorrect') {
        nextQuestionId = activeQuestion.id
      } else if (nextInBlock) {
        nextQuestionId = nextInBlock.id
        nextActivity = `Next in block (${currentIdx + 2}/${blockQuestions.length}): ${nextInBlock.title}`
        nextReason = `Continue question by question through this block to complete all ${blockQuestions.length} exercises.`
      } else {
        const nextBlockQuestion = refreshedTopic.questions.find(
          (q) => q.topicId !== activeQuestion.topicId && q.status !== 'completed' && refreshedTopic.nodes.find((n) => n.id === q.topicId)?.eligible,
        )
        if (nextBlockQuestion) {
          const nextNode = refreshedTopic.nodes.find((n) => n.id === nextBlockQuestion.topicId)
          nextQuestionId = nextBlockQuestion.id
          nextActivity = `Next block: ${nextNode?.label ?? nextBlockQuestion.title}`
          nextReason = `You finished all questions in this block! Move on to the next unlocked block.`
        }
      }

      setReview({ ...result, nextQuestionId, nextActivity, nextReason })
      updateTopic(refreshedTopic)
      setDashboard((current) => ({ ...current, lastSession: { topicId: topic.id, title: topic.title, detail: activeQuestion.title, progress: refreshedTopic.progress } }))
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
    <input ref={fileInputRef} className="sr-only" type="file" accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx" onChange={(event) => handleFileChange(event)} aria-label="Choose lecture notes to upload" />
    <AppHeader learnerName={dashboard.learnerName} />
    <main className="mx-auto min-h-[calc(100vh-88px)] w-full max-w-[1440px] px-4 pb-16 pt-3 sm:px-6 sm:pt-4 lg:px-10 lg:pt-5">
      {error && <div className="mb-6"><ErrorNotice message={error} onRetry={() => { setError(''); if (page === 'dashboard') void loadHome() }} /></div>}
      {appLoading ? <LoadingCard title="Opening Lea’s learning space" detail="Gathering topics and recent progress…" /> : <AnimatePresence mode="wait" initial={false}>
        <motion.div key={page} variants={pageVariants} initial="initial" animate="animate" exit="exit">
          {page === 'dashboard' && <>{uploadingSource && <div className="mb-5"><LoadingInline label="Preparing your learning material…" /></div>}<DashboardPage dashboard={dashboard} busy={busy} onOpenTopic={(id) => void openTopic(id)} onUpload={() => fileInputRef.current?.click()} onSetWeeklyGoal={async (minutes) => {
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
          {page === 'topic' && (topicLoading ? <LoadingCard title="Opening this learning space" detail="Loading notes, progress, and your plan…" /> : <TopicPage topic={topic} uploading={uploadingSource} setupMode={setupMode && !setupDone} planChatOpen={planChatOpen} setupMessages={setupMessages} setupError={topicError} selectedNode={selectedNode} selectedTopicNode={selectedTopicNode} questions={visibleQuestions} questionFilters={questionFilters} search={search} context={contextDraft} contextSaving={contextSaving} contextSaved={contextSaved} showAllQuestions={showAllQuestions} onBack={() => setPage('dashboard')} onUpload={(file) => void beginUpload(file, topic.id)} onSelectNode={setSelectedNode} onFilter={setQuestionFilters} onSearch={setSearch} onStartQuestion={startQuestion} onToggleAllQuestions={() => setShowAllQuestions((show) => !show)} onTopicUpdated={handleScopedTopic} onTogglePlanChat={() => setPlanChatOpen((open) => !open)} onSaveContext={saveContext} onContextChange={setContextDraft} onRenameStart={(id, name) => { setEditingSource(id); setSourceName(name) }} editingSource={editingSource} sourceName={sourceName} onSourceNameChange={setSourceName} onRenameSource={(id) => void renameSource(id)} onCancelRename={() => setEditingSource(null)} onDeleteSource={(id) => void deleteSource(id)} sourceBusyId={sourceBusyId} onBackToDashboard={() => setPage('dashboard')} onRetry={() => void openTopic(topic.id, setupMode)} />)}
          {page === 'question' && <QuestionPage topic={topic} question={activeQuestion} answer={answer} hintsUsed={hintsUsed} hintsOpen={hintsOpen} tutorOpen={tutorOpen && topic.context.tutorEnabled} tutorEnabled={topic.context.tutorEnabled} tutorMessages={tutorMessages} busy={busy} error={error} answerRef={answerRef} onBack={() => setPage('topic')} onAnswer={setAnswer} onSubmit={submitAnswer} onHint={addHint} onToggleHints={() => setHintsOpen((open) => !open)} onToggleTutor={() => setTutorOpen((open) => !open)} onTutorMessages={setTutorMessages} />}
          {page === 'review' && review && <ReviewPage topic={topic} question={activeQuestion} review={review} difficulty={difficulty} ratingSaving={ratingSaving} error={reviewError} tutorOpen={reviewTutorOpen} tutorMessages={tutorMessages} onToggleTutor={() => setReviewTutorOpen((open) => !open)} onTutorMessages={setTutorMessages} onDifficulty={(value) => void recordDifficulty(value)} onContinue={() => {
            const suggested = topic.questions.find((question) => question.id === review.nextQuestionId) ?? topic.questions.find((question) => question.id !== activeQuestion.id) ?? activeQuestion
            startQuestion(suggested)
          }} onTopic={() => setPage('topic')} onDashboard={() => setPage('dashboard')} />}
        </motion.div>
      </AnimatePresence>}
    </main>
    <footer className="mx-auto max-w-[1440px] px-4 pb-8 text-center text-xs tracking-wide text-muted-foreground sm:px-6 lg:px-10">CHALLENGE <span className="mx-2 text-border">→</span> ACTION <span className="mx-2 text-border">→</span> FEEDBACK <span className="mx-2 text-border">→</span> ADAPTATION <span className="mx-2 text-border">→</span> PROGRESS</footer>
  </div>
}

function AppHeader({ learnerName }: { learnerName: string }) {
  return <header className="app-header border-b border-border/80 bg-card/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <span className="brand-mark flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><GraduationCap className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0"><p className="brand-name truncate text-lg font-semibold tracking-tight">learn<span>45</span></p><p className="hidden text-[11px] text-muted-foreground sm:block">A little better, every session</p></div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" aria-label={`${learnerName} profile menu`} aria-haspopup="menu"><span className="inline-flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{learnerName.slice(0, 1)}</span><span className="hidden sm:inline">{learnerName}</span><ChevronDown className="size-4" aria-hidden="true" /></span></Button>} />
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel><span className="block text-sm font-semibold text-foreground">{learnerName}’s profile</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Single-learner demo</span></DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled><Settings2 aria-hidden="true" /> Settings <span className="ml-auto text-xs text-muted-foreground">Preview only</span></DropdownMenuItem>
          <DropdownMenuItem disabled><LogOut aria-hidden="true" /> Sign out <span className="ml-auto text-xs text-muted-foreground">Preview only</span></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
}

function SectionHeading({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>{detail && <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p>}</div>{action}
  </div>
}

function ProgressBar({ value, label, className = '' }: { value: number; label?: string; className?: string }) {
  return <Progress value={value} aria-label={label ?? 'Overall progress'} className={`progress-bar ${className}`}><div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">{label ?? 'Overall progress'}</span><span className="font-semibold tabular-nums">{value}%</span></div></Progress>
}

function DashboardPage({ dashboard, busy, onOpenTopic, onUpload, onContinue, onSetWeeklyGoal }: { dashboard: DashboardData; busy: boolean; onOpenTopic: (id: string) => void; onUpload: () => void; onContinue: () => void; onSetWeeklyGoal: (minutes: number) => Promise<boolean> }) {
  const [goalMenuOpen, setGoalMenuOpen] = useState(false)
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalMenuPosition, setGoalMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const goalAnchorRef = useRef<HTMLDivElement>(null)
  const goalMenuRef = useRef<HTMLDivElement>(null)
  const percent = Math.min(100, Math.round(dashboard.studyMinutes / dashboard.weeklyGoalMinutes * 100))
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
  return <div className="space-y-7">
    <section className="dashboard-hero relative overflow-hidden rounded-[1.75rem] bg-primary px-5 py-6 text-primary-foreground sm:px-8 sm:py-8">
      <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
      <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.72fr)] lg:items-center">
        <div className="max-w-2xl"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-primary-foreground/70"><Sparkles className="size-4" aria-hidden="true" /> Welcome back</p><h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">Good to see you, {dashboard.learnerName}.</h1><p className="mt-2 text-sm leading-6 text-primary-foreground/80">You’ve completed {dashboard.completedSessions} sessions and kept a {dashboard.streak}-day streak. A short practice today keeps your progress moving.</p>
        </div>
        <div className="hero-stat-card rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-4 backdrop-blur-sm sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><span className="flex items-center gap-1.5 text-xs text-primary-foreground/75"><Clock3 className="size-3.5" aria-hidden="true" /> This week</span><p className="mt-1 text-xl font-semibold">{dashboard.studyMinutes}<span className="ml-1 text-sm font-normal text-primary-foreground/75">of {dashboard.weeklyGoalMinutes} min</span></p></div><div className="text-right"><span className="flex items-center justify-end gap-1.5 text-xs text-primary-foreground/75"><Flame className="size-3.5" aria-hidden="true" /> Streak</span><p className="mt-1 text-xl font-semibold">{dashboard.streak}<span className="ml-1 text-sm font-normal text-primary-foreground/75">days</span></p></div></div>
          <div className="mt-4"><div className="mb-2 flex justify-between gap-2 text-xs text-primary-foreground/75"><span>Weekly learning goal</span><span>{percent}%</span></div><div className="h-2 rounded-full bg-primary-foreground/20" role="progressbar" aria-label="Weekly learning goal" aria-valuenow={Math.min(100,percent)} aria-valuemin={0} aria-valuemax={100}><motion.div className="h-2 rounded-full bg-primary-foreground" initial={false} animate={{ width: `${percent}%` }} transition={{ duration: .5 }} /></div></div>
          <div className="mt-3 flex items-center justify-between gap-2"><p className="text-xs text-primary-foreground/75">{Math.max(0, dashboard.weeklyGoalMinutes - dashboard.studyMinutes)} min left this week</p><div ref={goalAnchorRef}><Button variant="secondary" className="px-3 py-2 text-xs" aria-expanded={goalMenuOpen} aria-haspopup="menu" onClick={() => setGoalMenuOpen((open) => !open)}>Edit goal</Button></div></div>
        </div>
      </div>
    </section>

    <Card className="panel mx-auto flex w-full flex-col justify-between gap-0 sm:flex-row sm:items-center sm:gap-6 lg:w-fit lg:max-w-full"><div className="min-w-0"><p className="eyebrow">CONTINUE</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Pick up where you left off</h2><h3 className="mt-3 font-semibold">{dashboard.lastSession.title}</h3><p className="mt-1 text-sm text-muted-foreground">{dashboard.lastSession.detail} · {dashboard.lastSession.progress}% topic progress</p><ProgressBar value={dashboard.lastSession.progress} className="mt-4 max-w-lg" /></div><Button variant="primary" className="mt-5 shrink-0 sm:mt-0" disabled={busy} onClick={onContinue}><span className="inline-flex items-center gap-2">Continue session <ArrowRight className="size-4" aria-hidden="true" /></span></Button></Card>

    <section>
      <SectionHeading eyebrow="YOUR LIBRARY" title="Choose a topic" detail={`${dashboard.topics.length} ${dashboard.topics.length === 1 ? 'topic' : 'topics'} ready to continue`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{dashboard.topics.map((item, index) => <motion.article key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }} className="topic-card panel group flex min-h-56 flex-col justify-between transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg motion-reduce:transition-none">
          <div><div className="mb-5 flex items-start justify-between gap-2"><span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary"><BookOpen className="size-5" aria-hidden="true" /></span><span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{item.subject}</span></div><h3 className="text-lg font-semibold tracking-tight">{item.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.description}</p></div>
          <div className="mt-5"><ProgressBar value={item.progress} label={`${item.nodes.length} subtopics · ${item.sources.length} sources`} /><div className="mt-4 flex items-center justify-between"><span className="text-xs text-muted-foreground">{item.updatedLabel}</span><Button variant="ghost" onClick={() => onOpenTopic(item.id)}><span className="inline-flex items-center gap-1.5">Open topic <ArrowRight className="size-4" aria-hidden="true" /></span></Button></div></div>
        </motion.article>)}
        <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: dashboard.topics.length * .05 }} className="add-topic-card flex min-h-56 flex-col justify-between rounded-[1.5rem] border border-dashed border-border bg-card p-5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg motion-reduce:transition-none sm:p-6"><div><div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-muted text-primary"><Plus className="size-5" aria-hidden="true" /></div><p className="eyebrow">GROW YOUR LIBRARY</p><h3 className="mt-1 text-lg font-semibold tracking-tight">Start a new topic</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Add lecture notes to create a focused learning space and plan.</p></div><div className="mt-5"><Button variant="outline" disabled={busy} onClick={onUpload}><span className="inline-flex items-center gap-2"><Upload className="size-4" aria-hidden="true" /> Choose notes</span></Button></div></motion.article>
      </div>
    </section>
    {goalMenuOpen && createPortal(<div id="weekly-goal-menu" ref={goalMenuRef} className="fixed z-[100] w-52 rounded-xl border border-border bg-card p-2 text-foreground shadow-xl" style={{ top: goalMenuPosition?.top ?? 0, left: goalMenuPosition?.left ?? 0, visibility: goalMenuPosition ? 'visible' : 'hidden', maxHeight: 'min(240px, calc(100dvh - 24px))', overflowY: 'auto' }} role="menu" aria-label="Choose a weekly goal"><p className="px-3 py-2 text-xs font-semibold text-muted-foreground">Weekly goal</p>{[60,120,180,240].map((minutes) => <Button key={minutes} variant={minutes === dashboard.weeklyGoalMinutes ? 'secondary' : 'ghost'} className="w-full justify-start px-3 py-2 text-sm" role="menuitem" disabled={goalSaving} onClick={async () => { setGoalSaving(true); const saved = await onSetWeeklyGoal(minutes); setGoalSaving(false); if (saved) setGoalMenuOpen(false) }}>{goalSaving ? <span className="inline-flex items-center gap-2"><span className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />Saving</span> : `${minutes} minutes`}</Button>)}</div>, document.body)}
  </div>
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
        <form className="mt-6" onSubmit={props.onSubmit}><label htmlFor="answer" className="text-sm font-semibold">Your answer</label><Textarea ref={props.answerRef} id="answer" value={props.answer} onChange={(event) => props.onAnswer(event.target.value)} rows={7} disabled={props.busy} required placeholder="Take a moment to think it through. There’s no need to get it perfect on the first try…" className="mt-2 min-h-40 resize-y rounded-2xl bg-background p-4 text-sm leading-7" /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">{props.answer.trim().split(/\s+/).filter(Boolean).length} words · Hints used: {props.hintsUsed}/3 <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-xs" className="rounded-full" aria-label="Why progress is counted"><Info className="size-3.5" aria-hidden="true" /></Button>} /><TooltipContent className="max-w-xs">{progressExplanation}</TooltipContent></Tooltip></span><Button variant="primary" type="submit" disabled={props.busy || !props.answer.trim()}><span className="inline-flex items-center gap-2">{props.busy ? <><span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />Reviewing</> : <>Submit for feedback <ArrowRight className="size-4" aria-hidden="true" /></>}</span></Button></div></form>
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
    <Card className="panel gap-0"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Want to talk through the feedback?</p><p className="mt-1 text-xs text-muted-foreground">The tutor can help you understand the suggestion without writing the next answer for you.</p></div><Button variant={tutorOpen ? 'secondary' : 'outline'} onClick={onToggleTutor}><span className="inline-flex items-center gap-2"><MessageCircle className="size-4" aria-hidden="true" />{tutorOpen ? 'Close AI tutor' : 'Ask the AI tutor'}</span></Button></div>{tutorOpen && <div className="mt-4"><TutorPanel questionId={question.id} initialMessages={tutorMessages} onMessagesChange={onTutorMessages} title="AI feedback coach" detail="Explain the feedback and suggest how to improve" /></div>}</Card>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-4"><div><p className="text-sm font-medium">Keep this learning plan in view</p><p className="mt-1 text-xs text-muted-foreground">Review your sources, progress, and topic relationships.</p></div><Button variant="outline" onClick={onTopic}>Open topic plan</Button></div>
  </div>
}

export default App
