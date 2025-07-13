import { Base64URLString, CredentialDeviceType } from "@simplewebauthn/types"

export type OutputFormat = "jpeg" | "png" | "webp"
export type StabilityAIContentResponse = {
  filepath: string
  filename: string
  contentType: "image" | "video" | "3d"
  outputFormat: OutputFormat | "mp4" | "glb"
  contentFiltered: boolean
  errored: boolean
  seed: number
}
export interface EssentialLinkProps {
  title: string
  caption?: string
  link?: string
  icon?: string
}
export type DevicePublicKeyAuthenticatorOutput = {
  dpk?: Uint8Array
  sig?: string
  nonce?: Uint8Array
  scope?: Uint8Array
  aaguid?: Uint8Array
}
export type UVMAuthenticatorOutput = {
  uvm?: Uint8Array[]
}

export type AuthenticationExtensionsAuthenticatorOutputs = {
  devicePubKey?: DevicePublicKeyAuthenticatorOutput
  uvm?: UVMAuthenticatorOutput
}
export declare function decodeAuthenticatorExtensions(extensionData: Uint8Array): AuthenticationExtensionsAuthenticatorOutputs | undefined

export type VerifiedAuthenticationResponse = {
  verified: boolean
  authenticationInfo: {
    credentialID: string
    newCounter: number
    userVerified: boolean
    credentialDeviceType: CredentialDeviceType
    credentialBackedUp: boolean
    origin: string
    rpID: string
    authenticatorExtensionResults?: AuthenticationExtensionsAuthenticatorOutputs
  }
}
export type AttestationFormat = "fido-u2f" | "packed" | "android-safetynet" | "android-key" | "tpm" | "apple" | "none"

export type VerifiedRegistrationResponse = {
  verified: boolean
  registrationInfo?: {
    fmt: AttestationFormat
    counter: number
    aaguid: string
    credentialID: Base64URLString
    credentialPublicKey: Uint8Array
    credentialType: "public-key"
    attestationObject: Uint8Array
    userVerified: boolean
    credentialDeviceType: CredentialDeviceType
    credentialBackedUp: boolean
    origin: string
    rpID?: string
    authenticatorExtensionResults?: AuthenticationExtensionsAuthenticatorOutputs
  }
}

export interface FileUpload {
  id: string
  fileName: string
  fileHash: string
  createdAt: Date
  userId: string
  processing: boolean
  transcription: string | null
  shortSummary: string | null
  longSummary: string | null
  keyDataPoints: Record<string, any>[]
  speakerNames: string | null
}
export interface UserFile {
  id: string
  createdAt: Date
  fileName: string
  name?: string
}
export class TranscriptLine {
  index: number = 0
  text: string = ""
  speaker: string = "0"
  startTime: number = 0
  endTime: number = 0
}

export interface TranscriptionLineEvent {
  type: "transcriptLine" | "tempTranscriptLine"
  data: TranscriptLine | TranscriptLine[]
}

export type BaseCreationRequest = {
  id: string
  mediaIds: string[]
  createdAt: Date
  aspectRatio: string
  public: boolean
  creatorId: string
  prompt?: string
  seed?: number
  model?: string
  quantity: number
}
type ImageCreationExtension = {
  type: "image"
  negativePrompt?: string
  customModelId?: string
  customModelName?: string
}

type VideoCreationExtension = {
  type: "video"
  duration?: number
}
export type UnifiedCreationRequest = (BaseCreationRequest & ImageCreationExtension) | (BaseCreationRequest & VideoCreationExtension)

export type UnifiedCreation = {
  id: string
  mediaIds: string[]
  createdAt: Date
  aspectRatio: string
  public: boolean
  creatorId: string
  prompt?: string
  seed?: number
  model?: string
  quantity: number

  // Image-only optional fields
  negativePrompt?: string
  customModelId?: string
  customModelName?: string

  // Video-only optional fields
  duration?: number

  // Helpful for filtering or UI branching
  type: "image" | "video"
}
