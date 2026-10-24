import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, FileText, LockKeyhole,
  MessageCircle, MousePointerClick, Pencil, Plus, Target, Trash2, Upload, UsersRound, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select as UISelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { ErrorNotice, LoadingCard, LoadingInline, SavedNotice } from '@/components/feedback'
import { bloomStages } from '@/lib/fixtures'
import type { BloomStage, ChatMessage, LearningQuestion, Topic } from '@/lib/types'

const preferredLengthLabels: Record<Topic['context']['preferredLength'], string> = { Short: 'Kurz', Balanced: 'Ausgewogen', Detailed: 'Ausführlich' }

const bloomStageLabels: Record<BloomStage, string> = {
  Remember: 'Erinnern',
  Understand: 'Verstehen',
  Apply: 'Anwenden',
  Analyze: 'Analysieren',
  Evaluate: 'Bewerten',
  Create: 'Entwickeln',
}

const LearningGraph = lazy(() => import('@/components/learning-graph'))
const AIChatPanel = lazy(() => import('@/components/ai-chat').then((module) => ({ default: module.AIChatPanel })))

function ProgressBar({ value, label, className = '' }: { value: number; label?: string; className?: string }) {
  return (
    <Progress value={value} aria-label={label ?? 'Gesamtfortschritt'} className={`progress-bar ${className}`}>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label ?? 'Gesamtfortschritt'}</span>
        <span className="font-semibold tabular-nums">{value}%</span>
      </div>
    </Progress>
  )
}

