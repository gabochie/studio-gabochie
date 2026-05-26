# GideonAbochie Studio — Style Guide

## 1. Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#0A1628` | Page background |
| `--bg-card` | `#0F1E38` | Card / panel backgrounds |
| `--bg-card-hover` | `#162540` | Card hover state |
| `--border` | `#1E3250` | Borders, dividers |
| `--border-light` | `#3A5278` | Subtle borders, disabled states |
| `--gold` | `#C9A84C` | Primary accent, CTAs, highlights |
| `--gold-hover` | `#D9B85C` | Gold hover state |
| `--gold-dim` | `rgba(201,168,76,0.12)` | Gold backgrounds (badges, tags) |
| `--text-primary` | `#F1F5F9` | Primary text, headings |
| `--text-body` | `#CBD5E1` | Body text |
| `--text-muted` | `#5A7A9F` | Secondary / muted text |
| `--text-dim` | `#3A5278` | Placeholder, disabled text |
| `--green` | `#34C77B` | Success, complete states |
| `--red` | `#E8637A` | Error, delete, cancel |
| `--blue` | `#3B82F6` | Info, links, in-progress |

## 2. Typography

### Font Families

- **Headings:** `'Barlow Condensed', sans-serif` — condensed, uppercase, heavy weight
- **Body:** `'DM Sans', system-ui, -apple-system, sans-serif` — clean, readable

### Font Sizes

| Element | Size | Weight | Family |
|---------|------|--------|--------|
| Page title (h1) | `clamp(28px, 3vw, 36px)` | 700 | Barlow Condensed |
| Section title | `14px` | 600 | Barlow Condensed |
| Card title | `15px` | 600 | DM Sans |
| Body text | `13-14px` | 400 | DM Sans |
| Small / meta | `11-12px` | 500 | DM Sans |
| Tiny / badges | `9-10px` | 600 | DM Sans |
| Stat numbers | `30-32px` | 700 | Barlow Condensed |

### Common Patterns

- Page titles are UPPERCASE with letter-spacing: `-0.01em`
- Section titles are UPPERCASE with letter-spacing: `0.1em`
- Badges / tags are UPPERCASE with letter-spacing: `0.3-0.8px`

## 3. Layout

### Container Widths

| Context | Max Width |
|---------|-----------|
| Admin pages (wrap) | `1100px` |
| ToDo List (container) | `1100px` |
| Padding | `0 24px` (sides) |

### Grids

- **Stats row:** `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))` gap `14px`
- **Two-column:** `grid-template-columns: 1fr 1fr` gap `20px`
- **Tool cards:** `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))` gap `14px`

### Spacing

- Card padding: `18-20px`
- Section margin-bottom: `24-32px`
- Grid gaps: `14-20px`
- Border radius: `6px` (small), `10px` (cards), `12px` (large panels)

## 4. Components

### Cards
```
background: #0F1E38
border: 1px solid #1E3250
border-radius: 10px
padding: 18-20px
hover: translateY(-1px) OR border-color: gold
```

### Buttons
```
Primary (CTA):   bg #C9A84C, text #0A1628, hover #D9B85C
Outline:         border #C9A84C, text #C9A84C, hover fill gold
Ghost:           border #1E3250, text #5A7A9F, hover text white + border #3A5278
```

### Tables
```
Header:  bg #0A1628, font 10px uppercase, letter-spacing 0.5px, color #5A7A9F
Body:    font 13px, color #CBD5E1
Row hover: bg rgba(201,168,76,0.03)
```

### Badges / Pills
```
font-size: 9-10px
font-weight: 600
text-transform: uppercase
letter-spacing: 0.3-0.5px
border-radius: 4px
padding: 2-4px 8-10px
```

Status colors:
- `live` / `active` / `done` → green (#34C77B at 12% bg)
- `pending` → gold (#C9A84C at 12% bg)
- `future` / `planned` → muted (#5A7A9F at 10% bg)
- `error` / `cancel` → red (#E8637A at 12% bg)
- `agent` → blue (#3B82F6 at 12% bg)

### Phase / Step Cards (ToDo List)
```
Phase header: bg #0F1E38, cursor pointer, chevron toggle
Phase badge:  font 11px Barlow Condensed, uppercase, letter-spacing 0.15em
Step:         bg rgba(255,255,255,0.02), border rgba(255,255,255,0.04), border-radius 8px
Step check:   22px square, border #3A5278, checked fill gold
Progress bar: height 4px, bg #1E3250, fill gold
```

## 5. Admin Navigation

- Horizontal nav bar in header
- Active page: gold text + gold bg at 10%
- Link: 12px, color rgba(255,255,255,0.5), hover white
- Font: DM Sans 500

## 6. Dark Theme

All admin UI uses a dark theme:
- Background: `#0A1628` (deep navy)
- Cards: `#0F1E38` (slightly lighter navy)
- Lines: `#1E3250` (subtle blue-grey)
- Gold accent throughout for CTAs, highlights, active states

No light theme is currently supported.
