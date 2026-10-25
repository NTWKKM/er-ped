# Design System & UI Specifications — MNRH ER-PED Calculator (Clinical Precision Cockpit)

## Design Tokens

### Light Theme Palette (`data-theme="light"`, default)

- `--bg`: `#F1F4F8` (Neutral-cool Medical Mist: Calming, non-glare clinical canvas reducing eye strain)
- `--card`: `#FFFFFF` (Elevated crisp white card surface with surgical clarity)
- `--panel`: `#E5EAF0` (Recessed well / table header / inset container with 1.22:1 contrast against cards)
- `--panel-subtle`: `#EDF2F7` (Tactile sub-panel / pill container / card hover with 1.14:1 contrast against cards)
- `--ink`: `#0F172A` (Slate-900: High-contrast dark charcoal text, > 15:1 contrast)
- `--ink-secondary`: `#334155` (Slate-700: High-readability secondary clinical text, > 9:1 contrast)
- `--muted`: `#475569` (Slate-600: Crisp secondary labels, WCAG AA compliant > 5.5:1)
- `--border`: `#D8E0EA` (Subtle 1px precision hairline border preventing card washout under bright ER lights)
- `--border-strong`: `#CBD5E1` (Slate-300: High-visibility border for focused/active states)
- `--accent`: `#0277B6` (Surgical azure: 4.86:1 contrast for white button text and primary actions)
- `--accent-hover`: `#026597` (Deep surgical azure hover: 6.5:1 contrast)
- `--accent-soft`: `#E0F2FE` (Sky-100: Soft tint for active weight & highlight containers)
- `--accent-subtle`: `#F0F7FF` (Sky-50: Ultra-soft tinted container background for table hover)
- `--accent-text`: `#026AA2` (High-contrast text token on soft tints, WCAG AA compliant with 5.86:1 on white and 5.10:1 on `--accent-soft`, satisfying the $\ge 4.5:1$ requirement)
- `--dark-btn`: `#0F172A` (Slate-900: High-contrast tactile action button)
- `--good`: `#16A34A` (Clinical safe green)
- `--good-soft`: `#ECFDF5` (Soft mint tint)
- `--good-text`: `#166534` (Deep clinical green text token, WCAG AAA > 7.1:1 on white, 6.77:1 on soft tint)
- `--warning`: `#D97706` (Amber caution / Broselow indicator)
- `--warning-soft`: `#FFFBEB` (Soft amber tint)
- `--warning-text`: `#92400E` (Deep clinical amber text token, WCAG AAA > 7.0:1 on white, 6.84:1 on soft tint)
- `--danger`: `#DC2626` (Emergency PALS critical red)
- `--danger-soft`: `#FEF2F2` (Soft rose tint)
- `--danger-text`: `#991B1B` (Deep clinical red text token, WCAG AAA > 8.3:1 on white, 7.60:1 on soft tint)

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
- `--accent-text`: `#ECECE8` (High-contrast light mono text token, WCAG AAA > 13:1 on dark card surface)
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

