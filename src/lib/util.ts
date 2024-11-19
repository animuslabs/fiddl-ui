import { TranscriptLine } from "lib/types"
import { formatDistanceToNow } from "date-fns"
import crypto from "crypto-js"
import type { TRPCClientError } from "@trpc/client"
import type { AppRouter } from "lib/server"
import { Dialog, LocalStorage } from "quasar"
import umami from "lib/umami"

export function extractImageId(url: string): string | null {
  const regex = /\/images\/([a-f0-9-]+)-/
  const match = url.match(regex)
  return match && match[1] ? match[1] : null
}

export function generateShortHash(input: string): string {
  // return crypto.createHash("md5").update(input).digest("base64").slice(0, 8)
  return crypto.HmacMD5(input, "Key").toString()
}

export const catchErr = (err: TRPCClientError<AppRouter> | any) => {
  console.error(err)
  umami.track("error", { message: err.message, error: err })
  Dialog.create({
    title: "Error",
    message: err.message,
    ok: true,
  })
}
export function getReferredBy(): string | undefined {
  return (LocalStorage.getItem("referredBy") as string) || undefined
}
export function setReferredBy(referredBy: string) {
  LocalStorage.set("referredBy", referredBy)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function shortIdToLong(base64url: string): string {
  // Convert Base64 URL encoding to standard Base64
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/")
  // Pad the Base64 string to make its length a multiple of 4
  const paddingNeeded = (4 - (base64.length % 4)) % 4
  base64 += "=".repeat(paddingNeeded)
  // Decode the Base64 string to an ArrayBuffer
  const buffer = base64ToArrayBuffer(base64)
  const bytes = new Uint8Array(buffer)
  // Convert the byte array to a hex string
  let hexStr = ""
  for (let i = 0; i < bytes.length; i++) {
    //@ts-ignore
    hexStr += bytes[i].toString(16).padStart(2, "0")
  }
  // Re-insert hyphens to format it as a UUID
  const uuid = `${hexStr.substr(0, 8)}-${hexStr.substr(8, 4)}-${hexStr.substr(12, 4)}-${hexStr.substr(16, 4)}-${hexStr.substr(20)}`
  return uuid
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    //@ts-ignore
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function longIdToShort(uuid: string): string {
  // Remove hyphens from the UUID
  const hexStr = uuid.replace(/-/g, "")
  // Convert the hex string to a Uint8Array
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hexStr.substr(i * 2, 2), 16)
  }
  // Convert the byte array to a Base64 string
  const base64 = arrayBufferToBase64(bytes.buffer)
  // Convert Base64 to Base64 URL encoding
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return base64url
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

type QueryParams = Record<string, string | number | boolean | null | undefined>

export function updateQueryParams(params: QueryParams): void {
  const currentParams = new URLSearchParams(window.location.search)

  // Update or add each key-value pair in `params`
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      currentParams.delete(key) // Remove key if value is null or undefined
    } else {
      currentParams.set(key, String(value)) // Convert value to string
    }
  })

  // Update the URL without reloading the page
  window.history.replaceState(null, "", `${window.location.pathname}?${currentParams.toString()}`)
}

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
