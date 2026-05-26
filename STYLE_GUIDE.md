# GideonAbochie Studio — Style Guide

## Design Tokens (CSS Custom Properties)

All CSS uses these tokens via `var(--token)`. Defined in `:root` across all stylesheets.

### Modular Type Scale (Major Third 1.25)

| Token | rem | px (16px base) | Usage |
|-------|-----|----------------|-------|
| `--text-2xs` | 0.688rem | 11px | Tiny badges, priority labels, meta |
| `--text-xs` | 0.813rem | 13px | Badges, nav links, table headers, meta |
| `--text-sm` | 0.875rem | 14px | Body text (admin), small body |
| `--text-base` | 1rem | 16px | Body text (public site) |
| `--text-lg` | 1.25rem | 20px | Card titles, subheadings |
| `--text-xl` | 1.563rem | 25px | Section headings (h3) |
| `--text-2xl` | 1.953rem | 31px | Page titles (h2), stat numbers |
| `--text-3xl` | 2.441rem | 39px | Hero titles (h1) |
| `--text-4xl` | 3.052rem | 49px | Large hero titles |

### Fluid Headings

| Token | Min | Mid | Max |
|-------|-----|-----|-----|
| `--heading-xl` | `clamp(1.953rem, 3vw, 3.052rem)` | 31px→49px |
| `--heading-lg` | `clamp(1.563rem, 2.5vw, 2.441rem)` | 25px→39px |
| `--heading-md` | `clamp(1.25rem, 2vw, 1.953rem)` | 20px→31px |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--leading-tight` | 1.15 | Headings, nav brand |
| `--leading-snug` | 1.35 | Cards, compact text |
| `--leading-normal` | 1.6 | Body text (default) |
| `--leading-relaxed` | 1.75 | Long-form content |

### Font Families

| Token | Stack | Usage |
|-------|-------|-------|
| `--font-heading` | `'Barlow Condensed', sans-serif` | All headings, CTAs, badges |
| `--font-body` | `'DM Sans', system-ui, -apple-system, sans-serif` | All body text, nav |
| `--font-serif` | `'Libre Baskerville', Georgia, serif` | Quoted content, accents |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--weight-normal` | 400 | Body text |
| `--weight-medium` | 500 | Nav links, mid-weight text |
| `--weight-semibold` | 600 | Section titles, card titles |
| `--weight-bold` | 700 | Page titles, stat numbers, CTAs |

### Spacing Scale (4px base)

| Token | PX | Usage |
|-------|-----|-------|
| `--space-1` | 4px | Micro spacing |
| `--space-2` | 8px | Tight gaps, small padding |
| `--space-3` | 12px | Button padding, compact gaps |
| `--space-4` | 16px | Standard padding, grid gaps |
| `--space-5` | 20px | Card padding, section breathing |
| `--space-6` | 24px | Section spacing, container padding |
| `--space-8` | 32px | Large section spacing |
| `--space-10` | 40px | Page section separation |
| `--space-12` | 48px | Major page sections |

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#0A1628` | Page background |
| `--bg-card` | `#0F1E38` | Card/panel backgrounds |
| `--bg-card-hover` | `#162540` | Card hover state |
| `--border` | `#1E3250` | Borders, dividers |
| `--border-light` | `#3A5278` | Subtle borders, disabled |
| `--gold` | `#C9A84C` | Primary accent, CTAs |
| `--gold-hover` | `#D9B85C` | Gold hover state |
| `--text-primary` | `#F1F5F9` | Primary text, headings |
| `--text-body` | `#CBD5E1` | Body text |
| `--text-muted` | `#5A7A9F` | Muted/secondary text |
| `--text-dim` | `#3A5278` | Placeholder, disabled |
| `--green` | `#34C77B` | Success, complete |
| `--red` | `#E8637A` | Error, delete, cancel |
| `--blue` | `#3B82F6` | Info, in-progress, agent |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Buttons, inputs, small elements |
| `--radius-md` | 10px | Cards, panels, modals |
| `--radius-lg` | 12px | Large containers, phase cards |
| `--content-max` | 1440px | Max-width for all page wrappers (`.container`, `.wrap`, `.page-wrap`) |

---

## Component Patterns

### Layout
- Max-width system: `--content-max: 1440px` applied to all page wrappers (`.container`, `.wrap`, `.page-wrap`)
- Wrappers centered with `margin: 0 auto; width: 100%`
- Nav backgrounds bleed full-width (hybrid approach) — `nav{position:fixed;top:0;left:0;right:0}`, inner `.container` constrained by `--content-max`
- Admin and public pages share the same max-width for consistency

### Buttons
```
Primary (gold-fill):   bg var(--gold), text var(--bg-primary), hover var(--gold-hover)
Outline:               border var(--gold), text var(--gold), hover fill gold
Ghost:                 border var(--border), text var(--text-muted), hover text white
```

### Cards
```
Admin cards:    bg var(--bg-card), border var(--border), radius var(--radius-md)
Step cards:     bg rgba(255,255,255,0.02), border rgba(255,255,255,0.04)
Hover:          border-color gold or translateY(-1px)
```

### Tables
```
Header:   bg var(--bg-primary), font 10px uppercase, color var(--text-muted)
Body:     font-size var(--text-sm), color var(--text-body)
Row:      border-bottom rgba(30,50,80,0.3), hover bg rgba(201,168,76,0.03)
```

### Status Pills
```
font-size: var(--text-xs) (12px), font-weight 600, uppercase
radius: 4px, padding: 3px 8px

live/done   → green at 12% bg
pending     → gold at 12% bg
future      → muted at 10% bg
error/cancel→ red at 12% bg
agent       → blue at 12% bg
```

---

## Responsive Breakpoints

| Breakpoint | Admin | Public |
|------------|-------|--------|
| max-width: 700px | Nav stacks, grids collapse to 1-2 cols | — |
| max-width: 640px | — | Mobile nav toggle appears |

---

## Dark Theme

All admin UI and public site default to dark theme:
- Background: `#0A1628` (deep navy)
- Cards: `#0F1E38` (slightly lighter)
- Borders: `#1E3250` (subtle blue-grey)
- Accent: `#C9A84C` (gold) for CTAs, highlights, active states

The public site supports `prefers-color-scheme: light` via media query.
No light theme is currently implemented for the admin panel.
