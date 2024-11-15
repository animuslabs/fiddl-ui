// sample logLine: flux_train_replicate:  83%|████████▎ | 2482/3000 [43:27<09:04,  1.05s/it, lr: 4.0e-04 loss: 2.472e-01]

export interface TrainingLog {
  percentProgress: number
  elapsedTime: string
  remainingTime: string
}

export function parseTrainingLog(logs: string): TrainingLog {
  const lastLine = logs.split("\n").filter(Boolean).pop()
  const percentProgress = lastLine?.match(/(\d+)%/)?.[1]
  const elapsedTime = lastLine?.match(/\[(\d+:\d+)\</)?.[1]
  return {
    percentProgress: parseInt(percentProgress || "0"),
    elapsedTime: elapsedTime || "0:00",
    remainingTime: lastLine?.match(/(\d+:\d+),/)?.[1] || "0:00",
  }
}
