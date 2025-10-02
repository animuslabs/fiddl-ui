import { TranscriptLine, type BaseCreationRequest, type MediaType, type UnifiedRequest, type UnifiedCreationRequest } from "lib/types"
import { formatDistanceToNow } from "date-fns"
import cryptoJs from "crypto-js"
import type { TRPCClientError } from "@trpc/client"
import type { AppRouter } from "lib/server"
import { Dialog, LocalStorage, SessionStorage } from "quasar"
import umami from "lib/umami"
import stripAnsi from "strip-ansi"
import type { CustomModelType, FineTuneType } from "fiddl-server/node_modules/@prisma/client"
import type { CreateImageRequestData, CreateVideoRequestData } from "fiddl-server/dist/lib/types/serverTypes"
import { match } from "ts-pattern"
import { creationsGetImageRequest, creationsGetVideoRequest, creationsPurchaseMedia, type CreationsGetImageRequest200, type CreationsGetVideoRequest200 } from "lib/orval"
import { prices } from "src/stores/pricesStore"
/**
 * Shares an image or video via the native share feature, with a fallback for unsupported devices.
 * @param title - The title of the content being shared.
 * @param text - The text description of the content being shared.
 * @param mediaUrl - The URL of the media (image or video) to be shared.
 * @param filename - The desired filename for the shared or downloaded media.
 */
export async function shareMedia(title: string, text: string, mediaUrl: string, filename: string): Promise<void> {
  if (navigator.share && navigator.canShare) {
    try {
      const response = await fetch(mediaUrl)
      const blob = await response.blob()
      const file = new File([blob], filename, { type: blob.type })

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text,
          files: [file],
        })
        console.log("Media shared successfully!")
      } else {
        console.error("This device cannot share the provided media.")
        fallbackShare(mediaUrl, filename)
      }
    } catch (error) {
      console.error("Error sharing the media:", error)
      fallbackShare(mediaUrl, filename)
    }
  } else {
    console.warn("Web Share API is not supported or file sharing is unavailable on this device.")
    fallbackShare(mediaUrl, filename)
  }
}
export async function shareLink(title: string, text: string, url: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
    } catch (err) {
      console.error("Error sharing link", err)
      copyToClipboard(url)
      Dialog.create({
        title: "Link Copied",
        message: "Link copied to clipboard instead.",
      })
    }
  } else {
    copyToClipboard(url)
    Dialog.create({
      title: "Link Copied",
      message: "Link copied to clipboard.",
    })
  }
}
/**
 * Fallback for sharing: Downloads or opens the image in a new tab.
 * @param imageUrl - The URL of the image to be shared.
 * @param filename - The desired filename for the downloaded image.
 */
function fallbackShare(imageUrl: string, filename: string): void {
  const a = document.createElement("a")
  a.href = imageUrl
  a.download = filename
  a.target = "_blank"
  a.click()
}

export function extractImageId(url: string): string | null {
  const regex = /\/images\/([a-f0-9-]+)-/
  const match = url.match(regex)
  return match && match[1] ? match[1] : null
}

export function generateShortHash(input: string): string {
  // return crypto.createHash("md5").update(input).digest("base64").slice(0, 8)
  return cryptoJs.HmacMD5(input, "Key").toString()
}

