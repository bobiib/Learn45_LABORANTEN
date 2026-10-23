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

export function createTopicFromFile(fileName: string): Topic {
  return {
    ...initialTopic,
    id: `topic-${Date.now()}`,
    title: fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
    subject: 'New learning topic',
    description: 'A new learning plan shaped around Lea’s goals and uploaded notes.',
    progress: 0,
    updatedLabel: 'Just added',
    sources: [{ id: `source-${Date.now()}`, name: fileName, kind: fileName.split('.').pop()?.toUpperCase() ?? 'FILE', sizeLabel: 'Ready to process', addedLabel: 'Just added' }],
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
