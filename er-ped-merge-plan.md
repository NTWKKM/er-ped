# ER-PED — Merge Plan: Mockup v2 → Production
เป้าหมาย: เอา design token/interaction pattern จาก `design-mockup-v2.html` ไปใช้กับ `index.html` จริง โดย**ไม่ตัดฟีเจอร์ที่มีอยู่แม้แต่ตัวเดียว**

---

## 1. Token layer — merge ก่อนสิ่งอื่นใด

คัดลอก `:root`, `:root[data-theme="dark"]`, `:root[data-theme="mono"]` ทั้งชุดจาก mockup ไปแทนที่ token เดิมใน `index.html` ตรงๆ ได้เลย (ชื่อตัวแปรตั้งไว้ compatible กับ `.tag`, `.hero`, `.card` อยู่แล้ว)

**สิ่งที่ต้องเช็คก่อน merge:**
- Broselow chip ปัจจุบัน hardcode สี `#E5E7EB`/`#111` ตรงๆ ไม่ใช้ token → ต้องแก้เป็น `var(--panel)`/`var(--ink)` ก่อน ไม่งั้นจะเป็นจุดเดียวที่หลุด theme เวลาสลับ mono
- ตรวจ `.tab-btn`, `.chip`, `.btn` เดิมว่าใช้ token ตัวไหนอยู่บ้าง แล้ว map เข้ากับชื่อใน mockup (`--panel`, `--border`, `--accent-soft` ฯลฯ) ทีละคลาส อย่า overwrite ทั้งไฟล์

---

## 2. Top bar ใหม่ — โครงสร้าง 2 แถว รักษาฟังก์ชันครบ

ปัญหาเดิม: mockup ใช้แถวเดียว มีแค่ ABW/Age/HT/IBW + Theme ปุ่มเดียว แต่ production มี 8 องค์ประกอบ ถ้าอัดแถวเดียวจะแน่นเกินบนจอแคบ

**แนวทาง: แยกเป็น 2 แถวย่อยในการ์ด topbar เดียว**

```
┌─────────────────────────────────────────────────────────┐
│ ER-PED.        [ABW][Age|Yr/Mo][HT][IBW ✓toggle]  [IBW: 14.0 kg] │  ← แถวชีวมิติ (เหมือน mockup)
├─────────────────────────────────────────────────────────┤
│ [📊 Vitals] [Broselow: —]     [🖨️ Print][🌐 TH][◐ Theme] │  ← แถว reference/action (ชิดขวา)
└─────────────────────────────────────────────────────────┘
```

- แถวบน: ใช้ `.chip` style จาก mockup ตรงๆ (มี segmented Yr/Mo, IBW badge พร้อม sync-dot) — เพิ่ม toggle switch "ใช้ IBW" กลับเข้าไปในชิปเดิม (ของ production มีอยู่แล้ว เอากลับมาแค่ผูก token ใหม่)
- แถวล่าง: ซ้าย = quick-access (Vitals chip, Broselow chip) / ขวา = action cluster (Print, Lang, Theme) ใช้ `.btn.btn-ghost` style จาก mockup แทนปุ่มเดิม
- Broselow chip คง badge สีเป็นตัวบ่งชี้ zone ได้ แต่เปลี่ยนมาใช้ token (`--accent2-soft` เป็นต้น) แทน hardcode
- Theme ปุ่มเดียวจาก mockup (cycle light→dark→mono) **แทนที่** ปุ่ม 🌙 Dark เดิม (2-state) — เพราะต้องรองรับ 3 theme แล้ว

**Mobile (<680px):** ยุบแถวชีวมิติเป็น scroll แนวนอนได้ (`overflow-x:auto`), แถว action ให้ icon-only (ซ่อน label ข้อความ เหลือ emoji/glyph) ประหยัดพื้นที่

---

## 3. Nav tab ใหม่ — คง 11 โมดูล + nav-break, apply style จาก mockup

**แนวทาง: ใช้ `.tabs`/`.tab` component ของ mockup เป็น container แต่คงโครง 2 กลุ่มของเดิม**

```
┌─ Primary ──────────────────────────────────────────┐
│ 💊Dose 🦠ATB 💧Fluids 🧒PALS 👶NCPR 🫀Drip           │
├─ Specialty ────────────────────────────────────────┤
│ ⚡Seizure 🧪Tox 💉Sedation 📊Vitals 🩺DKA             │
└─────────────────────────────────────────────────────┘
```

- ใช้ `.tabs` (background panel + padding) เป็นกรอบของแต่ละแถว แยก 2 `.tabs` block ต่อกัน (แทน `nav-break` เดิมที่เป็นแค่เส้นคั่น) — ให้ label เล็กๆ กำกับกลุ่ม ("Primary" / "Specialty") แบบ `.section-label` ของ mockup เพื่อสื่อความหมายกลุ่มชัดขึ้นกว่าเส้นคั่นเฉยๆ
- คง emoji ของแต่ละ tab ไว้ (production ใช้ emoji เป็น visual anchor หลักในการจำตำแหน่งตอนรีบ ห้ามตัดออก) — ใส่ **หลัง** ไม่ใช่แทนที่ label
- คง keyboard shortcut `[Alt+N]` แต่ปรับ style ตาม `.tab .kbd` ของ mockup (เล็กลง, opacity ต่ำ, เด่นขึ้นตอน active)
- Active state: ใช้ style `.tab.active` ของ mockup (พื้นขาว + shadow เบา) แทนพื้นสีทึบเดิม ให้เข้ากับโทน warm minimalism

