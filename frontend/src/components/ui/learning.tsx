import { useId, useState, type ReactNode } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Dialog } from '@base-ui/react/dialog'
import { ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronRight, Clock3, Info, UserRound, UsersRound, MessagesSquare, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Button } from './button'
import { Input } from './input'
import type { BloomStage, LearningMode } from '@/lib/learning-types'
import { bloomLabels } from '@/lib/learning-engine'
import type { TheoryContent } from '@/lib/learning-content'
import './learning.css'

export function LearningSurface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`learn-surface ${className}`}>{children}</section>
}

export function LearningReveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion()
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32, delay: reduced ? 0 : delay, ease: [.22, 1, .36, 1] }}>{children}</motion.div>
}

export function LearningPopover({ label, title, children, icon = true, iconOnly = false }: { label: string; title: string; children: ReactNode; icon?: boolean; iconOnly?: boolean }) {
  return <Popover.Root>
    <Popover.Trigger render={<Button variant="ghost" size={iconOnly ? 'icon-sm' : 'sm'} className="learn-disclosure" aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined} />}>
      {icon && <Info className="size-3.5" aria-hidden="true" />}{!iconOnly && label}
    </Popover.Trigger>
    <Popover.Portal><Popover.Positioner sideOffset={10} align="start" className="z-50"><Popover.Popup className="learn-popover">
      <div className="learn-popover-heading"><Popover.Title>{title}</Popover.Title><Popover.Close render={<Button variant="ghost" size="icon-sm" aria-label="Schliessen" />}><X className="size-4" /></Popover.Close></div>
      <div className="learn-popover-content">{children}</div>
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>
}

export function LearningStart({ open, minutes, onMinutes, onStart, onBack }: { open: boolean; minutes: number; onMinutes: (value: number) => void; onStart: () => void; onBack: () => void }) {
  return <Dialog.Root open={open}><Dialog.Portal><Dialog.Backdrop className="learn-start-backdrop" /><Dialog.Popup className="learn-start">
    <LearningStartContents minutes={minutes} onMinutes={onMinutes} onStart={onStart} onBack={onBack} />
  </Dialog.Popup></Dialog.Portal></Dialog.Root>
}

function LearningStartContents({ minutes, onMinutes, onStart, onBack }: { minutes: number; onMinutes: (value: number) => void; onStart: () => void; onBack: () => void }) {
  const inputId = useId()
  const [custom, setCustom] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('')
  const customValid = /^\d+$/.test(customMinutes) && Number(customMinutes) >= 5 && Number(customMinutes) <= 180
  const invalid = custom && !customValid
  return <>
    <span className="learn-start-icon"><Clock3 className="size-6" /></span>
    <Dialog.Title>Wie viel Zeit hast du?</Dialog.Title>
    <Dialog.Description>Eine kleine Einheit, die in deinen Tag passt. Theorie, Übung und Rückblick sind dabei.</Dialog.Description>
    <div className="learn-duration" role="group" aria-label="Zeit für diese Einheit">{[5, 15, 30].map((value) => <Button type="button" key={value} variant={!custom && minutes === value ? 'secondary' : 'outline'} aria-pressed={!custom && minutes === value} onClick={() => { setCustom(false); setCustomMinutes(String(value)); onMinutes(value) }}>{value} Min.</Button>)}</div>
    <div className="learn-custom-duration">
      <label htmlFor={inputId}>Eigene Dauer</label>
      <div className="learn-custom-duration-input"><Input id={inputId} type="number" inputMode="numeric" min={5} max={180} step={1} value={customMinutes} placeholder="Zum Beispiel 25" aria-invalid={invalid || undefined} aria-describedby={`${inputId}-hint`} onChange={(event) => {
        const value = event.target.value
        setCustom(true); setCustomMinutes(value)
        if (/^\d+$/.test(value) && Number(value) >= 5 && Number(value) <= 180) onMinutes(Number(value))
      }} /><span>Min.</span></div>
      <p id={`${inputId}-hint`} className={invalid ? 'learn-custom-duration-error' : ''} aria-live="polite">{invalid ? 'Bitte gib 5 bis 180 Minuten als ganze Zahl ein.' : '5 bis 180 Minuten'}</p>
    </div>
    <div className="learn-start-actions"><Button variant="ghost" onClick={onBack}>Zurück</Button><Button variant="primary" disabled={invalid} onClick={onStart}>Loslegen <ArrowUpRight className="size-4" /></Button></div>
  </>
}

