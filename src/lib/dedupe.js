// One-time cleanup utility for duplicate rows that can accumulate in
// app_data from race-condition-era saves. Removes exact-duplicate entries
// (every field identical) within each array section — safe because two
// records are only considered duplicates if they match completely, so
// genuinely different records (even with the same invoice number, say)
// are never touched.

function dedupeArray(arr) {
  const seen = new Set();
  const unique = [];
  let removed = 0;
  for (const item of arr) {
    const key = JSON.stringify(item);
    if (seen.has(key)) {
      removed++;
    } else {
      seen.add(key);
      unique.push(item);
    }
  }
  return { unique, removed };
}

/** Returns { section: removedCount } for every array section with duplicates, plus a total. */
export function scanForDuplicates(DB) {
  const report = {};
  let total = 0;
  for (const key of Object.keys(DB)) {
    if (!Array.isArray(DB[key])) continue;
    const { removed } = dedupeArray(DB[key]);
    if (removed > 0) {
      report[key] = removed;
      total += removed;
    }
  }
  return { report, total };
}

/** Returns a cleaned copy of DB with duplicate entries removed from every array section. */
export function dedupeDB(DB) {
  const next = { ...DB };
  for (const key of Object.keys(DB)) {
    if (!Array.isArray(DB[key])) continue;
    next[key] = dedupeArray(DB[key]).unique;
  }
  return next;
}
