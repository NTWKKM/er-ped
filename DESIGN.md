# Design System & UI Specifications — MNRH ER-PED Calculator (Clinical Precision Cockpit)

## Design Tokens

### Light Theme Palette (`data-theme="light"`, default)

- `--bg`: `#F8FAFC` (Slate-50: Crisp, clean, non-glare clinical canvas)
- `--card`: `#FFFFFF` (Elevated crisp white card surface)
- `--panel`: `#F1F5F9` (Slate-100: Soft cool neutral surgical panel)
- `--panel-subtle`: `#F8FAFC` (Slate-50 inset surface)
- `--ink`: `#0F172A` (Slate-900: High-contrast dark charcoal text, > 15:1 contrast)
- `--muted`: `#475569` (Slate-600: Crisp secondary labels, WCAG AA compliant > 5.5:1)
- `--border`: `#E2E8F0` (Slate-200: Subtle 1px precision border)
- `--border-strong`: `#CBD5E1` (Slate-300: High-visibility border for focused/active states)
- `--accent`: `#0284C7` (Sky-600: Clinical precision sky blue for primary actions & active states)
- `--accent-hover`: `#0369A1` (Sky-700: Darkened sky blue)
- `--accent-soft`: `#E0F2FE` (Sky-100: Subtle tint for active weight & highlight containers)
- `--accent-subtle`: `#F0F9FF` (Sky-50: Soft tinted container background)
- `--dark-btn`: `#0F172A` (Slate-900: High-contrast tactile action button)
- `--good`: `#16A34A` (Clinical safe green)
- `--good-soft`: `#F0FDF4` (Subtle safe tint)
- `--warning`: `#D97706` (Amber caution / Broselow indicator)
- `--warning-soft`: `#FFFBEB` (Subtle warning tint)
- `--danger`: `#DC2626` (Emergency PALS critical red)
- `--danger-soft`: `#FEF2F2` (Subtle emergency tint)

### Dark Theme Palette (`data-theme="dark"`)

- `--bg`: `#0B0F17` (Deep slate obsidian chassis, non-glare LCD/OLED)
- `--card`: `#111827` (Slate-900 elevated card surface)
- `--panel`: `#1E293B` (Slate-800 inset panel)
- `--panel-subtle`: `#0F172A` (Slate-950 subtle dark surface)
- `--ink`: `#F8FAFC` (Slate-50 luminous non-glare text)
- `--muted`: `#94A3B8` (Slate-400 secondary label text, > 5.2:1 contrast)
- `--border`: `#1E293B` (Slate-800 subtle 1px border)
- `--border-strong`: `#334155` (Slate-700 high-visibility dark border)
- `--accent`: `#38BDF8` (Sky-400: Illuminated precision blue for dark mode contrast)
- `--accent-hover`: `#7DD3FC` (Sky-300: Lightened sky blue for hover)
- `--accent-soft`: `#0C2B47` (Dark sky container tint)
- `--accent-subtle`: `#081E33` (Soft container dark tint)
- `--dark-btn`: `#1E293B` (Tactile dark action button)
- `--good`: `#4ADE80` (Safe green)
- `--good-soft`: `#052E16` (Subtle dark green tint)
- `--warning`: `#FBBF24` (Amber caution)
- `--warning-soft`: `#451A03` (Subtle dark amber tint)
- `--danger`: `#F87171` (Urgent red)
- `--danger-soft`: `#450A0A` (Subtle dark red tint)

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

### Night-Vision Red Theme Palette (`data-theme="red"`, v1.12.0)

