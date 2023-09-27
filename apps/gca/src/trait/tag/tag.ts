/* eslint-disable no-debugger */
import { intersection, uniq } from "lodash"
import { TraitParserNode } from "../parser/node"
import { SyntaxName } from "../parser/syntax"
import { TraitErrorMap, TraitErrorName } from "../error"
import { isNumeric } from "mathjs"
import chalk from "chalk"
import Trait from ".."
import { hasOnlybornAnd, isOnlyborn, removeWrapper, trimAndUnwrap } from "../parser/node/utils"
import { TraitTagValue, UNPARSED_VALUE } from "./value"

export const TRAIT_TAG_NAMES = [`name`, `cat`] as const // , `description`] as const

/** IMPORTANT INFO
 *
 * NewMode() is the only tag allowed to be used more than once per trait definition.
 */
export type TraitTagName = (typeof TRAIT_TAG_NAMES)[number]

export default class TraitTag {
  trait: Trait

  listNode: TraitParserNode
  nameNode: TraitParserNode
  valueNode: TraitParserNode

  name!: TraitTagName
  _value!: TraitTagValue

  constructor(trait: Trait, node: TraitParserNode, isPiped = false) {
    this.trait = trait

    // ERROR: Node is not a tag
    if (!TraitTag.isNodeATag(node, trait)) debugger

    this.listNode = node
    const nameNode = TraitTag.getNameNode(node)
    const valueNode = TraitTag.getValueNode(node)

    // ERROR: Value node MUST be a parenthesis
    if (valueNode.syntax.name !== `parenthesis`) debugger

    this.nameNode = nameNode
    this.valueNode = valueNode

    this._value = new TraitTagValue(this)
  }

  get value() {
    return this._value.get()
  }

  get isValueParsed() {
    return this.value !== UNPARSED_VALUE
  }

  // #region Static helpers

  // determine if a node is in the format expected of a tag
  static isNodeATag(node: TraitParserNode, trait?: Trait) {
    // ERROR: Cannot convert node other than list to traittag
    if (node.syntax.name !== `list`) {
      debugger
      return false
    }

    // ERROR: Lists need to have exactly 2 children (name, value)
    if (node.children.length !== 2) {
      // ERROR: Line is most likely corrupted
      node.printRelevant({ sections: [`header`, `context`] })

      // just for debugging purposes
      const fst = trait?._row?.fst
      const fstndx = trait?._row?.fstndx
      debugger

      return false
    }

    return true
  }

  static getNameNode(node: TraitParserNode) {
    return node.children[0]
  }

  static getValueNode(node: TraitParserNode) {
    return node.children[1]
  }

  // #endregion

  parse(): { errors: Partial<TraitErrorMap> } {
    const missingTagName = this.parseName()

    this.setupParseValue()
    const valueWasParsed = this.parseValue(missingTagName)

    return {
      errors: {
        missingTagName,
        unsuccessfulTagValueParsing: valueWasParsed ? [] : [this._value.stringified],
      },
    }
  }

  parseName() {
    const name = this.nameNode.substring.trim()

    this.name = name as TraitTagName

    if (!TRAIT_TAG_NAMES.includes(name as TraitTagName)) return [name]

    return []
  }

  setupParseValue() {
    this._value.setup()
  }

  parseValue(missingNames: string[]) {
    // parsing of value dependes HEAVILY on the tag name

    const isNameMissing = missingNames.includes(this.name)

    // no need to try to parse value if name is missing, just consider it a string
    if (isNameMissing) return false

    this._value.parse()

    if (!this.isValueParsed) return false
    return true
  }
}
