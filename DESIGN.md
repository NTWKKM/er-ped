# Design System & UI Specifications — MNRH ER-PED Calculator (Anthropic-Derived Reading-First Aesthetic)

## Design Tokens

### Light Theme Palette (current, per Key Decision #32)

- `--bg`: `#F0EEE6` (Warm ivory background)
- `--card`: `#FBFAF7` (Off-white card surface)
- `--panel`: `#E8E5DA` (Tactile inset surface container)
- `--ink`: `#191919` (High-contrast graphite charcoal text)
- `--muted`: `#6B6862` (Neutral grey secondary labels)
- `--border`: `#DDD9CD` (Precision 1px tactile border)
- `--accent`: `#A8452A` (Muted clay accent for primary actions & active states)
- `--accent-hover`: `#7F321D` (Darkened clay)
- `--accent-soft`: `#F3E3DA` / `--accent-subtle`: `#F7EDE6` (Subtle tints for highlights)
- `--dark-btn`: `#2A2927` (Dark charcoal tactile action button)
- `--good`: `#0E7A38` (Clinical safe green)
- `--warning`: `#A85B05` (Amber warning / Broselow indicator)
- `--danger`: `#B91C1C` (Emergency PALS critical red)
- `--blue`: `#0B6BCB` (Dosing directive blue / informational accent)

### Dark Theme Palette (`data-theme="dark"`)

- `--bg`: `#171613` (Warm charcoal matte chassis, non-glare LCD/OLED)
- `--card`: `#26241F` (Warm elevated surface container)
- `--panel`: `#1E1C19` (Warm tactile inset panel)
- `--ink`: `#EAE5DB` (Warm off-white text — non-glare, eye fatigue reduction)
- `--muted`: `#A39C8E` (Warm neutral grey secondary label text)
- `--border`: `#3A3733` (Warm precision 1px border)
- `--border-dark`: `#59554D` (Warm dark border)
- `--accent`: `#DE9070` (Muted clay tuned for high dark contrast)
- `--accent-hover`: `#EFA98C` (Lightened clay for hover)
- `--accent-soft` / `--accent-subtle`: `#2C201A` (Subtle dark clay tint)
- `--dark-btn`: `#322F2A` (Tactile dark action button)
- `--blue`: `#7FA0B8` (Informational blue / accent2)
- `--good`: `#8FB07A` (Safe green)
- `--warning`: `#D9A94A` (Amber caution)
- `--danger`: `#F0705A` (Urgent red)
*(Note: Semantic colors use distinct clinical hues tuned for high contrast, legibility, and visual hierarchy on dark displays).*

### Monochrome Theme Palette (`data-theme="mono"`)

- `--bg`: `#1C1C1A` (Grayscale matte dark chassis for JVC/ED hospital display panels)
- `--card`: `#222220` (Elevated dark container surface)
- `--panel`: `#161614` (Inset dark surface panel)
- `--ink`: `#F2F2F0` (High-contrast neutral white text)
- `--muted`: `#A8A8A4` (Grayscale secondary label text)
- `--border`: `#4A4A47` (Precision 1px grayscale border)
- `--border-strong`: `#7A7A77` (High-visibility border)
- `--accent`: `#EAEAE6` (Off-white accent for primary actions and active control backgrounds)
- `--accent-soft` / `--accent-subtle`: `#333330` (Subtle grayscale container highlight tint)
- **Active Controls & Combobox Highlight**: Employs **Tonal Inversion** (`#EAEAE6` background with `#121210` dark graphite text and `#FFFFFF` 2px outline for active tabs, pills, and dropdown selections), guaranteeing > 14:1 contrast ratio without color dependencies (Key Decision #36).



### Typography

- **Primary Font**: `'Sarabun'`, system-ui, sans-serif (Google Fonts Sarabun for optimal legibility).
- **Display Font**: `'Newsreader'`, Georgia, serif (`--font-display`) — serif display face used for `h1`/`h2` module headings, per Key Decision #32.
- **Monospace / Tabular Nums**: `'JetBrains Mono'`, monospace for digital readouts and dosage metrics.
- **Weights**: Regular (400), Medium (500), Semi-bold (600), Bold (700), Extra-bold (800).

## UI States & Components

1. **Top Biometric Instrument Bar**: Sticky top bar formatted as an industrial control panel with inset fields for ABW, Age (with `Yr`/`Mo` unit switch), Length, and dynamic `Wt for Ht`/Broselow badges.
2. **Segmented Control Tabs**: Vintage radio-style depressed button toggles with active indicator in muted clay accent (`#A8452A`) and keyboard shortcut hints (`Alt+1..0`, `Alt+K`).
3. **Autocomplete Combobox**: Integrated single-input search dropdown with real-time fuzzy filtering, drug category badges, and keyboard navigation.
4. **Hero Dosage Metrics**: Prominent digital readout blocks (`.hero-metric`) displaying key numbers (e.g., Epinephrine dose, Joule/kg, Fluid rate) in bold tabular font for zero-latency scanning.
5. **EHR Order Engine (background, no in-card UI surface)**: `copyEHROrder()`/`copyCustomOrder()` format standardized medical English prescription lines; per Key Decision #4 the in-card `📋 Copy` buttons were removed from the workstation view, but the formatter remains implemented and covered by JSDOM tests.
6. **Emergency PALS Floating Button**: Instant-access emergency action button (`🚨 PALS CODE`, `Alt+P`) anchored at bottom-right in dark graphite & clay accents.
7. **Broselow Drawer Panel**: Precision bottom drawer with color-coded band headings and equipment grids sliding over content for quick reference.
8. **Universal Input & Selection Box State System**: Standardized Theme-Aware Focus & Dropdown System across all input, select, option, and combobox elements. Replaces static background fills with dynamic theme custom properties (`var(--card)`, `var(--ink)`, `var(--border)`), preventing white-on-white text collisions in focused state and guaranteeing high-contrast option dropdown lists in Light, Dark, and Mono modes (Key Decision #37).


