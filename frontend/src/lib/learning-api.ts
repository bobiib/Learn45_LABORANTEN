import { ApiError, getApiUrl, isDemoMode, learningApi } from './api'
import { evaluatePractice } from './learning-engine'
import type { AnswerSubmission, ReviewResult } from './learning-types'

/** Only practice submissions differ from the team's shared API adapter. */
export const practiceApi = {
  rateDifficulty: learningApi.rateDifficulty,
  async submitAnswer(input: AnswerSubmission, signal?: AbortSignal): Promise<ReviewResult> {
    if (isDemoMode) {
      signal?.throwIfAborted()
      await new Promise<void>((resolve, reject) => {
        const abort = () => { window.clearTimeout(timer); reject(signal?.reason) }
        const timer = window.setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 550)
        signal?.addEventListener('abort', abort, { once: true })
      })
      return evaluatePractice(input)
    }
    const { attachment, ...withPreview } = input
    const selectedAnswers = input.activity?.options
      ?.filter((option) => input.selectedOptions?.includes(option.id))
      .map((option) => option.text) ?? []
    const answer = [input.answer, ...selectedAnswers, attachment ? undefined : input.attachmentText]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .join('\n\n')
      .slice(0, 12000)
    const payload = {
      questionId: input.questionId,
      answer: answer || (attachment ? `Eingereichte Arbeit: ${attachment.name}` : 'Ausgewählte Antwort eingereicht.'),
      selectedOptionIds: input.selectedOptions ?? [],
      hintsUsed: input.hintsUsed,
      tutorUsed: input.tutorUsed || input.supportUsed || input.theoryUsed || input.learningMode === 'coach',
      difficulty: input.difficulty,
      confidence: input.confidence ?? null,
    }
    const body = attachment ? new FormData() : JSON.stringify(payload)
    if (body instanceof FormData) {
      body.append('file', attachment!)
      body.append('submission', JSON.stringify(payload))
    }
    const controller = new AbortController()
    const abort = () => controller.abort(signal?.reason)
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
    const timer = window.setTimeout(() => controller.abort(new DOMException('Zeitlimit überschritten', 'TimeoutError')), 15000)
    try {
      const response = await fetch(getApiUrl('/questions/answer'), {
        method: 'POST', body, signal: controller.signal,
        headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { detail?: string; message?: string }
        throw new ApiError(error.detail ?? error.message ?? 'Dein Versuch konnte nicht geprüft werden.', response.status)
      }
      return await response.json() as ReviewResult
    } catch (error) {
      if (error instanceof ApiError || signal?.aborted) throw error
      throw new ApiError(controller.signal.reason?.name === 'TimeoutError' ? 'Die Prüfung dauert zu lange. Bitte versuche es erneut.' : 'Der Lerndienst ist nicht erreichbar. Bitte versuche es erneut.')
    } finally {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  },
}
