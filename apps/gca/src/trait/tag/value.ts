import { isNumeric } from "mathjs"
import { hasOnlybornAnd, isOnlyborn, removeWrapper, trimAndUnwrap } from "../parser/node/utils"
import TraitTag from "./tag"
import { LazyVariableType } from "./types"
import chalk from "chalk"

export const TRAIT_TAG_VALUE_STATE = [`unparsed`, `parsed`] as const
export type TraitTagValueState = (typeof TRAIT_TAG_VALUE_STATE)[number]

export const UNPARSED_VALUE = Symbol.for(`UNPARSED_VALUE`)
export const LAZY_VALUE = Symbol.for(`LAZY_VALUE`)

export type LazyValueDefinition = {
  type: LazyVariableType // [] | %%
  text: string
  options: unknown[] // somehow i just detect, here, the range of possibles optiosn for this lazy value
}

export class TraitTagValue {
  tag: TraitTag

  stringified!: string
  parsedValue: unknown

  lazy: LazyValueDefinition | false = false

  constructor(tag: TraitTag) {
    this.tag = tag
  }

  get node() {
    return this.tag.valueNode
  }

  get name() {
    return this.tag.name
  }

  get() {
    return this.parsedValue
  }

  setup() {
    // remove parenthesis from node (everyone should have it)
    this.stringified = removeWrapper(this.node.substring.trim())

    // if parenthesis onlyborn is a quotes, also remove quotes
    if (hasOnlybornAnd(this.node, [`quotes`])) {
      this.stringified = removeWrapper(this.node.children[0].substring.trim())
    }
  }

  parse() {
    let parsedValue: unknown = UNPARSED_VALUE

    /**
     * So, everything can be a lazy value, ok.
     * But what about piping?
     * Probably only some shit can be piped, but how do i decide?
     *  From observation i can tell that, for the tags that are piped, there is ALWAYS the same number of pipes in all.
     *  So maybe i should make a preliminary check in compile, to stablish the necessity to parse multiples values in a tag.
     */

    this.parseLazy()

    // specific is a parsing based on tag name
    parsedValue = this.parseSpecific()

    this.parsedValue = parsedValue
  }

  parseLazy() {
    const nodes = this.node.children

    // INPUT
    // TODO: Find out what to do in this situation: "[cost]"
    const quotesChildren = nodes.filter(node => node.syntax.name === `quotes`)
    // if ( && ) {

    // if (isOnlybornAnd(nodes, [`brackets`])) {
    //   debugger
    // }
  }

  parseSpecific() {
    const nodes = this.node.children

    let value: unknown = UNPARSED_VALUE

    // super specific parsing for specific tags
    if ([`name`, `displaycost`].includes(this.name)) {
      value = this.stringified
    } else if ([`isparent`, `noresync`].includes(this.name)) {
      const isYes = this.stringified.toLowerCase() === `yes`
      const isNo = this.stringified.toLowerCase() === `no`

      if (isYes) value = true
      else if (isNo) value = false
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
          value = node.children.map(list => trimAndUnwrap(list, [`quotes`]))
        } else if ([`quotes`, `string`].includes(syntax.name)) {
          value = [trimAndUnwrap(node, [`quotes`])]
        } else {
          // ERROR: Unimplemented syntax for cat
          debugger
        }
      } else {
        // ERROR: What to do with multiple children?
        debugger
      }
    } else if ([`basecost`, `techlvl`].includes(this.name)) {
      const isValueNumeric = isNumeric(this.stringified) || !isNaN(parseFloat(this.stringified))

      if (isValueNumeric) {
        value = parseFloat(this.stringified)
      } else {
        // ERROR: Unimplemented for non-numeric
        debugger
      }
    } else if ([`description`].includes(this.name)) {
      // TODO: How to determine if we should wrap colons?
      //    maybe check if all the colons are in the same level AND that level is immediate child of valueNode (that is an enclosure)

      debugger

      // const trait = this.trait._id
      // const context = this.valueNode.context
      // const substring = this.valueNode.substring

      // const colonIndexes = substring
      //   .split(``)
      //   .map((character, i) => (character === `:` ? i + this.valueNode.start : null))
      //   .filter(index => index !== null)

      // if (colonIndexes.length > 0) {
      //   const colonLevels = colonIndexes.map(index => this.valueNode.levelByIndex(index!))

      //   const isAnotherSeparatorAnImmediateChild = this.valueNode.children.every(child => child.syntax.type === `separator`)

      //   const areAllColonsAtSameLevel = uniq(colonLevels).length === 1 && colonLevels[0] !== -1
      //   const areAllColonsImmediateChildrenIgnoringOtherSeparators = colonLevels[0] === this.valueNode.level + 1 + (isAnotherSeparatorAnImmediateChild ? 2 : 0) // +2 to account for the pair separator > list

      //   if (areAllColonsImmediateChildrenIgnoringOtherSeparators && areAllColonsAtSameLevel) {
      //     this.valueNode.wrapSeparatorColon()

      //     const data = {} as Record<string, unknown>

      //     const separator = this.valueNode.children[0]
      //     for (const list of separator.children) {
      //       const [before, ...afters] = list.children

      //       const key = trimAndUnwrap(before, [`quotes`])
      //       const value = afters
      //         .map(after => after.substring)
      //         .join(``)
      //         .trim()

      //       // ERROR: Unimplemented repeating key
      //       if (data[key] !== undefined) debugger

      //       data[key] = value
      //     }

      //     value = data
      //   } else {
      //     console.error(chalk.bgRed(`${` `.repeat(50)}Unimplemented ${chalk.bold(`non-colon tag`)} for trait ${chalk.bold(trait)} at not ${chalk.bold(context)}${` `.repeat(50)}`))

      //     // ERROR: Non-colon node unimplemented (probably is gonna be just a string, maybe this if could become an UNPARSED instead of debugger, than i dont need to correct immediatly)
      //     debugger
      //   }
      // } else {
      //   // NO COLONS, just a regular string

      //   value = this.stringified
      // }
    } else {
      console.log(chalk.bgWhite.bold(`${` `.repeat(45)} ${this.name} `))
      console.log(chalk.bgWhite.bold(`${` `.repeat(45)} ${this.stringified} `))

      // ERROR: Unimplemented tag name
      debugger
    }

    return value
  }
}
