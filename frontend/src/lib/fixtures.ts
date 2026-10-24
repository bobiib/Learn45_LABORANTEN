import type { BloomEvidence, BloomStage, DashboardData, LearningQuestion, Topic, TopicNode } from './types'

export const emptyEvidence = (): BloomEvidence => ({
  Remember: 0,
  Understand: 0,
  Apply: 0,
  Analyze: 0,
  Evaluate: 0,
  Create: 0,
})

const nodes: TopicNode[] = [
  { id: 'prompt-goal', label: 'Name the goal', description: 'Identify who the prompt is for and what the reader needs to do next.', prerequisites: [], progress: 62, eligible: true, evidence: { ...emptyEvidence(), Remember: 12, Understand: 24, Apply: 26 } },
  { id: 'prompt-context', label: 'Add useful context', description: 'Choose the background details that help the model answer without overwhelming it.', prerequisites: [], progress: 38, eligible: true, evidence: { ...emptyEvidence(), Remember: 10, Understand: 28 } },
  { id: 'prompt-criteria', label: 'Set quality criteria', description: 'Describe what a useful, verifiable summary must include.', prerequisites: ['prompt-goal', 'prompt-context'], progress: 18, eligible: true, evidence: { ...emptyEvidence(), Remember: 8, Understand: 10 } },
  { id: 'prompt-revise', label: 'Revise with evidence', description: 'Compare a generated summary with the source and improve the prompt.', prerequisites: ['prompt-criteria'], progress: 0, eligible: false, evidence: emptyEvidence() },
  { id: 'prompt-transfer', label: 'Transfer the skill', description: 'Apply the same prompt strategy to a different project-note scenario.', prerequisites: ['prompt-revise'], progress: 0, eligible: false, evidence: emptyEvidence() },
]

export const initialTopic: Topic = {
  id: 'clear-ai-prompts',
  title: 'Writing clear AI prompts',
  subject: 'Project skills',
  description: 'Turn Lea’s project notes into a useful, reliable summary for her project lead.',
  updatedLabel: 'Continued yesterday',
  progress: 42,
  sources: [
    { id: 'source-1', name: 'Project notes & meeting transcript.pdf', kind: 'PDF', sizeLabel: '2.4 MB', addedLabel: 'Added Oct 20' },
    { id: 'source-2', name: 'Prompting guidelines — lecture 04.pdf', kind: 'PDF', sizeLabel: '1.1 MB', addedLabel: 'Added Oct 20' },
  ],
  nodes,
  questions: [
    { id: 'q-goal', topicId: 'prompt-goal', title: 'Identify the reader and outcome', prompt: 'Lea needs a summary of project notes for her project lead. What should her prompt specify about the reader and the next action the summary should support?', stage: 'Understand', mode: 'Solo', duration: '4 min', status: 'recommended' },
    { id: 'q-context', topicId: 'prompt-context', title: 'Choose the right context', prompt: 'Which two details from the notes would most help the AI produce a useful update without repeating every discussion point?', stage: 'Remember', mode: 'Solo', duration: '3 min', status: 'up-next' },
    { id: 'q-criteria', topicId: 'prompt-criteria', title: 'Make success checkable', prompt: 'Write one instruction Lea could add so she can quickly check whether the summary includes the decisions, owners, and next steps.', stage: 'Apply', mode: 'Solo', duration: '5 min', status: 'up-next' },
    { id: 'q-compare', topicId: 'prompt-criteria', title: 'Spot a missing criterion', prompt: 'A summary lists decisions but omits who owns each next step. How would you revise the prompt so that omission is easier to catch?', stage: 'Analyze', mode: 'Partner', duration: '6 min', status: 'up-next' },
    { id: 'q-revise', topicId: 'prompt-revise', title: 'Revise using evidence', prompt: 'Compare the draft summary with the source notes. Which claim needs a citation or correction, and how would you change the instruction?', stage: 'Evaluate', mode: 'Solo', duration: '7 min', status: 'up-next' },
    { id: 'q-transfer', topicId: 'prompt-transfer', title: 'Create a reusable prompt', prompt: 'Create a reusable prompt template Lea could adapt to summarize a different project meeting.', stage: 'Create', mode: 'Partner', duration: '8 min', status: 'up-next' },
  ],
  context: {
    examDate: '2026-11-02',
    timeAvailable: 'About 20 minutes a day',
    preferredLength: 'Short',
    tutorEnabled: true,
    focus: 'Prepare concise, actionable project updates',
  },
}

