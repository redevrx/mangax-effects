// Checks every effect in this repository the way the app will when someone installs it, and
// writes index.json — the list the MangaX effect market reads. Works for any effects
// repository with the same layout, not only the official one.
//
//   node tools/check.mjs          check everything
//   node tools/check.mjs --fix    also rewrite index.json from the effect folders
//
// No dependencies. The app's ManifestValidator is the authority; this catches the common
// mistakes before a push instead of on someone's phone.

import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const EFFECTS = join(ROOT, 'effects');
const MAX_MANIFEST = 64 * 1024;
const MAX_FILE = 256 * 1024;

const ID = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/;
const VERSION = /^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/;
const PATTERN = /^(\*|https?):\/\/(\*|\*\.[^/*]+|[^/*]+)(\/.*)$/;
const FILE_SEGMENT = /^[A-Za-z0-9._@+-]+$/;
const OPTION_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const TYPES = ['style', 'action', 'toggle'];
const CATEGORIES = ['reading', 'cleanup', 'appearance', 'navigation', 'utility'];
const ENGINES = ['any', 'manga', 'novel'];
const PERMISSIONS = ['toast'];
const RUN_AT = ['manual', 'pageLoad', 'documentStart'];

const isText = (t) => (typeof t === 'string' && t.trim() !== '') ||
  (t && typeof t === 'object' && Object.values(t).some((v) => typeof v === 'string' && v.trim() !== ''));
const isFile = (f) => typeof f === 'string' && f.length <= 200 && !f.startsWith('/') &&
  f.split('/').every((s) => s !== '.' && s !== '..' && FILE_SEGMENT.test(s));
const isPattern = (p) => p === '<all_urls>' || PATTERN.test(p);

function check(dir) {
  const problems = [];
  const at = join(EFFECTS, dir);
  const manifestPath = join(at, 'effect.json');
  if (!existsSync(manifestPath)) return { problems: ['effect.json is missing'] };
  if (statSync(manifestPath).size > MAX_MANIFEST) problems.push('effect.json is over 64 KB');

  let m;
  try { m = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch (e) { return { problems: [`effect.json: ${e.message}`] }; }

  if (m.schema !== 1) problems.push('schema must be 1');
  if (typeof m.id !== 'string' || m.id.length > 100 || !ID.test(m.id)) problems.push(`id "${m.id}" must look like owner.effect-name`);
  if (typeof m.id === 'string' && m.id.split('.').pop() !== dir) problems.push(`id should end with ".${dir}" to match its folder`);
  if (!VERSION.test(m.version ?? '')) problems.push(`version "${m.version}" must be semver`);
  if (!isText(m.name)) problems.push('name is empty');
  if (!TYPES.includes(m.type)) problems.push(`type must be one of ${TYPES.join(', ')}`);
  if (m.category !== undefined && !CATEGORIES.includes(m.category)) problems.push(`category "${m.category}" is unknown`);
  if (m.runAt !== undefined && !RUN_AT.includes(m.runAt)) problems.push(`runAt "${m.runAt}" is unknown`);

  if (m.type === 'style') {
    if (!m.style) problems.push('a style effect needs "style"');
    if (m.entry) problems.push('a style effect cannot have "entry"');
  }
  if (m.type === 'action') {
    if (!m.entry) problems.push('an action needs "entry"');
    if (m.style) problems.push('an action cannot have "style"');
    if ((m.runAt ?? 'manual') !== 'manual') problems.push('an action must be runAt manual');
  }
  if (m.type === 'toggle' && !m.entry) problems.push('a toggle needs "entry"');

  for (const file of [m.entry, m.style].filter(Boolean)) {
    if (!isFile(file)) { problems.push(`"${file}" is not a file inside the folder`); continue; }
    const path = join(at, file);
    if (!existsSync(path)) { problems.push(`${file} is missing`); continue; }
    if (statSync(path).size > MAX_FILE) problems.push(`${file} is over 256 KB`);
    if (file === m.entry) {
      try { execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' }); }
      catch (e) { problems.push(`${file} does not parse:\n${String(e.stderr).trim()}`); }
      if (!readFileSync(path, 'utf8').includes('mangax.effect(')) problems.push(`${file} never calls mangax.effect(...)`);
    }
  }

  const matches = m.matches ?? ['*://*/*'];
  if (!Array.isArray(matches) || matches.length === 0) problems.push('matches is empty');
  for (const p of [...(matches || []), ...(m.excludes ?? [])]) if (!isPattern(p)) problems.push(`"${p}" is not a site pattern`);
  for (const e of m.engines ?? ['any']) if (!ENGINES.includes(e)) problems.push(`engine "${e}" is unknown`);
  for (const p of m.permissions ?? []) if (!PERMISSIONS.includes(p)) problems.push(`permission "${p}" is not known to the app`);
  for (const u of [m.homepage, m.author?.url].filter(Boolean)) if (!u.startsWith('https://')) problems.push(`"${u}" must be https`);

  if (m.keywords !== undefined && !(Array.isArray(m.keywords) && m.keywords.length <= 20 &&
      m.keywords.every((k) => typeof k === 'string' && k.length <= 40))) {
    problems.push('keywords must be at most 20 strings of up to 40 characters');
  }

  const options = m.options ?? [];
  if (options.length > 20) problems.push('at most 20 options');
  const keys = new Set();
  for (const o of options) {
    const k = o.key;
    if (!OPTION_KEY.test(k ?? '')) problems.push(`option key "${k}" must be a plain identifier`);
    if (keys.has(k)) problems.push(`option key "${k}" is used twice`);
    keys.add(k);
    if (!isText(o.label)) problems.push(`option "${k}" has no label`);
    switch (o.type) {
      case 'boolean': break;
      case 'slider':
        if (!(o.min < o.max)) problems.push(`option "${k}": min must be below max`);
        if ((o.step ?? 1) <= 0) problems.push(`option "${k}": step must be above 0`);
        if (!(o.default >= o.min && o.default <= o.max)) problems.push(`option "${k}": default is outside min..max`);
        break;
      case 'select':
        if (!o.choices?.length) problems.push(`option "${k}" has no choices`);
        else if (!o.choices.some((c) => c.value === o.default)) problems.push(`option "${k}": default is not a choice`);
        break;
      case 'text':
        if (o.maxLength !== undefined && !(o.maxLength >= 1 && o.maxLength <= 2000)) problems.push(`option "${k}": maxLength must be 1..2000`);
        break;
      default: problems.push(`option "${k}": type "${o.type}" is unknown`);
    }
  }
  return { manifest: m, problems };
}

const dirs = readdirSync(EFFECTS).filter((d) => statSync(join(EFFECTS, d)).isDirectory()).sort();
let failed = 0;
const entries = [];
for (const dir of dirs) {
  const { manifest, problems } = check(dir);
  if (problems.length) {
    failed++;
    console.log(`✗ ${dir}\n${problems.map((p) => `   • ${p}`).join('\n')}`);
  } else {
    console.log(`✓ ${dir}  ${manifest.version}`);
    // Everything the market lists and searches, so it never has to open each manifest.
    entries.push({
      id: manifest.id,
      path: `effects/${dir}`,
      version: manifest.version,
      name: manifest.name,
      description: manifest.description ?? '',
      type: manifest.type,
      category: manifest.category ?? 'utility',
      icon: manifest.icon,
      author: manifest.author?.name,
      engines: manifest.engines ?? ['any'],
      keywords: manifest.keywords ?? [],
    });
  }
}

const registryPath = join(ROOT, 'registry.json');
if (existsSync(registryPath)) {
  try {
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    const seen = new Set();
    for (const r of registry.repositories ?? []) {
      if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.test(r.repo ?? '')) {
        failed++; console.log(`✗ registry.json: "${r.repo}" should look like owner/repository`);
      } else if (seen.has(r.repo.toLowerCase())) {
        failed++; console.log(`✗ registry.json: ${r.repo} is listed twice`);
      }
      seen.add((r.repo ?? '').toLowerCase());
    }
    console.log(`✓ registry.json  ${seen.size} repositories`);
  } catch (e) {
    failed++; console.log(`✗ registry.json: ${e.message}`);
  }
}

const indexPath = join(ROOT, 'index.json');
const wanted = { schema: 1, effects: entries };
const current = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
const next = JSON.stringify(wanted, null, 2) + '\n';
if (failed === 0 && current !== next) {
  if (process.argv.includes('--fix')) {
    writeFileSync(indexPath, next);
    console.log('index.json rewritten');
  } else {
    failed++;
    console.log('✗ index.json is out of date with the effect folders — run: node tools/check.mjs --fix');
  }
}
process.exit(failed ? 1 : 0);
