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

## Architectural Decision Records (ADR)
1. **ADR-001: Client-Side Data Rendering**: All drug calculations occur synchronously in the client browser using pre-compiled JSON rules (`dataset.json`) to eliminate network dependencies in hospital environments with poor connectivity.
2. **ADR-002: Dynamic Strength & Preparation Parsing**: RegEx-based strength parser evaluates text formats such as `120 mg / 5 mL`, `250 mg / 5 mL`, `325 mg / tab` to automatically provide fluid mL and tablet counts alongside absolute mg dosages.
3. **ADR-003: Single Source of Truth Biometric Engine**: Topbar ABW / Wt for Ht serves as the sole source of weight truth across all modules, rendering read-only weight badges in calculator cards to prevent intra-module weight drift.
4. **ADR-004: Standardized Medical English Order Strings**: EHR order copies format orders in standardized medical English (e.g., `Paracetamol 250 mg (10 mL) PO q 6 hr PRN [BW: 16.5 kg]`) for seamless clinical documentation.
5. **ADR-005: Enforced Safety Ceilings**: Calculated doses exceeding `maxPerDoseMg` or `maxPerDayMg` in `dataset.json` automatically clamp to safety maximums and display high-contrast warning badges.
6. **ADR-006: Frequency Token Parsing & Dataset Table Disambiguation**: `dosesPerDayFromFreq` parses clinical frequency abbreviations (`bid`, `tid`, `qid`, `OD`, `qXh`). `pediatricATB` numeric fields are recognized as per-dose values to preserve clinical dosing intent without erroneous division.
7. **ADR-007: Keyboard-First Accessible Combobox Navigation**: Dropdown drug selectors support full keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`/`Escape`) with WAI-ARIA expanded state tracking for high-speed emergency room use.
