# plan.md — ER-PED Calculator (fork ส่วนตัวของ Plan)

> Repo: `NTWKKM/er-ped` — Pediatric ER calculator (Dose / ATB / IV Fluids / PALS / NCPR)
> เอกสารนี้สรุป 3 เรื่องที่ขอ: personalize, UX audit, clinical accuracy check

---

## 1) Personalize ให้เป็นของฉัน

ไฟล์ที่ต้องแก้และจุดที่ต้องเปลี่ยน:

| ไฟล์ | จุดที่แก้ | ค่าปัจจุบัน | เสนอเปลี่ยนเป็น |
|---|---|---|---|
| `index.html` | `<title>` | `👶🏻 ER-TSH PED Calc` | ระบุชื่อ/รพ. เช่น `MNRH ER-PED` |
| `index.html` | footer credit (ยังไม่มี) | — | เพิ่ม `พัฒนาโดย Plan · EM, รพ.มหาราชนครราชสีมา` ท้าย container |
| `manifest.webmanifest` | `name`, `short_name` | `ER PED Calc` / `ER-PED` | ปรับตามชื่อที่ต้องการให้ขึ้นหน้าจอ Home |
| `manifest.webmanifest` | `theme_color`/icon | pastel blue emoji icon | เปลี่ยนสี/ไอคอนให้ตรง brand ของชุดเครื่องมือ (ให้เข้าชุดกับ er-hub ถ้าจะรวมกลุ่มเดียวกัน) |
| `package.json` | `author` | `""` | ใส่ชื่อ/GitHub handle |
| `ARCHITECTURE.md`/`CONTEXT.md`/`DESIGN.md` | หัวเรื่อง "ER-TSH Pediatric Calculator" | คงชื่อเดิมจาก template ต้นทาง | เปลี่ยนให้ตรงชื่อโปรเจกต์ใหม่ ลบ/แก้ reference "TSH" ถ้าไม่เกี่ยวกับหน่วยงานเดิม |

**การตัดสินใจ (ตัดสินใจแล้ว):** เลือกใช้ **Braun design language แบบ standalone (แยกเดี่ยว ไม่เชื่อมต่อกับ er-hub)** — ปรับสีแบรนด์เป็น Braun Warm Chassis + Signal Orange (`#D9480F`) ปรับปรุง UI ทั้งหมดเป็นแนว Braun Industrial Control Instrument, เพิ่ม Single Source of Truth สำหรับน้ำหนัก, Hero metric display สำหรับ critical doses และ PALS Emergency FAB

---

## 2) UX Audit — จุดที่ใช้ยากและข้อเสนอ

### ปัญหาหลักที่พบ

1. **น้ำหนักถูกกรอกซ้ำ 5 ที่** — top bar มี ABW กลาง แต่ทุกแท็บ (`doseW`, `atbW`, `fW`, `pW`, `nW`) มีช่องน้ำหนักแยกของตัวเอง `onWeightChange()` จะ sync ค่าจาก top bar ลงมาแท็บ **เฉพาะตอนช่องว่างเปล่า** เท่านั้น ถ้าหมอแก้ค่าที่ช่องใดช่องหนึ่งโดยตรง (เช่น แก้ที่แท็บ PALS ตอน resus) top bar จะไม่รู้ และแท็บอื่นจะไม่อัปเดตตาม → เสี่ยง "น้ำหนักไม่ตรงกัน" ระหว่างแท็บ ซึ่งอันตรายมากในบริบท ER
   → **เสนอ:** ให้ top bar ABW เป็น single source of truth ตัดช่องน้ำหนักในแต่ละแท็บออก เหลือไว้เฉพาะปุ่ม "override" เล็กๆ ถ้าจำเป็นจริง (เช่น NCPR ที่น้ำหนักแรกเกิดคนละบริบทกับ ABW เด็ก)

2. **PALS (cardiac arrest) ฝังอยู่เป็นแท็บที่ 4** — เวลาที่ต้องการเรียกดูเร็วที่สุด (code arrest) กลับต้องกดผ่าน 4 แท็บ
   → **เสนอ:** เพิ่มปุ่มลอย (FAB) แยกต่างหาก "🚨 PALS" สีแดงเด่น เข้าถึงได้จากทุกหน้าโดยไม่ต้องสลับแท็บ

