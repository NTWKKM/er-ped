# Clinical Domain Context & Glossary — MNRH ER-PED Calculator

## Glossary
- **ABW (Actual Body Weight)**: Patient's current measured or reported weight in kilograms.
- **Wt for Ht (Weight-for-Height/Length)**: Estimated target weight based on height/length using Broselow/CDC growth parameters for pediatric dosing to avoid toxicity or underdosing.
- **Weech Formula**: Age-based weight estimation algorithm:
  - `< 1 year`: `(months + 9) / 2` kg
  - `1–6 years`: `2 × age + 8` kg
  - `> 6 years`: `(7 × age - 5) / 2` kg
- **Holliday–Segar Method**: Standard maintenance fluid calculation:
  - `0–10 kg`: `100 mL/kg/day` (`4 mL/kg/hr`)
  - `10–20 kg`: `1000 + 50 mL/kg` for weight >10 kg (`40 + 2 mL/kg/hr`)
  - `> 20 kg`: `1500 + 20 mL/kg` for weight >20 kg (`60 + 1 mL/kg/hr`)
- **Broselow Color Bands**: Weight/length-based color zones (Grey, Pink, Red, Purple, Yellow, White, Blue, Orange, Green) mapping to pre-calculated resuscitation equipment and drug dosages.
- **PALS (Pediatric Advanced Life Support)**: Emergency protocols for pediatric cardiac arrest, arrhythmias, and resuscitation.
- **NCPR (Neonatal Resuscitation Program)**: Specialized resuscitation protocols for newborns in the immediate postnatal period.
- **GINA (Global Initiative for Asthma)**: International evidence-based guidelines for asthma management. GINA 2026 (May 2026 release): O₂ only if SpO₂ < 92%, conservative SABA dosing (lactic acidosis risk), Epinephrine IM first if anaphylaxis, nebulized MgSO₄ removed, OCS stewardship.
- **TAC (Thai Asthma Council)**: Thai national asthma guideline (พ.ศ. 2568 / 2025) aligned with GINA, adding Clinical Remission goal and Asthma Action Plan emphasis.
- **PRAM (Pediatric Respiratory Assessment Measure)**: Validated 12-point scoring system for pediatric asthma severity assessment (0–3 Mild–Moderate, 4–7 Severe, 8–12 Life-Threatening).
- **HFNC (High-Flow Nasal Cannula)**: Heated humidified oxygen delivery system providing positive airway pressure support. Pediatric acute asthma: 1–2 L/kg/min flow (max 60 L/min), FiO₂ titrated to SpO₂ ≥ 92%, temperature 37°C.
- **SABA (Short-Acting Beta-Agonist)**: Quick-relief bronchodilator (Salbutamol/Albuterol) used as first-line rescue therapy in acute asthma.

## Architectural Decision Records (ADR)
1. **ADR-001: Client-Side Data Rendering**: All drug calculations occur synchronously in the client browser using pre-compiled JSON rules (`dataset.json`) to eliminate network dependencies in hospital environments with poor connectivity.
2. **ADR-002: Dynamic Strength & Preparation Parsing**: RegEx-based strength parser evaluates text formats such as `120 mg / 5 mL`, `250 mg / 5 mL`, `325 mg / tab` to automatically provide fluid mL and tablet counts alongside absolute mg dosages.
3. **ADR-003: Single Source of Truth Biometric Engine**: Topbar ABW / Wt for Ht serves as the sole source of weight truth across all modules, rendering read-only weight badges in calculator cards to prevent intra-module weight drift.
4. **ADR-004: Standardized Medical English Order Strings**: EHR order copies format orders in standardized medical English (e.g., `Paracetamol 250 mg (10 mL) PO q 6 hr PRN [BW: 16.5 kg]`) for seamless clinical documentation.
5. **ADR-005: Enforced Safety Ceilings**: Calculated doses exceeding `maxPerDoseMg` or `maxPerDayMg` in `dataset.json` automatically clamp to safety maximums and display high-contrast warning badges.
6. **ADR-006: Frequency Token Parsing & Dataset Table Disambiguation**: `dosesPerDayFromFreq` parses clinical frequency abbreviations (`bid`, `tid`, `qid`, `OD`, `qXh`). `pediatricATB` numeric fields are recognized as per-dose values to preserve clinical dosing intent without erroneous division.
7. **ADR-007: Keyboard-First Accessible Combobox Navigation**: Dropdown drug selectors support full keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`/`Escape`) with WAI-ARIA expanded state tracking for high-speed emergency room use.
8. **ADR-008: Zero-Dependency Inline Lucide SVG Icon System & Flat Visual Hierarchy**: Standardized live-UI icon system on inline Lucide SVGs (`currentColor`, `stroke-width="2"`, `aria-hidden="true"`). Replaced text emoji glyphs on interactive controls to prevent font/OS-dependent rendering differences on hospital workstations, while keeping the app zero-dependency for offline PWA operation. Retained text emojis inside historical release note logs.
9. **ADR-009: GINA 2026 Asthma Protocol & Multi-Mode Drug Dosing**: Acute asthma management follows GINA 2026 + Thai TAC 2025. `asthmaProtocol` in `dataset.js` supports 4 dosing modes: standard mg/kg, mcg/kg (Terbutaline), fixed-dose (MDI puffs), and weight-threshold (Ipratropium <20kg/≥20kg). HFNC settings are auto-calculated from BW with configurable parameters. Nebulized MgSO₄ explicitly excluded per GINA 2026. Epinephrine IM prioritized before bronchodilators when anaphylaxis features present.
10. **ADR-010: DOM State Isolation & Print Panel Sandboxing**: Tab navigation state is bound to `.active-panel` CSS classes in addition to display style attributes. Media print queries isolate and render strictly the active clinical tabpanel (`section[role="tabpanel"]:not(.active-panel) { display: none !important; }`), ensuring single-page printouts on hospital A4 printers without leaking inactive DOM panels.
