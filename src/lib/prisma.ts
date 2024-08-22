import { Prisma } from "../../../fiddl-server/prisma/client"

export type User = Prisma.UserGetPayload<{}>;
export type ImageRequest = Prisma.ImageRequestGetPayload<{}>;



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