export const initialDashboard: DashboardData = {
  learnerName: 'Lea',
  streak: 4,
  studyMinutes: 85,
  weeklyGoalMinutes: 120,
  completedSessions: 12,
  topics: [initialTopic],
  lastSession: { topicId: initialTopic.id, title: 'Writing clear AI prompts', detail: 'Question 2 · Set quality criteria', progress: 42 },
}

export const nodePositions = [
  { id: 'prompt-goal', position: { x: 40, y: 40 } },
  { id: 'prompt-context', position: { x: 40, y: 190 } },
  { id: 'prompt-criteria', position: { x: 310, y: 115 } },
  { id: 'prompt-revise', position: { x: 580, y: 115 } },
  { id: 'prompt-transfer', position: { x: 850, y: 115 } },
]

export const bloomStages = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'] as const

function slugify(value: string, index: number): string {
  const base = value.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 28)
  return base ? `node-${base}-${index}` : `node-${index}`
}

function capitalize(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return 'Core concept'
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function buildQuestionsForNodes(topicNodes: TopicNode[], sourceTitle: string): LearningQuestion[] {
  const stages: { stage: BloomStage; mode: 'Solo' | 'Partner'; duration: string }[] = [
    { stage: 'Understand', mode: 'Solo', duration: '4 min' },
    { stage: 'Apply', mode: 'Solo', duration: '5 min' },
    { stage: 'Analyze', mode: 'Partner', duration: '6 min' },
    { stage: 'Evaluate', mode: 'Solo', duration: '6 min' },
    { stage: 'Create', mode: 'Partner', duration: '7 min' },
  ]

  const result: LearningQuestion[] = []
  topicNodes.forEach((node, index) => {
    const primarySpec = stages[index % stages.length]
    const secondaryStage: BloomStage = index === 0 ? 'Remember' : index % 2 === 1 ? 'Analyze' : 'Apply'
    const isFirstEligible = index === 0

    result.push({
      id: `q-${node.id}-1`,
      topicId: node.id,
      title: `${node.label}: Core check`,
      prompt: `Based on “${sourceTitle}”, explain the most important rule, goal, or requirement for “${node.label}” and how you would verify it in practice.`,
      stage: primarySpec.stage,
      mode: primarySpec.mode,
      duration: primarySpec.duration,
      status: isFirstEligible ? 'recommended' : 'up-next',
    })

    result.push({
      id: `q-${node.id}-2`,
      topicId: node.id,
      title: `Apply ${node.label.toLowerCase()} to a case`,
      prompt: `Imagine a colleague uses an incomplete draft for “${node.label}”. Which concrete criterion or correction from “${sourceTitle}” would you add so the result becomes reliable?`,
      stage: secondaryStage,
      mode: secondaryStage === 'Analyze' ? 'Partner' : 'Solo',
      duration: '5 min',
      status: 'up-next',
    })
  })

  return result
}

export function createTopicFromFile(fileName: string): Topic {
  const cleanTitle = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/\(\d+\)\s*$/, '')
    .replace(/[_-]+/g, ' ')
    .trim() || 'Uploaded study material'

  const generatedNodes: TopicNode[] = [
    {
      id: 'doc-foundations',
      label: 'Core concepts & goal',
      description: `Understand the main purpose and key terms in ${cleanTitle}.`,
      prerequisites: [],
      progress: 0,
      eligible: true,
      evidence: emptyEvidence(),
    },
    {
      id: 'doc-context',
      label: 'Key requirements',
      description: `Identify the essential conditions and inputs described in ${cleanTitle}.`,
      prerequisites: [],
      progress: 0,
      eligible: true,
      evidence: emptyEvidence(),
    },
    {
      id: 'doc-criteria',
      label: 'Quality & decision criteria',
      description: `Apply checkable criteria from ${cleanTitle} to evaluate real cases.`,
      prerequisites: ['doc-foundations', 'doc-context'],
      progress: 0,
      eligible: false,
      evidence: emptyEvidence(),
    },
    {
      id: 'doc-transfer',
      label: 'Practical transfer',
      description: `Solve a realistic scenario and review edge cases from ${cleanTitle}.`,
      prerequisites: ['doc-criteria'],
      progress: 0,
      eligible: false,
      evidence: emptyEvidence(),
    },
  ]

  return {
    ...initialTopic,
    id: `topic-${Date.now()}`,
    title: cleanTitle,
    subject: 'Uploaded document',
    description: `Focused learning plan generated from ${fileName}.`,
    progress: 0,
    updatedLabel: 'Just added',
    sources: [{ id: `source-${Date.now()}`, name: fileName, kind: fileName.split('.').pop()?.toUpperCase() ?? 'FILE', sizeLabel: 'Ready to process', addedLabel: 'Just added' }],
    nodes: generatedNodes,
    questions: buildQuestionsForNodes(generatedNodes, cleanTitle),
    context: {
      ...initialTopic.context,
      focus: `Master the key sections of ${cleanTitle}`,
    },
  }
}

