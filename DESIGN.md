# Design System & UI Specifications — MNRH ER-PED Calculator (Braun Aesthetic)

## Design Tokens

### Braun Color Palette
- `--bg`: `#F5F4F0` (Warm vintage off-white matte plastic chassis)
- `--card`: `#FFFFFF` (Crisp white surface container)
- `--panel`: `#EBEAE5` (Tactile inset surface container)
- `--ink`: `#1E1E1E` (High-contrast graphite charcoal text)
- `--muted`: `#666563` (Industrial neutral grey secondary labels)
- `--border`: `#D5D3CE` (Precision 1px tactile border)
- `--accent`: `#D9480F` (Braun Signal Orange for primary actions & active states)
- `--accent-hover`: `#C23E0A` (Darkened signal orange)
- `--accent-subtle`: `#FDF2E9` (Subtle tint for highlights)
- `--dark-btn`: `#2A2927` (Dark charcoal tactile action button)
- `--good`: `#16A34A` (Clinical safe green)
- `--warning`: `#D97706` (Amber warning / Broselow indicator)
- `--danger`: `#DC2626` (Emergency PALS critical red)
- `--blue`: `#2563EB` (Dosing directive blue)

### Braun Dark Mode Palette (`data-theme="dark"`)
- `--bg`: `#171613` (Warm charcoal matte chassis, non-glare LCD/OLED)
- `--card`: `#26241F` (Warm elevated surface container)
- `--panel`: `#1E1C19` (Warm tactile inset panel)
- `--ink`: `#EAE5DB` (Warm off-white text — non-glare, eye fatigue reduction)
- `--muted`: `#A39C8E` (Warm neutral grey secondary label text)
- `--border`: `#3A3733` (Warm precision 1px border)
- `--border-dark`: `#59554D` (Warm dark border)
- `--accent`: `#E8863D` (Braun Signal Orange tuned for high dark contrast)
- `--accent-hover`: `#D9480F` (Darkened Braun Signal Orange)
- `--accent-subtle`: `#2E2119` (Subtle dark signal orange tint)
- `--dark-btn`: `#322F2A` (Tactile dark action button)
- `--blue`: `#7FA0B8` (L≈0.19 — calmest, informational)
- `--good`: `#8FB07A` (L≈0.26 — safe green)
- `--warning`: `#D9A94A` (L≈0.38 — amber caution)
- `--danger`: `#F0705A` (L≈0.41 — highest luminance urgent red)
*(Note: Semantic colors are ordered by escalating relative luminance `blue < good < warning < danger` so urgency maps strictly to visual brightness even on monochrome/grayscale clinical displays).*

### Typography
- **Primary Font**: `'Sarabun'`, system-ui, sans-serif (Google Fonts Sarabun for optimal legibility).
- **Monospace / Tabular Nums**: `'JetBrains Mono'`, monospace for digital readouts and dosage metrics.
- **Weights**: Regular (400), Medium (500), Semi-bold (600), Bold (700), Extra-bold (800).

## UI States & Components
1. **Top Biometric Instrument Bar**: Sticky top bar formatted as an industrial control panel with inset fields for ABW, Age (with `Yr`/`Mo` unit switch), Length, and dynamic IBW/Broselow badges.
2. **Braun Segmented Control Tabs**: Vintage radio-style depressed button toggles with active indicator in Braun Signal Orange (`#D9480F`) and keyboard shortcut hints (`Alt+1..5`).
3. **Braun Autocomplete Combobox**: Integrated single-input search dropdown with real-time fuzzy filtering, drug category badges, and keyboard navigation.
4. **Hero Dosage Metrics**: Prominent digital readout blocks (`.hero-metric`) displaying key numbers (e.g., Epinephrine dose, Joule/kg, Fluid rate) in bold tabular font for zero-latency scanning.
5. **EHR Order Clipboard Engine**: High-contrast tactile action button (`📋 Copy EHR Order`) generating standardized medical English prescription lines with animated toast feedback.
6. **Emergency PALS Floating Button**: Instant-access emergency action button (`🚨 PALS CODE`, `Alt+P`) anchored at bottom-right in dark graphite & Braun signal accents.
7. **Broselow Drawer Panel**: Precision bottom drawer with color-coded band headings and equipment grids sliding over content for quick reference.