1. **Top Biometric Instrument Bar**: Sticky top bar with clean 1px border separation and tactile capsules:
   - **Measured Zone**: ABW input with unit, Age input with `yr`/`mo` toggle button, and Sex toggle (`♂`/`♀`) for WHO Growth charts.
   - **Derived Zone**: Height (`HT`) input, real-time `Wt for Ht` readout, explicit `Use Wt-for-Ht` switch, and dynamic WHO Growth Standards Z-Score badge (`WAZ` & `HAZ` with color-coded severity).
   - **In-Use Hero Metric Zone**: High-visibility active weight box with left status border (blue accent for manual, amber caution for derived/estimated, neutral for empty), explicit provenance label (`measured`, `estimated · Weech`, `Broselow band · <color>`, `Wt for Ht`, `enter BW or age`), Broselow resuscitation tape zone pill (`White · 12-14 kg`) with 1-tap reference modal, and 4-theme cycle toggle (`Light` $\rightarrow$ `Dark` $\rightarrow$ `Mono` $\rightarrow$ `Red`).
   - **Ergonomic Mobile Streamlining (≤ 640px)**: Automatically truncates non-essential fields (`HT`, `Sex`, and Z-scores) to present strictly the 4 clinical essentials: Weight (`BW` + In-Use Readout), Age (`yr`/`mo`), Broselow tape band, and Theme toggle, with `16px` minimum mobile input font-size preventing iOS Safari auto-zoom.
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
23. **Streamlined Minimalist UI/UX & Mobile Form Input Ergonomics (modern-web-guidance v2.3.0)**: Simplified cockpit chrome and visual clutter by eliminating parenthetical item counts on Category Switcher pills (e.g. `Meds & Fluids`, `Emergency Resus`, `Protocols & CDS`, `All Modules`). Lightened shadow elevation tokens (`--shadow-1`, `--shadow-2`, `--shadow-3`) with softer ambient opacity for a crisp, calm clinical card surface. Streamlined Topbar instrument cluster with compact biometric capsules, discrete `Provenance` weight provenance labels, and tabular monospace readouts. Enforced modern mobile web form ergonomics across 100% of numeric inputs (`inputmode="decimal"`, `autocomplete="off"`) and combobox search fields (`enterkeyhint="search"`, `spellcheck="false"`), preventing native keyboard zooming and unwanted autocomplete dropdown collisions during critical emergency resuscitations.
24. **Futuristic Broselow Triage HUD Capsule & Scroll-Down Matrix Popover (modern-web-guidance v2.3.1)**: Replaced the bulky horizontal 10-button quick weight strip with an ultra-compact (~140px) Futuristic Triage HUD Capsule integrated into the topbar. The capsule features a glowing active Broselow color indicator dot (`#triageHudDot`), active zone name (`#triageHudLabel`), tabular monospace weight display (`#triageHudVal`), animated chevron, and an integrated 9-segment interactive mini-spectrum bar (`#broselowMiniStrip`). Clicking the capsule smoothly reveals a tethered Scroll-Down Popover (`#triagePopoverMenu`) containing a responsive 2-column clinical card deck (`#quickWeightStrip`) with weight ranges, estimated ages, and 1-tap rapid adoption, saving >270px of topbar horizontal space and eliminating mobile/tablet wrap.
25. **Minimalist Swiss Clinical Ergonomics & Glare-Free Light Theme (taste-skill v2.3.3)**: Calibrated light theme palette to non-glare Medical Mist canvas (`#F1F4F8`), tactile inset panels (`--panel: #E5EAF0`, `--panel-subtle: #EDF2F7`), and surgical azure accent (`#0277B6`). Introduced semantic WCAG AA/AAA ($\ge 4.5:1$, actual 5.10:1 to 8.3:1) text tokens (`--accent-text: #026AA2`, `--good-text: #166534`, `--warning-text: #92400E`, `--danger-text: #991B1B`) to guarantee sharp legibility of hero readouts, badges, and calculation summaries on pastel tints (with `--accent-text` on `--accent-soft` achieving 5.10:1, satisfying WCAG AA). Refined 2-tier Cockpit Nav geometry with hairline borders, luminous full-pill category switches, and flat underline tab indicators. Implemented dynamic `--topbar-h` responsive clearance (`52px` desktop, `96px` tablet <=960px, `106px` mobile <=768px, `168px` phone <=480px) and mobile biometric flex-wrapping, completely eliminating sticky topbar content overlap and horizontal viewport blowout.
26. **React Component & Tailwind v4 Design Token Synchronization (v2.4.0)**: Mapped clinical design tokens into Tailwind CSS v4 `@import "tailwindcss";` and root CSS custom properties. Component hierarchy strictly respects clinical ergonomics: `TopbarBiometrics` (sticky, persistent triage context), high-contrast data tables (`.clinical-table` with sticky first columns and hover highlights), and themed cards (`.clinical-card`, `.clinical-panel`, `.clinical-panel-subtle`). Multi-theme support (Light, Dark, Monochrome, Night-Vision Red) persists seamlessly without CSS bloat.
27. **WHO Growth Standards Reference Calibration (v2.4.1)**: Calibrated 120-month (10-year) pediatric height reference data to official WHO Growth Reference 2007 (5–19 years) tables ($M=137.8\text{ cm}, SD=6.4\text{ cm}$ for boys; $M=138.6\text{ cm}, SD=6.4\text{ cm}$ for girls). Ensured fine-grained Gaussian HAZ stunting classification evaluates unrounded scores against $-2\text{ SD}$ thresholds ($125.0\text{ cm}$ boys, $125.8\text{ cm}$ girls) with $10^{-12}$ IEEE-754 precision snapping, strictly classifying values below threshold as Stunted.
28. **Multi-Breakpoint Zero-Overflow Geometry, Full-Coverage Transfusion & Modals Integration (taste-skill v2.4.2)**:
    - **Zero-Overflow Responsive Geometry**: Re-engineered `TopbarBiometrics` with `flex flex-wrap lg:flex-nowrap` and responsive input clamp widths (`w-11 sm:w-16` for BW, `w-9 sm:w-12` for Age), completely eliminating the previous 887px horizontal viewport blowout on tablet viewports (640px–887px) and 320px–360px ultra-small phones.
    - **Main Tab Button Truncation**: Applied `py-1.5 sm:py-2 px-1 sm:px-2 text-[11px] sm:text-xs md:text-sm font-bold truncate` across the 5-tab segment, resolving text clipping of the "Protocols" tab on 320px–375px screens.
    - **Full Content Coverage (Transfusion Module)**: Unlocked the 18th clinical module (`transfusion` - Blood Transfusion Calculator) with a cohesive 3-segment switcher (`IV Fluids`, `Continuous Drips`, `Blood Transfusion`) inside `FluidsAndDripsView`.
    - **Clinical Evidence & Bedside Pocket Card Modals**: Directly integrated `EvidenceModal` (LOE/COR guideline citations) and `OrderSheetModal` (EHR order queue & 1-tap A4 Bedside Emergency Pocket Card printing) into TopbarBiometrics actions.
    - **Mobile Non-Zoom Input Font Sizing**: Configured all form inputs (`.clinical-input`, `input[type="number"]`, `input[type="text"]`, `select`) to enforce `16px` on mobile viewports (< 768px), preventing iOS Safari auto-zooming.
    - **Viewport Stability**: Standardized root container on `min-h-[100dvh]` to eliminate mobile browser address bar layout jumps.

