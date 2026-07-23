# Design System & UI Specifications — ER-TSH Pediatric Calculator

## Design Tokens

### Color Palette
- `--bg`: `#f6f7fb` (Soft clinical slate backdrop)
- `--card`: `#ffffff` (Clean white card container)
- `--ink`: `#1f2937` (High-contrast dark charcoal text)
- `--muted`: `#6b7280` (Muted grey secondary labels)
- `--accent`: `#89b6ff` (Pastel medical blue)
- `--accent2`: `#ffb3c1` (Pastel warm pink)
- `--accent3`: `#b2f0e6` (Pastel mint green for active states)
- `--accent4`: `#ffe7a1` (Pastel alert yellow)
- `--good`: `#0ea5e9` (Info blue)
- `--danger`: `#ef4444` (Clinical warning red)

### Typography
- **Primary Font**: `'Sarabun'`, system-ui, sans-serif (Google Fonts Sarabun for optimal Thai/English legibility in clinical settings).
- **Weights**: Light (300), Regular (400), Semi-bold (600), Bold (700).

## UI States & Components
1. **Fixed Topbar**: Sticky header with `backdrop-filter: blur(6px)` to maintain quick access to ABW, Age, Length, and Broselow tape indicators regardless of page scroll.
2. **Tabs & Active Indicators**: Visual highlight with `--accent3` pastel mint background and soft borders.
3. **Broselow Drawer Panel**: Fixed bottom drawer sliding in smoothly over main content for emergency quick access.
4. **Summary & Output Cards**: Dashed light grey borders with clear HTML typography hierarchy (`<strong>`, `• bullets`) for fast glanceability under high-stress ER situations.
