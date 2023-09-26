import { isNilOrEmpty, push, typing } from "@december/utils"
import chalk from "chalk"
import { cloneDeep, first, identity, isEmpty, isNil, isString, last, max, min, orderBy, over, range, uniq, zip } from "lodash"

import churchill from "../../../logger"
import { TraitParser } from ".."
import { EnclosureSyntaxComponent, SYNTAX_COMPONENTS, SeparatorSyntaxComponent, SyntaxComponent, SyntaxName } from "../syntax"
import { AsyntaticComponent, MathSyntaxComponent } from "../syntax/types"
import * as MathSyntax from "../syntax/math"
import MathObject from "../syntax/math/object"
import { MathNode, OperatorNode } from "mathjs"
import { MathJSInverseOperatorNodeMap, MathJSOperatorNodeMap } from "../syntax/math/syntax"
import { calculateNecessaryParentheses } from "../syntax/math/utils"
import { wrap } from "module"
import { MathNodeParser } from "./math"
import LogBuilder from "@december/churchill/src/builder"
import { VariableType } from "@december/utils/src/typing/types"

export const logger = churchill.child({ name: `node` })

const ALPHABET = [`a`, `b`, `c`, `d`, `e`, `f`, `g`, `h`, `i`, `j`, `k`, `l`, `m`, `n`, `o`, `p`, `q`, `r`, `s`, `t`, `u`, `v`, `w`, `x`, `y`, `z`]

function toName(j: number) {
  let i = j % ALPHABET.length
  const f = Math.floor(j / ALPHABET.length)

  return `${range(0, f)
    .map(() => ALPHABET[0])
    .join(``)}${ALPHABET[i]}`
}

type LabelDefinition = {
  type: `range` | `whitespace`
  start: number
  end: number
  text?: string
  color?: `edges` | `all` | `middles`
}

