import MarkdownIt from "markdown-it"

// Shared singleton renderer configured for trusted internal markdown messages.
// HTML input is disabled to prevent raw script injection while still allowing
// rich markdown elements (links, images, emphasis, etc.).
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const targetIndex = token.attrIndex("target")
  if (targetIndex < 0) token.attrPush(["target", "_blank"])
  else token.attrs![targetIndex][1] = "_blank"

  const relIndex = token.attrIndex("rel")
  const relValue = "noopener noreferrer"
  if (relIndex < 0) token.attrPush(["rel", relValue])
  else token.attrs![relIndex][1] = relValue

  return defaultLinkOpen(tokens, idx, options, env, self)
}

const defaultImage = md.renderer.rules.image || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const loadingIndex = token.attrIndex("loading")
  if (loadingIndex < 0) token.attrPush(["loading", "lazy"])
  else token.attrs![loadingIndex][1] = "lazy"
  return defaultImage(tokens, idx, options, env, self)
}

export function renderMarkdown(input: string | null | undefined): string {
  if (!input) return ""
  return md.render(String(input))
}
