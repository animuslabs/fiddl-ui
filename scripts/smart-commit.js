#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { generateCommitMessageLLM } from './llm.js'
import 'dotenv/config'

function run(cmd, args = [], opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts })
  if (res.error) throw res.error
  if (res.status !== 0) {
    const err = new Error(`Command failed: ${cmd} ${args.join(' ')}`)
    err.stdout = res.stdout
    err.stderr = res.stderr
    err.status = res.status
    throw err
  }
  return res.stdout || ''
}

function inGitRepo() {
  try {
    const out = run('git', ['rev-parse', '--is-inside-work-tree']).trim();
    return out === 'true'
  } catch {
    return false
  }
}

function getStagedFiles() {
  // Parse name-status, NUL-delimited for safety
  const out = spawnSync('git', ['diff', '--cached', '--name-status', '-z'], { encoding: 'buffer' })
  if (out.error) throw out.error
  if (out.status !== 0) return { added: [], modified: [], deleted: [], renamed: [] }
  const parts = out.stdout.toString('utf8').split('\u0000').filter(Boolean)
  const added = [], modified = [], deleted = [], renamed = []
  for (let i = 0; i < parts.length; ) {
    const status = parts[i++]
    if (!status) break
    if (status.startsWith('R')) {
      const from = parts[i++]
      const to = parts[i++]
      if (from && to) renamed.push({ from, to })
      continue
    }
    const path = parts[i++]
    if (!path) break
    switch (status[0]) {
      case 'A': added.push(path); break
      case 'M': modified.push(path); break
      case 'D': deleted.push(path); break
      default: modified.push(path); break
    }
  }
  return { added, modified, deleted, renamed }
}

function getNumstat() {
  const out = run('git', ['diff', '--cached', '--numstat']).trim()
  let additions = 0, deletions = 0
  const files = new Map()
  if (!out) return { additions, deletions, files }
  for (const line of out.split('\n')) {
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
    if (!m) continue
    const a = m[1] === '-' ? 0 : parseInt(m[1], 10)
    const d = m[2] === '-' ? 0 : parseInt(m[2], 10)
    const file = m[3]
    additions += a; deletions += d
    files.set(file, { a, d })
  }
  return { additions, deletions, files }
}

function topN(arr, n) {
  return arr.slice(0, n)
}

function pickTopFiles(allPaths, n = 3) {
  const score = (p) => {
    if (p === 'index.html') return 100;
    if (p.startsWith('netlify/edge-functions/')) return 90;
    if (p.startsWith('src/lib/')) return 80;
    if (p.startsWith('src/')) return 70;
    if (p.endsWith('.vue')) return 60;
    if (p.endsWith('.ts') || p.endsWith('.js')) return 50;
    return 10;
  }
  return [...allPaths]
    .sort((a, b) => score(b) - score(a))
    .slice(0, n)
}

function areasFromPaths(paths) {
  const areas = new Set();
  for (const p of paths) {
    const seg = p.includes('/') ? p.split('/')[0] : '.'
    areas.add(seg)
  }
  return [...areas]
}

function summarize({ added, modified, deleted, renamed }, numstat) {
  const allChanged = new Set([
    ...added,
    ...modified,
    ...deleted,
    ...renamed.map((r) => r.to)
  ])
  const totalFiles = allChanged.size
  const { additions, deletions } = numstat

  const verbs = [];
  if (added.length) verbs.push('Add')
  if (modified.length) verbs.push('Update')
  if (deleted.length) verbs.push('Remove')
  if (renamed.length) verbs.push('Rename')
  const verbPhrase = verbs.length ? verbs.join('/') : 'Update'

  const topFiles = pickTopFiles([...allChanged], 3)
  const areas = areasFromPaths([...allChanged])

  const one = `${verbPhrase} ${totalFiles} file${totalFiles === 1 ? '' : 's'} (+${additions} / -${deletions}): ${topFiles.join(', ')}.`
  const two = areas.length ? `Touches ${areas.slice(0, 4).join(', ')}.` : ''
  return two ? `${one} ${two}` : one
}

function hasStagedChanges() {
  const res = spawnSync('git', ['diff', '--cached', '--quiet'])
  // exit code 1 means there are differences
  return res.status === 1
}

function currentBranch() {
  try {
    return run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  } catch {
    return ''
  }
}

function pushWithFallback(branch) {
  // Try normal push first
  let res = spawnSync('git', ['push'], { stdio: 'inherit' })
  if (res.status === 0) return 0
  if (!branch) return res.status || 1
  // Try setting upstream to origin/branch
  res = spawnSync('git', ['push', '-u', 'origin', branch], { stdio: 'inherit' })
  return res.status || 1
}

function stageAllChanges() {
  // Stage new, modified, and deleted files according to .gitignore rules
  spawnSync('git', ['add', '-A'], { stdio: 'ignore' })
}

function getRepoName() {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json')
    const text = fs.readFileSync(pkgPath, 'utf8')
    const pkg = JSON.parse(text)
    return pkg?.name || 'repo'
  } catch {
    return 'repo'
  }
}

function getStagedUnifiedDiff() {
  // U0 to keep only changed lines; histogram for better hunks; no color for clean text
  const out = run('git', ['diff', '--cached', '--unified=0', '--no-color', '--diff-algorithm=histogram'])
  return out.trim()
}

async function main() {
  if (!inGitRepo()) {
    console.error('Not a git repository.');
    process.exit(1);
  }

  // Always stage current changes before generating the diff
  stageAllChanges()

  if (!hasStagedChanges()) {
    console.log('No changes to commit.');
    process.exit(0);
  }

  const staged = getStagedFiles()
  const numstat = getNumstat()
  const summary = summarize(staged, numstat)
  const diff = getStagedUnifiedDiff()

  let message = summary
  // Try OpenAI if configured
  if (process.env.OPENAI_API_KEY) {
    try {
      message = await generateCommitMessageLLM({
        diff,
        summary,
        repoName: getRepoName(),
      })
    } catch (e) {
      console.warn('LLM commit generation failed, using fallback summary.')
    }
  }

  console.log('\nCommit message:')
  console.log(message)
  console.log('')

  // Commit
  // If the model returned a multi-line message, pass second line as body
  const [first, ...rest] = message.split('\n')
  const commitArgs = ['commit', '-m', first]
  if (rest.length) {
    commitArgs.push('-m', rest.join('\n'))
  }
  const commitRes = spawnSync('git', commitArgs, { stdio: 'inherit' })
  if (commitRes.status !== 0) {
    process.exit(commitRes.status || 1)
  }

  // Push
  const branch = currentBranch()
  const pushCode = pushWithFallback(branch)
  if (pushCode !== 0) {
    console.error('\nPush failed. Ensure remote and upstream are set.')
  }
  process.exit(pushCode)
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
