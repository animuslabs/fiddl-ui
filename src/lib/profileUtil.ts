export class ProfileMeta {
  links: [string, string][] = []
  media: [string, string][] = []
  text: [string, string][] = []
  extra?: [string, string][] = []
}

export function parseProfileMeta(meta: ProfileMeta | undefined): ParsedAccountMeta {
  const parsed = new ParsedAccountMeta()
  if (meta) {
    parsed.text = Object.assign(parsed.text, normalizeArr(meta.text))
    parsed.media = Object.assign(parsed.media, normalizeArr(meta.media))
  }

  return parsed
}

export class ParsedAccountMeta {
  text: {
    tagline: string
    info: string
    telosAccount: string
  } = {
    tagline: "",
    info: "",
    telosAccount: "",
  }

  media: {
    profile: string
    banner: string
  } = {
    profile: "",
    banner: "",
  }
}

const normalizeArr = (arr: [string, string][] | undefined) => {
  const obj: Record<string, string> = {}
  if (arr) {
    arr.forEach((el) => {
      obj[el[0]] = el[1]
    })
  }
  return obj
}

export function parseAccountMeta(meta: ProfileMeta | undefined): ParsedAccountMeta {
  const parsed = new ParsedAccountMeta()

  // Check if meta is defined before accessing its properties
  if (meta) {
    parsed.text = Object.assign(parsed.text, normalizeArr(meta.text))
    parsed.media = Object.assign(parsed.media, normalizeArr(meta.media))
  }

  return parsed
}
