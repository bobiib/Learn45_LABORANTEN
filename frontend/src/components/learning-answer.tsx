import { useId, useRef, useState } from 'react'
import { Check, FileCode2, FileText, LoaderCircle, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { LearningActivity } from '@/lib/learning-types'

export type AnswerDraft = { text: string; selected: string[]; file?: File; fileName?: string; fileText?: string; reading?: boolean }
export const emptyDraft = (): AnswerDraft => ({ text: '', selected: [] })

export function canSubmitActivity(activity: LearningActivity, draft: AnswerDraft) {
  if (draft.reading) return false
  if (activity.format === 'artifact' && draft.fileName && !draft.file) return false
  if (activity.options && draft.selected.length !== activity.selectCount) return false
  if (activity.format === 'artifact' && activity.id.startsWith('q-python') && !draft.file) return false
  if (activity.format === 'artifact' && !draft.file && !draft.text.trim()) return false
  if ((activity.criteria.length > 0 || activity.format === 'write') && !draft.text.trim()) return false
  return !!(draft.text.trim() || draft.selected.length || draft.file)
}

export function LearningAnswer({ activity, draft, onChange, disabled, label = 'Dein Versuch', autoFocus = false }: { activity: LearningActivity; draft: AnswerDraft; onChange: (draft: AnswerDraft) => void; disabled?: boolean; label?: string; autoFocus?: boolean }) {
  const inputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)
  const [fileError, setFileError] = useState('')
  const [dragging, setDragging] = useState(false)
  const count = draft.text.trim().split(/\s+/).filter(Boolean).length
  const requiresReason = activity.criteria.length > 0
  const codeTask = activity.id.startsWith('q-python')

  async function selectFile(file?: File) {
    if (!file || disabled) return
    setFileError('')
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`
    const accepts = (activity.accept ?? '.txt,.md,.pdf,.docx,.py').split(',')
    if (!accepts.includes(extension)) {
      setFileError('Dieses Dateiformat passt nicht zur Aufgabe. Bitte wähle eines der angegebenen Formate.')
      return
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setFileError(file.size ? 'Die Datei ist zu gross. Bitte wähle eine Datei bis 5 MB.' : 'Die Datei ist leer. Bitte wähle eine Datei mit Inhalt.')
      return
    }
    const request = ++requestRef.current
    onChange({ ...draft, file, fileName: file.name, fileText: undefined, reading: true })
    try {
      const fileText = ['.txt', '.md', '.py'].includes(extension) ? await file.text() : undefined
      if (request === requestRef.current) onChange({ ...draft, file, fileName: file.name, fileText, reading: false })
    } catch {
      if (request === requestRef.current) {
        onChange({ ...draft, file: undefined, fileName: undefined, fileText: undefined, reading: false })
        setFileError('Die Datei konnte nicht gelesen werden. Bitte wähle sie erneut.')
      }
    }
  }

  function toggleOption(id: string) {
    const selected = activity.selectCount === 1 ? [id] : draft.selected.includes(id) ? draft.selected.filter((value) => value !== id) : [...draft.selected, id]
    onChange({ ...draft, selected })
  }

  return <div>
    {activity.options && <div className="learn-choice-list" role="group" aria-label={activity.format === 'spot' ? 'Unbelegte Aussagen markieren' : 'Antwort auswählen'}>
      <div className="learn-answer-heading"><span>{activity.format === 'spot' ? 'Markiere im KI-Ergebnis' : 'Deine Auswahl'}</span><span>{draft.selected.length} / {activity.selectCount} gewählt</span></div>
      {activity.options.map((option, index) => <Button type="button" key={option.id} variant={draft.selected.includes(option.id) ? 'secondary' : 'outline'} className="learn-choice" aria-pressed={draft.selected.includes(option.id)} disabled={disabled} onClick={() => toggleOption(option.id)}>
        <span className="learn-choice-letter">{String.fromCharCode(65 + index)}</span><span className="learn-choice-copy">{option.text}</span>{draft.selected.includes(option.id) && <Check className="size-4 learn-choice-check" aria-hidden="true" />}
      </Button>)}
    </div>}

    {activity.format === 'artifact' && <>
      <input ref={fileRef} id={`${inputId}-file`} type="file" className="sr-only" tabIndex={-1} accept={activity.accept} disabled={disabled || draft.reading} onChange={(event) => { void selectFile(event.target.files?.[0]); event.target.value = '' }} aria-label="Eigene Arbeit hochladen" />
      <div className={`learn-file-drop ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void selectFile(event.dataTransfer.files[0]) }}>
        {draft.file ? <>
          <div className="learn-file-row"><div className="flex min-w-0 items-center gap-3"><span className="learn-file-icon">{codeTask ? <FileCode2 className="size-5" /> : <FileText className="size-5" />}</span><div className="min-w-0"><strong>{draft.file.name}</strong><small>{(draft.file.size / 1024).toFixed(1)} KB · {draft.reading ? 'Wird gelesen …' : 'Für diesen Versuch ausgewählt'}</small></div></div><Button variant="ghost" size="icon" type="button" aria-label="Datei entfernen" disabled={disabled || draft.reading} onClick={() => { ++requestRef.current; onChange({ ...draft, file: undefined, fileName: undefined, fileText: undefined }); setFileError('') }}><X className="size-4" /></Button></div>
          {draft.fileText && <details><summary className="mt-2 text-left text-xs text-muted-foreground cursor-pointer">Dateiinhalt ansehen</summary><pre className="learn-file-preview">{draft.fileText.slice(0, 4000)}{draft.fileText.length > 4000 ? '\n… Vorschau gekürzt' : ''}</pre></details>}
        </> : <>
          <span className="learn-file-icon"><Upload className="size-5" aria-hidden="true" /></span><h3>Deine Arbeit gehört hierher.</h3><p>Datei hier ablegen oder vom Computer auswählen.</p><p>{activity.fileLabel}</p><Button type="button" variant="outline" disabled={disabled} onClick={() => fileRef.current?.click()}>Datei auswählen <Upload className="size-3.5" /></Button>
        </>}
      </div>
      {draft.reading && <p className="learn-loading" role="status"><LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" /> Datei wird vorbereitet …</p>}
      {fileError && <p className="learn-inline-error" role="alert">{fileError}</p>}
      <p className="learn-footnote">{codeTask ? 'Code wird hier nicht ausgeführt. Die fachliche Prüfung folgt im Backend.' : 'Dateien bleiben in dieser Sitzung; Dokumente brauchen eine fachliche Prüfung.'}</p>
    </>}

    {(!activity.options || requiresReason) && <div className="learn-answer-area">
      <div className="learn-answer-heading"><label htmlFor={inputId}>{activity.options ? 'Was ist deine Begründung?' : activity.format === 'artifact' ? draft.file ? 'Wie hast du deine Arbeit geprüft?' : codeTask ? 'Beschreibe deine Testfälle' : 'Vorlage oder kurze Erläuterung' : label}</label><span>{count ? `${count} Wörter` : activity.options ? 'Ein Satz reicht.' : 'In deinen Worten.'}</span></div>
      <Textarea id={inputId} className="learn-input" rows={activity.options ? 3 : 6} disabled={disabled || draft.reading} value={draft.text} autoFocus={autoFocus} onChange={(event) => onChange({ ...draft, text: event.target.value })} placeholder={activity.options ? 'Ich entscheide mich dafür, weil …' : activity.format === 'artifact' ? codeTask ? 'Für einen Sieg teste ich … Für ein Unentschieden …' : 'Schreibe deine Vorlage hier oder erläutere die hochgeladene Datei …' : codeTask ? 'Mein Testfall … Das erwartete Ergebnis …' : 'Halte deinen Gedanken hier fest …'} />
    </div>}
  </div>
}
