import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, BookOpen, CalendarDays,
  ChevronDown, Clock3, FileText, Flame, GraduationCap, Lightbulb, LockKeyhole,
  LogOut, MessageCircle, Pencil, Plus, Settings2, Sparkles, Target, Trash2, Upload,
  UsersRound, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select as UISelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ErrorNotice, LoadingCard, LoadingInline, SavedNotice } from '@/components/feedback'
import { AIChatPanel } from '@/components/ai-chat'
import { LearningSession } from '@/components/learning-session'
import { getStoredTopic, isDemoMode, learningApi, saveStoredTopic } from '@/lib/api'
import { bloomStages, initialDashboard, initialTopic, refreshEligibility } from '@/lib/fixtures'
import { readLearnerContext, writeLearnerContext } from '@/lib/storage'
import type { ChatMessage, DashboardData, LearningQuestion, Topic } from '@/lib/types'

const LearningGraph = lazy(() => import('@/components/learning-graph'))
const StageFilter = lazy(() => import('@/components/stage-filter'))

type Page = 'dashboard' | 'topic' | 'question'

const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } },
  exit: { opacity: 0, y: -5, transition: { duration: 0.14, ease: 'easeIn' } },
}

const defaultSetupMessages: ChatMessage[] = [{ id: 'setup-welcome', role: 'assistant', text: 'Lass uns aus deinen Notizen einen Lernpfad machen. Worauf bereitest du dich vor, und welche Teile sollen zuerst im Mittelpunkt stehen?' }]

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [dashboard, setDashboard] = useState<DashboardData>(initialDashboard)
  const [topic, setTopic] = useState<Topic>(initialTopic)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [activeQuestion, setActiveQuestion] = useState<LearningQuestion>(initialTopic.questions[0])
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
          if (!key?.startsWith('learn45.topic.')) continue
          try {
            const stored = window.localStorage.getItem(key)
            if (stored) {
              const parsed = JSON.parse(stored) as Partial<Topic> | null
              if (parsed && typeof parsed.id === 'string' && Array.isArray(parsed.nodes) && Array.isArray(parsed.questions)) storedTopics.push(parsed as Topic)
            }
          } catch { /* Ignore an invalid local cache entry and keep loading the rest. */ }
        }
      }
      const combined = [...storedTopics, ...data.topics].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
      setDashboard({ ...data, topics: combined })
      const primary = combined[0] ?? initialTopic
      setTopic(primary)
      setContextDraft(isDemoMode ? readLearnerContext(primary.context) : primary.context)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Leas Lernübersicht konnte nicht geladen werden.')
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
      else setTopicError(cause instanceof Error ? cause.message : 'Dieses Thema konnte nicht geladen werden.')
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
      setError(cause instanceof Error ? cause.message : 'Diese Datei konnte nicht hinzugefügt werden.')
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
      setTopicError(cause instanceof Error ? cause.message : 'Dein Lernkontext konnte nicht gespeichert werden.')
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
      setTopicError(cause instanceof Error ? cause.message : 'Diese Quelle konnte nicht umbenannt werden.')
    } finally {
      setSourceBusyId('')
    }
  }

  async function deleteSource(sourceId: string) {
    setSourceBusyId(sourceId)
    try {
      updateTopic(await learningApi.deleteSource(topic.id, sourceId))
    } catch (cause) {
      setTopicError(cause instanceof Error ? cause.message : 'Diese Quelle konnte nicht entfernt werden.')
    } finally {
      setSourceBusyId('')
    }
  }

  function startQuestion(question: LearningQuestion) {
    setActiveQuestion(question)
    setPage('question')
    scrollToTop()
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
    <input ref={fileInputRef} className="sr-only" type="file" accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx" onChange={(event) => handleFileChange(event)} aria-label="Lernmaterial zum Hochladen wählen" />
    <AppHeader learnerName={dashboard.learnerName} />
    <main className="mx-auto min-h-[calc(100vh-88px)] w-full max-w-[1440px] px-4 pb-16 pt-3 sm:px-6 sm:pt-4 lg:px-10 lg:pt-5">
      {error && <div className="mb-6"><ErrorNotice message={error} onRetry={() => { setError(''); if (page === 'dashboard') void loadHome() }} /></div>}
      {appLoading ? <LoadingCard title="Leas Lernraum wird geöffnet" detail="Themen und jüngster Fortschritt werden geladen …" /> : <AnimatePresence mode="wait" initial={false}>
        <motion.div key={page} variants={pageVariants} initial="initial" animate="animate" exit="exit">
          {page === 'dashboard' && <>{uploadingSource && <div className="mb-5"><LoadingInline label="Lernmaterial wird vorbereitet …" /></div>}<DashboardPage dashboard={dashboard} busy={busy} onOpenTopic={(id) => void openTopic(id)} onUpload={() => fileInputRef.current?.click()} onSetWeeklyGoal={async (minutes) => {
            try {
              const weeklyGoalMinutes = await learningApi.updateWeeklyGoal(minutes)
              setDashboard((current) => ({ ...current, weeklyGoalMinutes }))
              return true
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Dein wöchentliches Lernziel konnte nicht aktualisiert werden.')
              return false
            }
          }} onContinue={() => {
            const nextTopic = dashboard.topics.find((item) => item.id === dashboard.lastSession.topicId) ?? topic
            setTopic(nextTopic)
            const nextQuestion = nextTopic.questions.find((question) => question.title === dashboard.lastSession.detail) ?? nextTopic.questions.find((question) => question.topicId === 'prompt-criteria') ?? nextTopic.questions[0]
            startQuestion(nextQuestion)
          }} /></>}
          {page === 'topic' && (topicLoading ? <LoadingCard title="Lernraum wird geöffnet" detail="Notizen, Fortschritt und Lernpfad werden geladen …" /> : <TopicPage topic={topic} uploading={uploadingSource} setupMode={setupMode && !setupDone} planChatOpen={planChatOpen} setupMessages={setupMessages} setupError={topicError} selectedNode={selectedNode} selectedTopicNode={selectedTopicNode} questions={visibleQuestions} questionFilters={questionFilters} search={search} context={contextDraft} contextSaving={contextSaving} contextSaved={contextSaved} showAllQuestions={showAllQuestions} onBack={() => setPage('dashboard')} onUpload={(file) => void beginUpload(file, topic.id)} onSelectNode={setSelectedNode} onFilter={setQuestionFilters} onSearch={setSearch} onStartQuestion={startQuestion} onToggleAllQuestions={() => setShowAllQuestions((show) => !show)} onTopicUpdated={handleScopedTopic} onTogglePlanChat={() => setPlanChatOpen((open) => !open)} onSaveContext={saveContext} onContextChange={setContextDraft} onRenameStart={(id, name) => { setEditingSource(id); setSourceName(name) }} editingSource={editingSource} sourceName={sourceName} onSourceNameChange={setSourceName} onRenameSource={(id) => void renameSource(id)} onCancelRename={() => setEditingSource(null)} onDeleteSource={(id) => void deleteSource(id)} sourceBusyId={sourceBusyId} onBackToDashboard={() => setPage('dashboard')} onRetry={() => void openTopic(topic.id, setupMode)} />)}
          {page === 'question' && <LearningSession key={`${topic.id}-${activeQuestion.id}`} topic={topic} question={activeQuestion} onBack={() => setPage('topic')} onHome={() => setPage('dashboard')} onProgress={(next) => { updateTopic(next); setDashboard((current) => ({ ...current, lastSession: { topicId: next.id, title: next.title, detail: activeQuestion.title, progress: next.progress } })) }} />}
        </motion.div>
      </AnimatePresence>}
    </main>
    <footer className="mx-auto max-w-[1440px] px-4 pb-8 text-center text-xs tracking-wide text-muted-foreground sm:px-6 lg:px-10">AUFGABE <span className="mx-2 text-border">→</span> VERSUCH <span className="mx-2 text-border">→</span> RÜCKMELDUNG <span className="mx-2 text-border">→</span> ANPASSUNG <span className="mx-2 text-border">→</span> FORTSCHRITT</footer>
  </div>
}

