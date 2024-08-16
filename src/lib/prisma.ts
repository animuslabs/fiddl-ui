import { Prisma } from "../../../echoscribe-server/prisma/client"

export type FileUpload = Prisma.FileUploadGetPayload<{}>;

export type LiveSession = Prisma.LiveSessionGetPayload<{
  select:{ id:true, createdAt:true, updatedAt:true, speakerNames:true, name:true }
}>
export type LiveSessionWithRelations = Prisma.LiveSessionGetPayload<{
  include:{
    TranscriptLine:{ orderBy:{ index:"asc" }, select:{ index:true, text:true, speaker:true, startTime:true, endTime:true }}
    LivePrompt:true;
  }
}>

export type LivePrompt = Prisma.LivePromptGetPayload<{}>;
export type TranscriptLine = Prisma.TranscriptLineGetPayload<{}>;
export type PassKey = Prisma.PassKeyGetPayload<{}>;



