# Design System & UI Specifications — MNRH ER-PED Calculator (Simple & Elegant Aesthetic)

## Design Tokens

### Light Theme Palette (`data-theme="light"`, default)

- `--bg`: `#F7F6F2` (Warm organic ivory canvas)
- `--card`: `#FFFFFF` (Crisp elevated white card surface)
- `--panel`: `#F1EEE7` (Soft warm neutral panel)
- `--panel-subtle`: `#FAF9F6` (Subtle tinted inset surface)
- `--ink`: `#181716` (High-contrast charcoal text)
- `--muted`: `#66625A` (Warm neutral grey secondary labels, WCAG AA compliant > 4.8:1 on card)
- `--border`: `#E6E2D8` (Subtle 1px structural border)
- `--border-strong`: `#D5CEBF` (High-visibility border for focused/active states)
- `--accent`: `#9E3D24` (Refined terracotta accent for primary actions, links & active underline states)
- `--accent-hover`: `#7D2E1A` (Darkened terracotta)
- `--accent-soft`: `#F9ECE6` (Subtle tint for active weight & highlight containers)
- `--accent-subtle`: `#FCF6F3` (Soft tinted container background)
- `--dark-btn`: `#242220` (Dark charcoal flat action button)
- `--good`: `#15803D` (Clinical safe green)
- `--good-soft`: `#ECFDF5` (Subtle safe tint)
- `--warning`: `#B45309` (Amber warning / Broselow indicator)
- `--warning-soft`: `#FFFBEB` (Subtle warning tint)
- `--danger`: `#DC2626` (Emergency PALS critical red)
- `--danger-soft`: `#FEF2F2` (Subtle emergency tint)

### Dark Theme Palette (`data-theme="dark"`)

- `--bg`: `#11100E` (Deep warm obsidian chassis, non-glare LCD/OLED)
- `--card`: `#1A1815` (Elevated slate card surface)
- `--panel`: `#23201B` (Warm inset panel)
- `--panel-subtle`: `#161412` (Subtle dark surface)
- `--ink`: `#ECE7DF` (Warm off-white text — non-glare, eye fatigue reduction)
- `--muted`: `#9B9488` (Warm neutral grey secondary label text)
- `--border`: `#322E27` (Subtle 1px border)
- `--border-strong`: `#443F35` (High-visibility dark border)
- `--accent`: `#E28E70` (Illuminated clay tuned for high dark contrast)
- `--accent-hover`: `#EEA58B` (Lightened clay for hover)
- `--accent-soft`: `#2B1D17` (Subtle dark clay tint)
- `--accent-subtle`: `#211611` (Soft container dark tint)
- `--dark-btn`: `#2A2723` (Tactile dark action button)
- `--good`: `#4ADE80` (Safe green)
- `--good-soft`: `#132717` (Subtle dark green tint)
- `--warning`: `#FBBF24` (Amber caution)
- `--warning-soft`: `#2B210E` (Subtle dark amber tint)
- `--danger`: `#F87171` (Urgent red)
- `--danger-soft`: `#2C1313` (Subtle dark red tint)

### Monochrome Theme Palette (`data-theme="mono"`)

