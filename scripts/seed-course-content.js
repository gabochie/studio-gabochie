import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

const src = readFileSync(join('functions', 'api', 'db', 'setup.js'), 'utf8');
const DB = 'gahq';

// Slugs we need to update
const TARGET_SLUGS = ['web-development', 'digital-marketing', 'freelancing-ai'];

// Extract all backtick template-literals
const regex = /`([^`]+)`/g;
const stmts = [];
let m;
while ((m = regex.exec(src)) !== null) {
  stmts.push(m[1].trim());
}

// Find INSERT statements that match our target slugs
const inserts = stmts.filter(s => {
  if (!s.startsWith('INSERT OR IGNORE INTO programs')) return false;
  return TARGET_SLUGS.some(slug => s.includes(`'${slug}'`));
});

console.log(`Found ${inserts.length} program INSERT statements`);

// Parse each INSERT to extract slug, sample_content, full_content
// Pattern: VALUES (title, slug, tagline, description, duration, price, price_label, status, sample_content, full_content, sort_order)
function parseInsert(sql) {
  const valuesMatch = sql.match(/VALUES\s*\(([\s\S]+)\)\s*$/);
  if (!valuesMatch) return null;
  
  const valuesPart = valuesMatch[1];
  // The values are 11 comma-separated items. We need to split carefully
  // because content contains commas. Split at top level only.
  const parts = splitTopLevel(valuesPart);
  if (parts.length < 11) {
    console.log('Expected 11 parts, got', parts.length);
    return null;
  }
  
  return {
    title: unquote(parts[0]),
    slug: unquote(parts[1]),
    tagline: unquote(parts[2]),
    description: unquote(parts[3]),
    duration: unquote(parts[4]),
    price: parts[5].trim(),
    price_label: unquote(parts[6]),
    status: unquote(parts[7]),
    sample_content: unquote(parts[8]),
    full_content: unquote(parts[9]),
    sort_order: parts[10].trim().replace(')', '')
  };
}

function splitTopLevel(s) {
  const result = [];
  let depth = 0;
  let current = '';
  let inStr = false;
  let quoteChar = null;
  
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    
    if (inStr) {
      current += ch;
      if (ch === quoteChar && s[i-1] !== '\\') {
        // Check for doubled single quotes in SQL
        if (quoteChar === "'" && i + 1 < s.length && s[i+1] === "'") {
          i++; // skip next
          current += "'";
          continue;
        }
        inStr = false;
        quoteChar = null;
      }
      continue;
    }
    
    if (ch === "'" || ch === '"') {
      inStr = true;
      quoteChar = ch;
      current += ch;
      continue;
    }
    
    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth--; current += ch; continue; }
    
    if (ch === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
      continue;
    }
    
    current += ch;
  }
  
  if (current.trim()) result.push(current.trim());
  return result;
}

function unquote(s) {
  s = s.trim();
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    s = s.slice(1, -1);
  }
  // Un-double single quotes for SQL
  s = s.replace(/''/g, "'");
  return s;
}

const updates = [];
for (const sql of inserts) {
  const parsed = parseInsert(sql);
  if (!parsed) {
    console.log('Failed to parse:', sql.substring(0, 100));
    continue;
  }
  
  // Escape single quotes for SQL by doubling them
  const escSample = parsed.sample_content.replace(/'/g, "''");
  const escFull = parsed.full_content.replace(/'/g, "''");
  
  updates.push(`UPDATE programs SET sample_content = '${escSample}', full_content = '${escFull}' WHERE slug = '${parsed.slug}';`);
  console.log(`  Prepared UPDATE for ${parsed.slug} (sample: ${parsed.sample_content.length} chars, full: ${parsed.full_content.length} chars)`);
}

if (updates.length > 0) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'seed-content-'));
  const tmpFile = join(tmpDir, 'seed.sql');
  writeFileSync(tmpFile, updates.join('\n\n'), 'utf8');
  
  console.log(`\nExecuting ${updates.length} UPDATE statements...`);
  try {
    const out = execSync(`npx wrangler d1 execute ${DB} --file="${tmpFile}" --remote 2>&1`, {
      encoding: 'utf8', timeout: 120000
    });
    console.log(out);
    console.log('Content seeded successfully.');
  } catch (e) {
    console.error('Failed:', e.message);
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.log(e.stderr);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
    try { unlinkSync(tmpDir); } catch {}
  }
} else {
  console.log('No updates to execute.');
}
