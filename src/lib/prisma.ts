// UI-only: provide loose types for Prisma models to satisfy type-checking
export type User = any
export type Profile = any
export type ImageRequest = any
export type ImageRequest2 = any
export type CryptoOrder = any

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
