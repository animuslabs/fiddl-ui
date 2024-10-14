import { TranscriptLine } from "lib/types"
import { formatDistanceToNow } from "date-fns"
import crypto from "crypto-js"
import type { TRPCClientError } from "@trpc/client"
import type { AppRouter } from "lib/server"
import { Dialog } from "quasar"
import umami from "lib/umami"

/**
 * Extracts the image ID from the URL.
 * @param url - The URL containing the image ID.
 * @returns The extracted image ID or null if not found.
 */
export function extractImageId(url: string): string | null {
  const regex = /\/images\/([a-f0-9-]+)-/
  const match = url.match(regex)
  return match && match[1] ? match[1] : null
}

/**
 * Generates a shortened hash from a given string.
 * @param input - The input string to hash.
 * @returns A shortened hash (8 characters).
 */
export function generateShortHash(input: string): string {
  // return crypto.createHash("md5").update(input).digest("base64").slice(0, 8)
  return crypto.HmacMD5(input, "Key").toString()
}

// Example usage
const url = "http://localhost:4444/images/2e63a85c-3d16-4f89-aa6c-5db32b9c1c1b-lg.webp"
const imageId = extractImageId(url)

export const catchErr = (err: TRPCClientError<AppRouter>) => {
  console.error(err)
  umami.track("error", { message: err.message, error: err })
  Dialog.create({
    title: "Error",
    message: err.message,
    ok: true,
  })
}

if (imageId) {
  const shortHash = generateShortHash(imageId)
  console.log(shortHash) // Outputs: shortened hash
}

export function timeSince(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true })
}
export function normalizePhoneNumber(phoneNumber: string, defaultCountryCode = "+1") {
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
export function loadScript(src: string) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.type = "text/javascript"
    script.src = src
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function downloadFile(dataUrl: any, fileName: string) {
  // console.log("Downloading file...", dataUrl, fileName)
  try {
    const [metadata, base64] = dataUrl.split(",")
    const mime = metadata.match(/:(.*?);/)[1]
    const binary = atob(base64)
    const arrayBuffer = new Uint8Array(binary.length)

    for (let i = 0; i < binary.length; i++) {
      arrayBuffer[i] = binary.charCodeAt(i)
    }

    const blob = new Blob([arrayBuffer], { type: mime })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error("Error downloading file:", error)
  }
}
export function downloadImage(imageUrl: string, filename = "downloaded-image") {
  fetch(imageUrl)
    .then((response) => response.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    })
    .catch((error) => console.error("Image download failed:", error))
}

// export function downloadImage(imageUrl: string, filename = "downloaded-image") {
//   const link = document.createElement("a")
//   link.href = imageUrl
//   link.download = filename
//   document.body.appendChild(link)
//   link.click()
//   document.body.removeChild(link)
// }

export function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      console.log("Text copied to clipboard")
    })
    .catch((err) => {
      console.error("Error copying text: ", err)
    })
}

export function formatTranscriptForDocs(transcripts: TranscriptLine[], speakerNames?: Record<string, string>): string {
  return transcripts
    .map((transcript) => {
      const name = speakerNames ? speakerNames[transcript.speaker] : transcript.speaker
      if (name) transcript.speaker = name
      if (transcript.text.length === 0) return ""
      return `
${transcript.speaker}

${transcript.text}

${transcript.startTime.toFixed(0)}s - ${transcript.endTime.toFixed(0)}s
    `
    })
    .join("\n")
}

export function getSpeakerName(speaker: string, speakerNames: Record<string, string>, callerName: string): string {
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

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function shuffle<T>(array: T[]) {
  let currentIndex = array.length
  let temporaryValue: T | undefined
  let randomIndex: number
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex -= 1
    temporaryValue = array[currentIndex]
    array[currentIndex] = array[randomIndex] as T
    array[randomIndex] = temporaryValue as T
  }

  return array
}
export function throwErr(...messages: any[]): never {
  const strMessages = messages.map((el) => (typeof el === "object" ? JSON.stringify(el, null, 2) : el.toString()))
  const errorMessage = strMessages.join(" ")
  throw new Error(errorMessage)
}

export function extractAndParseJSON(input: string): any {
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

export function rand(min: number, max: number) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function toObject(data: any) {
  return JSON.parse(
    JSON.stringify(
      data,
      (key, value) => (typeof value === "bigint" ? value.toString() : value), // return everything else unchanged
    ),
  )
}

export function toInt(num: bigint): number {
  return parseInt(num.toString())
}
export function pickRand<T>(arr: T[]): T {
  const randomIndex = Math.floor(Math.random() * arr.length)
  return arr[randomIndex] as T
}
export function removeDuplicates<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}