function AppHeader({ learnerName }: { learnerName: string }) {
  return <header className="app-header border-b border-border/80 bg-card/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <span className="brand-mark flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><GraduationCap className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0"><p className="brand-name truncate text-lg font-semibold tracking-tight">learn<span>45</span></p><p className="hidden text-[11px] text-muted-foreground sm:block">Mit jeder Übung ein Stück weiter</p></div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" aria-label={`${learnerName}s Profilmenü`} aria-haspopup="menu"><span className="inline-flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{learnerName.slice(0, 1)}</span><span className="hidden sm:inline">{learnerName}</span><ChevronDown className="size-4" aria-hidden="true" /></span></Button>} />
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel><span className="block text-sm font-semibold text-foreground">{learnerName}s Profil</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Demo für eine lernende Person</span></DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled><Settings2 aria-hidden="true" /> Einstellungen <span className="ml-auto text-xs text-muted-foreground">Nur Vorschau</span></DropdownMenuItem>
          <DropdownMenuItem disabled><LogOut aria-hidden="true" /> Abmelden <span className="ml-auto text-xs text-muted-foreground">Nur Vorschau</span></DropdownMenuItem>
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
  return <Progress value={value} aria-label={label ?? 'Gesamtfortschritt'} className={`progress-bar ${className}`}><div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">{label ?? 'Gesamtfortschritt'}</span><span className="font-semibold tabular-nums">{value}%</span></div></Progress>
}