29. **Accessibility, Transfusion Guardrails & Active Order Queue Flow (CodeRabbit PR #11 Polish)**:
    - **Calculator Order State Flow & Persistent View Inputs**: Passed `handleAddOrder` callback across all four calculator views (`MedicationsView`, `FluidsAndDripsView`, `EmergencyResusView`, `ProtocolsAndCDSView`), enabling 1-tap `+ Order Sheet` queuing of calculated drug doses, maintenance fluids, vasoactive drips, PRBC transfusions, emergency arrest/anaphylaxis/sepsis doses, and clinical protocol regimens with collision-free monotonic order IDs (`createOrderId`). Lifted `FluidsAndDripsInputs` state (`deficitPct`, `fluidDuration`, `dripKey`, `dripDose`, `dripDrugMg`, `dripVolMl`, `reverseRate`, `currentHb`, `targetHb`, `prbcType`), medication selection & concentration override (`medSelectedKey`, `medConcOverride`), and DKA parameters (`dkaSeverity`, `dkaPriorBolus`) to `App.tsx` root state so switching between main navigation tabs does not reset user-configured parameters or desynchronize on-screen inputs with previously queued orders. Changing patient biometric/lab inputs triggers full-queue invalidation, while module-specific edits in `FluidsAndDripsView`, `MedicationsView`, and `ProtocolsAndCDSView` pass targeted invalidation prefixes (`'fluids'`, `drip-${dripKey}`, `'tx'`, `med-${selectedDrug.key}`, `'proto-dka-fluid'`) to `onInvalidateOrders` with strict delimiter boundary matching (`orderPrefix === targetPrefix`), ensuring that only dependent orders are invalidated without affecting unrelated medication, insulin (`proto-dka-ri`), or resuscitation entries.
    - **Medication & Protocol Order Safety Verification**: Gated medication order submission on positive numeric dose/volume (`hasNumericDose`) rather than display placeholder `—`, blocked submission for age-limited medications when age is missing or non-positive until verified, restricted non-numeric matched renal regimens to review-only guidance while requiring resolved numeric renal doses for order submission with reviewed status reset upon weight or lab changes, and standardized indexed eGFR units to `mL/min/1.73m²`; validated DKA prior fluid boluses input in `ProtocolsAndCDSView` by rejecting negative numbers and gating order submission, preventing negative boluses from increasing the calculated deficit.
    - **Accessible Dialog Focus Management**: Added trigger element retention (`e?.currentTarget` falling back to `document.activeElement`), keyboard focus routing on open, shared `useModalFocusTrap` hook with `Escape` close handling and Tab/Shift+Tab focus trapping within modal dialogs (`aria-modal="true"`), and focus restoration to originating trigger buttons on close.
    - **Transfusion & Infusion Calculation Safety Guardrails**: Eliminated implicit `0` and `10.0` fallbacks for `currentHb` and `targetHb` in `FluidsAndDripsView`; `currentHb` and `targetHb` both start blank (`''`), requiring explicit positive numeric values, non-zero calculated PRBC volume, and 4-hour schedule feasibility (`tx.prbcVol <= tx.maxInfusionRate * 4`) before showing the PRBC order button; dynamically sets minimum PRBC infusion duration from `tx.prbcVol / tx.maxInfusionRate` (`minPrbcDurationHr`), indicating `no feasible 4-hr schedule` when conflicted, ensuring that every permitted schedule complies with the maximum safe infusion rate; gated vasoactive drip orders on valid positive dose, drug amount, and diluent volume inputs.
    - **W3C Form Accessibility & ARIA Navigation Sync**: Grouped vasoactive drip dilution inputs into `<fieldset>` with `<legend>` and explicit control labels; added `aria-pressed` states to subtab selector buttons; aligned main navigation state between `fluids` and `transfusion` subtabs.




