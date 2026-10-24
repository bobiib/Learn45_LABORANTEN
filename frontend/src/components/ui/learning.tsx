import type { ReactNode } from 'react'
import { Popover } from '@base-ui/react/popover'
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Clock3, Info, UserRound, UsersRound, MessagesSquare, X } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from './button'
import type { BloomStage, LearningMode } from '@/lib/types'
import { bloomLabels } from '@/lib/learning-engine'
import './learning.css'

export function LearningSurface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`learn-surface ${className}`}>{children}</section>
}

export function LearningReveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion()
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32, delay: reduced ? 0 : delay, ease: [.22, 1, .36, 1] }}>{children}</motion.div>
}

export function LearningPopover({ label, title, children, icon = true }: { label: string; title: string; children: ReactNode; icon?: boolean }) {
  return <Popover.Root>
    <Popover.Trigger render={<Button variant="ghost" size="sm" className="learn-disclosure" />}>
      {icon && <Info className="size-3.5" aria-hidden="true" />}{label}
    </Popover.Trigger>
    <Popover.Portal><Popover.Positioner sideOffset={10} align="start" className="z-50"><Popover.Popup className="learn-popover">
      <div className="learn-popover-heading"><Popover.Title>{title}</Popover.Title><Popover.Close render={<Button variant="ghost" size="icon-sm" aria-label="Schliessen" />}><X className="size-4" /></Popover.Close></div>
      <div className="learn-popover-content">{children}</div>
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>
}

export function LearningNavigation({ topic, onBack, minutes, budget, onBudget, phase, onFinish }: { topic: string; onBack: () => void; minutes: number; budget: number; onBudget: (minutes: number) => void; phase: 'question' | 'review' | 'summary'; onFinish: () => void }) {
  return <div className="learn-navigation">
    <div className="learn-breadcrumb"><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Lernpfad</Button><ChevronRight className="size-3 text-muted-foreground" /><span>{topic}</span></div>
    <div className="learn-navigation-actions">
      <LearningPopover label={`Noch ca. ${minutes} Min.`} title="Dein Zeitrahmen" icon={false}>
        <p>Heute hast du {budget} Minuten eingeplant. Zwei Minuten bleiben für einen guten Abschluss reserviert.</p>
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
