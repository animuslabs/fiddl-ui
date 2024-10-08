import { LivePrompt } from "lib/prisma"
import { TranscriptLine } from "lib/types"

export function normalizePhoneNumber(phoneNumber:string, defaultCountryCode = "+1") {
  // Remove all non-digit characters except the plus sign
  const cleaned = phoneNumber.replace(/[^\d+]/g, "")

  // Check if the phone number starts with a plus sign, prepend default country code if not
  const formatted = cleaned.startsWith("+") ? cleaned : defaultCountryCode + cleaned

  // Validate the formatted phone number
  const isValid = /^\+\d{10,15}$/.test(formatted)
  if (!isValid) {
    throw new Error("invalid phone number")
  }
  // Encode the phone number to be URL safe
  return encodeURIComponent(formatted)
}
export function loadScript(src:string) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
export async function downloadFile(data:any, fileName:string) {
  try {
    console.log("download file data")
    const url = window.URL.createObjectURL(new Blob([data]))
    const a = document.createElement("a")
    a.href = url
    a.download = `${fileName}` // Suggested filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url) // Clean up the URL object
  } catch (error) {
    console.error("Error downloading file:", error)
  }
}

export function copyToClipboard(text:string) {
  navigator.clipboard.writeText(text).then(() => {
    console.log("Text copied to clipboard")
  }).catch(err => {
    console.error("Error copying text: ", err)
  })
}


export function PromptsToMarkdown(dataArray:LivePrompt[]):string {
  return dataArray.map(data => {
    return `
// ### Prompt ID: ${data.id}

// **Created At:** ${new Date(data.createdAt).toLocaleString()}

// **Updated At:** ${new Date(data.updatedAt).toLocaleString()}

**Prompt:**
\`\`\`
${data.promptText}
\`\`\`

**Response:**
\`\`\`
${data.promptResponse}
\`\`\`
    `
  }).join("\n")
}

export function promptsToDoc(dataArray:LivePrompt[]):string {
  return dataArray.map(data => {
    return `
Prompt:
${data.promptText}

Response:
${data.promptResponse}
    `
  }).join("\n")
}

export function formatTranscriptForDocs(transcripts:TranscriptLine[], speakerNames?:Record<string, string>):string {
  return transcripts.map(transcript => {
    const name = speakerNames ? speakerNames[transcript.speaker] : transcript.speaker
    if (name) transcript.speaker = name
    if (transcript.text.length === 0) return ""
    return `
${transcript.speaker}

${transcript.text}

${transcript.startTime.toFixed(0)}s - ${transcript.endTime.toFixed(0)}s
    `
  }).join("\n")
}

export function getSpeakerName(speaker:string, speakerNames:Record<string, string>, callerName:string):string {
  if (!speakerNames) return "Speaker:" + speaker
  let newSpeaker = speakerNames[speaker]
  if (newSpeaker) return newSpeaker
  const firstDigit = speaker.charAt(0)
  newSpeaker = speakerNames[firstDigit]
  if (newSpeaker) return newSpeaker
  if (!newSpeaker && speaker[0] == "2") return callerName
  if (!newSpeaker) return "Speaker:" + speaker
  else return ""
}

export const sleep = async(ms:number) => new Promise(resolve => setTimeout(resolve, ms))

export function shuffle<T>(array:T[]) {
  let currentIndex = array.length
  let temporaryValue:T | undefined
  let randomIndex:number
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex -= 1
    temporaryValue = array[currentIndex]
    array[currentIndex] = array[randomIndex] as T
    array[randomIndex] = temporaryValue as T
  }

  return array
}
export function throwErr(...messages:any[]):never {
  let strMessages = messages.map(el => (typeof el === "object") ? JSON.stringify(el, null, 2) : el.toString())
  const errorMessage = strMessages.join(" ")
  throw new Error(errorMessage)
}

export function extractAndParseJSON(input:string):any {
  // Regular expression to find JSON wrapped in triple backticks optionally followed by "json"
  const regex = /```json\s*([\s\S]*?)\s*```/
  const match = input.match(regex)

  if (match && match[1]) {
    try {
      const jsonObject = JSON.parse(match[1])
      return jsonObject
    } catch (error) {
      console.error("Failed to parse JSON", error)
      return null // or return an appropriate error/message
    }
  } else {
    try {
      const jsonObject = JSON.parse(input)
      return jsonObject
    } catch (error) {
      console.error("Failed to parse JSON", error, input)
      return null // or return an appropriate error/message
    }
  }
}

export function rand(min:number, max:number) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function toObject(data:any) {
  return JSON.parse(JSON.stringify(data, (key, value) =>
    typeof value === "bigint"
      ? value.toString()
      : value // return everything else unchanged
  ))
}

export function toInt(num:BigInt):number {
  return parseInt(num.toString())
}
export function pickRand<T>(arr:T[]):T {
  const randomIndex = Math.floor(Math.random() * arr.length)
  return arr[randomIndex] as T
}
export function removeDuplicates<T>(arr:T[]):T[] {
  return Array.from(new Set(arr))
}

export function jsonToMarkdown(json:any[]) {
  let markdown = ""
  function formatValue(value:any):any {
    if (typeof value === "string") {
      // Trim leading and trailing whitespace and newlines, then replace multiple whitespace with a single space
      let cleanedString = value

      try {
        // Attempt to parse and pretty-print if the string is JSON
        let parsed = JSON.parse(cleanedString)
        return "```\n" + JSON.stringify(parsed, null, 2) + "\n```"
      } catch (e) {
        // If it's not JSON, return the cleaned string
        return cleanedString
      }
    } else if (Array.isArray(value)) {
      return value.map(item => formatValue(item)).join("\n")
    } else if (typeof value === "object" && value !== null) {
      return jsonToMarkdown(value)
    } else {
      return value
    }
  }
  let object = Object.assign({}, json)
  for (let key in object) {
    if (json.hasOwnProperty(key)) { // eslint-disable-line no-prototype-builtins
      markdown += `**${key}:**\n${formatValue(json[key as any])}\n\n`
    }
  }

  return markdown
}
