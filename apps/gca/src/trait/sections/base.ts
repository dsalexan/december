import { z } from "zod"
import { TraitSectionsSchema } from "./types"

export const BaseTraitSchema = z
  .object({
    name: z.string(),
    // nameext: z.string().optional(),
    fullname: z.string(),
    //
    // cat: z.array(z.string()).optional(),
    meta: z.array(z.string()).optional(),
  })
  .strict()

export type BaseTrait = z.infer<typeof BaseTraitSchema>
//            ^?