export const catchErr = (err: TRPCClientError<AppRouter> | any) => {
  console.error(err)
  const cleanErr = stripAnsi(err.message || err.toString())
  umami.track("error", { message: err.message, error: err })
  let message = cleanErr
  if (err.response?.data?.message) message = stripAnsi(err.response.data.message)
  Dialog.create({
    title: "Error",
    message,
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
  const result = formatDistanceToNow(date, { addSuffix: true })
  const includesAbout = result.includes("about")
  return includesAbout ? result.replace("about ", "") : result
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

export async function generateThumbnail(file: File, maxSize = 512): Promise<Blob> {
  const img = new Image()
  img.src = URL.createObjectURL(file)

  await new Promise((resolve) => (img.onload = resolve))

  const canvas = document.createElement("canvas")
  const scale = Math.min(maxSize / img.width, maxSize / img.height)
  canvas.width = img.width * scale
  canvas.height = img.height * scale

  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/webp", 0.75)
  })
}

export async function generateThumbnails(files: File[]): Promise<{ id: string; blob: Blob }[]> {
  return Promise.all(
    files.map(async (file) => ({
      id: crypto.randomUUID(),
      blob: await generateThumbnail(file),
    })),
  )
}

export function trainModelPrice(modelType: CustomModelType, fineTuneType: FineTuneType): number {
  return prices.forge.trainBaseModel[modelType] + prices.forge.fineTuneType[fineTuneType]
}

export function getCookie(name: string): string | null {
  const escapedName = name.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1")
  const match = document.cookie.match(new RegExp(`(^| )${escapedName}=([^;]+)`))
  if (!match) return null
  return match[2] ? decodeURIComponent(match[2]) : null
}

export function normalizeCreation(creation: CreateImageRequestData | CreateVideoRequestData): UnifiedCreationRequest {
  const isImage = (creation as any).imageIds != null
  const mediaIds = (isImage ? (creation as any).imageIds : (creation as any).videoIds) as string[]
  const createdAtRaw = (creation as any).createdAt as any
  const createdAt = createdAtRaw instanceof Date ? createdAtRaw : new Date(createdAtRaw)
  const base: BaseCreationRequest = {
    id: (creation as any).id as string,
    mediaIds,
    createdAt,
    aspectRatio: (creation as any).aspectRatio || "1:1",
    public: !!(creation as any).public,
    creatorId: (creation as any).creatorId || "",
    prompt: (creation as any).prompt,
    seed: (creation as any).seed,
    model: (creation as any).model,
    quantity: Number((creation as any).quantity || 1),
  }

  if ((creation as any).imageIds != null) {
    return {
      ...base,
      type: "image",
      negativePrompt: (creation as any).negativePrompt,
      customModelId: (creation as any).customModelId,
      customModelName: (creation as any).customModelName,
    }
  } else {
    return {
      ...base,
      type: "video",
      duration: (creation as any).duration,
    }
  }
}

export function toUnifiedCreation(creation: CreateImageRequestData | CreateVideoRequestData): UnifiedRequest {
  const isImage = (creation as any).imageIds != null
  const createdAtRaw = (creation as any).createdAt as any
  const createdAt = createdAtRaw instanceof Date ? createdAtRaw : new Date(createdAtRaw)
  return {
    id: (creation as any).id as string,
    mediaIds: isImage ? ((creation as any).imageIds as string[]) : ((creation as any).videoIds as string[]),
    createdAt,
    aspectRatio: (creation as any).aspectRatio || "1:1",
    public: !!(creation as any).public,
    creatorId: (creation as any).creatorId || "",
    creatorUsername: (creation as any).creatorUsername || "",
    prompt: (creation as any).prompt,
    seed: (creation as any).seed,
    model: (creation as any).model,
    quantity: Number((creation as any).quantity || 1),
    negativePrompt: (creation as any).negativePrompt,
    customModelId: (creation as any).customModelId,
    customModelName: (creation as any).customModelName,
    duration: (creation as any).duration,
    startImageId: (creation as any).startImageId,
    uploadedStartImageId: (creation as any).uploadedStartImageId,
    type: isImage ? "image" : "video",
  }
}

export async function getCreationRequest(requestId: string, type: MediaType) {
  const { data } = await match(type)
    .with("image", () => creationsGetImageRequest({ imageRequestId: requestId }))
    .with("video", () => creationsGetVideoRequest({ videoRequestId: requestId }))
    .exhaustive()
  return unifiyRequest(data)
}

export async function preloadHdVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.src = url
    video.preload = "auto"
    video.muted = true
    video.playsInline = true

    const timeout = setTimeout(() => reject(new Error("HD preload timeout")), 18000)

    video.oncanplay = async () => {
      clearTimeout(timeout)
      await sleep(2000)
      resolve(video)
    }

    video.onerror = () => {
      clearTimeout(timeout)
      reject(new Error("HD video failed to load"))
    }

    video.load()
  })
}
export function unifiyRequest(request: CreationsGetImageRequest200 | CreationsGetVideoRequest200): UnifiedRequest {
  const mediaIds = "imageIds" in request ? request.imageIds : request.videoIds
  return { ...request, mediaIds, type: "imageIds" in request ? "image" : "video", createdAt: new Date(request.createdAt) }
}

export function triggerDownload(url: string, filename: string) {
  try {
    const tg: any = (typeof window !== "undefined" ? (window as any)?.Telegram?.WebApp : null)
    const inTma = Boolean((typeof window !== "undefined" ? (window as any)?.__TMA__?.enabled : false) && tg && typeof tg.downloadFile === "function")
    if (inTma) {
      try {
        tg.downloadFile({ url, file_name: filename, filename }, () => {})
        return
      } catch {}
    }
  } catch {}
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export async function purchaseMedia(mediaId: string, type: MediaType) {
  await creationsPurchaseMedia({ [type == "image" ? "imageId" : "videoId"]: mediaId })
  SessionStorage.removeItem(`noHd${type}-` + mediaId)
}

export function arraysEqual(a: unknown[], b: unknown[]) {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function decodeHtmlEntities(input: string): string {
  if (!input) return ""
  const basicNamed: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: String.fromCharCode(160),
  }

  let result = input
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (match, name) => basicNamed[name] ?? match)

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const textarea = document.createElement("textarea")
    textarea.innerHTML = result
    result = textarea.value
  }

  return result
}

export function goToModelPage(router: any, modelName: string, customModelId?: string) {
  if (customModelId) {
    router.push({ name: "model", params: { modelName, customModelId } })
  } else {
    router.push({ name: "model", params: { modelName } })
  }
}
// @ts-nocheck