function formatExamCountdown(date: string) {
  if (!date) return 'Prüfungsdatum nicht festgelegt'
  const target = new Date(`${date}T00:00:00`).getTime()
  if (!Number.isFinite(target)) return 'Prüfungsdatum nicht festgelegt'
  const remaining = Math.ceil((target - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  return remaining > 0 ? `Prüfung in ${remaining} Tagen` : remaining === 0 ? 'Prüfung heute' : 'Prüfungsdatum vorbei'
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
        <div className="max-w-2xl"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-primary-foreground/70"><Sparkles className="size-4" aria-hidden="true" /> Willkommen zurück</p><h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">Schön, dass du da bist, {dashboard.learnerName}.</h1><p className="mt-2 text-sm leading-6 text-primary-foreground/80">Du hast {dashboard.completedSessions} Lerneinheiten abgeschlossen und bist seit {dashboard.streak} Tagen dran. Eine kurze Übung heute bringt dich weiter.</p>
        </div>
        <div className="hero-stat-card rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-4 backdrop-blur-sm sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><span className="flex items-center gap-1.5 text-xs text-primary-foreground/75"><Clock3 className="size-3.5" aria-hidden="true" /> Diese Woche</span><p className="mt-1 text-xl font-semibold">{dashboard.studyMinutes}<span className="ml-1 text-sm font-normal text-primary-foreground/75">von {dashboard.weeklyGoalMinutes} Min.</span></p></div><div className="text-right"><span className="flex items-center justify-end gap-1.5 text-xs text-primary-foreground/75"><Flame className="size-3.5" aria-hidden="true" /> Serie</span><p className="mt-1 text-xl font-semibold">{dashboard.streak}<span className="ml-1 text-sm font-normal text-primary-foreground/75">Tage</span></p></div></div>
          <div className="mt-4"><div className="mb-2 flex justify-between gap-2 text-xs text-primary-foreground/75"><span>Wöchentliches Lernziel</span><span>{percent}%</span></div><div className="h-2 rounded-full bg-primary-foreground/20" role="progressbar" aria-label="Wöchentliches Lernziel" aria-valuenow={Math.min(100,percent)} aria-valuemin={0} aria-valuemax={100}><motion.div className="h-2 rounded-full bg-primary-foreground" initial={false} animate={{ width: `${percent}%` }} transition={{ duration: .5 }} /></div></div>
          <div className="mt-3 flex items-center justify-between gap-2"><p className="text-xs text-primary-foreground/75">{Math.max(0, dashboard.weeklyGoalMinutes - dashboard.studyMinutes)} Min. verbleiben diese Woche</p><div ref={goalAnchorRef}><Button variant="secondary" className="px-3 py-2 text-xs" aria-expanded={goalMenuOpen} aria-haspopup="menu" onClick={() => setGoalMenuOpen((open) => !open)}>Ziel bearbeiten</Button></div></div>
        </div>
      </div>
    </section>

    <Card className="panel mx-auto flex w-full flex-col justify-between gap-0 sm:flex-row sm:items-center sm:gap-6 lg:w-fit lg:max-w-full"><div className="min-w-0"><p className="eyebrow">WEITERLERNEN</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Dort weitermachen, wo du aufgehört hast</h2><h3 className="mt-3 font-semibold">{dashboard.lastSession.title}</h3><p className="mt-1 text-sm text-muted-foreground">{dashboard.lastSession.detail} · {dashboard.lastSession.progress}% Themenfortschritt</p><ProgressBar value={dashboard.lastSession.progress} className="mt-4 max-w-lg" /></div><Button variant="primary" className="mt-5 shrink-0 sm:mt-0" disabled={busy} onClick={onContinue}><span className="inline-flex items-center gap-2">Einheit fortsetzen <ArrowRight className="size-4" aria-hidden="true" /></span></Button></Card>

    <section>
      <SectionHeading eyebrow="DEINE THEMEN" title="Wähle ein Thema" detail={`${dashboard.topics.length} ${dashboard.topics.length === 1 ? 'Thema' : 'Themen'} zum Fortsetzen bereit`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{dashboard.topics.map((item, index) => <motion.article key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }} className="topic-card panel group flex min-h-56 flex-col justify-between transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg motion-reduce:transition-none">
          <div><div className="mb-5 flex items-start justify-between gap-2"><span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary"><BookOpen className="size-5" aria-hidden="true" /></span><span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{item.subject}</span></div><h3 className="text-lg font-semibold tracking-tight">{item.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.description}</p></div>
          <div className="mt-5"><ProgressBar value={item.progress} label={`${item.nodes.length} Teilthemen · ${item.sources.length} Quellen`} /><div className="mt-4 flex items-center justify-between"><span className="text-xs text-muted-foreground">{item.updatedLabel}</span><Button variant="ghost" onClick={() => onOpenTopic(item.id)}><span className="inline-flex items-center gap-1.5">Thema öffnen <ArrowRight className="size-4" aria-hidden="true" /></span></Button></div></div>
        </motion.article>)}
        <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: dashboard.topics.length * .05 }} className="add-topic-card flex min-h-56 flex-col justify-between rounded-[1.5rem] border border-dashed border-border bg-card p-5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg motion-reduce:transition-none sm:p-6"><div><div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-muted text-primary"><Plus className="size-5" aria-hidden="true" /></div><p className="eyebrow">THEMEN ERWEITERN</p><h3 className="mt-1 text-lg font-semibold tracking-tight">Neues Thema starten</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Füge Lernmaterial hinzu, um einen fokussierten Lernraum und Plan zu erstellen.</p></div><div className="mt-5"><Button variant="outline" disabled={busy} onClick={onUpload}><span className="inline-flex items-center gap-2"><Upload className="size-4" aria-hidden="true" /> Material wählen</span></Button></div></motion.article>
      </div>
    </section>
    {goalMenuOpen && createPortal(<div id="weekly-goal-menu" ref={goalMenuRef} className="fixed z-[100] w-52 rounded-xl border border-border bg-card p-2 text-foreground shadow-xl" style={{ top: goalMenuPosition?.top ?? 0, left: goalMenuPosition?.left ?? 0, visibility: goalMenuPosition ? 'visible' : 'hidden', maxHeight: 'min(240px, calc(100dvh - 24px))', overflowY: 'auto' }} role="menu" aria-label="Wöchentliches Lernziel wählen"><p className="px-3 py-2 text-xs font-semibold text-muted-foreground">Wöchentliches Lernziel</p>{[60,120,180,240].map((minutes) => <Button key={minutes} variant={minutes === dashboard.weeklyGoalMinutes ? 'secondary' : 'ghost'} className="w-full justify-start px-3 py-2 text-sm" role="menuitem" disabled={goalSaving} onClick={async () => { setGoalSaving(true); const saved = await onSetWeeklyGoal(minutes); setGoalSaving(false); if (saved) setGoalMenuOpen(false) }}>{goalSaving ? <span className="inline-flex items-center gap-2"><span className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />Wird gespeichert</span> : `${minutes} Minuten`}</Button>)}</div>, document.body)}
  </div>
}

