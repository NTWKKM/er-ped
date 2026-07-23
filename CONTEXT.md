# Clinical Domain Context & Glossary — MNRH ER-PED Calculator

## Glossary
- **ABW (Actual Body Weight)**: Patient's current measured or reported weight in kilograms.
- **IBW (Ideal Body Weight)**: Calculated target weight for dosing to avoid toxicity in overweight or malnourished pediatric patients.
- **Weech Formula**: Age-based weight estimation algorithm:
  - `< 1 year`: 9 kg default
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
