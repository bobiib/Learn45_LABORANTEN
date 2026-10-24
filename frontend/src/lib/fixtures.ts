import type { BloomEvidence, DashboardData, Topic, TopicNode } from './types'

const emptyEvidence = (): BloomEvidence => ({
  Remember: 0,
  Understand: 0,
  Apply: 0,
  Analyze: 0,
  Evaluate: 0,
  Create: 0,
})

const nodes: TopicNode[] = [
  { id: 'prompt-goal', label: 'Ziel benennen', description: 'Bestimme, für wen der Prompt gedacht ist und was die lesende Person als Nächstes tun soll.', prerequisites: [], progress: 62, eligible: true, evidence: { ...emptyEvidence(), Remember: 12, Understand: 24, Apply: 26 } },
  { id: 'prompt-context', label: 'Nützlichen Kontext ergänzen', description: 'Wähle Hintergrundinformationen, die dem Modell helfen, ohne es zu überladen.', prerequisites: [], progress: 38, eligible: true, evidence: { ...emptyEvidence(), Remember: 10, Understand: 28 } },
  { id: 'prompt-criteria', label: 'Qualitätskriterien festlegen', description: 'Beschreibe, was eine hilfreiche und überprüfbare Zusammenfassung enthalten muss.', prerequisites: ['prompt-goal', 'prompt-context'], progress: 18, eligible: true, evidence: { ...emptyEvidence(), Remember: 8, Understand: 10 } },
  { id: 'prompt-revise', label: 'Mit Belegen überarbeiten', description: 'Vergleiche eine erzeugte Zusammenfassung mit der Quelle und verbessere den Prompt.', prerequisites: ['prompt-criteria'], progress: 0, eligible: false, evidence: emptyEvidence() },
  { id: 'prompt-transfer', label: 'Kompetenz übertragen', description: 'Wende dieselbe Prompt-Strategie auf eine andere Projektnotiz an.', prerequisites: ['prompt-revise'], progress: 0, eligible: false, evidence: emptyEvidence() },
]

export const initialTopic: Topic = {
  id: 'clear-ai-prompts',
  title: 'Klare KI-Prompts schreiben',
  subject: 'Projektkompetenz',
  description: 'Verwandle Leas Projektnotizen in eine hilfreiche, verlässliche Zusammenfassung für die Projektleitung.',
  updatedLabel: 'Gestern fortgesetzt',
  progress: 42,
  sources: [
    { id: 'source-1', name: 'Projektnotizen & Sitzungsprotokoll.pdf', kind: 'PDF', sizeLabel: '2.4 MB', addedLabel: 'Hinzugefügt am 20. Okt.' },
    { id: 'source-2', name: 'Prompting-Leitfaden – Lektion 04.pdf', kind: 'PDF', sizeLabel: '1.1 MB', addedLabel: 'Hinzugefügt am 20. Okt.' },
  ],
  nodes,
  questions: [
    { id: 'q-goal', topicId: 'prompt-goal', title: 'Lesende Person und Ergebnis bestimmen', prompt: 'Lea braucht für ihre Projektleitung eine Zusammenfassung der Projektnotizen. Was sollte ihr Prompt über die lesende Person und die nächste Handlung festlegen, die die Zusammenfassung unterstützen soll?', stage: 'Understand', mode: 'Solo', duration: '4 Min.', status: 'recommended' },
    { id: 'q-context', topicId: 'prompt-context', title: 'Den passenden Kontext wählen', prompt: 'Welche zwei Angaben aus den Notizen helfen der KI am meisten, ein nützliches Update zu schreiben, ohne jeden Gesprächspunkt zu wiederholen?', stage: 'Remember', mode: 'Solo', duration: '3 Min.', status: 'up-next' },
    { id: 'q-criteria', topicId: 'prompt-criteria', title: 'Erfolg überprüfbar machen', prompt: 'Formuliere eine Anweisung, mit der Lea schnell prüfen kann, ob die Zusammenfassung Entscheidungen, Zuständigkeiten und nächste Schritte enthält.', stage: 'Apply', mode: 'Solo', duration: '5 Min.', status: 'up-next' },
    { id: 'q-compare', topicId: 'prompt-criteria', title: 'Ein fehlendes Kriterium erkennen', prompt: 'Eine Zusammenfassung nennt Entscheidungen, aber nicht die Verantwortlichen für die nächsten Schritte. Wie würdest du den Prompt überarbeiten, damit dieses Fehlen leichter auffällt?', stage: 'Analyze', mode: 'Partner', duration: '6 Min.', status: 'up-next' },
    { id: 'q-revise', topicId: 'prompt-revise', title: 'Mit Belegen überarbeiten', prompt: 'Vergleiche den Entwurf mit den Ausgangsnotizen. Welche Aussage braucht einen Beleg oder eine Korrektur, und wie würdest du die Anweisung ändern?', stage: 'Evaluate', mode: 'Solo', duration: '7 Min.', status: 'up-next' },
    { id: 'q-transfer', topicId: 'prompt-transfer', title: 'Einen wiederverwendbaren Prompt erstellen', prompt: 'Erstelle eine Prompt-Vorlage, mit der Lea die Zusammenfassung einer anderen Projektsitzung erstellen könnte.', stage: 'Create', mode: 'Partner', duration: '8 Min.', status: 'up-next' },
  ],
  context: {
    examDate: '2026-11-02',
    timeAvailable: 'Etwa 20 Minuten pro Tag',
    preferredLength: 'Short',
    tutorEnabled: true,
    focus: 'Prägnante, umsetzbare Projektupdates vorbereiten',
  },
}

