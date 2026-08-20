# Design System & UI Specifications — MNRH ER-PED Calculator (Simple & Elegant Aesthetic)

## Design Tokens

### Light Theme Palette (`data-theme="light"`, default)

- `--bg`: `#F6F5F0` (Warm organic ivory background)
- `--card`: `#FFFFFF` (Crisp elevated white card surface)
- `--panel`: `#F0EDE4` (Soft warm inset panel)
- `--panel-hover`: `#E8E4D8` (Interactive inset hover)
- `--ink`: `#1A1917` (High-contrast graphite charcoal text)
- `--muted`: `#5C5850` (Warm neutral grey secondary labels, WCAG AA compliant > 4.8:1 on card)
- `--border`: `#E3DFD5` (Subtle 1px structural border)
- `--border-strong`: `#CDC7B8` (High-visibility border for focused/active states)
- `--accent`: `#9E3D24` (Refined terracotta accent for primary actions, links & active underline states)
- `--accent-hover`: `#7A2E1A` (Darkened terracotta)
- `--accent-soft`: `#FBECE7` (Subtle tint for active weight & highlight containers)
- `--accent-subtle`: `#F5DCD4` (Soft tinted container background)
- `--dark-btn`: `#23211E` (Dark charcoal flat action button)
- `--dark-btn-hover`: `#383530` (Dark action button hover)
- `--good`: `#166534` (Clinical safe green)
- `--good-soft`: `#DCFCE7` (Subtle safe tint)
- `--warning`: `#854D0E` (Amber warning / Broselow indicator)
- `--warning-soft`: `#FEF9C3` (Subtle warning tint)
- `--danger`: `#991B1B` (Emergency PALS critical red)
- `--danger-soft`: `#FEE2E2` (Subtle emergency tint)
- `--blue`: `#1D4ED8` (Clinical diagnostic blue)
- `--blue-soft`: `#DBEAFE` (Subtle blue tint)

### Dark Theme Palette (`data-theme="dark"`)

- `--bg`: `#12110F` (Deep warm obsidian chassis, non-glare LCD/OLED)
- `--card`: `#1C1A17` (Elevated slate card surface)
- `--panel`: `#24221D` (Warm inset panel)
- `--panel-hover`: `#2E2B25` (Interactive inset hover)
- `--ink`: `#ECE8E1` (Warm off-white text — non-glare, eye fatigue reduction)
- `--muted`: `#A0998B` (Warm neutral grey secondary label text)
- `--border`: `#35322B` (Subtle 1px border)
- `--border-strong`: `#4D483E` (High-visibility dark border)
- `--accent`: `#E08E70` (Illuminated clay tuned for high dark contrast)
- `--accent-hover`: `#EBB09B` (Lightened clay for hover)
- `--accent-soft`: `#302019` (Subtle dark clay tint)
- `--accent-subtle`: `#3D271E` (Soft container dark tint)
- `--dark-btn`: `#2D2A24` (Tactile dark action button)
- `--dark-btn-hover`: `#3A362E` (Dark button hover)
- `--good`: `#4ADE80` (Safe green)
- `--good-soft`: `#143520` (Subtle dark green tint)
- `--warning`: `#FACC15` (Amber caution)
- `--warning-soft`: `#382E0B` (Subtle dark amber tint)
- `--danger`: `#F87171` (Urgent red)
- `--danger-soft`: `#3B1A1A` (Subtle dark red tint)
- `--blue`: `#60A5FA` (Diagnostic blue)
- `--blue-soft`: `#172A45` (Subtle dark blue tint)

### Monochrome Theme Palette (`data-theme="mono"`)

- `--bg`: `#121210` (Grayscale matte dark chassis for JVC/ED hospital display panels)
- `--card`: `#1C1C1A` (Elevated dark container surface)
- `--panel`: `#252522` (Inset dark surface panel)
- `--panel-hover`: `#30302C` (Interactive inset hover)
- `--ink`: `#F5F5F2` (High-contrast neutral white text)
- `--muted`: `#A0A09B` (Grayscale secondary label text)
- `--border`: `#42423E` (Precision 1px grayscale border)
- `--border-strong`: `#73736C` (High-visibility border)
- `--accent`: `#EAEAE6` (Off-white accent for primary actions and active control backgrounds)
- `--accent-soft`: `#2C2C28` (Subtle grayscale container highlight tint)
- `--accent-subtle`: `#363632` (Soft grayscale container background)
- **Active Controls & Combobox Highlight**: Employs **Tonal Inversion** (`#EAEAE6` background with `#121210` dark graphite text and `#FFFFFF` 2px outline for active tabs, pills, and dropdown selections), guaranteeing > 14:1 contrast ratio without color dependencies (Key Decision #36).

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