export type LearningTab = 'Aufgabe' | 'Material'
export function LearningTabs({ value, onChange, children }: { value: LearningTab; onChange: (value: LearningTab) => void; children: ReactNode }) {
  const id = useId()
  const tabs: LearningTab[] = ['Aufgabe', 'Material']
  return <><div className="learn-tabs" role="tablist" aria-label="Aufgabe und Lernmaterial">{tabs.map((tab, index) => <Button key={tab} id={`${id}-${index}`} role="tab" aria-controls={`${id}-panel`} aria-selected={value === tab} tabIndex={value === tab ? 0 : -1} variant="ghost" onClick={() => onChange(tab)} onKeyDown={(event) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (next < 0) return
    event.preventDefault(); onChange(tabs[next]); document.getElementById(`${id}-${next}`)?.focus()
  }}>{tab}</Button>)}</div><div className="learn-tab-panel" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tabs.indexOf(value)}`}>{children}</div></>
}

export function LearningHelp({ content, viewed, onOpen, disabled = false }: { content: TheoryContent; viewed: boolean; onOpen: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const reduced = useReducedMotion()
  return <div className="learn-help">
    <div className="learn-help-toggle"><Button variant="ghost" size="sm" disabled={disabled} aria-expanded={open} aria-controls={id} aria-describedby={`${id}-notice`} onClick={() => { if (!open) onOpen(); setOpen((value) => !value) }}><BookOpen className="size-3.5" />{open ? 'Lernhilfe schliessen' : 'Lernhilfe öffnen'}</Button><span id={`${id}-notice`}>{viewed ? 'Als Unterstützung vermerkt' : 'Zählt als Unterstützung'}</span></div>
    <AnimatePresence initial={false}>{open && <motion.div id={id} key="help" role="region" aria-label="Lernhilfe" className="learn-theory learn-help-content" initial={reduced ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reduced ? 0 : .2 }}>
      <div className="learn-theory-heading"><BookOpen className="size-4" /><span>{content.minutes} Min. Erklärung</span></div><h2>{content.title}</h2><p>{content.principle}</p>{content.formula && <p className="learn-formula">{content.formula}</p>}<div className="learn-example"><div><span>Ausgangslage</span><p>{content.example.before}</p></div><div><span>Weitergedacht</span><p>{content.example.after}</p></div></div><p className="learn-theory-note">{content.example.explanation}</p><div className="learn-takeaway">{content.takeaway}</div><p className="learn-help-note">Dein nächster eigener Versuch zeigt, was du ohne Hilfe anwenden kannst.</p>
    </motion.div>}</AnimatePresence>
  </div>
}

export function LearningNavigation({ topic, onBack, minutes, budget, onBudget, phase, onFinish }: { topic: string; onBack: () => void; minutes: number; budget: number; onBudget: (minutes: number) => void; phase: 'question' | 'review' | 'summary'; onFinish: () => void }) {
  return <div className="learn-navigation">
    <div className="learn-breadcrumb"><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Lernpfad</Button><ChevronRight className="size-3 text-muted-foreground" /><span>{topic}</span></div>
    <div className="learn-navigation-actions">
      <LearningPopover label={`Noch ca. ${minutes} Min.`} title="Dein Zeitrahmen" icon={false}>
        <p>Heute hast du {budget} Minuten eingeplant. Theorie und ein kurzer Abschluss sind im Zeitplan berücksichtigt.</p>
        <Button variant="outline" size="sm" onClick={() => onBudget(5)}><Clock3 className="size-3.5" /> 5 Minuten ergänzen</Button>
      </LearningPopover>
      {phase !== 'summary' && <Button variant="ghost" size="sm" onClick={onFinish}>Für heute abschliessen <ArrowUpRight className="size-3.5" /></Button>}
    </div>
  </div>
}

const stages = ['Aufgabe', 'Dein Versuch', 'Rückmeldung', 'Nächster Schritt']
export function LearningSteps({ phase, hasAnswer }: { phase: 'question' | 'review' | 'summary'; hasAnswer: boolean }) {
  const current = phase === 'summary' ? 4 : phase === 'review' ? 2 : hasAnswer ? 1 : 0
  return <ol className="learn-steps" aria-label="Dein Lernablauf">
    {stages.map((stage, index) => <li key={stage} className={index < current ? 'is-complete' : index === current ? 'is-current' : ''} aria-current={index === current ? 'step' : undefined}>
      <span className="learn-step-number">{index < current ? <Check className="size-3" aria-hidden="true" /> : `0${index + 1}`}</span><span>{stage}</span>
    </li>)}
  </ol>
}

const modes = [
  { id: 'solo', label: 'Alleine', icon: UserRound },
  { id: 'coach', label: 'Mit KI', icon: MessagesSquare },
  { id: 'together', label: 'Zu zweit', icon: UsersRound },
] as const

export function LearningModes({ value, onChange, disabled }: { value: LearningMode; onChange: (mode: LearningMode) => void; disabled?: boolean }) {
  return <div className="learn-mode-switch" role="group" aria-label="Lernform wählen">
    {modes.map(({ id, label, icon: Icon }) => <Button type="button" key={id} variant={value === id ? 'secondary' : 'ghost'} aria-pressed={value === id} disabled={disabled} onClick={() => onChange(id)}><Icon className="size-3.5" aria-hidden="true" />{label}</Button>)}
  </div>
}

export function BloomIndicator({ stage }: { stage: BloomStage }) {
  return <LearningPopover label={bloomLabels[stage]} title="So denkst du in dieser Übung">
    <p>Bloom beschreibt sechs Arten, mit Wissen zu arbeiten. Heute übst du: <strong>{bloomLabels[stage]}.</strong></p>
    <div className="learn-bloom-list">{Object.entries(bloomLabels).map(([key, label]) => <span key={key} data-active={key === stage}>{label}</span>)}</div>
    <p>Die nächste Aufgabe richtet sich nach deinem Lernziel und deinen bisherigen Versuchen. Du musst nicht jede Stufe der Reihe nach durchlaufen.</p>
  </LearningPopover>
}