export const initialDashboard: DashboardData = {
  learnerName: 'Lea',
  streak: 4,
  studyMinutes: 85,
  weeklyGoalMinutes: 120,
  completedSessions: 12,
  topics: [initialTopic],
  lastSession: { topicId: initialTopic.id, title: 'Klare KI-Prompts schreiben', detail: 'Frage 2 · Qualitätskriterien festlegen', progress: 42 },
}

export const nodePositions = [
  { id: 'prompt-goal', position: { x: 40, y: 40 } },
  { id: 'prompt-context', position: { x: 40, y: 190 } },
  { id: 'prompt-criteria', position: { x: 310, y: 115 } },
  { id: 'prompt-revise', position: { x: 580, y: 115 } },
  { id: 'prompt-transfer', position: { x: 850, y: 115 } },
]

export const bloomStages = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'] as const

export function createTopicFromFile(fileName: string): Topic {
  return {
    ...initialTopic,
    id: `topic-${Date.now()}`,
    title: fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
    subject: 'Neues Lernthema',
    description: 'Ein neuer Lernpfad, abgestimmt auf Leas Ziele und hochgeladene Notizen.',
    progress: 0,
    updatedLabel: 'Gerade hinzugefügt',
    sources: [{ id: `source-${Date.now()}`, name: fileName, kind: fileName.split('.').pop()?.toUpperCase() ?? 'DATEI', sizeLabel: 'Bereit zur Verarbeitung', addedLabel: 'Gerade hinzugefügt' }],
    nodes: initialTopic.nodes.map((node) => ({ ...node, progress: 0, eligible: node.prerequisites.length === 0, evidence: emptyEvidence() })),
    questions: initialTopic.questions.map((question) => ({ ...question, status: 'up-next' as const })),
    context: { ...initialTopic.context },
  }
}

export function refreshEligibility(topic: Topic): Topic {
  const startedOrDone = new Set(topic.nodes.filter((node) => node.progress > 0).map((node) => node.id))
  return {
    ...topic,
    nodes: topic.nodes.map((node) => ({
      ...node,
      eligible: node.prerequisites.every((prerequisite) => startedOrDone.has(prerequisite)),
    })),
  }
}
