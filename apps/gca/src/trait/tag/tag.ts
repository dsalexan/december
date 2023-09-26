/* eslint-disable no-debugger */
import { intersection, uniq } from "lodash"
import { TraitParserNode } from "../parser/node"
import { SyntaxName } from "../parser/syntax"
import { TraitErrorMap, TraitErrorName } from "../error"
import { isNumeric } from "mathjs"
import chalk from "chalk"
import Trait from ".."

export const TRAIT_TAG_NAMES = [`name`] as const // `cat`, `basecost`, `techlvl`, `mods`, `isparent`, `displaycost`, `page`, `noresync`, `description`] as const
export type TraitTagName = (typeof TRAIT_TAG_NAMES)[number]

export const UNPARSED_VALUE = Symbol.for(`UNPARSED_VALUE`)

export default class TraitTag {
  trait: Trait

  nameNode: TraitParserNode
  valueNode: TraitParserNode

  name!: TraitTagName
  _value!: string
  value!: any

  constructor(trait: Trait, node: TraitParserNode) {
    this.trait = trait

    // ERROR: Cannot convert node other than list to traittag
    if (node.syntax.name !== `list`) debugger

    // ERROR: Lists need to have exactly 2 children
    if (node.children.length !== 2) {
      // ERROR: Line is most likely corrupted
      node.printRelevant({ sections: [`header`, `context`] })

      const fst = this.trait._row.fst
      const fstndx = this.trait._row.fstndx
      debugger
    }

    const [nameNode, valueNode] = node.children

    // ERROR: Value node MUST be a parenthesis
    if (valueNode.syntax.name !== `parenthesis`) debugger

    this.nameNode = nameNode
    this.valueNode = valueNode
  }

  get isValueParsed() {
    return this.value !== UNPARSED_VALUE
  }

  parse(): { errors: Partial<TraitErrorMap> } {
    const missingTagName = this.parseName()
    this.parseRawValue()
    const valueWasParsed = this.parseValue(missingTagName)

    return {
      errors: {
        missingTagName,
        unsuccessfulTagValueParsing: valueWasParsed ? [] : [this._value],
      },
    }
  }

  parseName() {
    const name = this.nameNode.substring.trim()

    this.name = name as TraitTagName

    if (!TRAIT_TAG_NAMES.includes(name as TraitTagName)) return [name]

    return []
  }

  parseRawValue() {
    // this function only really removes the imaginary enclosure and first separator:comma node (⟨,,,⟩) since EVERY LINE has it

    this._value = removeWrapper(this.valueNode.substring.trim())

    // if parenthesis onlyborn is a quotes, also remove quotes
    if (hasOnlybornAnd(this.valueNode, [`quotes`])) {
      this._value = removeWrapper(this.valueNode.children[0].substring.trim())
    }
  }

