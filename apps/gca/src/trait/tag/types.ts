import { VariableTypes, VariableType } from "@december/utils/src/typing/types"
import { TraitTagName } from "./tag"

/**
 * Value: String x Input x Selection List
 *        "    "   [   ]   %            %
 *
 * I'm assuming that EVERYTHING can be a combination of strings (primitives actually), input and selection list
 * But I really dont want to deal with implementing this schema
 * So i'll just attribute a symbol for "lazy value", indicating that that tag WAS parsed (but will only yield a value at runtime)
 */

export const LazyVariableTypes = [`input`, `selection`] as const
export type LazyVariableType = (typeof LazyVariableTypes)[number]

export const ExpandedVariableTypes = [...VariableTypes, ...LazyVariableTypes] as const
export type ExpandedVariableType = VariableType | LazyVariableType

const BASE_TAG_TYPE: Record<TraitTagName, ExpandedVariableType[]> = {
  name: [`string`],
  cat: [`string`],
}