function TopicPage(props: {
  topic: Topic; uploading: boolean; setupMode: boolean; planChatOpen: boolean; setupMessages: ChatMessage[]; setupError: string; selectedNode: string | null; selectedTopicNode: Topic['nodes'][number] | null; questions: LearningQuestion[]; questionFilters: { short: boolean; partner: boolean; stage: string }; search: string; context: Topic['context']; contextSaving: boolean; contextSaved: boolean; showAllQuestions: boolean; editingSource: string | null; sourceName: string; sourceBusyId: string;
  onBack: () => void; onUpload: (file: File) => void; onSelectNode: (id: string | null) => void; onFilter: (filters: { short: boolean; partner: boolean; stage: string }) => void; onSearch: (query: string) => void; onStartQuestion: (question: LearningQuestion) => void; onToggleAllQuestions: () => void; onTopicUpdated: (topic: Topic) => void; onTogglePlanChat: () => void; onSaveContext: (event: FormEvent<HTMLFormElement>) => Promise<boolean>; onContextChange: (context: Topic['context']) => void; onRenameStart: (id: string, name: string) => void; onSourceNameChange: (name: string) => void; onRenameSource: (id: string) => void; onCancelRename: () => void; onDeleteSource: (id: string) => void; onBackToDashboard: () => void; onRetry: () => void;
}) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const recommendedQuestion = props.topic.questions.find((question) => question.status === 'recommended' && props.topic.nodes.find((node) => node.id === question.topicId)?.eligible) ?? props.topic.questions.find((question) => props.topic.nodes.find((node) => node.id === question.topicId)?.eligible) ?? props.topic.questions[0]
  return <div className="space-y-4">
    <input ref={uploadRef} className="sr-only" type="file" accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx" aria-label="Weitere Quelle hochladen" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onUpload(file); event.target.value = '' }} />
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" onClick={props.onBack}><span className="inline-flex items-center gap-2"><ArrowLeft className="size-4" aria-hidden="true" /> Zu meinen Lerninhalten</span></Button><span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden="true" /> {formatExamCountdown(props.context.examDate)}</span></div>
    {props.setupMode ? <SetupPanel topic={props.topic} messages={props.setupMessages} error={props.setupError} onTopicUpdated={props.onTopicUpdated} onRetry={props.onRetry} /> : <>
      <section className="topic-banner grid gap-4 rounded-[1.5rem] border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"><div><p className="eyebrow">{props.topic.subject.toUpperCase()} · LERNRAUM</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{props.topic.title}</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{props.topic.description}</p></div><div className="flex flex-wrap items-center gap-4"><div className="min-w-[180px] flex-1 sm:flex-none sm:min-w-[190px]"><ProgressBar value={props.topic.progress} label="Themenfortschritt" /></div><Button variant="primary" disabled={!recommendedQuestion} onClick={() => recommendedQuestion && props.onStartQuestion(recommendedQuestion)}><span className="inline-flex items-center gap-2">Empfohlene Übung starten <ArrowRight className="size-4" aria-hidden="true" /></span></Button></div></section>
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
  return <Card className="gap-0 rounded-2xl border border-border px-3 py-2.5 sm:px-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><FileText className="size-4 text-primary" aria-hidden="true" /><h2 className="text-sm font-semibold">Quellen</h2><span className="text-xs text-muted-foreground">{topic.sources.length}</span></div><Button variant="outline" className="px-3 py-2 text-xs" disabled={uploading} onClick={onAdd}><span className="inline-flex items-center gap-1.5">{uploading ? <LoadingInline label="Quelle wird hinzugefügt" /> : <><Upload className="size-3.5" aria-hidden="true" /> Quelle hinzufügen</>}</span></Button></div>
    {topic.sources.length ? <ul className="mt-2 flex flex-wrap gap-2">{topic.sources.map((source) => <li key={source.id} className="source-chip flex max-w-full items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5">{editingSource === source.id ? <form className="flex min-w-0 flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); onRenameSource(source.id) }}><Input autoFocus value={sourceName} onChange={(event) => onSourceNameChange(event.target.value)} className="h-8 min-w-0 w-40 rounded-lg px-2 py-1.5 text-xs" aria-label="Quellenname" /><Button variant="primary" type="submit" size="sm" disabled={sourceBusyId === source.id}>{sourceBusyId === source.id ? <LoadingInline label="Wird gespeichert" /> : 'Speichern'}</Button><Button variant="ghost" size="sm" onClick={onCancelRename}>Abbrechen</Button></form> : <><FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="max-w-[min(48vw,260px)] truncate text-xs font-medium" title={source.name}>{source.name}</span><span className="hidden text-[10px] text-muted-foreground sm:inline">{source.kind}</span><Button variant="ghost" size="icon-sm" aria-label={`${source.name} umbenennen`} onClick={() => onRenameStart(source.id, source.name)}><Pencil className="size-3.5" aria-hidden="true" /></Button><Button variant="ghost" size="icon-sm" aria-label={`${source.name} löschen`} disabled={sourceBusyId === source.id} onClick={() => onDeleteSource(source.id)}>{sourceBusyId === source.id ? <LoadingInline label="Wird entfernt" /> : <Trash2 className="size-3.5" aria-hidden="true" />}</Button></>}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">Füge Lernmaterial hinzu, um diesen Lernpfad zu gestalten.</p>}
  </Card>
}

function TopicPlanPanel({ topic, selectedTopicNode, selectedNode, onSelectNode }: {
  topic: Topic; selectedTopicNode: Topic['nodes'][number] | null; selectedNode: string | null; onSelectNode: (id: string | null) => void;
}) {
  return <Card className="panel min-w-0 gap-0 p-4 sm:p-5 xl:sticky xl:top-20 xl:self-start"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">DEIN LERNPFAD</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Lernplan</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Pfeile zeigen von Voraussetzungen zu den Themen, die sie freischalten. Wähle einen Knoten, um die Übungen zu fokussieren.</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"><Sparkles className="size-3.5" aria-hidden="true" /> KI-gestützt</span></div>
    <Suspense fallback={<div className="flow-shell flex h-[300px] items-center justify-center rounded-2xl border border-border bg-background"><LoadingInline label="Lernpfad wird vorbereitet …" /></div>}><LearningGraph topic={topic} selectedNode={selectedNode} onSelect={onSelectNode} /></Suspense>
    {selectedTopicNode && <div className="mt-3 rounded-xl bg-accent/40 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{selectedTopicNode.eligible ? 'Bereit zum Üben' : 'Wartet auf Voraussetzungen'}</p><h3 className="mt-0.5 text-sm font-semibold">{selectedTopicNode.label}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedTopicNode.description}</p>{selectedTopicNode.prerequisites.length > 0 && <p className="mt-1 text-[10px] text-muted-foreground">Benötigt: {selectedTopicNode.prerequisites.map((id) => topic.nodes.find((node) => node.id === id)?.label ?? id).join(' · ')}</p>}</div><div className="w-full max-w-[220px]"><ProgressBar value={selectedTopicNode.progress} label="Teilthemenfortschritt" /></div></div><div className="mt-3 border-t border-primary/10 pt-2"><p className="mb-2 text-[10px] font-semibold">Bloom-Evidenz · die letzten drei Stufen sind parallele Optionen</p><div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">{bloomStages.map((stage) => <div key={stage} className="rounded-md bg-card/70 px-2 py-1.5"><div className="flex items-center justify-between gap-1 text-[9px]"><span className="font-medium">{stage}</span><span className="tabular-nums text-muted-foreground">{selectedTopicNode.evidence[stage]}%</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${selectedTopicNode.evidence[stage]}%` }} /></div></div>)}</div></div></div>}
  </Card>
}

function TopicQuestionsPanel({ topic, selectedTopicNode, questions, questionFilters, search, showAllQuestions, onFilter, onSearch, onStartQuestion, onToggleAllQuestions }: {
  topic: Topic; selectedTopicNode: Topic['nodes'][number] | null; questions: LearningQuestion[]; questionFilters: { short: boolean; partner: boolean; stage: string }; search: string; showAllQuestions: boolean;
  onFilter: (filters: { short: boolean; partner: boolean; stage: string }) => void; onSearch: (query: string) => void; onStartQuestion: (question: LearningQuestion) => void; onToggleAllQuestions: () => void;
}) {
  const groupedQuestions = bloomStages.map((stage) => ({ stage, items: questions.filter((question) => question.stage === stage) })).filter((group) => group.items.length > 0)
  return <section className="panel p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">ÜBUNGSBIBLIOTHEK</p><h2 className="mt-1 text-xl font-semibold">Übungen zum Ausprobieren</h2><p className="mt-1 text-xs text-muted-foreground">{selectedTopicNode ? `Fokus auf ${selectedTopicNode.label}` : 'Nach Bloom-Taxonomie gruppiert'}</p></div><span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">{questions.length} verfügbar</span></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_auto_auto_200px] xl:items-center"><label className="sr-only" htmlFor="question-search">Übungen suchen</label><Input id="question-search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Übung suchen …" className="h-11 w-full rounded-xl bg-background px-3 text-sm" /><label className="flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-xs"><Switch size="sm" checked={questionFilters.short} onCheckedChange={(checked) => onFilter({ ...questionFilters, short: checked })} aria-label="Kurze Übungen filtern" /> Kurz (≤ 5 Min.)</label><label className="flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-xs"><Switch size="sm" checked={questionFilters.partner} onCheckedChange={(checked) => onFilter({ ...questionFilters, partner: checked })} aria-label="Partnerübungen filtern" /> Mit anderen</label><Suspense fallback={<div className="flex h-11 items-center rounded-xl border border-border px-3"><LoadingInline label="Stufen werden geladen" /></div>}><StageFilter value={questionFilters.stage} onChange={(stage) => onFilter({ ...questionFilters, stage })} /></Suspense></div>
    {groupedQuestions.length === 0 ? <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">Keine Übung passt zu diesen Filtern. Wähle eine andere Stufe oder entferne einen Filter.</p> : <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{groupedQuestions.map(({ stage, items }) => <section key={stage} className="min-w-0"><p className="eyebrow mb-2">{stage.toUpperCase()} <span className="font-normal tracking-normal">· {items.length}</span></p><div className="space-y-2">{(showAllQuestions ? items : items.slice(0, 2)).map((question) => <QuestionCard key={question.id} question={question} locked={!topic.nodes.find((node) => node.id === question.topicId)?.eligible} onStart={onStartQuestion} />)}</div></section>)}</div>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">{questions.length > 2 && <Button variant="ghost" onClick={onToggleAllQuestions}><span className="inline-flex items-center gap-1.5">{showAllQuestions ? 'Weniger anzeigen' : 'Alle passenden Übungen anzeigen'} <ChevronDown className={`size-4 transition-transform ${showAllQuestions ? 'rotate-180' : ''}`} aria-hidden="true" /></span></Button>}<div className="rounded-xl border border-border/70 bg-muted/50 px-3 py-2"><div className="flex items-center gap-2 text-xs font-medium"><UsersRound className="size-3.5 text-primary" aria-hidden="true" /> Partnerübungen brauchen eine zweite Person</div><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Niemand verfügbar? Wähle eine Solo-Übung mit demselben Ziel.</p></div></div>
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

export default App