3. **Output เป็น text block ยาวรวด** — ทุก summary (`doseOut`, `pOut`, `nOut` ฯลฯ) เรียง bullet ยาวเป็นพืด ไม่มีสี ไม่มีจุดเด่น ในสถานการณ์เร่งด่วนต้อง scan หาตัวเลขสำคัญ (เช่น dose epinephrine) ยากเพราะฟอนต์ขนาด/น้ำหนักเท่ากันหมด
   → **เสนอ:** ทำ key number ให้เด่นแยกกล่อง (เช่น การ์ดสีแดงอ่อนสำหรับ critical dose บรรทัดแรกสุด) ส่วนรายละเอียดที่เหลือ (adenosine, MgSO4 ฯลฯ) พับเก็บใน accordion แทนการแสดงยาวทั้งหมดตลอดเวลา

4. **Drug select + search แยกกัน 2 ช่อง** — dropdown ยาว (72 รายการ) กับช่อง search อยู่คนละที่ ผู้ใช้ต้องเข้าใจว่า search filter dropdown ที่อยู่ข้างๆ ไม่ชัดเจนในแวบแรก
   → **เสนอ:** รวมเป็น combobox/autocomplete ตัวเดียว พิมพ์แล้วเห็นตัวเลือกลอยขึ้นมาเลย

5. **Mobile margin-top 190px** — บนจอเล็ก `.container` ถูกดันลงเกือบ 200px เพราะ topbar โตขึ้นจาก chip ที่ wrap หลายบรรทัด เสียพื้นที่จอไปเยอะ
   → **เสนอ:** บนมือถือ ให้ biometric bar (ABW/Age/Length) พับเป็นแถบสรุปบรรทัดเดียว + ปุ่ม "แก้ไข" เปิด bottom-sheet แทนการโชว์ input ครบทุกช่องค้างตลอดเวลา

6. **Broselow ซ่อนอยู่ใน chip เล็กๆ** — ข้อความ "กดเพื่อดู" จางและเล็ก ผู้ใช้ใหม่อาจไม่รู้ว่ากดได้
   → **เสนอ:** ให้ Broselow chip เด่นขึ้น (border/สี ตาม band ที่ match) และ auto-highlight เมื่อกรอกน้ำหนัก/ส่วนสูงเสร็จ

7. **Disclaimer ซ้ำทุกแท็บ** ("WebApp นี้ไม่ใช่ standard ref...") ข้อความดีอยู่แล้วแต่ซ้ำ 4 ที่ — เสนอทำเป็น banner ลอยเดียวแทน (ลด clutter แต่ยังเห็นตลอด)

### ลำดับความสำคัญ UX (แนะนำ)
1. รวมแหล่งน้ำหนัก (ความปลอดภัย > UX)
2. FAB เข้า PALS ตรง
3. Key-number highlight ใน output
4. ที่เหลือ (combobox, mobile bar, Broselow, banner) — ทำทีหลังได้

---

## 3) Clinical Accuracy Check

### ตรวจแล้ว "สอดคล้องกับแนวทางมาตรฐาน" (PALS 2020 AHA / NRP 8th ed.)

- **PALS**: epinephrine arrest 0.01 mg/kg (1:10,000), amiodarone 5 mg/kg (max 15 mg/kg total), lidocaine 1 mg/kg (max 3 mg/kg total), defib 2→4 J/kg (up to 10 J/kg หรือ adult max), atropine 0.02 mg/kg (min 0.1 / max 0.5 mg single, max 1 mg total), adenosine 0.1→0.2 mg/kg (max 6/12 mg), sync cardioversion 0.5–1→2 J/kg, MgSO₄ 25–50 mg/kg (max 2 g over 10–20 min) — **ตรงกับ 2020 AHA PALS guideline ทั้งหมด**
- **NCPR**: epi IV 0.01–0.03 mg/kg, fluid bolus 10 mL/kg over 5–10 min, PPV rate 40–60/min PIP 20–25 cmH₂O, ETT size-by-weight/GA ตาราง, depth-by-GA ตาราง — **ตรงกับ NRP 8th edition**

### พบปัญหาที่ต้องแก้ (เรียงตามความสำคัญ)

1. **Weech formula ไม่ตรงกับ UI hint สำหรับเด็ก < 1 ปี** (บั๊กสำคัญที่สุด)
   ข้อความ hint ใน top bar เขียนว่า `AGE ** if < 1 yr : (mo + 9) / 2` แต่โค้ดจริงใน `estimateWeightFromAge()`:
   ```js
   if (ageYr < 1)  return 9;   // ทารก ~9 kg (ดีฟอลต์)
   ```
   คือ **คืนค่าคงที่ 9 kg เสมอ** ไม่ได้คำนวณตามเดือนจริงตามสูตรที่บอกไว้ในหน้าจอ ผลคือทารกอายุ 2 เดือน กับ 11 เดือน จะได้ IBW estimate เท่ากันหมด (9 kg) ทั้งที่สูตรบนจอสัญญาไว้ว่าจะต่างกัน — ต้องแก้ให้ตรงกันอย่างใดอย่างหนึ่ง (ทำตามสูตรจริง หรือแก้ hint text ให้ตรงกับที่โค้ดทำ)

