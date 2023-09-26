import { z } from "zod"
import { AbstractTrait, TraitSectionsSchema, TraitSection } from "./types"
import { BaseTraitSchema } from "./base"

export const TraitSpellSchema = BaseTraitSchema.merge(z.object({}).strict())

export type TraitSpell = AbstractTrait<`spells`, z.infer<typeof TraitSpellSchema>>
