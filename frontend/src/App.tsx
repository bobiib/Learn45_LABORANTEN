import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import {
  ArrowRight, BookOpen, CheckCircle2,
  ChevronDown, Clock3, Flame, GraduationCap,
  LogOut, Plus, Settings2, Sparkles, Target, Trash2, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ErrorNotice, LoadingCard, LoadingInline } from '@/components/feedback'
import { TopicPage as RedesignedTopicPage } from '@/components/topic-page'
import { getDeletedTopicIds, getStoredTopic, isDemoMode, learningApi, saveStoredTopic } from '@/lib/api'
import { initialDashboard, initialTopic, refreshEligibility } from '@/lib/fixtures'
import { readLearnerContext, writeLearnerContext } from '@/lib/storage'
import type { ChatMessage, DashboardData, LearningQuestion, Topic } from '@/lib/types'

const LearningSession = lazy(() => import('@/components/learning-session').then((module) => ({ default: module.LearningSession })))

type Page = 'dashboard' | 'topic' | 'question'
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
  const [recommendedQuestionId, setRecommendedQuestionId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [startWithCoach, setStartWithCoach] = useState(false)
  const [activeQuestion, setActiveQuestion] = useState<LearningQuestion>(initialTopic.questions[0])
  const [busy, setBusy] = useState(false)
  const [recommendationBusy, setRecommendationBusy] = useState(false)
  const [generatingQuestionNodeId, setGeneratingQuestionNodeId] = useState<string | null>(null)
  const [topicLoading, setTopicLoading] = useState(false)
  const [uploadingSource, setUploadingSource] = useState(false)
  const [appLoading, setAppLoading] = useState(true)
  const [error, setError] = useState('')
  const [topicError, setTopicError] = useState('')
  const [setupMode, setSetupMode] = useState(false)
  const [setupDone, setSetupDone] = useState(false)
  const [planChatOpen, setPlanChatOpen] = useState(false)
  const [setupMessages, setSetupMessages] = useState<ChatMessage[]>(defaultSetupMessages)
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
          if (!key?.startsWith('learn45.topic.') || key.startsWith('learn45.topic.ready.') || key === 'learn45.deleted-topics.v1') continue
          try {
            const stored = window.localStorage.getItem(key)
            if (stored) {
              const parsed = JSON.parse(stored) as unknown
              if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Topic).nodes)) {
                storedTopics.push(parsed as Topic)
              }
            }
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
    setRecommendedQuestionId(null)
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
    setStartWithCoach(withTutor)
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

  async function getNextRecommendedQuestion() {
    setRecommendationBusy(true)
    setTopicError('')
    try {
      const recommendation = await learningApi.recommendQuestion(topic.id)
      if (!recommendation.question) {
        setTopicError(recommendation.reason)
        return
      }
      setRecommendedQuestionId(recommendation.question.id)
      const nextTopic = topic.questions.some((question) => question.id === recommendation.question?.id)
        ? topic
        : { ...topic, questions: [...topic.questions, recommendation.question] }
      updateTopic(nextTopic)
      startQuestion(recommendation.question)
    } catch (cause) {
      setTopicError(cause instanceof Error ? cause.message : 'Die nächste passende Übung konnte nicht gefunden werden.')
    } finally {
      setRecommendationBusy(false)
    }
  }

  async function generateQuestionForNode(nodeId: string) {
    setGeneratingQuestionNodeId(nodeId)
    setTopicError('')
    try {
      updateTopic(await learningApi.generateNodeQuestion(topic.id, nodeId))
    } catch (cause) {
      setTopicError(cause instanceof Error ? cause.message : 'Für diesen Lernschritt konnte keine Frage erstellt werden.')
    } finally {
      setGeneratingQuestionNodeId(null)
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
          {page === 'topic' && (topicLoading ? <LoadingCard title="Themenbereich wird geöffnet" detail="Lernmaterial, Fortschritt und Lernpfad werden geladen…" /> : <RedesignedTopicPage topic={topic} recommendedQuestionId={recommendedQuestionId} uploading={uploadingSource} recommendationBusy={recommendationBusy} generatingQuestionNodeId={generatingQuestionNodeId} onGenerateQuestion={(nodeId) => void generateQuestionForNode(nodeId)} onRecommend={() => void getNextRecommendedQuestion()} setupMode={setupMode && !setupDone} planChatOpen={planChatOpen} setupMessages={setupMessages} setupError={topicError} selectedNode={selectedNode} selectedTopicNode={selectedTopicNode} questions={visibleQuestions} questionFilters={questionFilters} search={search} context={contextDraft} contextSaving={contextSaving} contextSaved={contextSaved} showAllQuestions={showAllQuestions} onBack={() => setPage('dashboard')} onUpload={(file) => void beginUpload(file, topic.id)} onSelectNode={setSelectedNode} onFilter={setQuestionFilters} onSearch={setSearch} onStartQuestion={startQuestion} onToggleAllQuestions={() => setShowAllQuestions((show) => !show)} onTopicUpdated={handleScopedTopic} onTogglePlanChat={() => setPlanChatOpen((open) => !open)} onSaveContext={saveContext} onContextChange={setContextDraft} onRenameStart={(id, name) => { setEditingSource(id); setSourceName(name) }} editingSource={editingSource} sourceName={sourceName} onSourceNameChange={setSourceName} onRenameSource={(id) => void renameSource(id)} onCancelRename={() => setEditingSource(null)} onDeleteSource={(id) => void deleteSource(id)} sourceBusyId={sourceBusyId} onBackToDashboard={() => setPage('dashboard')} onRetry={() => void openTopic(topic.id, setupMode)} />)}
          {page === 'question' && <Suspense fallback={<LoadingCard title="Deine Übung wird geöffnet" detail="Der Lernbereich wird vorbereitet …" />}><LearningSession key={`${topic.id}-${activeQuestion.id}`} topic={topic} question={activeQuestion} startWithCoach={startWithCoach} onBack={() => setPage('topic')} onHome={() => setPage('dashboard')} onProgress={(next) => { updateTopic(next); setDashboard((current) => ({ ...current, lastSession: { topicId: next.id, title: next.title, detail: activeQuestion.title, progress: next.progress } })) }} /></Suspense>}
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


function SkillProgressPanel({ topic, focusNodeId, compact = false }: { topic: Topic; focusNodeId?: string; compact?: boolean }) {
  const reduceMotion = useReducedMotion()
  const skills = learnerSkills.flatMap((skill) => {
    const node = topic?.nodes?.find((item) => item.id === skill.nodeId)
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
  const hasTopics = Array.isArray(dashboard.topics) && dashboard.topics.length > 0
  const suggestionTopic = dashboard.topics?.find((item) => item?.id === dashboard.lastSession?.topicId) ?? dashboard.topics?.[0]
  const suggestionNode = suggestionTopic?.nodes?.filter((node) => node.eligible && node.progress < 100).sort((left, right) => left.progress - right.progress)[0] ?? suggestionTopic?.nodes?.[0]
  const eligibleQuestions = suggestionTopic?.questions ? suggestionTopic.questions.filter((question) => suggestionTopic.nodes?.some((node) => node.id === question.topicId && node.eligible)) : []
  const suggestionQuestion = eligibleQuestions.find((question) => question.topicId === suggestionNode?.id && question.status !== 'completed') ?? eligibleQuestions[0] ?? suggestionTopic?.questions?.[0]
  const coachingQuestion = suggestionTopic?.questions?.find((question) => question.id === 'q-criteria') ?? suggestionQuestion
  const independentQuestion = suggestionTopic?.questions?.find((question) => question.id === 'q-revise') ?? suggestionQuestion
  const practicedSteps = suggestionTopic?.nodes?.filter((node) => node.progress > 0).length ?? 0
  const totalSteps = suggestionTopic?.nodes?.length ?? 0
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


export default App