- `--bg`: `#0A0000` (Pure pitch black with deep red undertone, eliminating glare in darkened PICUs/night transports)
- `--card`: `#180404` (Elevated dark crimson card surface)
- `--panel`: `#220808` (Dark crimson panel surface)
- `--panel-subtle`: `#140303` (Subtle dark red inset surface)
- `--ink`: `#FF6B6B` (High-contrast red-coral text, preserving scotopic rod cell dark adaptation $> 620\text{ nm}$)
- `--muted`: `#B84A4A` (Medium red secondary labels)
- `--border`: `#401010` (Dark crimson 1px structural border)
- `--border-strong`: `#601818` (High-visibility crimson border)
- `--accent`: `#FF2B2B` (Vivid emergency red accent for active tabs and highlights)
- `--accent-hover`: `#FF5252` (Lightened emergency red)
- `--accent-soft`: `#380808` (Subtle dark red container highlight tint)
- `--accent-subtle`: `#240505` (Soft crimson container background)
- `--dark-btn`: `#2A0505` (Tactile dark crimson action button)
- `--good`: `#FF8585` (Safe readable red tint)
- `--warning`: `#FFAA80` (Warm amber-red tint)
- `--danger`: `#FF0000` (Critical emergency red)

### Surface Shadows & Border Radii Scale

- `--shadow-1`: `0 1px 2px 0 rgba(15, 23, 42, 0.04)` (Micro card lift)
- `--shadow-2`: `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04)` (Medium component elevation)
- `--shadow-3`: `0 16px 24px -4px rgba(15, 23, 42, 0.10), 0 6px 10px -4px rgba(15, 23, 42, 0.05)` (Floating overlays, dropdowns, modals, and FAB)
- `--r-xs`: `4px`
- `--r-sm`: `6px`
- `--r-md`: `8px`
- `--r-lg`: `12px`
- `--r-xl`: `16px`
- `--r-full`: `9999px`

### Typography

