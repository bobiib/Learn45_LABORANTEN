import type { LearnerContext } from './types'

const CONTEXT_KEY = 'learn45.learner-context.v1'

export function readLearnerContext(fallback: LearnerContext): LearnerContext {
  try {
    const value = window.localStorage.getItem(CONTEXT_KEY)
    return value ? { ...fallback, ...JSON.parse(value) as Partial<LearnerContext> } : fallback
  } catch {
    return fallback
  }
}

export function writeLearnerContext(context: LearnerContext) {
  window.localStorage.setItem(CONTEXT_KEY, JSON.stringify(context))
}