**Mobile (<720px):** ให้แต่ละ `.tabs` block เป็น `overflow-x:auto` scrollable แทนการบีบปุ่มให้เล็ก (ของเดิมบีบเหลือ `min-width:30%` ซึ่งทำให้ label ยาวๆ เช่น "Toxicology" ตัดคำ) — scroll ดีกว่า squeeze

---

## 3.5 Decluttering — ลดความแน่นของ top bar / nav tab

Feedback หลัง draft แรก: รวมฟีเจอร์ครบแล้วแน่นเกินไป แก้ด้วยการ**รวม/ซ่อน ไม่ใช่ตัดทิ้ง**

**Top bar (8 องค์ประกอบ → ~4-5):**
1. **Vitals chip + Broselow chip → รวมเป็นปุ่มเดียว "Reference ▾"** กดแล้วเด้ง popover โชว์ทั้งสองอย่าง แทนที่จะค้าง 2 chip แยกตลอดเวลา
2. **Print + Lang toggle → ย้ายเข้า overflow menu (⋯)** เหลือ Theme toggle ให้เห็นตลอดอย่างเดียว (สลับบ่อยสุดตามสภาพแสง) ส่วน Print/Lang ใช้ไม่บ่อยพอที่จะซ่อนได้
3. **ยุบ IBW badge เข้าไปในชิป ABW เดียวกัน** เช่น "ABW 14.0 → IBW 14.2 kg" แทนที่จะมีกล่องแยก 2 กล่อง

**Nav tab:**
1. **ย้าย `[Alt+N]` shortcut label ออกจากปุ่ม ไปเป็น `title` tooltip** (โชว์ตอน hover/focus เท่านั้น) — คีย์ลัดยังทำงานเหมือนเดิม แค่ไม่ต้องมีตัวอักษรเล็กค้างถาวรทุกปุ่ม ลด clutter ได้เยอะโดยไม่กระทบ logic
2. คง 2 กลุ่มเดิม (Primary/Specialty) แต่ลด padding/font-size ตาม `.tab` ของ mockup ซึ่งบางกว่าเดิมอยู่แล้ว
3. ถ้ายังแน่น: ให้กลุ่ม **Specialty เป็น scrollable แถวเดียว** แทนพยายามบีบให้พอดีจอ (ดีกว่าบีบ label จนตัดคำ เช่น "Toxicology")

**ลำดับความสำคัญถ้าทำแค่ 2 อย่างก่อน:** (a) ย้าย shortcut label ออกจากปุ่ม tab และ (b) รวม Vitals/Broselow เป็น Reference▾ — สองอย่างนี้ลด visual clutter ได้มากสุดโดยแรงน้อยสุด ไม่กระทบ handler เดิมเลย

---

## 4. Component ที่เหลือ (Dose/ATB/PALS screen)

Apply `.hero`, `.verify`, `.sync-bound`, 2-tap `.confirm` pattern เข้ากับหน้าจอเดิมทีละโมดูล เริ่มจาก **Dose calculator** ก่อน (เพราะมี logic คำนวณจริงอยู่แล้ว ไม่ต้องผูก mock dataset ใหม่แบบ mockup) แล้วค่อยไล่โมดูลอื่น

---

## 5. ลำดับการทำงานที่แนะนำ

1. Merge token layer (`:root` 3 theme) — ตรวจ regression ด้วยตาทุกหน้าจอเดิม
2. แก้ Broselow chip ให้ใช้ token
3. Redesign topbar (2 แถว + decluttering: Reference▾ popover, overflow ⋯ menu, ยุบ IBW เข้า ABW chip) — ผูกฟังก์ชันเดิมทั้งหมดกลับเข้าไป ไม่ใช่เขียนใหม่
4. Redesign nav tab (2 group, shortcut label → tooltip, Specialty group scrollable บนมือถือ)
5. Apply hero/verify/sync-bound ให้ Dose screen ก่อน เป็น pilot
6. ไล่ apply ให้ ATB → PALS → NCPR → ที่เหลือ
7. Regression test ทุก theme (light/dark/mono) บนทุกหน้าจอ + ทดสอบจอ mono จริงถ้ามี

## ความเสี่ยงที่ต้องระวัง
- อย่าลบ `useIBW` checkbox, `syncNCPRWithABW()`, `applyIBWToBW()` ฯลฯ ที่ผูกกับ topbar chip เดิม — ตรวจทุก `onclick`/`oninput` handler ก่อนแก้ HTML structure
- `.broselow-chip` badge อาจมี logic คำนวณสี zone แยกอยู่ใน JS (ต้อง grep หา `updateBroselowColor` หรือคล้ายกันก่อนแตะ)
- Print stylesheet (`@media print`) อ้างอิง class `.topbar` ตรงๆ — ถ้าเปลี่ยนโครง topbar เป็น 2 แถว ต้องเช็ค print CSS ไม่ให้พังตาม
- Popover "Reference ▾" และ overflow menu "⋯" เป็นองค์ประกอบใหม่ที่ไม่มีในเดิม — ต้องเพิ่ม keyboard focus trap + `Esc` ปิดเอง และเช็คว่าไม่บัง element อื่นตอน mobile
