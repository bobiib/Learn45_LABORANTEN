export type BloomStage = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create'

export type BloomEvidence = Record<BloomStage, number>

export type LearnerContext = {
  examDate: string
  timeAvailable: string
  preferredLength: 'Short' | 'Balanced' | 'Detailed'
  tutorEnabled: boolean
  focus: string
}

export type SourceMaterial = {
  id: string
  name: string
  kind: string
  sizeLabel: string
  addedLabel: string
}

export type TopicNode = {
  id: string
  label: string
  description: string
  prerequisites: string[]
  progress: number
  eligible: boolean
  evidence: BloomEvidence
}

export type SourceReference = { sourceName: string; location: string; excerpt: string }

export type LearningQuestion = {
  id: string
  topicId: string
  title: string
  prompt: string
  /** Identifies the renderer; new activity types can be added without changing the question's stable ID. */
  questionType?: string
  /** Type-specific, JSON-serializable content for future activities such as projects. */
  content?: Record<string, unknown>
  reasoningGraph?: { nodes: { id: string; step: string }[]; edges: { source: string; target: string; deduction: string }[] }
  stage: BloomStage
  mode: 'Solo' | 'Partner'
  duration: string
  status: 'recommended' | 'completed' | 'up-next'
  difficultyLabel?: 'Hard' | 'Just right' | 'Easy'
  sources?: SourceReference[]
}

export type Topic = {
  id: string
  title: string
  subject: string
  description: string
  updatedLabel: string
  progress: number
  sources: SourceMaterial[]
  nodes: TopicNode[]
  questions: LearningQuestion[]
  context: LearnerContext
}

export type DashboardData = {
  learnerName: string
  streak: number
  studyMinutes: number
  weeklyGoalMinutes: number
  completedSessions: number
  topics: Topic[]
  lastSession: { topicId: string; title: string; detail: string; progress: number }
}

export type AnswerSubmission = {
  questionId: string
  answer: string
  hintsUsed: number
  tutorUsed: boolean
  difficulty: 'too-easy' | 'about-right' | 'too-hard' | null
}

export type ReviewResult = {
  correctness: 'strong' | 'partial' | 'incorrect'
  estimatedPointsPercent: number
  headline: string
  feedback: string
  evidenceLabel: string
  evidenceDelta: number
  nextActivity: string
  nextReason: string
  nextQuestionId: string
  sources?: SourceReference[]
}

export type QuestionRecommendation = { question: LearningQuestion | null; reason: string; generated: boolean }

export type ChatMessage = { id: string; role: 'assistant' | 'user'; text: string }

export type TopicChangeSet = {
  assistantMessage: string
  proposalType: 'requested' | 'alternative'
  baseVersion: string
  topic: { title?: string | null; subject?: string | null; description?: string | null }
  context: Partial<LearnerContext>
  nodes: { id: string; label?: string | null; description?: string | null; prerequisites?: string[] | null }[]
  questions: { id: string; title?: string | null; prompt?: string | null; stage?: BloomStage | null; mode?: 'Solo' | 'Partner' | null; durationMinutes?: number | null; sources?: SourceReference[] | null }[]
  addNodes: { key: string; label: string; description: string; prerequisites: string[] }[]
  addQuestions: { nodeRef: string; title: string; prompt: string; stage: BloomStage; mode: 'Solo' | 'Partner'; durationMinutes: number; sources?: SourceReference[] }[]
  deleteNodeIds: string[]
  deleteQuestionIds: string[]
}

export type TopicProposalResult = { assistantMessage: string; proposal: TopicChangeSet }

export type SetupResult = {
  topic: Topic
  assistantMessage: string
}
