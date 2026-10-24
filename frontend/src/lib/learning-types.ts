import type { BloomStage } from './types'
export type { BloomStage, ChatMessage, LearningQuestion, Topic } from './types'

export type AnswerSubmission = {
  questionId: string
  answer: string
  hintsUsed: number
  tutorUsed: boolean
  theoryUsed?: boolean
  supportUsed?: boolean
  difficulty: 'too-easy' | 'about-right' | 'too-hard' | null
  activity?: LearningActivity
  selectedOptions?: string[]
  learningMode?: LearningMode
  attachment?: File
  attachmentText?: string
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
  criteria?: CriterionResult[]
  assessmentPending?: boolean
}

export type LearningMode = 'solo' | 'coach' | 'together'
export type ActivityFormat = 'write' | 'choose' | 'spot' | 'artifact'
export type ActivityCriterion = { id: string; label: string; explanation: string; pattern?: string }
export type CriterionResult = { id: string; label: string; met: boolean; explanation: string }
export type LearningActivity = {
  id: string
  skillId: string
  stage: BloomStage
  format: ActivityFormat
  title: string
  prompt: string
  minutes: number
  rationale: string
  scenario: { title: string; text: string; source: string }
  criteria: ActivityCriterion[]
  hints: string[]
  options?: { id: string; text: string; correct: boolean; explanation: string }[]
  selectCount?: number
  accept?: string
  fileLabel?: string
  transfer?: boolean
}

export type PracticeAttempt = {
  activityId: string
  skillId: string
  stage: BloomStage
  correctness: ReviewResult['correctness']
  supported: boolean
  mode: LearningMode
  at: number
}