function extractFocusItems(message: string): string[] {
  const cleaned = message
    .replace(/^(ich (will|möchte|würde gerne)|i (want|would like) to|bitte|please|fokus auf|focus on|nur|only|lass uns|let's)\s+/i, '')
    .replace(/\s+(lernen|üben|anschauen|verstehen|practice|study|learn|focus)\.?$/i, '')
    .trim()

  const parts = cleaned
    .split(/\s*(?:,|;|\/|\bund\b|\band\b|\bsowie\b|\bplus\b|\n)\s*/i)
    .map((item) => item.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter((item) => item.length >= 2 && item.length <= 55)

  return parts
}

export function buildScopedPlanFromMessage(topic: Topic, message: string): { topic: Topic; assistantMessage: string } {
  const trimmed = message.trim()
  const sourceTitle = topic.sources[0]?.name.replace(/\.[^.]+$/, '') ?? topic.title

  const isAddRequest = /\b(add|füg|plus|ergänz|weiteren?|noch eine|new box|neue box|neuer block)\b/i.test(trimmed) && topic.nodes.length > 0
  if (isAddRequest) {
    const rawLabel = trimmed
      .replace(/^.*?\b(?:zu|about|on|für|for|namens|called|box|block|thema|topic)\b\s*/i, '')
      .replace(/\s*\b(?:hinzu|dazu|hinzufügen|erstellen|add)\b.*$/i, '')
      .trim()
    const label = capitalize(rawLabel.slice(0, 38) || 'Deep-dive practice')
    const newId = slugify(label, topic.nodes.length + 1)
    const eligibleRoots = topic.nodes.filter((node) => node.prerequisites.length === 0)
    const prereqIds = eligibleRoots.length > 0 ? [eligibleRoots[0].id] : []
    const newNode: TopicNode = {
      id: newId,
      label,
      description: `Focused practice block on “${label}” from ${sourceTitle}.`,
      prerequisites: prereqIds,
      progress: 0,
      eligible: prereqIds.length === 0 || topic.nodes.some((n) => prereqIds.includes(n.id) && n.progress > 0),
      evidence: emptyEvidence(),
    }
    const newQuestions = buildQuestionsForNodes([newNode], sourceTitle).map((q) => ({ ...q, status: 'up-next' as const }))
    const updatedTopic = refreshEligibility({
      ...topic,
      updatedLabel: 'Updated just now',
      nodes: [...topic.nodes, newNode],
      questions: [...topic.questions, ...newQuestions],
    })
    return {
      topic: updatedTopic,
      assistantMessage: `I added the block “${label}” to your learning plan with matching practice questions. Hover over any ready block in the graph and click “Study now” to begin.`,
    }
  }

  const items = extractFocusItems(trimmed)
  let generatedNodes: TopicNode[] = []

  if (items.length >= 2) {
    const capped = items.slice(0, 5).map(capitalize)
    generatedNodes = capped.map((label, index) => {
      const id = slugify(label, index + 1)
      return {
        id,
        label: label.length > 34 ? `${label.slice(0, 32)}…` : label,
        description: `Targeted practice on “${label}” based on ${sourceTitle}.`,
        prerequisites: [],
        progress: 0,
        eligible: index < 2,
        evidence: emptyEvidence(),
      }
    })
    // Wire prerequisites so starter blocks unlock deeper blocks
    if (generatedNodes.length === 2) {
      generatedNodes[1].prerequisites = [generatedNodes[0].id]
      generatedNodes[1].eligible = false
    } else if (generatedNodes.length >= 3) {
      const rootIds = [generatedNodes[0].id, generatedNodes[1].id]
      generatedNodes[2].prerequisites = rootIds
      generatedNodes[2].eligible = false
      for (let i = 3; i < generatedNodes.length; i += 1) {
        generatedNodes[i].prerequisites = [generatedNodes[i - 1].id]
        generatedNodes[i].eligible = false
      }
    }
  } else {
    const focusLabel = capitalize((items[0] || trimmed).slice(0, 32))
    const n1 = slugify(`${focusLabel}-basics`, 1)
    const n2 = slugify(`${focusLabel}-context`, 2)
    const n3 = slugify(`${focusLabel}-apply`, 3)
    const n4 = slugify(`${focusLabel}-review`, 4)
    generatedNodes = [
      {
        id: n1,
        label: `${focusLabel}: Foundations`,
        description: `Core concepts and key rules for “${focusLabel}” from ${sourceTitle}.`,
        prerequisites: [],
        progress: 0,
        eligible: true,
        evidence: emptyEvidence(),
      },
      {
        id: n2,
        label: `${focusLabel}: Criteria`,
        description: `Identify what makes “${focusLabel}” complete and verifiable.`,
        prerequisites: [],
        progress: 0,
        eligible: true,
        evidence: emptyEvidence(),
      },
      {
        id: n3,
        label: `Apply: ${focusLabel}`,
        description: `Put “${focusLabel}” into practice on a concrete example from your notes.`,
        prerequisites: [n1, n2],
        progress: 0,
        eligible: false,
        evidence: emptyEvidence(),
      },
      {
        id: n4,
        label: `Evaluate & Transfer`,
        description: `Spot errors and adapt “${focusLabel}” to a new work scenario.`,
        prerequisites: [n3],
        progress: 0,
        eligible: false,
        evidence: emptyEvidence(),
      },
    ]
  }

  const generatedQuestions = buildQuestionsForNodes(generatedNodes, sourceTitle)
  const updatedTopic = refreshEligibility({
    ...topic,
    description: `Focused on: ${trimmed}`,
    updatedLabel: 'Shaped by AI partner',
    nodes: generatedNodes,
    questions: generatedQuestions,
    context: {
      ...topic.context,
      focus: trimmed.slice(0, 90),
    },
  })

  const blockNames = generatedNodes.map((n) => `“${n.label}”`).join(', ')
  return {
    topic: updatedTopic,
    assistantMessage: `Got it! I shaped your learning plan around your focus with ${generatedNodes.length} blocks (${blockNames}) and created tailored questions for each block. Hover over a ready block and click “Study now” to jump right in.`,
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