- `--bg`: `#181816` (Grayscale matte dark chassis for JVC/ED hospital display panels)
- `--card`: `#20201E` (Elevated dark container surface)
- `--panel`: `#141412` (Inset dark surface panel)
- `--panel-subtle`: `#1C1C1A` (Subtle dark inset surface)
- `--ink`: `#F4F4F2` (High-contrast neutral white text)
- `--muted`: `#A6A6A0` (Grayscale secondary label text)
- `--border`: `#42423E` (Precision 1px grayscale border)
- `--border-strong`: `#74746E` (High-visibility border)
- `--accent`: `#ECECE8` (Off-white accent for primary actions and active control backgrounds)
- `--accent-soft`: `#2E2E2B` (Subtle grayscale container highlight tint)
- `--accent-subtle`: `#262624` (Soft grayscale container background)
- **Active Controls & Combobox Highlight**: Employs **Tonal Inversion** (`#ECECE8` background with `#121210` dark graphite text and `#FFFFFF` 2px outline for active tabs, pills, and dropdown selections), guaranteeing > 14:1 contrast ratio without color dependencies (Key Decision #36).

### Surface Shadows & Border Radii Scale

- `--shadow-1`: `0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.03)` (Micro card lift)
- `--shadow-2`: `0 2px 6px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)` (Medium component elevation)
- `--shadow-3`: `0 8px 24px rgba(0, 0, 0, 0.12), 0 3px 8px rgba(0, 0, 0, 0.06)` (Floating overlays, dropdowns, modals, and FAB)
- `--r-xs`: `4px`
- `--r-sm`: `7px`
- `--r-md`: `10px`
- `--r-lg`: `14px`
- `--r-xl`: `18px`
- `--r-full`: `9999px`

### Typography

- **Primary Body Font**: `'Sarabun'`, system-ui, sans-serif (Google Fonts Sarabun for optimal legibility).
- **Display Serif Font**: `'Newsreader'`, Georgia, serif (`--font-display`) — used for `h1`/`h2` module headings and topbar brand.
- **Monospace / Tabular Nums**: `'JetBrains Mono'`, monospace for digital readouts, active weight displays, and dosage badges.
- **Mobile Non-Zoom Font Sizing**: All interactive form inputs set to `16px` on mobile viewports (< 768px) to prevent iOS Safari viewport auto-zooming.
- **Weights**: Standardized steps 400 (regular), 500 (medium), 600 (semi-bold), 700 (bold), and 800 (bold tabular nums for hero metrics).

## UI States & Components

1. **Top Biometric Instrument Bar**: Sticky top bar with clean 1px border separation, containing inputs for ABW, Age (with `Yr`/`Mo` unit switch), Length, and dynamic `Wt for Ht`/Broselow badges.
2. **Zero-CLS Smooth-Scrolling Tab Rail**: Horizontal scrollable tab navigation with persistent labels across all viewports (never hides labels on inactive tabs) and automatic center scrolling (`btn.scrollIntoView`) on selection, achieving 0.00 Cumulative Layout Shift (Key Decision #46).
3. **Inline Lucide SVG Icon System**: Offline-first inline Lucide SVGs (`currentColor`, `stroke-width="2"`, `aria-hidden="true"`) replacing all live-UI text emojis across tabs, search inputs, toolbars, lock badges, and modals.
4. **Autocomplete Combobox with Quick-Clear**: Integrated single-input search dropdown with left-aligned search SVG icon, quick-clear (`✕`) touch button, real-time fuzzy filtering, drug category badges, and keyboard navigation.
5. **Shape-Coded Hero Dosage Metrics**: Digital readout blocks (`.hero-metric`) displaying key numbers (e.g., Epinephrine dose, Joule/kg, Fluid rate) with shape-coded status prefixes (`✓` safe, `▲` warning, `✕` danger, `ℹ` info) ensuring dual-channel accessibility for color-blind clinicians.
6. **High-Density Protocol Tables & Dose Badges**: `.protocol-table-wrapper` with responsive horizontal scrolling, sticky first columns (`position: sticky; left: 0`), subtle zebra striping (`color-mix`), and monospace `.dose-badge` tags across Seizure, Drip, Tox, PSA, Vitals, DKA, Asthma, and Broselow Equipment drawers.
7. **EHR Order Engine (background, no in-card UI surface)**: `copyEHROrder()`/`copyCustomOrder()` format standardized medical English prescription lines; per Key Decision #4 the in-card `📋 Copy` buttons were removed from the workstation view, but the formatter remains implemented and covered by JSDOM tests.
8. **Emergency PALS Floating Button**: Instant-access emergency action button (`PALS CODE`, `Alt+P`) anchored at bottom-right with flat solid red fill (`var(--danger)`).
9. **Interactive Broselow 9-Band Spectrum Visualizer & Drawer Panel**: Precision bottom drawer/modal with `background: var(--card)`, featuring a 9-band visual color spectrum strip (Grey, Pink, Red, Purple, Yellow, White, Blue, Orange, Green) with active patient indicator and 1-tap zone previewing (Key Decision #47).
10. **Universal Input & Selection Box State System**: Standardized Theme-Aware Focus & Dropdown System across all input, select, option, and combobox elements. Dynamic theme custom properties (`var(--card)`, `var(--ink)`, `var(--border)`), preventing white-on-white text collisions in focused state and guaranteeing high-contrast option dropdown lists in Light, Dark, and Mono modes.
11. **Category Jump Bar & Module Quick-Filter**: Dedicated `.category-bar` with tactile `.category-pill` buttons with inline Lucide SVGs (All Modules, Emergency Resus, Meds & Fluids, Protocols & Vitals) providing instant semantic navigation with dimmed state filtering for reduced visual clutter.
12. **Tactile Interaction & Accessible Focus System**: Comprehensive `:focus-visible` offset rings (3px outline, 2px offset) and physical compression tap states (`:active { transform: scale(0.97); }`) across all interactive buttons, pills, and switches.
13. **Asthma Protocol Stage Cards & HFNC Settings Panel**: `.stage-card` containers rendering 6-stage stepwise protocol with embedded `.protocol-table` drug dosing grids. Dedicated HFNC card with sky-blue left border (`#0ea5e9`) and auto-calculated settings. Color-coded severity assessment table headers (green Mild–Moderate, yellow Severe, red Life-Threatening).coding (Key Decision #48).
14. **Pediatric Electrolytes & Corrected Imbalance Panel (v1.10.0)**: Dedicated 13th tabpanel (`#electrolytes`, `Alt+E`) featuring a multi-section modular layout: Quick Correctors grid (3-column responsive cards for Corrected Na, Corrected Ca, and Baseline K+ shift), Deficit & Fluid Replacement table (3% NaCl bolus, Total Na deficit, Free water deficit, IV KCl slow piggyback, Oral KCl syrup, Bicarbonate deficit), Diagnostic Indices table (Anion Gap, Corrected AG, Delta Ratio, Osmolality/Osmolar Gap, FeNa, FeUrea, UAG, TTKG), Emergency Resuscitation Protocols (Hyperkalemia 3-Step Cocktail card with red accent left border, Hypokalemia Replacement Protocol & Piggyback Dilution card with warm accent left border, Calcium gluconate, MgSO4), and an interactive Age-Specific Reference Table with active age bracket highlighting (`var(--accent-soft)`).
