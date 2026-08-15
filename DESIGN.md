# Design System & UI Specifications — MNRH ER-PED Calculator (Minimal Design Aesthetic)

## Design Tokens

### Light Theme Palette (current, per Key Decision #32, #38, & #46)

- `--bg`: `#F0EEE6` (Warm ivory background)
- `--card`: `#FBFAF7` (Off-white card surface)
- `--panel`: `#E8E5DA` (Flat inset container surface)
- `--ink`: `#191919` (High-contrast graphite charcoal text)
- `--muted`: `#57534E` (Neutral grey secondary labels, WCAG AA compliant > 4.8:1 on card)
- `--border`: `#DDD9CD` (Single 1px flat structural border)
- `--accent`: `#A8452A` (Muted clay accent for primary actions, links & active underline states)
- `--accent-hover`: `#7F321D` (Darkened clay)
- `--accent-soft`: `#F3E3DA` (Subtle tint for active weight & highlight containers)
- `--dark-btn`: `#2A2927` (Dark charcoal flat action button)
- `--good`: `#0E7A38` (Clinical safe green)
- `--warning`: `#A85B05` (Amber warning / Broselow indicator)
- `--danger`: `#B91C1C` (Emergency PALS critical red)
*(Note: `--accent2` and `--blue` collapsed into `--ink` / `--accent` to streamline the semantic color set while keeping all 4 clinical safety colors distinct).*

### Dark Theme Palette (`data-theme="dark"`)

- `--bg`: `#171613` (Warm charcoal matte chassis, non-glare LCD/OLED)
- `--card`: `#26241F` (Warm elevated surface container)
- `--panel`: `#1E1C19` (Warm inset panel)
- `--ink`: `#EAE5DB` (Warm off-white text — non-glare, eye fatigue reduction)
- `--muted`: `#A39C8E` (Warm neutral grey secondary label text)
- `--border`: `#3A3733` (Warm precision 1px border)
- `--accent`: `#DE9070` (Muted clay tuned for high dark contrast)
- `--accent-hover`: `#EFA98C` (Lightened clay for hover)
- `--accent-soft`: `#2C201A` (Subtle dark clay tint)
- `--dark-btn`: `#322F2A` (Tactile dark action button)
- `--good`: `#8FB07A` (Safe green)
- `--warning`: `#D9A94A` (Amber caution)
- `--danger`: `#F0705A` (Urgent red)

### Monochrome Theme Palette (`data-theme="mono"`)

- `--bg`: `#1C1C1A` (Grayscale matte dark chassis for JVC/ED hospital display panels)
- `--card`: `#222220` (Elevated dark container surface)
- `--panel`: `#161614` (Inset dark surface panel)
- `--ink`: `#F2F2F0` (High-contrast neutral white text)
- `--muted`: `#A8A8A4` (Grayscale secondary label text)
- `--border`: `#4A4A47` (Precision 1px grayscale border)
- `--border-strong`: `#7A7A77` (High-visibility border)
- `--accent`: `#EAEAE6` (Off-white accent for primary actions and active control backgrounds)
- `--accent-soft`: `#333330` (Subtle grayscale container highlight tint)
- **Active Controls & Combobox Highlight**: Employs **Tonal Inversion** (`#EAEAE6` background with `#121210` dark graphite text and `#FFFFFF` 2px outline for active tabs, pills, and dropdown selections), guaranteeing > 14:1 contrast ratio without color dependencies (Key Decision #36).

### Surface Shadows

- `--shadow-1`: `none` (No shadows on document-flow cards, tabs, inputs, or hero metrics)
- `--shadow-2`: `0 1px 2px rgba(0,0,0,.05)` (Minimal flat shadow reserved strictly for floating overlays, modals, popovers, and dropdowns)

### Typography

- **Primary Font**: `'Sarabun'`, system-ui, sans-serif (Google Fonts Sarabun for optimal legibility).
- **Display Font**: `'Newsreader'`, Georgia, serif (`--font-display`) — serif display face used for `h1`/`h2` module headings, per Key Decision #32.
- **Monospace / Tabular Nums**: `'JetBrains Mono'`, monospace for digital readouts and dosage metrics.
- **Mobile Non-Zoom Font Sizing**: All interactive form inputs set to `16px` on mobile viewports (< 768px) to prevent iOS Safari viewport auto-zooming.
- **Weights**: Standardized steps 400 (regular), 600 (semi-bold), 700 (bold), and 800 (bold tabular nums for hero metrics).

## UI States & Components

1. **Top Biometric Instrument Bar**: Sticky top bar with clean 1px border separation, containing inputs for ABW, Age (with `Yr`/`Mo` unit switch), Length, and dynamic `Wt for Ht`/Broselow badges.
2. **Zero-CLS Smooth-Scrolling Tab Rail**: Horizontal scrollable tab navigation with persistent labels across all viewports (never hides labels on inactive tabs) and automatic center scrolling (`btn.scrollIntoView`) on selection, achieving 0.00 Cumulative Layout Shift (Key Decision #46).
3. **Inline Lucide SVG Icon System**: Offline-first inline Lucide SVGs (`currentColor`, `stroke-width="2"`, `aria-hidden="true"`) replacing all live-UI text emojis across tabs, search inputs, toolbars, lock badges, and modals.
4. **Autocomplete Combobox with Quick-Clear**: Integrated single-input search dropdown with left-aligned search SVG icon, quick-clear (`✕`) touch button, real-time fuzzy filtering, drug category badges, and keyboard navigation.
5. **Flatter Hero Dosage Metrics**: Digital readout blocks (`.hero-metric`) displaying key numbers (e.g., Epinephrine dose, Joule/kg, Fluid rate) on flat backgrounds with border-left severity indicators and WCAG AA compliant sub-labels.
6. **High-Density Protocol Tables & Dose Badges**: `.protocol-table-wrapper` with responsive horizontal scrolling, `.protocol-table` headers and cells, and monospace `.dose-badge` tags across Seizure, Drip, Tox, PSA, Vitals, DKA, and Broselow Equipment drawers.
7. **EHR Order Engine (background, no in-card UI surface)**: `copyEHROrder()`/`copyCustomOrder()` format standardized medical English prescription lines; per Key Decision #4 the in-card `📋 Copy` buttons were removed from the workstation view, but the formatter remains implemented and covered by JSDOM tests.
8. **Emergency PALS Floating Button**: Instant-access emergency action button (`PALS CODE`, `Alt+P`) anchored at bottom-right with flat solid red fill (`var(--danger)`).
9. **Theme-Aware Broselow Drawer Panel**: Precision bottom drawer/modal with `background: var(--card)` and `color: var(--ink)`, color-coded band headings and equipment grid table.
10. **Universal Input & Selection Box State System**: Standardized Theme-Aware Focus & Dropdown System across all input, select, option, and combobox elements. Replaces static background fills with dynamic theme custom properties (`var(--card)`, `var(--ink)`, `var(--border)`), preventing white-on-white text collisions in focused state and guaranteeing high-contrast option dropdown lists in Light, Dark, and Mono modes (Key Decision #37).