2. **Absolute daily-dose cap ไม่ถูกบังคับในโค้ดสำหรับยา PRN น้ำหนัก-ฐาน** เช่น paracetamol/ibuprofen
   ใน `dataset.json` field `note` เขียนไว้ว่า `⚠️ Max 90 mg/kg/day or 4 g/day` (paracetamol) แต่ entry **ไม่มี field `maxPerDayMg`** เลย ส่วน `calcDose()` จะ cap ด้วย `drug.maxPerDayMg` เท่านั้นถ้ามีค่า — เพราะไม่มีค่านี้ใน dataset การคำนวณ "Per day" ที่แสดงบนจอจึงไม่ถูก cap จริง สำหรับเด็กน้ำหนักมาก (เช่น >65 kg ที่ 15 mg/kg × 4 ครั้ง/วัน = เกิน 4 g) แอปจะโชว์ตัวเลขที่เกิน safe limit โดยไม่มี warning ใดๆ
   → ต้องเติม `maxPerDayMg` (และ `maxPerDoseMg` ถ้ามี) ใน dataset ให้ตรงกับที่เขียนไว้ใน note ของทุก drug ที่มีการอ้าง max แบบ absolute

3. **Age input เป็นทศนิยมปี (step 0.1) แต่ใช้ทั้งสูตร Weech และเป็นเกณฑ์ minAgeYr/maxAgeYr ของยาบางตัว**
   สำหรับทารก <1 ปี การกรอก "0.5" ปีเพื่อหมายถึง 6 เดือนนั้นต้องคิดเลขเองทุกครั้ง (คูณ 12) เสี่ยง input ผิดในสถานการณ์เร่งด่วน — แนะนำเพิ่มตัวเลือกกรอกเป็น "เดือน" สำหรับเคส <2 ปี โดยเฉพาะ

4. **ยังไม่ตรวจครบทุกตัว** — ที่ตรวจอัตโนมัติละเอียดคือ PALS/NCPR/fluids ทั้งหมด และสุ่มตรวจ paracetamol/ibuprofen ใน `pediatricDose` (72 รายการ) ส่วนที่เหลือ (ยาอื่นใน pediatricDose และทั้งหมดใน pediatricATB) ยังไม่ได้ไล่ตรวจทีละตัวเทียบกับ formulary — แนะนำให้ Plan รีวิวเองแบบ spreadsheet cross-check กับ Thai National List of Essential Medicine หรือ BNF for Children ก่อนใช้จริงกับคนไข้ เพราะเป็นความรับผิดชอบทางคลินิกที่ต้องมีผู้เชี่ยวชาญยืนยันทุกตัวเลข ไม่ใช่แค่ตรวจโดยอัตโนมัติ

5. **ไม่มี renal/hepatic dose adjustment หรือ drug-interaction warning** ในทุกโมดูล — เป็นข้อจำกัดที่ยอมรับได้สำหรับ quick-reference tool แต่ควรระบุไว้ชัดใน disclaimer ว่า tool นี้ไม่ครอบคลุมกรณีดังกล่าว

### Disclaimer ที่มีอยู่แล้ว
ทุกแท็บมีข้อความ "WebApp นี้ไม่ใช่ standard ref ตรวจสอบขนาดยาซ้ำก่อนสั่งทุกครั้ง" อยู่แล้ว — เป็น good practice ที่ควรคงไว้ (แค่ลด clutter ตามข้อ UX #7)

---

## สรุปลำดับที่ควรทำก่อน-หลัง

1. แก้บั๊ก Weech <1 ปี (ความถูกต้องทางคลินิก, แก้เร็ว)
2. เติม `maxPerDayMg`/`maxPerDoseMg` ให้ยา PRN ที่มี absolute cap ในหมายเหตุ (ความปลอดภัย)
3. รวมแหล่งน้ำหนักเป็นจุดเดียว (ความปลอดภัย + UX)
4. เพิ่มทางลัดเข้า PALS + key-number highlight (UX ระหว่าง resus)
5. Personalize branding/ชื่อ/credit
6. ที่เหลือ: combobox drug search, mobile bar, Broselow prominence, banner รวม disclaimer
7. รีวิวยาที่เหลือทั้งหมดใน pediatricDose/pediatricATB เทียบ formulary (งานที่ต้องทำเองแบบ manual)