type MathData = { mathObject: MathObject; shallow: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SerializedTraitParserNode<TData extends object = any> = {
  parent: string | null
  id: number | `root`

  start: number
  end: number | null

  middles: number[]

  children: SerializedTraitParserNode[]
  unbalanced: { index: number; syntax: SyntaxComponent }[]

  syntax: SyntaxName

  data: TData
}

export type TraitParserNodeParseOptions = {
  syntax: SyntaxName[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TraitParserNode<TSyntax extends SyntaxComponent = SyntaxComponent, TData extends object = any> {
  parser!: TraitParser

  __parent: TraitParserNode | null = null
  get parent() {
    return this.__parent
  }
  set parent(value: TraitParserNode | null) {
    if (value) {
      // eslint-disable-next-line no-debugger
      if (isNil(value.parser)) debugger
      this.parser = value.parser
    }
    this.__parent = value
  }

  id: `root` | number
  start: number
  end: number | null
  middles: number[]

  syntax: TSyntax

  children: TraitParserNode[] = []
  unbalanced: { index: number; syntax: SyntaxComponent }[] // list of occurences of unbalanced syntatic components

  data: TData

  constructor(parser: TraitParser, parent: TraitParserNode | null, id: number | `root`, start: number, syntax: TSyntax, data?: TData) {
    this.parser = parser
    this.parent = parent

    this.id = id

    this.start = start
    this.end = null

    // almost cosmetic, but useful for debugging
    this.middles = []

    this.children = []
    this.unbalanced = []

    this.syntax = syntax

    this.data = data ?? ({} as TData)
  }

  get context() {
    if (this.id === `root`) return `root`
    return `${this.syntax.prefix}${this.level}.${toName(this.id)}`
  }

  get level() {
    const parentLevel = (this.parent?.level ?? -1) as number
    return parentLevel + 1
  }

  // Returns end of node OR end of tree, when node is unbalanced
  get safe_end() {
    return this.end ?? this.parser.text.length
  }

  get isUnbalanced() {
    return this.end === null
  }

  get substring() {
    return this.parser.text.substring(this.start, this.safe_end + 1)
  }

  get path(): string {
    if (!this.parent) return ``
    const parentPath = this.parent.path
    if (isEmpty(parentPath)) return this.parent.id.toString()
    return `${parentPath}/${this.parent.id}`
  }

  get fullpath() {
    const path = this.path
    return `${path}${path === `` ? `root/` : `/`}${this.id}`
    // return `${path}${path === `` ? `` : `/`}${this.id}`
  }

  get color() {
    if (this.id === `root`) return chalk.white

    const rest = this.id % 3
    if (rest === 2) return chalk.magenta
    if (rest === 1) return chalk.green
    else return chalk.cyan
  }

  get backgroundColor() {
    if (this.id === `root`) return chalk.bgWhite

    const rest = this.id % 3
    if (rest === 2) return chalk.bgMagenta
    if (rest === 1) return chalk.bgGreen
    else return chalk.bgCyan
  }

  // #region Parentage

  addChild(child: TraitParserNode) {
    if (this.children.find(node => node.id === child.id)) {
      // throw new Error(`Node ${child.context} (${child.substring}) already exists as child of ${this.context}`)
      child.id = this.children.length
    }

    this.children.push(child)

    child.parent = this
  }

  removeChild(child: TraitParserNode) {
    this.children = this.children.filter(node => node.id !== child.id)

    child.parent = null
  }

  // #endregion

  checkTreeIntegrity() {
    if (!this.parent && this.id !== `root`) return false
    for (const child of this.children) {
      if (child.parent !== this) return false
      if (!child.checkTreeIntegrity()) return false
    }

    return true
  }

  guessType(): string | undefined {
    let type: string | undefined

    if (this.syntax.name === `string`) {
      const substring = this.substring
      type = typing.guessType(substring)
    } else {
      const childrenTypes = this.children.map(child => child.guessType()).join(`, `)

      if (this.syntax.name === `list`) {
        type = `[${childrenTypes}]`
      } else {
        const syntax = this.syntax.type === this.syntax.name ? this.syntax.type : `${this.syntax.type}:${this.syntax.name}`
        type = `${syntax}<${childrenTypes}>`
      }
    }

    if (!type) return undefined

    if (this.syntax.name === `quotes` || this.syntax.name === `string` || this.syntax.name === `comma` || this.syntax.name === `list`) return this.color.bgBlack(type)
    return this.backgroundColor(type)
  }

  get(context: string): TraitParserNode | undefined {
    if (context === this.context) return this
    for (const child of this.children) {
      const getContext = child.get(context)
      if (getContext) return getContext
    }

    return undefined
  }

  levelByIndex(index: number): number {
    // return node level by index of character
    if (index < this.start) return -1
    if (index > this.safe_end) return -1

    const character = this.parser.text[index]

    for (const child of this.children) {
      const start = child.start
      const end = child.safe_end

      if (index >= start && index <= end) return child.levelByIndex(index)
    }

    return this.level
  }

  parse(options: Partial<TraitParserNodeParseOptions> = {}, silent = false) {
    if (isNil(this.start) || this.start === -1 || this.start === Infinity) throw new Error(`Invalid node start: ${this.start}`)

    const SYNTAXES = this.parser.syntaxes(options.syntax)
    const CHARACTER_SHET = this.parser.characterSet(options.syntax)
    const SYNTAX_FROM_CHARACTER = this.parser.getSyntaxFromCharacter(options.syntax)

    const log = logger.builder().tab()

    if (!silent)
      log
        .tab(this.level)
        .add(chalk.gray(`${chalk.italic.bold(`[${this.fullpath}]`)} parsing (${chalk.white(this.syntax.name)})`))
        .verbose()

    // get substring from start (source is parser.text ALWAYS, since it is immutable)
    let substring = this.substring
    let start = this.start

    // advance one to account for enclosure opener (no need to parse the opener, since we already know the node is an enclosure)
    let i0 = 0
    if (this.syntax.type === `enclosure`) {
      if (!silent)
        log
          .tab(this.level + 1)
          .add(chalk.gray(`${chalk.italic(`[char/${start + i0}]`)} ${chalk.white(substring[i0])} | skipping enclosure (${chalk.white(this.syntax.name)}) opener`))
          .silly()
      i0++
    }

    let carryStringNode = null as TraitParserNode | null // carry string node found
    for (let i = i0; i < substring.length; i++) {
      // const prevChar = substring[i - 1]
      // const nextChar = substring[i + 1]
      const char = substring[i]
      const index = start + i // index of character in tree.text

      const syntax = SYNTAX_FROM_CHARACTER[char]

      // if it is not a relevant character for parsing
      const isRelevantCharacter = !isNil(syntax)

      if (!silent)
        log
          .tab(this.level + 1)
          .add(
            chalk.grey(
              `${chalk.italic(`[char/${start + i}]`)} ${chalk.white(char)} | ${!isRelevantCharacter ? `not relevant` : chalk.white(`RELEVANT CHARACTER (${syntax?.name})`)}`,
            ),
          )
          .silly()

      // if it is not a relevant character for parsing, add to carry string node
      let characterIsString = !isRelevantCharacter

      if (isRelevantCharacter) {
        // if is IS a relevant character, first check if carry has something.
        // if carry has text then reset it (consider it "closed")
        if (carryStringNode && !isNil(carryStringNode.end)) {
          if (!silent)
            log
              .tab(carryStringNode.level)
              .add(chalk.grey(`${chalk.italic.bold(`[${carryStringNode.fullpath}]`)} closing carry string node (${chalk.white(carryStringNode.substring)})`))
              .silly()

          carryStringNode = null
        }

        // parse by syntatic component
        if (syntax.type === `enclosure`) {
          const enclosureSyntax = syntax as EnclosureSyntaxComponent

          const thisSyntaxCloser = (this.syntax as EnclosureSyntaxComponent).closer
          if (char === thisSyntaxCloser) {
            // check if it is the closer expected for this node

            // end of node found, break from loop
            this.end = index

            if (!silent)
              log
                .tab(this.level)
                .add(chalk.gray(`${chalk.italic.bold(`[${this.fullpath}]`)} ${chalk.white(char)} | closing node (${chalk.white(this.substring)})`))
                .silly()

            break
          } else if (char === enclosureSyntax.opener) {
            // character is an opener for an enclosure
            // so create a new node for the enclosure

            const id = this.children.length // id will be its probable (not necessaryly) index inside children
            const node = new TraitParserNode(this.parser, null, id, index, syntax) // new node starts at enclosure opener
            this.addChild(node)

            if (!silent)
              log
                .tab(node.level)
                .add(chalk.gray(`${chalk.italic.bold(`[${node.fullpath}]`)} ${chalk.white(char)} | creating`))
                .silly()

            node.parse(options, silent) // try to parse new node

            if (node.isUnbalanced) {
              // if node is unbalanced

              // remove node from children
              if (!silent)
                log
                  .tab(node.level)
                  .add(chalk.gray(`${chalk.italic.bold(`[${node.fullpath}]`)} ${chalk.white(char)} | REMOVING unbalanced node`))
                  .silly()

              this.removeChild(node)

              // since it is not really a relevant character, consider it a string
              characterIsString = true

              // register unbalanced index
              this.unbalanced.push({ index, syntax })
            } else {
              // node is OK, advance cursor to its end to continue parsing
              i += node.end! - index
            }
          } else if (char === enclosureSyntax.closer) {
            // found an closer character in the wild

            // since it is not a closer for this node, it is UNBALANCED
            this.unbalanced.push({
              index,
              syntax,
            })

            if (!silent)
              log
                .tab(this.level)
                .add(chalk.gray(`${chalk.italic.bold(`[${this.fullpath}]`)} ${chalk.white(char)} | tagging as UNBALANCED`))
                .silly()

            // since it is not really a relevant character, consider it a string
            characterIsString = true
          } else {
            // ERROR: Not Implemented
            // eslint-disable-next-line no-debugger
            debugger
          }
        } else if (syntax.type === `separator`) {
          const separatorSyntax = syntax as SeparatorSyntaxComponent

          if (separatorSyntax.enclosures.includes(this.syntax.name)) {
            const node = new TraitParserNode(this.parser, null, this.children.length, index, syntax)
            this.addChild(node)

            node.end = index

            if (!silent)
              log
                .tab(node.level)
                .add(chalk.grey(`${chalk.italic.bold(`[${this.fullpath}/${node.id}]`)} creating separator node`))
                .silly()
          } else {
            // if current node is not an enclosure (as far as this specific separator is concerned)
            characterIsString = true
          }
        } else {
          // ERROR: Not Implemented
          // eslint-disable-next-line no-debugger
          debugger
        }
      }

      // if character is to be considered a string (regardless of being relevant or not)
      if (characterIsString) {
        if (carryStringNode === null) {
          // first check if last child could be a carry string node
          const lastChild = last(this.children)

          //    if last child is a string AND ends immediately before this index
          if (lastChild?.syntax.type === `string` && lastChild?.end === index - 1) {
            // set it as carry string node
            carryStringNode = this.children.pop()!
            this.addChild(carryStringNode)

            if (!silent)
              log
                .tab(this.level + 1)
                .add(chalk.grey(`${chalk.italic.bold(`[${this.fullpath}/${carryStringNode.id}]`)} popping last child as carry string node`))
                .silly()
          } else {
            // if not, create a new carry string node
            carryStringNode = new TraitParserNode(this.parser, null, this.children.length, index, SYNTAX_COMPONENTS.string)
            this.addChild(carryStringNode)

            if (!silent)
              log
                .tab(this.level + 1)
                .add(chalk.grey(`${chalk.italic.bold(`[${this.fullpath}/${carryStringNode.id}]`)} creating carry string node`))
                .silly()
          }
        }

        // add character to carry string node
        carryStringNode.end = index

        if (!silent)
          log
            .tab(this.level + 1)
            .add(chalk.grey(`${chalk.italic(`[char/${start + i}]`)} adding to carry string node (${chalk.white(carryStringNode.fullpath)})`))
            .silly()
      }
    }

    // aggregate by separator (nested)
    const enlistedChildren = enlistSeparatorNodes(this.children)
    if (enlistedChildren !== null) {
      // replace enlisted children in-place
      this.children = []
      for (const node of enlistedChildren) this.addChild(node)
    }

    // if syntax accepts mathematical sentences
    if (SYNTAXES[`math`]) {
      const mathNode = this.wrapMath()
      if (!silent && mathNode) {
        log
          .tab(this.level + 1)
          .add(chalk.grey(`${chalk.italic.bold(`[${this.fullpath}/${mathNode.id}]`)} creating math node`))
          .silly()
      }
    }
  }

  normalize(skipFirst = false) {
    // normalize all ids fowards from root based on their position per level

    const levels = this.byLevel()

    for (let level = levels.length - 1; level >= 0; level--) {
      if (skipFirst && level === 0) continue
      const nodes = levels[level]

      const orderedByStart = orderBy(nodes, node => node.start)

      for (let i = 0; i < orderedByStart.length; i++) {
        const node = orderedByStart[i]
        if (node.id === i) continue

        // const siblings = node.parent?.children ?? []
        // const parentHasConflitingID = siblings.find(node => node.id === i)
        // if (parentHasConflitingID) debugger

        node.id = i
      }
    }
  }

  /**
   * Wrap children as a single math node
   * @param force Force the wrapping, since it skips if some child is not mathWrappable
   */
  wrapMath(force = false) {
    // cannot wrap math if the current node doenst accept math wrapping
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isMathParent = (this.syntax as any).mathParent
    if (!isMathParent) return null

    const allChildrenAreMathWrappable = this.children.every(child => child.syntax.mathWrappable)

    const shouldWrap = force || allChildrenAreMathWrappable
    if (!shouldWrap) return null

    // check if rasterized content is a valid mathematical sentence
    let content = this.substring
    if (this.syntax.type === `enclosure`) content = content.substring(1, content.length - 1)

    const mathObject = MathSyntax.parse(content)
    if (mathObject === null) return null

    // if it compiles, replace children by new math node
    const start = this.syntax.type === `enclosure` ? this.start + 1 : this.start
    const math = new TraitParserNode<MathSyntaxComponent, MathData>(this.parser, null, 0, start, SYNTAX_COMPONENTS.math as MathSyntaxComponent, { mathObject, shallow: true })
    math.end = this.syntax.type === `enclosure` ? this.end! - 1 : this.end!

    this.children = []
    this.addChild(math)

    return math
  }

  deepWrapMath(force = false) {
    const mathNode = this.wrapMath(force)
    if (!mathNode) {
      for (const child of this.children) child.deepWrapMath(force)
    }
  }

  /**
   * Wraps children as a single separator:colon node
   */
  wrapSeparatorColon() {
    // an inline object structure, like: (<name>:<value>[] <name>:<value>[] <name>:<value>[] <name>:<value>[])
    //    maybe should only work on parenthesis, but for now i'm not making a distinction here (since i'm manually running this wraping while compiling trait tags)

    // check if rasterized content has colons
    let content = this.substring
    if (this.syntax.type === `enclosure`) content = content.substring(1, content.length - 1) // removing edges for enclosures

    const hasColons = content.includes(`:`)
    if (!hasColons) return null

    this.children = []
    this.parse({ syntax: [`colon`] }, true)
    this.deepen()
    this.parser.root.normalize()

    return this.children[0]

    // // create master separator:colon node
    // const start = this.syntax.type === `enclosure` ? this.start + 1 : this.start
    // const colon = new TraitParserNode<SeparatorSyntaxComponent>(this.parser, null, 0, start, SYNTAX_COMPONENTS.colon as SeparatorSyntaxComponent)
    // colon.end = this.syntax.type === `enclosure` ? this.end! - 1 : this.end!

    // colon.parse({ syntax: [`colon`] }, true)

    // this.children = []
    // this.addChild(colon)
  }

  byLevel() {
    const list = [[this]] as TraitParserNode[][]

    let newLeaves
    do {
      const leaves = list[list.length - 1]

      newLeaves = []
      for (const node of leaves) newLeaves.push(...node.children)

      list.push(newLeaves)
      // debugger
    } while (newLeaves.length > 0)

    list.pop()

    return list
  }

  deepUnbalanced() {
    const list = []

    let stack = [this] as TraitParserNode[]
    do {
      const node = stack.shift()!

      list.push(...node.unbalanced)

      stack.push(...node.children)
    } while (stack.length > 0)

    return list
  }

  deepen() {
    // deepen all nodes with shallow data
    //    "shallow data" means the node can receive children after an conversion of its data to a TraitParserNode-oriented structure

    const isShallow = (this.data as any).shallow ?? false
    if (isShallow) {
      const hasChildren = this.children.length > 0

      // ERROR: Unimplemented for parent
      if (hasChildren) debugger

      if (this.syntax.type === `math`) {
        // ERROR: Unimplemented for math-dereived nodes (math_operation, math_symbol, etc)
        if (this.syntax.name !== `math`) debugger

        const mathObject = (this.data as any).mathObject as MathObject

        const parser = new MathNodeParser(this.parser, this.start, mathObject)
        const child = parser.parse()

        this.children = []
        child.id = this.children.length
        this.addChild(child)
      } else {
        // ERROR: Unimplemented
        debugger
      }

      // @ts-ignore
      this.data.shallow = false
    }

    for (const child of this.children) child.deepen()
  }

  // #region PRINT

  printCompact(options: Partial<TraitParserNodePrintOptions> = {}) {
    this.print({ ...options, levels: [2], calculateLevels: [2, 3], sections: [`nodes`], lineSizeWithoutLevenPadding: 220, onlyRelevantSource: true })
    this.print({
      ...options,
      levels: [3],
      calculateLevels: [2, 3],
      sections: [`text`, `nodes`],
      lineSizeWithoutLevenPadding: 220,
      onlyRelevantSource: true,
      boldString: true,
      colorInnerOnlyEnclosure: true,
      useParentColor: true,
      dimNodes: true,
    })
    this.print({ ...options, levels: [4], calculateLevels: [2, 3], sections: [`nodes`], lineSizeWithoutLevenPadding: 220, onlyRelevantSource: true, dimNodes: true })
  }

  printRelevant(options: Partial<TraitParserNodePrintOptions> = {}) {
    this.print({
      ...options,
      // levels: [1, 2, 3],
      sections: uniq([`nodes`, `text`, ...(options.sections ?? [])]),
      onlyRelevantSource: true,
      calculateLevelsFrom: this.level + 1,
    })
  }

  _printConstants(options: Partial<TraitParserNodePrintOptions> = {}) {
    const SOURCE_TEXT = this.parser.text

    const ROOT_LEVELS = this.parser.root.byLevel()
    const LEVELS = this.byLevel()
    const PRINT_SECTIONS = options.sections ?? [`header`, `text`, `nodes`]

    const MAX_LEVEL_ROOT = ROOT_LEVELS.length
    const MAX_LEVEL = LEVELS.length

    let RELEVANT_SOURCE = [0, SOURCE_TEXT.length] as [number, number]
    if (options.onlyRelevantSource) {
      if (options.onlyRelevantSource === true) RELEVANT_SOURCE = [this.start, this.end! + 1]
      else RELEVANT_SOURCE = [options.onlyRelevantSource.start, options.onlyRelevantSource.end! + 1]
    }

    // foreshadowing to facilitade math
    const foreshadowing_PADDING_LEVEL = `${LEVELS.length}: `.length

    let LINE_SIZE = options.lineSize ?? Infinity
    if (options.lineSizeWithoutLevenPadding !== undefined) {
      LINE_SIZE = options.lineSizeWithoutLevenPadding + foreshadowing_PADDING_LEVEL
    }

    const CHARACTERS = {
      PLACEHOLDER: `.`,
      REMAINING_COLUMNS: ``,
      EMPTYSPACE: ` `,
      //
      WHITESPACE: ` `,
      DASH: `-`,
      EDGES: [`|`, `|`],
    }

    const COLORS = {
      TEXT: {
        SYNTAX: {
          STRING: {
            BOLD: options.boldString ?? false,
          },
          ENCLOSURE: {
            INNER_ONLY: options.colorInnerOnlyEnclosure ?? false,
          },
        },
      },
      FILL: {
        USE_PARENT_COLOR: options.useParentColor ?? false,
        DIM: options.dimNodes ?? false,
      },
      EDGES: {
        DIM: options.dimNodes ?? false,
      },
    }

    const PRINT = {
      LEVELS: options.levels ?? range(0, MAX_LEVEL_ROOT),
      //
      HEADER: PRINT_SECTIONS.includes(`header`),
      TEXT: PRINT_SECTIONS.includes(`text`),
      NODES: PRINT_SECTIONS.includes(`nodes`),
      PARENT_NODES: PRINT_SECTIONS.includes(`parent_nodes`),
      CONTEXT: PRINT_SECTIONS.includes(`context`),
      //
      SOURCE: RELEVANT_SOURCE,
      UNIQ_DIGITS: options.dontRepeatDigitsInHeader ?? false,
    }

    // #region calculate paddings for columns

    let CALCULATE_PADDING_AT_LEVELS = options.calculateLevels ?? PRINT.LEVELS
    if (options.calculateLevelsUpTo !== undefined) CALCULATE_PADDING_AT_LEVELS = range(0, options.calculateLevelsUpTo + 1)
    if (options.calculateLevelsFrom !== undefined) CALCULATE_PADDING_AT_LEVELS = range(options.calculateLevelsFrom, MAX_LEVEL_ROOT)

    const PADDING_COLUMN = range(0, SOURCE_TEXT.length).map(index => {
      return {
        BEFORE: ``,
        AFTER: ``,
      }
    })
    function padBefore(index: number) {
      PADDING_COLUMN[index].BEFORE = CHARACTERS.WHITESPACE
      if (index > 1) PADDING_COLUMN[index - 1].AFTER = CHARACTERS.WHITESPACE
    }
    function padAfter(index: number) {
      PADDING_COLUMN[index].AFTER = CHARACTERS.WHITESPACE
      if (index < SOURCE_TEXT.length - 1) PADDING_COLUMN[index + 1].BEFORE = CHARACTERS.WHITESPACE
    }
    function padBoth(index: number) {
      padBefore(index)
      padAfter(index)
    }
    for (let level = 0; level < MAX_LEVEL_ROOT; level++) {
      if (!CALCULATE_PADDING_AT_LEVELS.includes(level)) continue

      for (const node of ROOT_LEVELS[level]) {
        if (node.syntax.type === `enclosure`) {
          padBoth(node.start)
          padBoth(node.end!)
        } else if (node.syntax.type === `separator`) {
          for (const middle of node.middles) padBoth(middle)
          if (node.syntax.name === `colon`) {
            padBefore(node.start)
            padAfter(node.end!)
          }
        }
      }
    }

    // #endregion

    const PADDING = {
      LEVEL: foreshadowing_PADDING_LEVEL,
      COLUMN: PADDING_COLUMN,
    }

    const SIZE = {
      //
      LINE_MAX: LINE_SIZE,
      LINE_LEVEL_PADDED: LINE_SIZE - PADDING.LEVEL,
      //
      SOURCE_TEXT: SOURCE_TEXT.length,
    }

    return {
      SOURCE_TEXT,
      NODES: LEVELS,
      MAX_LEVEL,
      MAX_LEVEL_ROOT,
      //
      CHARACTERS,
      COLORS,
      PRINT,
      SIZE,
      PADDING,
    }
  }

  print(options: Partial<TraitParserNodePrintOptions> = {}) {
    const log = (options.log ?? churchill.child({ name: `parser` })).builder({ separator: `` })

    const PRINT_CONSTANTS = this._printConstants(options)
    const { MAX_LEVEL, SIZE, PADDING, CHARACTERS, PRINT, NODES } = PRINT_CONSTANTS

    // // structural debug
    // log
    //   .add(`${`0`.repeat(PADDING.LEVEL)}`)
    //   .add(`.`.repeat(SIZE.LINE_LEVEL_PADDED))
    //   .debug()

    // context header
    if (PRINT.CONTEXT) {
      const context = this.context.toString()
      const paddedText = this._substringWithColumnPadding(this.start, this.end! + 1, PRINT_CONSTANTS, () => CHARACTERS.WHITESPACE).split(``)

      const padding = paddedText.length - context.length
      const offsetStart = Math.ceil(padding / 2)

      paddedText.splice(offsetStart, context.length, `+`)
      const [padStart, padEnd] = paddedText.join(``).split(`+`)

      log.add(` `).debug()
      log
        .add(` `.repeat(PADDING.LEVEL))
        .add(this.backgroundColor.bold(`${padStart}${context}${padEnd}`))
        .debug()
      log.add(` `).debug()
    }

    // numeric header
    if (PRINT.HEADER) {
      const MAX_DIGITS = SIZE.SOURCE_TEXT.toString().length
      for (let d = 0; d < MAX_DIGITS; d++) {
        const e = MAX_DIGITS - d - 1
        const e10 = Math.pow(10, e)

        let line = [] as string[]

        let overflow = 0
        for (const column of range(...PRINT.SOURCE)) {
          const columnString = column.toString()
          const numberOfDigits = columnString.length

          let text = ``
          let color = identity as any as chalk.Chalk

          let tens = Math.floor(parseInt(columnString.substring(numberOfDigits - 2)) / 10)
          if (tens % 2 === 0) color = chalk.cyan
          else color = chalk.green

          if (e === 0) text = last([...columnString])!
          else {
            if (column % e10 === 0) {
              text = columnString

              if (numberOfDigits > 1) overflow = numberOfDigits
            } else text = overflow-- > 1 ? `` : ` `
          }

          const paddedText = this._substringWithColumnPadding(column, column + 1, PRINT_CONSTANTS, (index: number) => {
            return text.toString()
          })
          line.push(color(paddedText))
        }

        this._printLevelPaddedCappedLine(log, -1, chalk.grey(line.join(``)), PRINT_CONSTANTS, {
          printLineNumberAsLevel: true,
          alternatingLevelColor: [chalk.red.bold, chalk.magenta.bold],
          onlyFirstLine: PRINT.UNIQ_DIGITS && e === 0,
        })
      }

      // source text
      const paddedSourceText = this._substringWithColumnPadding(this.start, this.end! + 1, PRINT_CONSTANTS)
      this._printLevelPaddedCappedLine(log, -1, chalk.grey(paddedSourceText), PRINT_CONSTANTS, {
        printLineNumberAsLevel: true,
        alternatingLevelColor: [chalk.red.bold, chalk.magenta.bold],
      })
    }

    for (let i = 0; i < MAX_LEVEL; i++) {
      const level = this.level + i

      if (!PRINT.LEVELS.includes(level)) continue

      this.printLevel(log, i, PRINT_CONSTANTS)
    }
  }

  printLevel(log: LogBuilder, level: number, PRINT_CONSTANTS: TraitParserNodePrintConstants) {
    const { MAX_LEVEL, SIZE, PADDING, PRINT } = PRINT_CONSTANTS

    if (PRINT.PARENT_NODES) {
      // this.printLevelNodes(log, level - 2, PRINT_CONSTANTS, { printLevel: true })
      // this.printLevelNodes(log, level - 1, PRINT_CONSTANTS, { printLevel: true })
    }
    if (PRINT.TEXT) this.printLevelText(log, level, PRINT_CONSTANTS, { printLevel: true })
    if (PRINT.NODES) this.printLevelNodes(log, level, PRINT_CONSTANTS, { printLevel: false })
  }

  printLevelText(log: LogBuilder, level: number, PRINT_CONSTANTS: TraitParserNodePrintConstants, options: Partial<{ printLevel: boolean }> = {}) {
    const { NODES, PADDING, SIZE, CHARACTERS, COLORS } = PRINT_CONSTANTS

    const inlineComponents = this._printNodesInline(NODES[level], PRINT_CONSTANTS)

    let text = [] as string[]
    for (const component of inlineComponents) {
      if (isString(component)) text.push(component)
      else {
        const node = component as TraitParserNode
        const substring = [] as string[]

        let colorSource = node
        if (COLORS.FILL.USE_PARENT_COLOR && node.parent) colorSource = node.parent
        let color = colorSource.color

        // color
        if (node.syntax.type === `string`) {
          if (COLORS.TEXT.SYNTAX.STRING.BOLD) color = color.bold
        }

        // assemble substring
        if (node.syntax.type === `enclosure`) {
          // by default only color outers of enclosure
          let outerColor = color
          let innerColor = identity as any as chalk.Chalk

          if (COLORS.TEXT.SYNTAX.ENCLOSURE.INNER_ONLY) {
            outerColor = identity as any as chalk.Chalk
            innerColor = color
          }

          const outer0 = this._substringWithColumnPadding(node.start, node.start + 1, PRINT_CONSTANTS)
          const inner = this._substringWithColumnPadding(node.start + 1, node.end!, PRINT_CONSTANTS)
          const outer1 = this._substringWithColumnPadding(node.end!, node.end! + 1, PRINT_CONSTANTS)

          substring.push(outerColor(outer0))
          substring.push(innerColor(inner))
          substring.push(outerColor(outer1))
        } else if (node.syntax.type === `separator` || node.syntax.name === `math_array`) {
          // color middles alone
          const middlesAndEnd = [...node.middles, node.end! + 1]
          for (let i = 0; i < middlesAndEnd.length; i++) {
            const middle = middlesAndEnd[i]
            const previousMiddle = middlesAndEnd[i - 1] ?? node.start - 1

            // since end is in the array we only need to add the before text and middle text
            const beforeText = this._substringWithColumnPadding(previousMiddle + 1, middle, PRINT_CONSTANTS)
            const middleText = this._substringWithColumnPadding(middle, middle + 1, PRINT_CONSTANTS)

            substring.push(beforeText)
            if (i < middlesAndEnd.length - 1) substring.push(color(middleText))
          }
        } else if (node.syntax.type === `list` && node.parent?.syntax.name === `colon`) {
          const before = node.children[0]
          const afters = node.children.slice(1)

          const paddedBefore = this._substringWithColumnPadding(before.start, before.end! + 1, PRINT_CONSTANTS)
          const paddedMiddle = this._substringWithColumnPadding(before.end! + 1, afters[0].start, PRINT_CONSTANTS)
          const paddedAfter = this._substringWithColumnPadding(afters[0].start, last(afters)!.end! + 1, PRINT_CONSTANTS)

          substring.push(`${color.bold(paddedBefore)}${paddedMiddle}${color(paddedAfter)}`)
        } else {
          const paddedText = this._substringWithColumnPadding(node.start, node.end! + 1, PRINT_CONSTANTS)

          substring.push(color(paddedText))
        }

        text.push(substring.join(``))
      }
    }

    this._printLevelPaddedCappedLine(log, level, chalk.gray(text.join(``)), PRINT_CONSTANTS, options)
  }

  printLevelNodes(log: LogBuilder, level: number, PRINT_CONSTANTS: TraitParserNodePrintConstants, options: Partial<{ printLevel: boolean }> = {}) {
    const { NODES, PADDING, SIZE, CHARACTERS, COLORS } = PRINT_CONSTANTS

    const inlineComponents = this._printNodesInline(NODES[level], PRINT_CONSTANTS, { useWhitespace: true })

    // construct line from nodes in level
    const text = [] as (string | { text: string; overflow: number })[]
    for (const component of inlineComponents) {
      if (isString(component)) text.push(component)
      else {
        const node = component as TraitParserNode

        const LOCAL_DASH = CHARACTERS.DASH

        // make strings
        let centerText = node.context.toString()

        // SPECIAL CASE: Strings can ditch the point, the prefix "x" and level in context (since i hardly will inspect/search for string nodes)
        if (node.syntax.type === `string`) centerText = node.id === `root` ? `root` : toName(node.id)

        let edges = [CHARACTERS.EDGES[0], CHARACTERS.EDGES[1]]
        let fill = centerText

        // colors
        let doDimRanges = false

        let edgeColor = chalk.white

        let fillColorSource = node
        if (COLORS.FILL.USE_PARENT_COLOR && node.parent) fillColorSource = node.parent
        let fillColor = fillColorSource.color

        //    syntax-based
        if (node.syntax.name === `math`) fillColor = fillColorSource.backgroundColor
        else if (node.syntax.name === `math_constant` || node.syntax.name === `math_symbol`) {
          if (isVariable(node)) doDimRanges = true
        }

        //    dimming
        if (doDimRanges || COLORS.EDGES.DIM) edgeColor = edgeColor.dim
        if (doDimRanges || COLORS.FILL.DIM) fillColor = fillColor.dim

        //    bolding
        fillColor = fillColor.bold
        edgeColor = edgeColor.bold

        // coloring
        edges = edges.map(edge => edgeColor(edge))
        fill = fillColor(fill)

        // decide what prints
        const parts = [] as (string | { text: string; overflow: number })[]
        // before start padding (to align edge with first character of substring)
        parts.push(PADDING.COLUMN[node.start].BEFORE)

        const viewportStart = this._substringWithColumnPadding(0, node.start, PRINT_CONSTANTS).length + PADDING.COLUMN[node.start].BEFORE.length
        const viewportEnd = this._substringWithColumnPadding(0, node.end!, PRINT_CONSTANTS).length + PADDING.COLUMN[node.end!].BEFORE.length

        const availableSpace = viewportEnd - viewportStart + 1
        const overflowLength = availableSpace - centerText.length
        if (overflowLength < 0) {
          parts.push({ text: fill, overflow: Math.abs(overflowLength) })
        } else {
          let dashes = LOCAL_DASH.repeat(availableSpace).split(``)
          const offsetStart = Math.floor((availableSpace - centerText.length) / 2)

          dashes.splice(offsetStart, centerText.length, `.`)
          const [prefix, suffix] = dashes.join(``).split(`.`)

          let boundary = `${prefix}${fill}${suffix}`

          // +4 to account for edges AND at least one dash on each side
          const isThereSpaceForEdges = availableSpace >= centerText.length + 4 // boundary[0] === LOCAL_DASH && boundary[boundary.length - 1] === LOCAL_DASH
          if (isThereSpaceForEdges) {
            boundary = `${edges[0]}${boundary.substring(1, boundary.length - 1)}${edges[1]}`
          } else {
            boundary = boundary.replaceAll(LOCAL_DASH, CHARACTERS.WHITESPACE)
          }

          parts.push(boundary)
        }

        text.push(...parts)
      }
    }

    // aggregate whitespaces
    let aggregateWhitespaceText = [] as (string | { text: string; overflow: number })[]
    for (let i = 0; i < text.length; i++) {
      const component = text[i]
      if (isString(component)) {
        const lastInAggregate = last(aggregateWhitespaceText) ?? `a`
        if (isString(lastInAggregate)) {
          if (!/\S/.test(lastInAggregate) && !/\S/.test(component)) {
            aggregateWhitespaceText[aggregateWhitespaceText.length - 1] = `${lastInAggregate}${component}`

            continue
          }
        }
      }

      aggregateWhitespaceText.push(component)
    }

    // remove overflow from sides (if they are whitespacess)
    const overflowAccountextText = cloneDeep(aggregateWhitespaceText)
    for (let i = 0; i < overflowAccountextText.length; i++) {
      if (isString(overflowAccountextText[i])) continue

      const overflownText = overflowAccountextText[i] as { text: string; overflow: number }
      if (overflownText.overflow === 0) {
        overflowAccountextText[i] = overflownText.text
        continue
      }

      const isOverflownTextWhitespaces = (index: number) => isString(overflowAccountextText[index]) && !/\S/.test(overflowAccountextText[index] as any)

      let remainingOverflow = overflownText.overflow
      overflowAccountextText[i] = overflownText.text

      const targetsInOrderOfPreference = [i + 1, i - 1]
      const validTargets = targetsInOrderOfPreference.filter(index => index >= 0 && index < overflowAccountextText.length && isOverflownTextWhitespaces(index))

      let halfOverflow = Math.ceil(remainingOverflow / 2)
      for (let j = 0; j < validTargets.length; j++) {
        const target = validTargets[j]

        const targetOverflowText = overflowAccountextText[target] as string
        const numberOfCharactersToRemove = Math.min(halfOverflow, targetOverflowText.length, remainingOverflow)
        overflowAccountextText[target] = targetOverflowText.substring(numberOfCharactersToRemove)

        remainingOverflow -= numberOfCharactersToRemove
      }

      // if (remainingOverflow > 0) debugger
    }

    this._printLevelPaddedCappedLine(log, level, chalk.gray((overflowAccountextText as string[]).join(``)), PRINT_CONSTANTS, options)
  }

  _substringWithColumnPadding(start: number, end: number, PRINT_CONSTANTS: TraitParserNodePrintConstants, getText?: (index: number) => string) {
    const { PRINT, PADDING, SIZE, CHARACTERS, SOURCE_TEXT } = PRINT_CONSTANTS

    const relevantStart = Math.max(start, PRINT.SOURCE[0])
    const relevantEnd = Math.min(end, PRINT.SOURCE[1])

    if (getText === undefined) getText = index => SOURCE_TEXT[index]

    const columns = [] as string[]
    for (let index = relevantStart; index < relevantEnd; index++) {
      // eslint-disable-next-line no-debugger
      if (PADDING.COLUMN[index] === undefined) debugger
      const { BEFORE, AFTER } = PADDING.COLUMN[index]

      const text = getText(index)

      const isLastColumn = index === SIZE.SOURCE_TEXT - 1 || index === PRINT.SOURCE[1] - 1

      columns.push(`${BEFORE}${text}${isLastColumn ? AFTER : ``}`)
    }

    return columns.join(``)
  }

  _printNodesInline(nodes: TraitParserNode[], PRINT_CONSTANTS: TraitParserNodePrintConstants, options: Partial<{ useWhitespace: boolean }> = {}) {
    const { NODES, PADDING, SIZE, CHARACTERS } = PRINT_CONSTANTS
    const USE_WHITESPACE = options.useWhitespace ?? false

    const orderedNodes = orderBy(nodes, [`start`], [`asc`])

    const debug_orderedNodes = orderedNodes.map(node => ({ node, start: node.start, end: node.end }))

    const components = [] as (string | TraitParserNode)[]

    let cursor = 0
    for (let i = 0; i < orderedNodes.length; i++) {
      const previousNode = orderedNodes[i - 1] ?? { end: 0 }
      const nextNode = orderedNodes[i + 1]
      let node = orderedNodes[i]

      const prefix = node.start - cursor
      if (prefix > 0) {
        // space between nodes
        components.push(this._substringWithColumnPadding(cursor, node.start, PRINT_CONSTANTS, USE_WHITESPACE ? () => CHARACTERS.WHITESPACE : undefined))
        // components.push(CHARACTERS.EMPTYSPACE.repeat(prefix))
      }

      components.push(node)
      cursor = node.end! + 1
    }

    // append suffix for last node
    if (cursor < SIZE.SOURCE_TEXT) {
      // space between nodes
      components.push(this._substringWithColumnPadding(cursor, SIZE.SOURCE_TEXT, PRINT_CONSTANTS, USE_WHITESPACE ? () => CHARACTERS.WHITESPACE : undefined))
      // components.push(CHARACTERS.EMPTYSPACE.repeat(SIZE.SOURCE_TEXT - cursor))
    }

    return components
  }

  _printLevelPaddedCappedLine(
    log: LogBuilder,
    level: number,
    text: string,
    PRINT_CONSTANTS: TraitParserNodePrintConstants,
    options: Partial<{ onlyFirstLine: boolean; printLevel: boolean; printLineNumberAsLevel: boolean; alternatingLevelColor: (chalk.Chalk | typeof identity)[] }> = {},
  ) {
    const { PADDING, SIZE, CHARACTERS } = PRINT_CONSTANTS

    // if we should print level number or just pad the space
    const PRINT_LINE_NUMBER_AS_LEVEL = options.printLineNumberAsLevel ?? false
    const PRINT_LEVEL = (PRINT_LINE_NUMBER_AS_LEVEL || options.printLevel) ?? true

    // eslint-disable-next-line no-control-regex
    const ANSI = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g

    const _noANSIText = splitOnRegexWithIndex(text, ANSI)
    const noANSIText = _noANSIText.map(partial => partial.text).join(``)

    const NO_ANSI_LENGTH = noANSIText.length

    const necessaryLines = Math.max(1, Math.ceil(NO_ANSI_LENGTH / SIZE.LINE_LEVEL_PADDED))
    let cursor = 0
    let overflowOffset = 0
    for (let i = 0; i < necessaryLines; i++) {
      const cloneLog = log.builder()

      // level
      let levelColor = chalk.grey

      const doPrintLevelNumber = (PRINT_LEVEL && i === 0) || PRINT_LINE_NUMBER_AS_LEVEL
      if (doPrintLevelNumber) {
        const numericValue = PRINT_LINE_NUMBER_AS_LEVEL ? i : level + this.level

        if (options.alternatingLevelColor) {
          const colorOptions = options.alternatingLevelColor.length
          const module = numericValue % colorOptions

          levelColor = options.alternatingLevelColor[module] as chalk.Chalk
        }

        const levelText = `${numericValue}`
        cloneLog.add(levelColor(levelText) + ` `.repeat(PADDING.LEVEL - levelText.length))
      } else {
        cloneLog.add(` `.repeat(PADDING.LEVEL))
      }

      // effective line
      let line = ``
      let lineColorlessLength = 0
      while (lineColorlessLength < SIZE.LINE_LEVEL_PADDED && cursor < _noANSIText.length) {
        const partial = _noANSIText[cursor++]

        let stringIncrement = partial.text.substring(overflowOffset)

        if (lineColorlessLength + stringIncrement.length > SIZE.LINE_LEVEL_PADDED) {
          const overflow = lineColorlessLength + stringIncrement.length - SIZE.LINE_LEVEL_PADDED

          stringIncrement = stringIncrement.substring(0, stringIncrement.length - overflow)

          overflowOffset += partial.text.substring(overflowOffset).length - overflow
          cursor--
        } else {
          overflowOffset = 0
        }

        line = `${line}${partial.before}${stringIncrement}`

        lineColorlessLength += stringIncrement.length
      }

      // adding after for current partial of text
      if (cursor < _noANSIText.length) line = `${line}${_noANSIText[cursor].after}`

      cloneLog.add(line)

      if (CHARACTERS.REMAINING_COLUMNS !== `` && SIZE.LINE_LEVEL_PADDED !== Infinity) {
        cloneLog.add(chalk.italic.gray.dim(CHARACTERS.REMAINING_COLUMNS.repeat(SIZE.LINE_LEVEL_PADDED - lineColorlessLength)))
      }
      cloneLog.debug()

      if (options.onlyFirstLine) break
    }
  }

  // #endregion

  serialize() {
    const object: SerializedTraitParserNode = {
      parent: this.parent?.fullpath ?? null,
      id: this.id,

      start: this.start,
      end: this.end,

      middles: this.middles,

      children: this.children.map(node => node.serialize()),
      unbalanced: this.unbalanced,

      syntax: this.syntax.name,

      data: {},
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data = this.data as any
    if (data.mathObject) data.mathObject = data.mathObject.serialize()

    object.data = data

    return object
  }

  static deserialize<TSyntax extends SyntaxComponent = SyntaxComponent, TData extends object = any>(serialized: SerializedTraitParserNode, parser: TraitParser) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data = serialized.data as any
    if (data.mathObject) data.mathObject = MathObject.deserialize(data.mathObject)

    const node = new TraitParserNode<TSyntax, TData>(parser, null, serialized.id, serialized.start, SYNTAX_COMPONENTS[serialized.syntax] as TSyntax, data)
    node.end = serialized.end
    node.middles = serialized.middles

    node.unbalanced = serialized.unbalanced

    for (const serializedChild of serialized.children) {
      if (node.fullpath !== serializedChild.parent) {
        // ERROR: Node doesnt seem to be parent of child
        // eslint-disable-next-line no-debugger
        debugger
      }

      const child = TraitParserNode.deserialize(serializedChild, parser)

      node.addChild(child)
    }

    return node
  }
}

export type TraitParserNodePrintOptions = {
  log: LogBuilder
  //
  levels: number[]
  calculateLevels: number[]
  calculateLevelsUpTo: number
  calculateLevelsFrom: number
  lineSize: number
  lineSizeWithoutLevenPadding: number
  sections: TraitParserNodePrintSections[]
  dontRepeatDigitsInHeader: boolean
  onlyRelevantSource: boolean | TraitParserNode
  //
  useParentColor: boolean
  dimNodes: boolean
  boldString: boolean
  colorInnerOnlyEnclosure: boolean
}

export type TraitParserNodePrintSections = `header` | `text` | `nodes` | `parent_nodes` | `context`

export type TraitParserNodePrintConstants = ReturnType<TraitParserNode<any, any>[`_printConstants`]>

type IndexedSeparatorNode = { node: TraitParserNode<SeparatorSyntaxComponent>; index: number; syntax: SyntaxName }

function enlistSeparatorNodes(listOfNodes: TraitParserNode[], returnAsListNode: number | false = false) {
  // index all separators in list of nodes
  const separatorNodes = listOfNodes
    .map((child, index) => ({ node: child as TraitParserNode<SeparatorSyntaxComponent>, syntax: child.syntax.name, index, offspring: [] }))
    .filter(indexedNode => indexedNode.node.syntax.type === `separator`) as IndexedSeparatorNode[]

  // if there are no separators, just return list of nodes
  if (separatorNodes.length === 0) {
    if (returnAsListNode === false) return listOfNodes

    //  create list node to hold, well, the list of nodes
    const id = returnAsListNode

    const list = new TraitParserNode(listOfNodes[0].parser, null, id, listOfNodes[0].start, SYNTAX_COMPONENTS.list)
    list.end = listOfNodes[listOfNodes.length - 1].end

    for (let i = 0; i < listOfNodes.length; i++) {
      const node = listOfNodes[i]

      list.addChild(node)
    }

    return [list]
  }

  // if there are, start calculating types to get the mostest prioritariest
  const types = uniq(separatorNodes.map(node => node.syntax))
  const typesByPriority = orderBy(types, type => (SYNTAX_COMPONENTS[type] as SeparatorSyntaxComponent).prio ?? 0, `desc`)

  const prioritaryType = typesByPriority[0]
  const prioritarySeparators = separatorNodes.filter(node => node.syntax === prioritaryType)

  const indexes = prioritarySeparators.map(indexedNode => indexedNode.index)

  // choose first separator as master node
  const master = prioritarySeparators[0].node
  // ERROR: Unimplemented for when master node ALREADY has children
  // eslint-disable-next-line no-debugger
  if (master.children.length > 0) debugger

  // partition nodes by separator
  const children = [] as (TraitParserNode | null)[]
  if ([`comma`, `pipe`].includes(prioritaryType)) {
    const pairs = zip([0, ...indexes.map(i => i + 1)], [...indexes, listOfNodes.length])
    const partitions = pairs.map(([start, end]) => listOfNodes.slice(start, end))

    // aggregate partition in list nodes
    for (let index = 0; index < partitions.length; index++) {
      const nodes = partitions[index]

      // if there are no nodes in this partition, just push null (presenving index so far, dont know if its gonna become necessary in the future)
      if (nodes.length === 0) children.push(null)
      else {
        // enlistSeparatorNodes receives a list of nodes and, if necessary, split them by separators OR return as a list node
        const enlistedChildren = enlistSeparatorNodes(nodes, index)

        children.push(...enlistedChildren)
      }
    }
  } else if ([`colon`].includes(prioritaryType)) {
    // first of all we have to break STRING nodes BEFORE middles (<many words><single whitespaceless word>)
    //    if before the middle we have a non string node, just keep it as is
    const brokenUpNodes = [] as TraitParserNode[]
    for (let index = listOfNodes.length - 1; index >= 0; index--) {
      const node = listOfNodes[index]

      const isNextMiddle = indexes.includes(index + 1)

      if (!isNextMiddle) brokenUpNodes.splice(0, 0, node)
      else {
        const substring = node.substring
        const lastWhitespace = substring.lastIndexOf(` `)

        // split string into two
        const strings = [substring.substring(0, lastWhitespace + 1), substring.substring(lastWhitespace + 1)]

        // create new TraitParserNode s from strings
        const originalId = node.id as number

        const newNodes = [] as TraitParserNode[]
        let cursor = 0
        for (let i = 0; i < strings.length; i++) {
          const string = strings[i]
          const newId = originalId + i / strings.length

          const newNode = new TraitParserNode(node.parser, null, newId, node.start + cursor, SYNTAX_COMPONENTS.string)
          newNode.end = node.start + cursor + string.length - 1

          cursor += string.length
          newNodes.push(newNode)
        }

        brokenUpNodes.splice(0, 0, ...newNodes)
      }
    }

    const brokenUpPrioritarySeparators = brokenUpNodes.map((node, index) => ({ node, index })).filter(({ node }) => node.syntax.name === prioritaryType)
    const brokenUpIndexes = brokenUpPrioritarySeparators.map(indexedNode => indexedNode.index)

    // then we make the triples to partition the lists
    const pairs = brokenUpIndexes.map(index => [index - 1, index])
    const _partitions = zip(pairs, [...brokenUpIndexes.slice(1).map(i => i - 2), brokenUpNodes.length])
    const partitions = _partitions.map(([pair, after]) => [...(pair as any), after])

    const debug_partitions = partitions.map(triple => triple.map(i => brokenUpNodes[i]?.substring))

    for (let index = 0; index < partitions.length; index++) {
      const [before, middle, after] = partitions[index]

      const beforeNode = brokenUpNodes[before]
      const middleNode = brokenUpNodes[middle]
      const afterNodes = brokenUpNodes.slice(middle + 1, after + 1)

      // if there are no nodes in this partition, just push null (presenving index so far, dont know if its gonna become necessary in the future)
      if (!beforeNode && afterNodes.length === 0) children.push(null)
      else {
        // ERROR: Untested colon without before node
        if (!beforeNode) debugger

        // enlistSeparatorNodes receives a list of nodes and, if necessary, split them by separators OR return as a list node
        const enlistedChildren = enlistSeparatorNodes([beforeNode, ...afterNodes], index)

        children.push(...enlistedChildren)
      }
    }
  } else {
    // ERROR: Separator specialization not implemented
    debugger
  }

  const validChildren = children.filter(node => !isNil(node)) as TraitParserNode[]

  // add lists to master
  validChildren.map(node => master.addChild(node))
  master.middles = prioritarySeparators.map(indexedNode => indexedNode.node.start)
  master.start = min([...validChildren.map(node => node.start), ...master.middles])!
  master.end = max([...validChildren.map(node => node.end), ...master.middles])!

  // VALIDATION
  if (!master.checkTreeIntegrity()) debugger

  return [master]
}

function getMathObject(node: TraitParserNode) {
  const data = node.data as any
  if (data.mathObject) return data.mathObject as MathObject

  if (node.parent) return getMathObject(node.parent)

  return null
}

function isVariable(node: TraitParserNode) {
  if (node.syntax.type !== `math`) return false
  if (![`math_constant`, `math_symbol`].includes(node.syntax.name)) return false

  const mathObject = getMathObject(node)

  // ERROR: How I could not find a math object in node tree if node is a math_someshit?
  // eslint-disable-next-line no-debugger
  if (!mathObject) debugger
  else {
    let variableKey = node.data?.value as string
    if (node.syntax.name === `math_symbol`) variableKey = node.data?.name as string

    // ERROR: Variable is lacking a key
    // eslint-disable-next-line no-debugger
    if (isNil(variableKey)) debugger

    const scopeValue = mathObject.scope.get(variableKey)
    const isVariable = scopeValue === MathSyntax.MISSING_VALUE

    return isVariable
  }
}

function splitOnRegexWithIndex(string: string, regex: RegExp) {
  let results = [],
    cnt = regex.global ? Infinity : 1,
    m,
    offset = 0

  while (cnt-- && (m = regex.exec(string))) {
    const slice = string.slice(offset, m.index)

    results.push({
      before: ``,
      after: m[0],
      index: offset,
      text: slice,
    })

    offset = m.index + m[0].length
  }

  const slice = string.slice(offset)
  if (slice.length > 0) {
    results.push({
      before: ``,
      after: ``,
      index: offset,
      text: slice,
    })
  }

  // backtgrack to fill "before"
  for (let i = 1; i < results.length; i++) {
    const before = results[i - 1].after
    results[i].before = before
  }

  return results
}
