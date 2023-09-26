import { z } from "zod"

import { BaseTrait, BaseTraitSchema } from "./base"
import { AbstractTrait, TraitSection } from "./types"
import { TraitModifier, TraitModifierSchema } from "./modifier"
import { TraitEquipmentSchema } from "./equipment"
import { TraitAdvantageSchema } from "./advantage"
import { TraitSkillSchema } from "./skill"
import { TraitPerkSchema } from "./perk"
import { TraitSpellSchema } from "./spell"
import { TraitTemplateSchema } from "./template"
import { TraitAttributeSchema } from "./attribute"
import { TraitQuirkSchema } from "./quirk"
import { TraitDisadvantageSchema } from "./disadvantage"
import { TraitFeatureSchema } from "./feature"
import { TraitCultureSchema } from "./culture"
import { TraitLanguageSchema } from "./language"

export const TRAIT_SCHEMAS = {
  attributes: TraitAttributeSchema,
  languages: TraitLanguageSchema,
  cultures: TraitCultureSchema,
  advantages: TraitAdvantageSchema,
  perks: TraitPerkSchema,
  disadvantages: TraitDisadvantageSchema,
  quirks: TraitQuirkSchema,
  features: TraitFeatureSchema,
  skills: TraitSkillSchema,
  spells: TraitSpellSchema,
  equipment: TraitEquipmentSchema,
  templates: TraitTemplateSchema,
  //
  modifiers: TraitModifierSchema,
} as const

export type TraitDefinition = TraitModifier

export type SuperchargedTraitData<TDefinition extends TraitDefinition> = TDefinition[`Data`] & {
  fullname: string
}

type rec = Record<string, number>
type rec1 = {
  [P in TraitSection]: z.ZodSchema
}
type rec2 = {
  modifier: typeof TraitModifierSchema
  base: typeof BaseTraitSchema
}

const section0 = `modifier` as TraitSection
//     ^?
const section = `modifier` as TraitModifier[`Section`]
//     ^?
const sec1 = TRAIT_SCHEMAS[section as TraitSection]
//     ^?
