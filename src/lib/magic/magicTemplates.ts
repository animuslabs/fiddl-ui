export type MagicTemplate = {
  id: string
  title: string
  prompt: string
  negative?: string
  aspect?: "1:1" | "3:4" | "4:5" | "16:9" | "9:16"
  thumbnailId?: string // optional preview media id for display
}

/**
 * Initial curated placeholders optimized for LoRA face templates on flux-dev
 * Replace titles/prompts/thumbnails later with branded content
 */
export const magicTemplates: Readonly<MagicTemplate[]> = Object.freeze([
  { id: "knight", title: "Knight", prompt: "portrait of a heroic knight in shining armor, dramatic lighting, highly detailed, studio photo", aspect: "3:4" },
  { id: "astronaut", title: "Astronaut", prompt: "portrait of an astronaut in space suit, visor reflections of stars, cinematic lighting, high detail", aspect: "3:4" },
  { id: "samurai", title: "Samurai", prompt: "portrait of a samurai in traditional armor, shallow depth of field, cinematic, ultra detailed", aspect: "3:4" },
  { id: "superhero", title: "Superhero", prompt: "portrait of a modern superhero, dynamic lighting, comic-realistic, bold colors, detailed suit", aspect: "3:4" },
  { id: "viking", title: "Viking", prompt: "portrait of a viking warrior, fur cloak, braided hair, cinematic lighting, high detail", aspect: "3:4" },
  { id: "cyberpunk", title: "Cyberpunk", prompt: "portrait in cyberpunk style, neon city bokeh, teal and magenta lights, high detail", aspect: "3:4" },
  { id: "wizard", title: "Wizard", prompt: "portrait of a wizard, flowing robes, magical particles, dramatic rim lighting, ultra detail", aspect: "3:4" },
  { id: "sci-fi-pilot", title: "Sci‑Fi Pilot", prompt: "portrait of a sci‑fi pilot, starfighter cockpit background bokeh, cinematic, high detail", aspect: "3:4" },
  { id: "detective", title: "Detective", prompt: "portrait of a noir detective, trench coat and hat, moody lighting, film grain aesthetic", aspect: "3:4" },
  { id: "rockstar", title: "Rockstar", prompt: "portrait on stage with bokeh lights, dynamic lighting, stylish outfit, high detail", aspect: "3:4" },
  { id: "medieval-queen", title: "Medieval Queen", prompt: "portrait of medieval queen wearing ornate crown, soft rim light, cinematic", aspect: "3:4" },
  { id: "futuristic-agent", title: "Futuristic Agent", prompt: "portrait with sleek tactical suit, neon reflections, cinematic grading, high detail", aspect: "3:4" },
])
