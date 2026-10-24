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

export type LearningQuestion = {
  id: string
  topicId: string
  title: string
  prompt: string
  stage: BloomStage
  mode: 'Solo' | 'Partner'
  duration: string
  status: 'recommended' | 'completed' | 'up-next'
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
  headline: string
  feedback: string
  evidenceLabel: string
  evidenceDelta: number
  nextActivity: string
  nextReason: string
  nextQuestionId: string
}

export type ChatMessage = { id: string; role: 'assistant' | 'user'; text: string }

export type SetupResult = {
  topic: Topic
  assistantMessage: string
}
