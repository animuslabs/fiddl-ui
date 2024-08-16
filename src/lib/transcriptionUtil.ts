import { TranscriptLine } from "lib/types"

export interface TranscriptionChunk {
  speaker:string,
  text:string
}
export function makeTranscriptionChunks(transcription:string):TranscriptionChunk[] {
  let chunks = transcription.split("\n")
  let chunkObjs = chunks.map(chunk => {
    const split = chunk.split(": ")
    return {
      speaker: split[0] || "Unknown",
      text: split[1] || ""
    }
  })
  return chunkObjs
}
type Transcript = Record<number, TranscriptLine>

export function prepareTranscript(transcriptLines:TranscriptLine[]):TranscriptLine[] {
  let transcript:Transcript = {}
  for (const line of transcriptLines) {
    transcript[line.index] = line
  }
  return Object.values(transcript).sort((a, b) => a.index - b.index)
}
