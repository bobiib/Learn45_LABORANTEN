# UI rules for this project

## Keep the interface consistent

- Use the shared `Button` from `frontend/src/components/ui/button.tsx` for every button. Do not add raw `<button>` elements elsewhere.
- Choose a `Button` variant (`primary`, `secondary`, `outline`, or `ghost`) instead of inventing button colors or states in a screen.
- The shared `Button` already includes hover, pressed (`active`), keyboard focus, disabled, and reduced-motion states. Do not remove or override them.
- Use the semantic theme utilities such as `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`, and `ring-ring`. Do not introduce one-off Tailwind palette colors (such as `stone-*` or `emerald-*`) in screens.
- Keep color, type, spacing, border, and radius decisions in the shared theme or UI components. If the team needs a new reusable visual pattern, add it once under `frontend/src/components/ui/` and reuse it.
- Prefer the existing hierarchy: clear page title, concise section label, one primary action per task, and short explanatory copy.
- All controls must remain usable with a keyboard and readable at mobile sizes. Keep visible focus indicators and native disabled semantics.

## Before handing off UI work

- Check the screen at a narrow mobile width and a desktop width.
- Confirm every action uses a shared component and communicates hover, pressed, focus, and disabled states where applicable.