function formatExamCountdown(date: string) {
  if (!date) return 'Prüfungstermin nicht festgelegt'
  const target = new Date(`${date}T00:00:00`).getTime()
  if (!Number.isFinite(target)) return 'Prüfungstermin nicht festgelegt'
  const remaining = Math.ceil((target - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  return remaining > 0 ? `Prüfung in ${remaining} Tagen` : remaining === 0 ? 'Prüfung heute' : 'Prüfungstermin vorbei'
}

export function TopicPage(props: {
  topic: Topic
  uploading: boolean
  setupMode: boolean
  planChatOpen: boolean
  setupMessages: ChatMessage[]
  setupError: string
  selectedNode: string | null
  selectedTopicNode: Topic['nodes'][number] | null
  questions: LearningQuestion[]
  questionFilters: { short: boolean; partner: boolean; stage: string }
  search: string
  context: Topic['context']
  contextSaving: boolean
  contextSaved: boolean
  showAllQuestions: boolean
  editingSource: string | null
  sourceName: string
  sourceBusyId: string
  onBack: () => void
  onUpload: (file: File) => void
  onSelectNode: (id: string | null) => void
  onFilter: (filters: { short: boolean; partner: boolean; stage: string }) => void
  onSearch: (query: string) => void
  onStartQuestion: (question: LearningQuestion) => void
  onToggleAllQuestions: () => void
  onTopicUpdated: (topic: Topic) => void
  onTogglePlanChat: () => void
  onSaveContext: (event: FormEvent<HTMLFormElement>) => Promise<boolean>
  onContextChange: (context: Topic['context']) => void
  onRenameStart: (id: string, name: string) => void
  onSourceNameChange: (name: string) => void
  onRenameSource: (id: string) => void
  onCancelRename: () => void
  onDeleteSource: (id: string) => void
  onBackToDashboard: () => void
  onRetry: () => void
}) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const recommendedQuestion =
    props.topic.questions.find(
      (question) => question.status === 'recommended' && props.topic.nodes.find((node) => node.id === question.topicId)?.eligible,
    )
    ?? props.topic.questions.find((question) => props.topic.nodes.find((node) => node.id === question.topicId)?.eligible)
    ?? props.topic.questions[0]
  const recommendedNode =
    props.topic.nodes.find((node) => node.id === recommendedQuestion?.topicId)
    ?? props.topic.nodes.find((node) => node.eligible)
    ?? props.topic.nodes[0]
    ?? null

  const handleStudyNode = (nodeId: string) => {
    const targetQuestion =
      props.topic.questions.find((q) => q.topicId === nodeId && q.status === 'recommended')
      ?? props.topic.questions.find((q) => q.topicId === nodeId && q.status !== 'completed')
      ?? props.topic.questions.find((q) => q.topicId === nodeId)
      ?? recommendedQuestion
    if (targetQuestion) props.onStartQuestion(targetQuestion)
  }

  return (
    <div className="space-y-4">
      <input
        ref={uploadRef}
        className="sr-only"
        type="file"
        accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx"
        aria-label="Weiteres Lernmaterial hochladen"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) props.onUpload(file)
          event.target.value = ''
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={props.onBack}>
          <span className="inline-flex items-center gap-2">
            <ArrowLeft className="size-4" aria-hidden="true" /> Zurück zur Übersicht
          </span>
        </Button>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" /> {formatExamCountdown(props.context.examDate)}
        </span>
      </div>
      {props.setupMode ? (
        <SetupPanel
          topic={props.topic}
          messages={props.setupMessages}
          error={props.setupError}
          onTopicUpdated={props.onTopicUpdated}
          onRetry={props.onRetry}
        />
      ) : (
        <>
          <section className="topic-banner panel p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{props.topic.subject}</p>
                <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">{props.topic.title}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{props.topic.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-[180px] flex-1 sm:min-w-[190px] sm:flex-none">
                  <ProgressBar value={props.topic.progress} label="Themenfortschritt" />
                </div>
                <Button
                  variant="primary"
                  disabled={!recommendedQuestion}
                  onClick={() => recommendedQuestion && props.onStartQuestion(recommendedQuestion)}
                >
                  <span className="inline-flex items-center gap-2">
                    Empfohlene Aufgabe starten <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </Button>
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <TopicSources
                topic={props.topic}
                uploading={props.uploading}
                onAdd={() => uploadRef.current?.click()}
                editingSource={props.editingSource}
                sourceName={props.sourceName}
                sourceBusyId={props.sourceBusyId}
                onRenameStart={props.onRenameStart}
                onSourceNameChange={props.onSourceNameChange}
                onRenameSource={props.onRenameSource}
                onCancelRename={props.onCancelRename}
                onDeleteSource={props.onDeleteSource}
              />
            </div>
          </section>
          {props.setupError && <ErrorNotice message={props.setupError} onRetry={props.onRetry} />}
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)]">
            <TopicPlanPanel
              topic={props.topic}
              selectedTopicNode={props.selectedTopicNode}
              selectedNode={props.selectedNode}
              recommendedNode={recommendedNode}
              recommendedNodeId={recommendedQuestion?.topicId ?? null}
              onSelectNode={props.onSelectNode}
              onStudyNode={handleStudyNode}
              onTopicUpdated={props.onTopicUpdated}
              onOpenPlanChat={() => {
                const input = document.getElementById('plan-chat-input')
                if (input instanceof HTMLElement) {
                  input.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  input.focus()
                }
              }}
            />
            <aside className="space-y-4 xl:sticky xl:top-20">
              <PlanConversation
                topicId={props.topic.id}
                messages={props.setupMessages}
                onTopicUpdated={props.onTopicUpdated}
              />
              <LearningContextCard
                context={props.context}
                saving={props.contextSaving}
                saved={props.contextSaved}
                onChange={props.onContextChange}
                onSave={props.onSaveContext}
              />
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

function TopicSources({
  topic,
  uploading,
  onAdd,
  editingSource,
  sourceName,
  sourceBusyId,
  onRenameStart,
  onSourceNameChange,
  onRenameSource,
  onCancelRename,
  onDeleteSource,
}: {
  topic: Topic
  uploading: boolean
  onAdd: () => void
  editingSource: string | null
  sourceName: string
  sourceBusyId: string
  onRenameStart: (id: string, name: string) => void
  onSourceNameChange: (name: string) => void
  onRenameSource: (id: string) => void
  onCancelRename: () => void
  onDeleteSource: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FileText className="size-3.5" aria-hidden="true" />
          Lernmaterialien ({topic.sources.length})
        </span>
        {topic.sources.length ? (
          <ul className="flex flex-wrap items-center gap-1.5">
            {topic.sources.map((source) => (
              <li
                key={source.id}
                className="source-chip flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1"
              >
                {editingSource === source.id ? (
                  <form
                    className="flex min-w-0 flex-wrap items-center gap-1.5"
                    onSubmit={(event) => {
                      event.preventDefault()
                      onRenameSource(source.id)
                    }}
                  >
                    <Input
                      autoFocus
                      value={sourceName}
                      onChange={(event) => onSourceNameChange(event.target.value)}
                      className="h-7 min-w-0 w-40 rounded-md px-2 py-1 text-xs"
                      aria-label="Name des Materials"
                    />
                    <Button variant="primary" type="submit" size="xs" disabled={sourceBusyId === source.id}>
                      {sourceBusyId === source.id ? <LoadingInline label="Wird gespeichert" /> : 'Speichern'}
                    </Button>
                    <Button variant="ghost" size="xs" onClick={onCancelRename}>
                      Abbrechen
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="max-w-[min(45vw,240px)] truncate text-xs font-medium" title={source.name}>
                      {source.name}
                    </span>
                    <span className="hidden text-[10px] text-muted-foreground sm:inline">· {source.kind}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`„${source.name}“ umbenennen`}
                      onClick={() => onRenameStart(source.id, source.name)}
                    >
                      <Pencil className="size-3 text-muted-foreground" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`„${source.name}“ entfernen`}
                      disabled={sourceBusyId === source.id}
                      onClick={() => onDeleteSource(source.id)}
                    >
                      {sourceBusyId === source.id ? <LoadingInline label="Wird entfernt" /> : <Trash2 className="size-3 text-muted-foreground" aria-hidden="true" />}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-xs text-muted-foreground">Noch kein Lernmaterial hinzugefügt.</span>
        )}
      </div>
      <Button variant="outline" size="sm" disabled={uploading} onClick={onAdd}>
        <span className="inline-flex items-center gap-1.5">
          {uploading ? (
            <LoadingInline label="Lernmaterial wird hinzugefügt" />
          ) : (
            <>
              <Upload className="size-3.5" aria-hidden="true" /> Lernmaterial hinzufügen
            </>
          )}
        </span>
      </Button>
    </div>
  )
}

function TopicPlanPanel({
  topic,
  selectedTopicNode,
  selectedNode,
  recommendedNode,
  recommendedNodeId,
  onSelectNode,
  onStudyNode,
  onTopicUpdated,
  onOpenPlanChat,
}: {
  topic: Topic
  selectedTopicNode: Topic['nodes'][number] | null
  selectedNode: string | null
  recommendedNode: Topic['nodes'][number] | null
  recommendedNodeId: string | null
  onSelectNode: (id: string | null) => void
  onStudyNode: (id: string) => void
  onTopicUpdated: (topic: Topic) => void
  onOpenPlanChat: () => void
}) {
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editingNode, setEditingNode] = useState(false)
  const [nodeLabelDraft, setNodeLabelDraft] = useState('')
  const [nodeDescDraft, setNodeDescDraft] = useState('')
  const [inspectorPulse, setInspectorPulse] = useState(false)
  const inspectorRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef<number | null>(null)

  const smoothScrollToInspector = () => {
    const targetEl = inspectorRef.current
    if (!targetEl) return
    if (scrollRafRef.current !== null) {
      window.cancelAnimationFrame(scrollRafRef.current)
    }

    const startY = window.scrollY
    const headerOffset = 92
    const rect = targetEl.getBoundingClientRect()
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const targetY = Math.min(maxScroll, Math.max(0, startY + rect.top - headerOffset))
    const distance = targetY - startY

    if (Math.abs(distance) < 4) return

    const duration = 680
    const startTime = performance.now()
    const htmlEl = document.documentElement
    const prevScrollBehavior = htmlEl.style.scrollBehavior
    htmlEl.style.scrollBehavior = 'auto'

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)
      const eased = easeInOutCubic(progress)
      window.scrollTo(0, startY + distance * eased)

      if (progress < 1) {
        scrollRafRef.current = window.requestAnimationFrame(step)
      } else {
        htmlEl.style.scrollBehavior = prevScrollBehavior
        scrollRafRef.current = null
      }
    }

    scrollRafRef.current = window.requestAnimationFrame(step)
  }

  const handleSelectGraphNode = (nodeId: string | null) => {
    onSelectNode(nodeId)
    if (nodeId) {
      setInspectorPulse(true)
      window.setTimeout(() => setInspectorPulse(false), 950)
      window.setTimeout(() => {
        smoothScrollToInspector()
      }, 55)
    }
  }

  const nodeQuestions = useMemo(
    () => (selectedTopicNode ? topic.questions.filter((q) => q.topicId === selectedTopicNode.id) : []),
    [selectedTopicNode, topic.questions],
  )
  const completedInNode = useMemo(
    () => nodeQuestions.filter((q) => q.status === 'completed').length,
    [nodeQuestions],
  )

  useEffect(() => {
    setEditingNode(false)
    setEditingQuestionId(null)
  }, [selectedTopicNode?.id])

  const handleSaveQuestion = (updated: LearningQuestion) => {
    const exists = topic.questions.some((q) => q.id === updated.id)
    const nextQuestions = exists
      ? topic.questions.map((q) => (q.id === updated.id ? updated : q))
      : [...topic.questions, updated]
    onTopicUpdated({ ...topic, questions: nextQuestions })
    setEditingQuestionId(null)
  }

  const handleDeleteQuestion = (questionId: string) => {
    const nextQuestions = topic.questions.filter((q) => q.id !== questionId)
    onTopicUpdated({ ...topic, questions: nextQuestions })
    if (editingQuestionId === questionId) setEditingQuestionId(null)
  }

  const handleAddQuestion = () => {
    if (!selectedTopicNode) return
    const newQuestion: LearningQuestion = {
      id: `q-${selectedTopicNode.id}-${Date.now()}`,
      topicId: selectedTopicNode.id,
      title: `Neue Frage zu ${selectedTopicNode.label}`,
      prompt: `Erkläre oder wende ein zentrales Kriterium zu „${selectedTopicNode.label}“ anhand deines Lernmaterials an.`,
      stage: 'Apply',
      mode: 'Solo',
      duration: '4 min',
      status: nodeQuestions.length === 0 ? 'recommended' : 'up-next',
    }
    onTopicUpdated({ ...topic, questions: [...topic.questions, newQuestion] })
    setEditingQuestionId(newQuestion.id)
  }

  const handleSaveNode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTopicNode || !nodeLabelDraft.trim()) return
    const nextNodes = topic.nodes.map((node) =>
      node.id === selectedTopicNode.id
        ? { ...node, label: nodeLabelDraft.trim(), description: nodeDescDraft.trim() || node.description }
        : node,
    )
    onTopicUpdated({ ...topic, nodes: nextNodes })
    setEditingNode(false)
  }

  return (
    <Card className="panel min-w-0 gap-0 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Lernpfad</h2>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Wähle einen Abschnitt im Lernpfad aus, um die Fragen zu öffnen. Dort kannst du direkt üben{' '}
            <span className="font-medium text-foreground">Jetzt üben</span>.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenPlanChat}>
          Lernpfad im Chat anpassen
        </Button>
      </div>
      <Suspense
        fallback={
          <div className="flow-shell flex h-[340px] items-center justify-center rounded-xl border border-border bg-background">
            <LoadingInline label="Lernpfad wird vorbereitet…" />
          </div>
        }
      >
        <LearningGraph
          topic={topic}
          selectedNode={selectedNode}
          recommendedNodeId={recommendedNodeId}
          onSelect={handleSelectGraphNode}
        />
      </Suspense>
      {selectedTopicNode ? (
        <motion.div
          ref={inspectorRef}
          key={selectedTopicNode.id}
          initial={{ opacity: 0.78, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className={`mt-4 scroll-mt-24 rounded-xl border bg-background/60 p-4 transition-[border-color,box-shadow] duration-500 ${
            inspectorPulse
              ? 'border-primary shadow-sm ring-2 ring-primary/40'
              : 'border-border'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {editingNode ? (
                <form className="max-w-xl space-y-2" onSubmit={handleSaveNode}>
                  <Input
                    autoFocus
                    value={nodeLabelDraft}
                    onChange={(e) => setNodeLabelDraft(e.target.value)}
                    className="h-8 rounded-lg bg-card px-2.5 text-xs font-semibold"
                    aria-label="Titel des Abschnitts"
                    placeholder="Titel des Abschnitts"
                  />
                  <Input
                    value={nodeDescDraft}
                    onChange={(e) => setNodeDescDraft(e.target.value)}
                    className="h-8 rounded-lg bg-card px-2.5 text-xs"
                    aria-label="Beschreibung des Abschnitts"
                    placeholder="Beschreibung des Abschnitts"
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="primary" size="xs" type="submit">
                      Abschnitt speichern
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => setEditingNode(false)}>
                      Abbrechen
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base font-semibold tracking-tight">{selectedTopicNode.label}</h3>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {selectedTopicNode.eligible ? 'Bereit' : 'Noch nicht freigeschaltet'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Abschnitt „${selectedTopicNode.label}“ bearbeiten`}
                      onClick={() => {
                        setNodeLabelDraft(selectedTopicNode.label)
                        setNodeDescDraft(selectedTopicNode.description)
                        setEditingNode(true)
                      }}
                    >
                      <Pencil className="size-3 text-muted-foreground" aria-hidden="true" />
                    </Button>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedTopicNode.description}</p>
                </>
              )}
              {selectedTopicNode.prerequisites.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Voraussetzung: {selectedTopicNode.prerequisites.map((id) => topic.nodes.find((node) => node.id === id)?.label ?? id).join(' · ')}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-40">
                <ProgressBar value={selectedTopicNode.progress} label="Fortschritt im Abschnitt" />
              </div>
              {selectedTopicNode.eligible && nodeQuestions.length > 0 && (
                <Button variant="primary" size="sm" onClick={() => onStudyNode(selectedTopicNode.id)}>
                  <span>Jetzt üben</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-3.5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-foreground">Fragen</h4>
                <span className="text-xs text-muted-foreground">
                  {completedInNode}/{nodeQuestions.length} abgeschlossen
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddQuestion}>
                <Plus className="size-3.5" aria-hidden="true" /> Frage hinzufügen
              </Button>
            </div>
            {nodeQuestions.length > 0 ? (
              <div className="space-y-2">
                {nodeQuestions.map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    stepNumber={index + 1}
                    question={question}
                    locked={!selectedTopicNode.eligible}
                    editing={editingQuestionId === question.id}
                    onEditStart={() => setEditingQuestionId(question.id)}
                    onEditCancel={() => setEditingQuestionId(null)}
                    onSave={handleSaveQuestion}
                    onDelete={() => handleDeleteQuestion(question.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                <span>In diesem Abschnitt gibt es noch keine Aufgaben. Füge eine eigene Frage hinzu oder bitte den Lerncoach rechts darum.</span>
                <Button variant="outline" size="sm" onClick={handleAddQuestion}>
                  <Plus className="size-3.5" aria-hidden="true" /> Erste Frage hinzufügen
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <div
          ref={inspectorRef}
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
              <MousePointerClick className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-foreground">
                Wähle oben einen Abschnitt aus, um die Fragen anzusehen und anzupassen
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Wenn du einen Abschnitt auswählst, erscheinen hier die passenden Aufgaben. Von dort kannst du direkt mit dem Üben starten.
              </p>
            </div>
          </div>
          {recommendedNode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectGraphNode(recommendedNode.id)}
            >
              <span>„{recommendedNode.label}“ öffnen</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

function SetupPanel({
  topic,
  messages,
  error,
  onTopicUpdated,
  onRetry,
}: {
  topic: Topic
  messages: ChatMessage[]
  error: string
  onTopicUpdated: (topic: Topic) => void
  onRetry: () => void
}) {
  return (
    <section className="setup-shell mx-auto grid max-w-5xl overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[.8fr_1.2fr]">
      <div className="setup-aside border-b border-border bg-muted/40 p-6 sm:p-8 lg:border-b-0 lg:border-r">
        <Button variant="ghost" onClick={onRetry}>
          <span className="inline-flex items-center gap-2">
            <ArrowLeft className="size-4" aria-hidden="true" /> Zurück zum Thema
          </span>
        </Button>
        <span className="mt-8 flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground">
          <Upload className="size-4" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Dein Lernmaterial ist bereit.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Jetzt legen wir den Schwerpunkt fest. Lernpfad und Fragen passen sich deinem Ziel an.
        </p>
        <div className="mt-6 rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
              <FileText className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{topic.sources[0]?.name ?? 'Lernnotizen'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Hinzugefügtes Material</p>
            </div>
          </div>
        </div>
        <ol className="mt-6 space-y-2.5 text-sm">
          <li className="flex items-center gap-3 font-medium">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span> Schwerpunkt festlegen
          </li>
          <li className="flex items-center gap-3 text-muted-foreground">
            <span className="flex size-6 items-center justify-center rounded-full border border-border bg-card text-xs">2</span> Lernpfad ansehen
          </li>
          <li className="flex items-center gap-3 text-muted-foreground">
            <span className="flex size-6 items-center justify-center rounded-full border border-border bg-card text-xs">3</span> Mit dem Üben starten
          </li>
        </ol>
      </div>
      <div className="flex min-h-[540px] flex-col p-5 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight">Was möchtest du erreichen?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sag dem Lerncoach, welche Inhalte du verstehen möchtest. Daraus erstellt er passende Lernschritte und Fragen.
        </p>
        {error && (
          <div className="mt-3">
            <ErrorNotice message={error} />
          </div>
        )}
        <div className="mt-5">
          <Suspense fallback={<LoadingCard title="Lerncoach wird geöffnet" detail="Chat wird vorbereitet…" />}>
            <AIChatPanel
              kind="scope"
              chatId={`scope-${topic.id}`}
              topicId={topic.id}
              initialMessages={messages}
              title="Lerncoach"
              detail="Sag dem Lerncoach, worauf du dich konzentrieren möchtest"
              onTopicUpdated={onTopicUpdated}
            />
          </Suspense>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Tipp: Trenne mehrere Themen mit Kommas (z. B. „Förderkriterien, Antragsprüfung, Praxis-Check“), damit eigene Abschnitte entstehen.
        </p>
      </div>
    </section>
  )
}

function PlanConversation({
  topicId,
  messages,
  onTopicUpdated,
}: {
  topicId: string
  messages: ChatMessage[]
  onTopicUpdated: (topic: Topic) => void
}) {
  return (
    <Suspense
      fallback={
        <Card className="panel p-4">
          <LoadingInline label="Lerncoach wird geöffnet…" />
        </Card>
      }
    >
      <AIChatPanel
        kind="scope"
        compact
        chatId={`scope-${topicId}`}
        topicId={topicId}
        initialMessages={messages}
        title="Lerncoach für den Lernpfad"
        detail="Passe Abschnitte an, setze Schwerpunkte aus deinen Materialien oder bearbeite Fragen."
        inputId="plan-chat-input"
        placeholder="z. B. „Nur Förderkriterien“ oder „Letzte Frage entfernen …“"
        onTopicUpdated={onTopicUpdated}
      />
    </Suspense>
  )
}

function LearningContextCard({
  context,
  saving,
  saved,
  onChange,
  onSave,
}: {
  context: Topic['context']
  saving: boolean
  saved: boolean
  onChange: (context: Topic['context']) => void
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  return (
    <Card className="panel context-card gap-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Lernkontext</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Einstellungen für deinen Lernpfad.</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={editing ? 'Lernkontext-Bearbeitung schließen' : 'Lernkontext bearbeiten'}
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? <X className="size-4" aria-hidden="true" /> : <Pencil className="size-4" aria-hidden="true" />}
        </Button>
      </div>
      {editing ? (
        <form
          className="mt-3 grid gap-2.5 sm:grid-cols-2"
          onSubmit={async (event) => {
            if (await onSave(event)) setEditing(false)
          }}
        >
          <label className="block text-[11px] font-medium">
            Prüfungstermin
            <Input
              type="date"
              value={context.examDate}
              onChange={(event) => onChange({ ...context, examDate: event.target.value })}
              className="mt-1 h-9 w-full rounded-lg px-3 text-xs"
            />
          </label>
          <label className="block text-[11px] font-medium">
            Verfügbare Lernzeit
            <Input
              value={context.timeAvailable}
              onChange={(event) => onChange({ ...context, timeAvailable: event.target.value })}
              className="mt-1 h-9 w-full rounded-lg px-3 text-xs"
            />
          </label>
          <label className="block text-[11px] font-medium sm:col-span-2">
            Focus
            <Input
              value={context.focus}
              onChange={(event) => onChange({ ...context, focus: event.target.value })}
              className="mt-1 h-9 w-full rounded-lg px-3 text-xs"
            />
          </label>
          <label className="block text-[11px] font-medium">
            Gewünschte Fragenlänge
            <UISelect
              value={context.preferredLength}
              onValueChange={(value) => {
                if (value) onChange({ ...context, preferredLength: value as Topic['context']['preferredLength'] })
              }}
            >
              <SelectTrigger className="mt-1 h-9 w-full rounded-lg px-3 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Short">Kurz</SelectItem>
                <SelectItem value="Balanced">Ausgewogen</SelectItem>
                <SelectItem value="Detailed">Ausführlich</SelectItem>
              </SelectContent>
            </UISelect>
          </label>
          <label className="flex items-center justify-between rounded-lg bg-muted/70 p-2.5 text-[11px]">
            <span>
              <span className="block font-medium">KI-Coach</span>
              <span className="mt-0.5 block text-muted-foreground">Beim Üben verfügbar</span>
            </span>
            <Switch
              checked={context.tutorEnabled}
              onCheckedChange={(checked) => onChange({ ...context, tutorEnabled: checked })}
              aria-label="KI-Coach aktivieren"
            />
          </label>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Button variant="primary" type="submit" size="sm" disabled={saving}>
              {saving ? <LoadingInline label="Wird gespeichert" /> : 'Lernkontext speichern'}
            </Button>
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => setEditing(false)}>
              Abbrechen
            </Button>
            {saved && <SavedNotice>In diesem Browser gespeichert</SavedNotice>}
          </div>
        </form>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
          <FactRow icon={<CalendarDays className="size-3.5" />} label="Prüfungstermin" value={context.examDate || 'Nicht festgelegt'} />
          <FactRow icon={<Clock3 className="size-3.5" />} label="Verfügbare Lernzeit" value={context.timeAvailable} />
          <FactRow icon={<Target className="size-3.5" />} label="Aktueller Schwerpunkt" value={context.focus} />
          <FactRow
            icon={<MessageCircle className="size-3.5" />}
            label="Fragenformat"
            value={`${preferredLengthLabels[context.preferredLength]} · KI-Coach ${context.tutorEnabled ? 'aktiv' : 'aus'}`}
          />
        </div>
      )}
    </Card>
  )
}

function FactRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xs font-medium leading-4 text-foreground">{value}</p>
      </div>
    </div>
  )
}

function QuestionCard({
  stepNumber,
  question,
  locked,
  editing,
  onEditStart,
  onEditCancel,
  onSave,
  onDelete,
}: {
  stepNumber: number
  question: LearningQuestion
  locked: boolean
  editing?: boolean
  onEditStart?: () => void
  onEditCancel?: () => void
  onSave?: (updated: LearningQuestion) => void
  onDelete?: () => void
}) {
  const [titleDraft, setTitleDraft] = useState(question.title)
  const [promptDraft, setPromptDraft] = useState(question.prompt)
  const [stageDraft, setStageDraft] = useState<BloomStage>(question.stage)
  const [modeDraft, setModeDraft] = useState<LearningQuestion['mode']>(question.mode)
  const [durationDraft, setDurationDraft] = useState(question.duration)

  useEffect(() => {
    setTitleDraft(question.title)
    setPromptDraft(question.prompt)
    setStageDraft(question.stage)
    setModeDraft(question.mode)
    setDurationDraft(question.duration)
  }, [question, editing])

  const isRecommended = question.status === 'recommended' && !locked
  const isCompleted = question.status === 'completed'

  if (editing && onSave) {
    return (
      <form
        className="question-card flex flex-col justify-between gap-2.5 rounded-lg border border-primary bg-card p-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!titleDraft.trim() || !promptDraft.trim()) return
          onSave({
            ...question,
            title: titleDraft.trim(),
            prompt: promptDraft.trim(),
            stage: stageDraft,
            mode: modeDraft,
            duration: durationDraft.trim() || '4 min',
          })
        }}
      >
        <div className="space-y-2">
          <label className="block text-[11px] font-medium">
            Fragentitel
            <Input
              autoFocus
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              className="mt-1 h-8 rounded-md px-2.5 text-xs"
              required
            />
          </label>
          <label className="block text-[11px] font-medium">
            Aufgabenstellung
            <Textarea
              value={promptDraft}
              onChange={(event) => setPromptDraft(event.target.value)}
              rows={2}
              className="mt-1 min-h-14 rounded-md p-2.5 text-xs leading-5"
              required
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-[10px] font-medium text-muted-foreground">
              Bloom-Stufe
              <UISelect
                value={stageDraft}
                onValueChange={(value) => {
                  if (value) setStageDraft(value as BloomStage)
                }}
              >
                <SelectTrigger className="mt-1 h-8 w-full rounded-md px-2 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bloomStages.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {bloomStageLabels[stage]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </UISelect>
            </label>
            <label className="block text-[10px] font-medium text-muted-foreground">
              Lernmodus
              <UISelect
                value={modeDraft}
                onValueChange={(value) => {
                  if (value) setModeDraft(value as LearningQuestion['mode'])
                }}
              >
                <SelectTrigger className="mt-1 h-8 w-full rounded-md px-2 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Solo">Allein</SelectItem>
                  <SelectItem value="Partner">Mit Partner</SelectItem>
                </SelectContent>
              </UISelect>
            </label>
            <label className="block text-[10px] font-medium text-muted-foreground">
              Dauer
              <Input
                value={durationDraft}
                onChange={(event) => setDurationDraft(event.target.value)}
                className="mt-1 h-8 rounded-md px-2 text-xs"
                placeholder="4 Min."
              />
            </label>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`„${question.title}“ löschen`}>
              <Trash2 className="size-3.5 text-destructive" aria-hidden="true" /> Löschen
            </Button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {onEditCancel && (
              <Button variant="ghost" size="sm" onClick={onEditCancel}>
                Abbrechen
              </Button>
            )}
            <Button variant="primary" size="sm" type="submit">
              Speichern
            </Button>
          </div>
        </div>
      </form>
    )
  }

  return (
    <article
      className={`question-card flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
        locked ? 'border-border bg-muted/40 opacity-75' : 'border-border bg-card'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
            isCompleted
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          }`}
        >
          {isCompleted ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : stepNumber}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{question.title}</p>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/40 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                Erledigt
              </span>
            )}
            {isRecommended && !isCompleted && (
              <span className="inline-flex items-center rounded-md bg-primary/45 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                Als Nächstes
              </span>
            )}
            {locked && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <LockKeyhole className="size-2.5" aria-hidden="true" /> Gesperrt
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{question.prompt}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">{bloomStageLabels[question.stage]}</span>
            <span>·</span>
            <span>{question.duration}</span>
            <span>·</span>
            {question.mode === 'Partner' ? (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <UsersRound className="size-3" aria-hidden="true" /> Partner
              </span>
            ) : (
              <span>Allein üben</span>
            )}
          </div>
        </div>
      </div>
      {(onEditStart || onDelete) && (
        <div className="flex shrink-0 items-center gap-0.5">
          {onEditStart && (
            <Button variant="ghost" size="icon-xs" aria-label={`„${question.title}“ bearbeiten`} onClick={onEditStart}>
              <Pencil className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon-xs" aria-label={`„${question.title}“ löschen`} onClick={onDelete}>
              <Trash2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </article>
  )
}
