import {
  AuthenticationResponseJSON, AuthenticatorTransportFuture, Base64URLString, CredentialDeviceType, PublicKeyCredentialCreationOptionsJSON

  , PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON
} from "@simplewebauthn/types"

export interface EssentialLinkProps {
  title:string;
  caption?:string;
  link?:string;
  icon?:string;
}
export type DevicePublicKeyAuthenticatorOutput = {
  dpk?:Uint8Array;
  sig?:string;
  nonce?:Uint8Array;
  scope?:Uint8Array;
  aaguid?:Uint8Array;
};
export type UVMAuthenticatorOutput = {
  uvm?:Uint8Array[];
};

export type AuthenticationExtensionsAuthenticatorOutputs = {
  devicePubKey?:DevicePublicKeyAuthenticatorOutput;
  uvm?:UVMAuthenticatorOutput;
};
export declare function decodeAuthenticatorExtensions(
  extensionData:Uint8Array):AuthenticationExtensionsAuthenticatorOutputs |
  undefined;



export type VerifiedAuthenticationResponse = {
  verified:boolean; authenticationInfo:{
    credentialID:string; newCounter:number; userVerified:boolean;
    credentialDeviceType:CredentialDeviceType;
    credentialBackedUp:boolean;
    origin:string;
    rpID:string;
    authenticatorExtensionResults?:AuthenticationExtensionsAuthenticatorOutputs;
  };
};
export type AttestationFormat =
  "fido-u2f" | "packed" | "android-safetynet" | "android-key" | "tpm" | "apple" | "none";

export type VerifiedRegistrationResponse = {
  verified:boolean;
  registrationInfo?:{
    fmt:AttestationFormat; counter:number; aaguid:string;
    credentialID:Base64URLString;
    credentialPublicKey:Uint8Array;
    credentialType:"public-key";
    attestationObject:Uint8Array;
    userVerified:boolean;
    credentialDeviceType:CredentialDeviceType;
    credentialBackedUp:boolean;
    origin:string;
    rpID?:string;
    authenticatorExtensionResults?:AuthenticationExtensionsAuthenticatorOutputs;
  };
};


export interface UserData {
  id:string
  webauthnUserID:string | null
  name:string | null
  email:string | null
  phone:string | null
  currentPassKeyChallenge:string | null
}


export interface FileUpload {
  id:string
  fileName:string
  fileHash:string
  createdAt:Date
  userId:string
  processing:boolean
  transcription:string | null
  shortSummary:string | null
  longSummary:string | null
  keyDataPoints:Record<string, any>[]
  speakerNames:string | null
}
export interface UserFile {
  id:string, createdAt:Date, fileName:string, name?:string
}
export class TranscriptLine {
  index:number = 0
  text:string = ""
  speaker:string = "0"
  startTime:number = 0
  endTime:number = 0
}

export interface TranscriptionLineEvent {
  type:"transcriptLine" | "tempTranscriptLine";
  data:TranscriptLine | TranscriptLine[];
}
