interface Preset {
  name: string
  prompt: string
  imageId: string
  aspectRatio: string
}

export const faceForgePresets: Preset[] = [
  {
    name: "ninja",
    prompt: "A ninja",
    imageId: "ninja",
    aspectRatio: "1:1",
  },
]