  parseValue(missingNames: string[]) {
    // parsing of value dependes HEAVILY on the tag name
    this.value = UNPARSED_VALUE as any

    const isNameMissing = missingNames.includes(this.name)

    // no need to try to parse value if name is missing, just consider it a string
    if (isNameMissing) return false

    const _value = this._value.trim()
    const nodes = this.valueNode.children

    // general parsing (type oriented)

    // super specific parsing for specific tags
    if ([`name`, `displaycost`].includes(this.name)) {
      this.value = _value.toString()
    } else if ([`isparent`, `noresync`].includes(this.name)) {
      const isYes = _value.toString().toLowerCase() === `yes`
      const isNo = _value.toString().toLowerCase() === `no`

      if (isYes) this.value = true
      else if (isNo) this.value = false
      else {
        // ERROR: Unimplemented parsing for boolean tag
        debugger
      }
    } else if ([`cat`, `mods`, `page`].includes(this.name)) {
      if (isOnlyborn(nodes)) {
        // nodes is actually just [node]
        const node = nodes[0]
        const syntax = node.syntax

        if ([`comma`].includes(syntax.name)) {
          this.value = node.children.map(list => trimAndUnwrap(list, [`quotes`]))
        } else if ([`quotes`, `string`].includes(syntax.name)) {
          this.value = [trimAndUnwrap(node, [`quotes`])]
        } else {
          // ERROR: Unimplemented syntax for cat
          debugger
        }
      } else {
        // ERROR: What to do with multiple children?
        debugger
      }
    } else if ([`basecost`, `techlvl`].includes(this.name)) {
      const isValueNumeric = isNumeric(_value) || !isNaN(parseFloat(_value))

      if (isValueNumeric) {
        this.value = parseFloat(_value)
      } else {
        // ERROR: Unimplemented for non-numeric
        debugger
      }
    } else if ([`description`].includes(this.name)) {
      // TODO: How to determine if we should wrap colons?
      //    maybe check if all the colons are in the same level AND that level is immediate child of valueNode (that is an enclosure)
      const trait = this.trait._id
      const context = this.valueNode.context
      const substring = this.valueNode.substring

      const colonIndexes = substring
        .split(``)
        .map((character, i) => (character === `:` ? i + this.valueNode.start : null))
        .filter(index => index !== null)

      if (colonIndexes.length > 0) {
        const colonLevels = colonIndexes.map(index => this.valueNode.levelByIndex(index!))

        const isAnotherSeparatorAnImmediateChild = this.valueNode.children.every(child => child.syntax.type === `separator`)

        const areAllColonsAtSameLevel = uniq(colonLevels).length === 1 && colonLevels[0] !== -1
        const areAllColonsImmediateChildrenIgnoringOtherSeparators = colonLevels[0] === this.valueNode.level + 1 + (isAnotherSeparatorAnImmediateChild ? 2 : 0) // +2 to account for the pair separator > list

        if (areAllColonsImmediateChildrenIgnoringOtherSeparators && areAllColonsAtSameLevel) {
          this.valueNode.wrapSeparatorColon()

          const data = {} as Record<string, unknown>

          const separator = this.valueNode.children[0]
          for (const list of separator.children) {
            const [before, ...afters] = list.children

            const key = trimAndUnwrap(before, [`quotes`])
            const value = afters
              .map(after => after.substring)
              .join(``)
              .trim()

            // ERROR: Unimplemented repeating key
            if (data[key] !== undefined) debugger

            data[key] = value
          }

          this.value = data
        } else {
          console.error(chalk.bgRed(`${` `.repeat(50)}Unimplemented ${chalk.bold(`non-colon tag`)} for trait ${chalk.bold(trait)} at not ${chalk.bold(context)}${` `.repeat(50)}`))

          // ERROR: Non-colon node unimplemented (probably is gonna be just a string, maybe this if could become an UNPARSED instead of debugger, than i dont need to correct immediatly)
          debugger
        }
      } else {
        // NO COLONS, just a regular string

        this.value = _value
      }
    } else {
      console.log(chalk.bgWhite.bold(`${` `.repeat(45)} ${this.name} `))
      console.log(chalk.bgWhite.bold(`${` `.repeat(45)} ${_value} `))

      // ERROR: Unimplemented tag name
      debugger
    }

    if (this.value === UNPARSED_VALUE) return false
    return true
  }
}

function removeWrapper(string: string) {
  return string.substring(1, string.length - 1)
}

function hasOnlyborn(node: TraitParserNode) {
  return node.children.length === 1
}

function hasOnlybornAnd(node: TraitParserNode, names: SyntaxName[]) {
  return hasOnlyborn(node) && names.includes(node.children[0].syntax.name)
}

function isOnlyborn(nodes: TraitParserNode[]) {
  return nodes.length === 1
}

function isOnlybornAnd(nodes: TraitParserNode[], names: SyntaxName[]) {
  return isOnlyborn(nodes) && names.includes(nodes[0].syntax.name)
}

function areSyntaxes(nodes: TraitParserNode[], names: SyntaxName[]) {
  return (
    intersection(
      nodes.map(node => node.syntax.name),
      names,
    ).length === nodes.length
  )
}

function isSyntax(node: TraitParserNode, names: SyntaxName[]) {
  return names.includes(node.syntax.name)
}

function trimAndUnwrap(node: TraitParserNode, names: SyntaxName[]) {
  const trimmed = node.substring.trim()

  // if node is not of an expected syntax, just trim substring
  if (!names.includes(node.syntax.name)) return trimmed

  // ERROR: Untested
  if (node.children.length !== 1) debugger

  // if node is of an expected syntax, recursivelly unwrap it
  const fewerNames = names.filter(name => name !== node.syntax.name)
  return trimAndUnwrap(node.children[0], fewerNames)
}
