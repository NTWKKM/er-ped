# System Architecture — MNRH ER-PED Calculator (`er-ped`)

## Components
1. **Top Navigation & Biometric Bar**:
   - `ABW` (Actual Body Weight in kg): Central single source of truth for patient weight across all calculator modules.
   - `Age` (Years/Months estimation with corrected Weech formula for infants <1 yr).
   - `Length` (Length in cm).
   - `IBW` (Ideal Body Weight chip & auto-switch toggle).
   - `Broselow` (Color band estimator & quick reference drawer).

2. **Core Calculators**:
   - `Pediatric Dose`: General pediatric medication dosing, preparation concentration parsing (mg/mL, mg/tab), range checks, per-dose & per-day caps.
   - `Pediatric ATB`: Antibiotic dosing calculator per kg per day or per dose, unit conversions, limits, age & weight warnings.
   - `IV Fluids`: Dehydration assessment (Mild 3-5%, Moderate 6-9%, Severe >=10%), Holliday–Segar maintenance fluid rate calculation, deficit replacement over 24h/48h, ORS vs IV fluid plans.
   - `PALS`: Emergency cardiac arrest protocols (Epi, Amiodarone, Lidocaine, Defib), Bradycardia, Tachycardia (Adenosine, Sync Cardioversion), Torsades MgSO4, rendered with Hero Metric LCD blocks.
   - `NCPR`: Neonatal resuscitation protocols, Epinephrine IV/IO & ETT dosing, Volume expanders, PPV & FiO2 targets, Hypoglycemia D10W bolus & infusion, ETT & suction catheter sizing.

3. **Data Storage & PWA Service**:
   - `dataset.json`: Single source of truth for drug references, Broselow bands, fluid rules, PALS, and NCPR protocols with safety caps.
   - `sw.js` & `manifest.webmanifest`: Offline-first caching strategy for instant clinical accessibility without internet.

## Data Flow
```mermaid
flowchart TD
    UserInputs[User Biometric Inputs: Weight, Age, Length] --> BiometricEngine[Biometric & IBW Engine]
    BiometricEngine --> WeechFormula[Weech Formula Weight Estimate]
    BiometricEngine --> BroselowMatcher[Broselow Tape Matcher]
    BiometricEngine --> ModuleCalculators[Calculator Modules: Dose, ATB, Fluids, PALS, NCPR]
    Dataset[dataset.json] --> ModuleCalculators
    ModuleCalculators --> UIOutputs[Rendered Clinical Directives & Braun Hero Metrics]
```

## Key Decisions
1. **Braun Design Language & Standalone Architecture**: Standalone clinical web app styled with Braun industrial controls (warm chassis `#F5F4F0`, signal orange `#D9480F`, high-contrast dark graphite) without cross-links to external tools.
2. **Single Source of Truth for Weight**: Topbar ABW automatically syncs weight input to all active modules (`doseW`, `atbW`, `fW`, `pW`, `nW`), ensuring zero discrepancy during high-stress resuscitations.
3. **Offline-First PWA**: Service worker caches static assets (`index.html`, `app.js`, `dataset.json`) to guarantee zero-latency clinical availability in emergency rooms.
4. **No External Framework Dependencies**: Pure Vanilla JS + CSS to minimize bundle size, eliminate build step complexity, and ensure high reliability.

