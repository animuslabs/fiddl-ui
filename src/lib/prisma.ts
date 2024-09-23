import type { AppRouter } from "fiddl-server/dist/server"
import { Prisma } from "../../../fiddl-server/prisma/client"
import { inferProcedureOutput } from "@trpc/server"

export type User = Prisma.UserGetPayload<object>
export type ImageRequest = Prisma.ImageRequestGetPayload<object>

type user = inferProcedureOutput<AppRouter["user"]["get"]>
// const usr:user= {createdAt}

// export type FileUpload = Prisma.FileUploadGetPayload<{}>;

// export type LiveSession = Prisma.LiveSessionGetPayload<{
//   select:{ id:true, createdAt:true, updatedAt:true, speakerNames:true, name:true }
// }>
// export type LiveSessionWithRelations = Prisma.LiveSessionGetPayload<{
//   include:{
//     TranscriptLine:{ orderBy:{ index:"asc" }, select:{ index:true, text:true, speaker:true, startTime:true, endTime:true }}
//     LivePrompt:true;
//   }
// }>

// export type LivePrompt = Prisma.LivePromptGetPayload<{}>;
// export type TranscriptLine = Prisma.TranscriptLineGetPayload<{}>;
// export type PassKey = Prisma.PassKeyGetPayload<{}>;
