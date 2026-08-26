const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const jsonPath = path.join(rootDir, 'dataset.json');
const jsPath = path.join(rootDir, 'dataset.js');

let errors = 0;
let warnings = 0;

function logErr(msg) {
  console.error(`❌ ERROR: ${msg}`);
  errors++;
}

function logWarn(msg) {
  console.warn(`⚠️ WARNING: ${msg}`);
  warnings++;
}

function logInfo(msg) {
  console.log(`ℹ️ INFO: ${msg}`);
}

// Helper: parse dosesPerDay from freq string (mirroring app.js)
function dosesPerDayFromFreq(freq) {
  if (!freq) return null;
  const f = String(freq).trim().toLowerCase();
  let m = f.match(/div(?:ided)?\s*(\d+)/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0) return n;
  }
  m = f.match(/q\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*h/);
  if (m) {
    const h1 = parseFloat(m[1]);
    const h2 = m[2] ? parseFloat(m[2]) : h1;
    const qh = Math.min(h1, h2);
    if (qh > 0) return Math.max(1, Math.round(24 / qh));
  }
  if (/\bqid\b/.test(f)) return 4;
  if (/\btid\b/.test(f)) return 3;
  if (/\bbid\b/.test(f)) return 2;
  if (/\b(od|qd|once\s*daily|once\s*a\s*day|daily)\b/.test(f)) return 1;
  return null;
}

console.log('🔍 Starting ER-PED Dataset Self-Check Validation...\n');

// 1. Validate dataset.json exists and parses
if (!fs.existsSync(jsonPath)) {
  logErr('dataset.json not found!');
  process.exit(1);
}

let dataset;
try {
  const jsonRaw = fs.readFileSync(jsonPath, 'utf8');
  dataset = JSON.parse(jsonRaw);
  logInfo('dataset.json loaded and parsed successfully.');
} catch (e) {
  logErr(`dataset.json failed JSON parse: ${e.message}`);
  process.exit(1);
}

// 2. Validate dataset.js exists and matches dataset.json
if (!fs.existsSync(jsPath)) {
  logErr('dataset.js not found!');
} else {
  const jsRaw = fs.readFileSync(jsPath, 'utf8');
  const expectedJsStart = 'window.ER_PED_DATASET = ';
  if (!jsRaw.startsWith(expectedJsStart)) {
    logErr('dataset.js does not start with "window.ER_PED_DATASET = "');
  } else {
    try {
      const jsJsonPart = jsRaw.substring(expectedJsStart.length).replace(/;\s*$/, '');
      const jsDataset = JSON.parse(jsJsonPart);
      if (JSON.stringify(jsDataset) !== JSON.stringify(dataset)) {
        logErr('dataset.js and dataset.json are out of sync! Run sync build step.');
      } else {
        logInfo('dataset.js is 100% in sync with dataset.json.');
      }
    } catch (e) {
      logErr(`dataset.js failed parsing embedded JSON: ${e.message}`);
    }
  }
}

// 3. Inspect drug tables
const tables = ['pediatricDose', 'pediatricATB'];

tables.forEach(tableName => {
  const list = dataset[tableName];
  if (!Array.isArray(list)) {
    logErr(`Table ${tableName} is missing or not an array`);
    return;
  }

  logInfo(`Checking ${list.length} entries in ${tableName}...`);

  const keys = new Set();

  list.forEach((item, idx) => {
    const ctx = `[${tableName} #${idx + 1} (${item.key || item.drug || 'unknown'})]`;

    // Key uniqueness
    if (!item.key) {
      logErr(`${ctx} Missing key`);
    } else if (keys.has(item.key)) {
      logErr(`${ctx} Duplicate key: ${item.key}`);
    } else {
      keys.add(item.key);
    }

    // Required fields
    if (!item.drug) logErr(`${ctx} Missing 'drug'`);
    if (!item.name) logErr(`${ctx} Missing 'name'`);

    // Min <= Max range check
    if (typeof item.doseMinMgPerKg === 'number' && typeof item.doseMaxMgPerKg === 'number') {
      if (item.doseMinMgPerKg > item.doseMaxMgPerKg) {
        logErr(`${ctx} doseMinMgPerKg (${item.doseMinMgPerKg}) > doseMaxMgPerKg (${item.doseMaxMgPerKg})`);
      }
    }

    // Check loading dose + frequency multiplier mismatch
    if (item.note && /load|loading/i.test(item.note) && item.unitType === 'perDose') {
      const nDay = dosesPerDayFromFreq(item.freq);
      if (nDay && nDay > 1 && !/maintenance|then/i.test(item.freq)) {
        logWarn(`${ctx} Entry appears to be a loading dose but has daily freq '${item.freq}' (${nDay}x/day)`);
      }
    }

    // Check max daily caps in note vs JSON fields
    if (item.note) {
      // e.g. "Max 60 mg/day"
      const mDay = item.note.match(/Max\s+(\d+(?:\.\d+)?)\s*mg\/day/i);
      if (mDay) {
        const noteMax = parseFloat(mDay[1]);
        if (!item.maxPerDayMg) {
          logWarn(`${ctx} Note specifies Max ${noteMax} mg/day but maxPerDayMg is missing in JSON!`);
        } else if (item.maxPerDayMg !== noteMax) {
          logWarn(`${ctx} maxPerDayMg (${item.maxPerDayMg}) does not match Note Max ${noteMax} mg/day`);
        }
      }

      // e.g. "Max 4 g/day" -> 4000 mg
      const mGramDay = item.note.match(/Max\s+(\d+(?:\.\d+)?)\s*g\/day/i);
      if (mGramDay) {
        const noteMaxMg = parseFloat(mGramDay[1]) * 1000;
        if (!item.maxPerDayMg) {
          logWarn(`${ctx} Note specifies Max ${mGramDay[1]} g/day (${noteMaxMg} mg) but maxPerDayMg is missing!`);
        } else if (item.maxPerDayMg !== noteMaxMg) {
          logWarn(`${ctx} maxPerDayMg (${item.maxPerDayMg}) does not match Note Max ${noteMaxMg} mg`);
        }
      }
    }

    // DoseBands structure check
    if (Array.isArray(item.doseBands)) {
      item.doseBands.forEach((band, bIdx) => {
        if (typeof band.doseMg !== 'number' && typeof band.doseUnits !== 'number' && (!band.minUnits || !band.maxUnits)) {
          logErr(`${ctx} doseBands[${bIdx}] missing valid dose amount`);
        }
      });
    }
  });
});

// 4. Validate evidenceReferences registry
if (!dataset.evidenceReferences || typeof dataset.evidenceReferences !== 'object') {
  logErr('dataset.evidenceReferences is missing or not an object!');
} else {
  const refKeys = Object.keys(dataset.evidenceReferences);
  logInfo(`Checking ${refKeys.length} clinical evidence references in registry...`);
  const requiredFields = ['title', 'organization', 'year', 'loe', 'summary'];
  refKeys.forEach(k => {
    const ref = dataset.evidenceReferences[k];
    requiredFields.forEach(f => {
      if (!ref[f]) {
        logErr(`[evidenceReferences: ${k}] Missing required field '${f}'`);
      }
    });
  });
}

console.log('\n----------------------------------------');
console.log(`Validation Complete: ${errors} Error(s), ${warnings} Warning(s)`);
console.log('----------------------------------------\n');

if (errors > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
