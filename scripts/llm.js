import 'dotenv/config'
import OpenAI from 'openai'

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export async function generateCommitMessageLLM({
  diff,
  summary,
  repoName = 'repo',
  model = DEFAULT_MODEL,
  temperature = 0.2,
  maxTokens = 300,
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set')
  }

  const client = new OpenAI({ apiKey })

  // Guard extremely large diffs
  let trimmedDiff = diff || ''
  const MAX_CHARS = 80_000
  if (trimmedDiff.length > MAX_CHARS) {
    trimmedDiff = trimmedDiff.slice(0, MAX_CHARS) + '\n...[diff truncated]'
  }

  const system = [
    'You are an expert developer writing concise, high-signal git commit messages.',
    'Rules:',
    '- Use imperative mood, as if completing the sentence: "If applied, this commit will ..."',
    '- Output 1–2 sentences. Aim for <= 100 characters per sentence.',
    '- Mention the most meaningful user-facing change, not implementation trivia.',
    '- Avoid generic noise ("update code", "minor fixes").',
    '- Don’t include code fences or markdown; return plain text only.',
  ].join('\n')

  const prompt = [
    `Repository: ${repoName}`,
    'Changed lines (unified diff follows):',
    trimmedDiff,
    '',
    'High-level summary:',
    summary || '(none)',
    '',
    'Write a clear commit message now (1–2 sentences, plain text only).',
  ].join('\n')

  const resp = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  })

  const text = resp.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('No content from OpenAI')

  // Normalize to a single line or two sentences max; strip wrapping quotes
  return text.replace(/^"|"$/g, '').replace(/\n+/g, ' ').trim()
}

