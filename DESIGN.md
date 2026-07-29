# Design System & UI Specifications — MNRH ER-PED Calculator (Anthropic-Derived Reading-First Aesthetic)

## Design Tokens

### Light Theme Palette (current, per Key Decision #32)
- `--bg`: `#F0EEE6` (Warm ivory background)
- `--card`: `#FBFAF7` (Off-white card surface)
- `--panel`: `#E8E5DA` (Tactile inset surface container)
- `--ink`: `#1E1E1E` (High-contrast graphite charcoal text)
- `--muted`: `#666563` (Neutral grey secondary labels)
- `--border`: `#D5D3CE` (Precision 1px tactile border)
- `--accent`: `#A8452A` (Muted clay accent for primary actions & active states)
- `--accent-hover`: `#7F321D` (Darkened clay)
- `--accent-soft`: `#F3E3DA` / `--accent-subtle`: `#F7EDE6` (Subtle tints for highlights)
- `--dark-btn`: `#2A2927` (Dark charcoal tactile action button)
- `--good`: `#16A34A` (Clinical safe green)
- `--warning`: `#D97706` (Amber warning / Broselow indicator)
- `--danger`: `#DC2626` (Emergency PALS critical red)
- `--blue`: `#2563EB` (Dosing directive blue)

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
- `--blue`: `#7FA0B8` (L≈0.19 — calmest, informational)
- `--good`: `#8FB07A` (L≈0.26 — safe green)
- `--warning`: `#D9A94A` (L≈0.38 — amber caution)
- `--danger`: `#F0705A` (L≈0.41 — highest luminance urgent red)
*(Note: Semantic colors are ordered by escalating relative luminance `blue < good < warning < danger` so urgency maps strictly to visual brightness even on monochrome/grayscale clinical displays).*

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