- **Primary Body Font**: `'Sarabun'`, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif (Google Fonts Sarabun for optimal legibility and Thai language support).
- **Display Sans Font**: `'Sarabun'`, system-ui, sans-serif (`--font-display`) — crisp, authoritative modern sans display on module titles (no serif distractions per taste-skill).
- **Monospace / Tabular Nums**: `'JetBrains Mono'`, monospace (`--font-mono`) for digital readouts, active weight displays, dosages, and calculation matrices.
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
15. **Pediatric Electrolytes Progressive Disclosure & Section 4C Resuscitation Cards (v1.10.1)**: Progressive non-blocking disclosure renders Section 1 (Corrected values), Section 3 (Acid-Base & Renal diagnostics), and Section 5 (Age Reference ranges) unconditionally. Section 2 (Deficit Calculations) and Section 4 (Emergency Protocols) display amber inline warning banners when patient weight is absent. Section 2 presents combined 48-hr fluid pump rates (`Maintenance + Deficit/48h`) in mL/hr and 50% initial bicarbonate resuscitation doses. Section 4 features a dedicated Section 4C stage card with violet accent border (`#8b5cf6`, `#7c3aed` header) for Acute Symptomatic Hypocalcemia (10% Calcium Gluconate 1.0 mL/kg max 20 mL) and Acute Hypomagnesemia (50% MgSO4 0.1 mL/kg max 4 mL).
16. **Native View Transitions & Zero-CLS Dynamic Tab Engine (v1.12.0)**: Tab switching leverages `document.startViewTransition()` with `@media (prefers-reduced-motion: reduce)` fallbacks, guaranteeing native app fluidity across all 13 clinical modules without layout shifts (CLS 0.00).
17. **1-Tap Quick Weight Triage Strip & Interactive Broselow Mini-Spectrum Bar (v1.12.0)**: Topbar Measured biometric capsule integrates a horizontal 1-tap quick weight preset strip (`3k`, `5k`, `10k`, `15k`, `20k`, `25k`, `30k`, `40k`) with Weech age estimation and an interactive 9-band Broselow mini-spectrum gradient bar for instant triage recalculations under $< 50\text{ ms}$.
18. **Mobile Emergency Resuscitation Bottom Quick-Dock & WCAG 2.2 Gloved Hit Ergonomics (v1.12.0)**: Dedicated mobile sticky bottom dock (`.mobile-bottom-dock`) anchoring the 4 highest-priority resuscitation actions (🚨 PALS, 💊 Dose, 💧 Fluids, ⚡ Seizure, ⋯ More) on viewports $< 680\text{ px}$. Dynamic scroll padding (`scroll-padding-top: calc(var(--topbar-h) + 16px)`) prevents sticky topbar focus occlusion. Touch targets meet WCAG 2.2 AA+ standards ($\ge 44\times 44\text{ px}$) with tactile `:active { transform: scale(0.975); }` compression feedback for gloved clinical use.
19. **6 New Clinical Modules UI Architecture (v2.0.0)**: Multi-column responsive layout across 6 new dedicated panels: 1) Airway & RSI (`#airway`) with Hero Equipment Sizing metrics (Cuffed ETT, Oral Depth, Blade, LMA, Suction) and RSI Medication Table featuring Rocuronium 1st-line paralytic and Sugammadex CICO rescue reversal; 2) Sepsis & Septic Shock (`#sepsis`) with Phoenix Score vs Simple Checklist toggle and SSC 2026 1-Hour Bundle hero metrics; 3) Anaphylaxis (`#anaphylaxis`) with 1st-line Epinephrine 1:1,000 hero metric, syringe volume drawing guide, and 2nd-line medication tables; 4) Trauma & Burns (`#trauma`) with ATLS 11th Ed xABCDE survey table, Modified Parkland burn fluid rate metrics, and EBV calculations; 5) Croup & Stridor (`#croup`) with Westley Score severity banners and Dexamethasone/Nebulized Epinephrine dosing; 6) Blood Transfusion (`#transfusion`) with PRBC volume calculations (CPDA-1 vs SAGM) and balanced MTP 1:1:1 + TXA protocols.
20. **Interactive Seizure Stopwatch Timer, WHO Growth Z-Scores & Explainable CDS (v2.0.0)**: 1) `#seizureTimerWidget` with running digital MM:SS clock, 5-minute milestone status alerts, progress bar color shifting (accent -> amber -> red), and haptic vibration triggers; 2) Topbar WHO Growth Z-Score badge (`#growthZScoreBadge`) displaying Weight-for-Age (WAZ) and Height-for-Age (HAZ) with dynamic Boy/Girl sex switch; 3) Expandable `.math-breakdown` details elements providing mathematical auditability across all new calculators; 4) Consolidated Bedside Pocket Card print layout.
21. **2-Tier Cockpit Navigation & Integrated Topbar Quick Triage (v2.1.0)**: Solved vertical navigation chrome overcrowding by integrating the 10-button Broselow quick-weight triage strip (`5k`..`40k`) and 9-band mini-spectrum directly into the sticky Topbar biometrics instrument cluster (`.topbar-triage`). Replaced the separated category and 19-tab rails with a unified 2-tier `.cockpit-nav` card: Tier 1 provides 3 segmented category switches (💊 *Meds & Transfusion*, 🚨 *Emergency Resus*, 📋 *Protocols & CDS*, plus *All Modules*), while Tier 2 renders only the 5–7 active module tabs with zero horizontal overflow or multi-row stacking, reclaiming $>60\text{ px}$ of vertical fold space for immediate bedside drug dosing.
22. **Unified Pediatric Formulary Engine & 9-Category Filter Pill Strip (v2.2.0)**: Consolidated all pediatric medications, anti-infectives, and emergency drugs (170 drugs total) into the unified `#dose` module (`Medications` / `ขนาดยาเด็ก & ยาปฏิชีวนะ`). Removed the standalone ATB navigation tab button to eliminate redundant cognitive friction. Integrated an ergonomic 9-category filter pill strip (`#doseCategoryFilter`: All, Antibiotics (ATB), Antipyretic/Analgesic, Respiratory, GI/Antiemetic, Steroid, Neurology/Anticonvulsant, Cardiovascular/Diuretic, Topical/Skin). Drug cards dynamically render indication selectors, safety ceilings (`maxPerDoseMg` / `maxPerDayMg`), oral liquid preparation volume calculations in mL, and bedside Schwartz eGFR renal adjustment matrices. Keyboard shortcuts (`Alt+1` for All Meds, `Alt+2` for Antibiotics filter) ensure zero-latency emergency access.
