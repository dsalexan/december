/* eslint-disable no-debugger */
import { VariableType } from "./../../../../packages/utils/src/typing/types"
import { isNilOrEmpty, typing } from "@december/utils"
import { TraitParser } from "./parser"

import churchill from "../logger"
import TraitTag, { TRAIT_TAG_NAMES, TraitTagName } from "./tag/tag"
import { cloneDeep, get, isNil, last, range, uniq } from "lodash"
import { NullableLogBuilder } from "@december/churchill"
import chalk from "chalk"
import { TraitError, TraitErrorManager, getHighestErrorPriority } from "./error"
import { SuperchargedTraitData, TRAIT_SCHEMAS, TraitDefinition } from "./sections"
import { TraitSection } from "./sections/types"
import { isOnlybornAnd } from "./parser/node/utils"
import { SYNTAX_COMPONENTS } from "./parser/syntax"
import { TraitParserNode } from "./parser/node"

export const logger = churchill.child({ name: `trait` })

export const TRAIT_PILELINES = [`parse`, `compile`, `mount`, `validate`] as const
export type TraitPipeline = (typeof TRAIT_PILELINES)[number]

// determines that a specific value for a trait was not defined (although it is different than undefined, which can exist)
export const UNDEFINED_VALUE = Symbol.for(`UNDEFINED_VALUE`)

export default class Trait<TDefinition extends TraitDefinition = TraitDefinition> {
  _id: string // na pratica é a linha do trait dentro do arquivo .fst, what i call "GCA ID"
  _row: {
    fst: number
    fstndx: number
  }

  _raw: string
  _parser!: TraitParser

  _errors: TraitErrorManager

  _tags: Partial<Record<TraitTagName, TraitTag>> = {}
  _data!: TDefinition[`Data`]

  section!: TraitSection
  book?: string
  parent?: Trait

  get data(): SuperchargedTraitData<TDefinition> {
    const data = this._data
    return {
      ...data, //
      fullname: data.name,
      // fullname: (data.nameext as any) === UNDEFINED_VALUE || data.nameext === `` || data.nameext === undefined ? data.name : `${data.name} (${data.nameext})`,
    }
  }

  constructor(raw: string, id: string | number, row: { fst: number; fstndx: number }) {
    this._raw = raw
    this._id = id.toString()
    this._row = row

    this._errors = new TraitErrorManager(this)
  }

  getHighestErrorPriority(pipeline?: TraitPipeline) {
    return this._errors.getHighestErrorPriority(pipeline)
  }

  parse(log?: NullableLogBuilder, parent?: Trait, book?: string) {
    let raw = this._raw

    const startsWithComma = raw.startsWith(`,`)
    if (!startsWithComma) raw = `,${raw}`

    raw = `⟨${raw.trim()}⟩` // we pretend there is an parenthesis enclosure around this, as seen when instantiating root node

    this.parent = parent
    this.book = book

    // reset errors in manager
    this._errors.clear(`parse`)

    if (log) {
      log.add(`parse`).verbose()
      log.tab()
      log.add(chalk.grey(raw)).verbose()
    }

    try {
      this._parser = new TraitParser(raw)
      this._parser.parse()
    } catch (ex) {
      debugger
    }

    if (log) {
      const numberOfErrors = this._errors.count(`parse`)
      if (numberOfErrors === 0) log.add(chalk.italic.gray(`no parsing errors`)).verbose({ duration: true })
      else log.add(chalk.italic(`${chalk.bgYellow.bold(` ${numberOfErrors} `)} mounting error${numberOfErrors === 1 ? `` : `s`}`)).verbose({ duration: true })

      log.tab(-1)
    }
  }

  compile(log?: NullableLogBuilder) {
    const root = this._parser.root

    // ERROR: Root must be imaginary
    if (root.syntax.name !== `imaginary`) debugger

    // ERROR: There must be offspring
    if (root.children.length === 0) debugger

    if (log) {
      log.add(`compile`).verbose()
      root.children[0].print({
        log,
        levels: [2],
        calculateLevels: [2],
        sections: [`text`, `nodes`],
        lineSizeWithoutLevenPadding: 210,
        onlyRelevantSource: true,
        boldString: true,
        colorInnerOnlyEnclosure: true,
        useParentColor: true,
        dimNodes: true,
      })
      log.tab()
    }

    // ERROR: First level child must be onlyborn AND comma
    const isOnlyborn = root.children.length === 1
    const isComma = root.children[0]?.syntax?.name === `comma`
    if (!isOnlyborn || !isComma) debugger

    // reset errors in manager
    this._errors.clear(`compile`)

    const separator = root.children[0]
    const lists = separator.children

    // detect piping
    const pipedIndexes = [] as number[]
    for (let i = 0; i < lists.length; i++) {
      const list = lists[i]

      // ERROR: Node is not a tag
      if (!TraitTag.isNodeATag(list, this)) debugger

      // check if value's first child is onlyborn and pipe
      const valueNode = TraitTag.getValueNode(list)
      if (isOnlybornAnd(valueNode.children, [`pipe`])) {
        // value IS piped
        pipedIndexes.push(i)
      } else {
        // value does not appear to be piped

        // there can be pipes not at first level
        //    gives(...) is an example of this, its value can be quite complex of a statement

        // check if there is a pipe in the first child level, but it is not onlyborn
        if (valueNode.children.length > 1 && valueNode.children.some(node => node.syntax.name === `pipe`)) {
          // ERROR: Untested
          debugger
        }
      }
    }

    // determine if piping is correct (same number of options for EVERY piped tag)
    let PIPE_VARIANTS = 1
    if (pipedIndexes.length > 0) {
      const indexOfOptions = {} as Record<number, number[]>

      for (let i = 0; i < pipedIndexes.length; i++) {
        const list = lists[pipedIndexes[i]]
        const valueNode = TraitTag.getValueNode(list)
        const pipe = valueNode.children[0]

        const numberOfOptions = pipe.middles.length
        if (indexOfOptions[numberOfOptions] === undefined) indexOfOptions[numberOfOptions] = []
        indexOfOptions[numberOfOptions].push(pipedIndexes[i])
      }

      const uniqNumberOfOptions = uniq(Object.keys(indexOfOptions).map(key => parseInt(key)))
      if (uniqNumberOfOptions.length === 1) {
        // PIPE IS CORRECT
        PIPE_VARIANTS = uniqNumberOfOptions[0]
      } else {
        // this._parser.root.printCompact({ lineSizeWithoutLevenPadding: 240 })

        for (const qtd of uniqNumberOfOptions) {
          // choose smaller node (easier to debug)
          const pool = indexOfOptions[qtd]

          const nodePool = pool.map(index => ({ node: lists[index], substring: lists[index].substring.trim() })).sort((a, b) => a.substring.length - b.substring.length)

          const node = nodePool[0].node

          console.error(
            chalk.bgGray.white(
              `${` `.repeat(50)}${node.backgroundColor(` ${node.context} (${chalk.bold(`${node.children[0].substring.trim()}`)}) `)} has ${chalk.bold(qtd)} pipes (${
                pool.length === 1 ? chalk.bgRed(`ONLY ONE`) : `one of ${chalk.bold(pool.length)}`
              })${` `.repeat(50)}`,
            ),
          )

          const pipe = node.children[1]
          pipe.printRelevant({ sections: [`context`], lineSizeWithoutLevenPadding: 240, levels: range(pipe.level, pipe.level + 3), calculateLevels: [pipe.level] })
          console.log(` `)
        }

        console.error(chalk.bgRed(`${` `.repeat(50)}Trait ${chalk.bold(this._row.fst)} at .fst${` `.repeat(50)}`))
        this._parser.root.printCompact({ sections: [`text`], lineSizeWithoutLevenPadding: 240 })
        // piping is not uniform across all piped tags, WHY?
        debugger
      }
    }

    const tags = {} as Record<TraitTagName, TraitTag>
    for (let i = 0; i < lists.length; i++) {
      const list = lists[i]

      const isPiped = pipedIndexes.includes(i) // informs that value for tag IS piped (and conforming to pipe format across all other piped tags)

      const tag = new TraitTag(this, list)
      const result = tag.parse()

      this._errors.add(`compile`, result.errors, { tag })
      if (getHighestErrorPriority(result.errors) >= 2) {
        debugger
      }

      tags[tag.name] = tag
    }

    if (log) {
      const numberOfErrors = this._errors.count(`compile`)
      if (numberOfErrors === 0) log.add(chalk.italic.gray(`no compilation errors`)).verbose({ duration: true })
      else log.add(chalk.italic(`${chalk.bgYellow.bold(` ${numberOfErrors} `)} compilation error${numberOfErrors === 1 ? `` : `s`}`)).verbose({ duration: true })

      log.tab(-1)
    }

    this._tags = tags
  }

  mount(log?: NullableLogBuilder) {
    // reset errors in manager
    this._errors.clear(`mount`)

    if (log) log.add(`mount`).verbose().tab()

    // reset values for trait (so in validate we can determine what is missing)
    const data = {} as any

    // fill values based on already parsed tags ("compilation")
    const tags = Object.values(this._tags)
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i]

      if (!tag.isValueParsed) {
        // dont bother to mount unparsed values (types might not match and all)
        // @ts-ignore
        data[tag.name] = UNDEFINED_VALUE
      } else {
        // @ts-ignore
        data[tag.name] = tag.value
      }
    }

    this._data = data

    if (log) {
      const numberOfErrors = this._errors.count(`mount`)
      if (numberOfErrors === 0) log.add(chalk.italic.gray(`no mounting errors`)).verbose({ duration: true })
      else log.add(chalk.italic(`${chalk.bgYellow.bold(` ${numberOfErrors} `)} mounting error${numberOfErrors === 1 ? `` : `s`}`)).verbose({ duration: true })

      log.tab(-1)
    }
  }

  validate(log?: NullableLogBuilder) {
    // reset errors in manager
    this._errors.clear(`validate`)

    if (log) log.add(`validate`).verbose().tab()

    if (isNilOrEmpty(this._id)) throw new Error(`Invalid trait ID: ${this._id}`)
    if (isNil(this._row.fst)) throw new Error(`Invalid .fst row: ${this._row.fst}`)
    if (isNil(this._row.fstndx)) throw new Error(`Invalid .fstndx row: ${this._row.fstndx}`)

    // validate data against schema
    const schema = TRAIT_SCHEMAS[this.section]
    if (!schema) {
      console.error(chalk.bgRed(`${` `.repeat(50)}Schema for section "${chalk.bold(this.section)}" was not implemented${` `.repeat(50)}`))

      // ERROR: Unimplemented schema for section
      debugger
    } else {
      try {
        const data = this.data
        const result = schema.safeParse(data)

        if (!result.success) {
          const errors = result.error.errors

          for (const error of errors) {
            const { code } = error

            if (code === `unrecognized_keys`) {
              const keysAndTypes = [] as { key: string; type?: VariableType }[]
              for (const key of error.keys) {
                const value = data[key as keyof typeof data]

                let type: VariableType | undefined
                if (value === UNDEFINED_VALUE) {
                  // if value was never defined (most key was not declared as a possible tag name)
                  // we try to guess the type based on trait._value
                  const tag = this._tags[key as TraitTagName]!
                  if (tag === undefined) {
                    // ERROR: Tag not found, probably some mistake in indexing
                    debugger
                  }

                  type = tag.valueNode.children[0].guessType() as any
                } else type = typing.guessType(value)

                keysAndTypes.push({ key, type })
              }

              this._errors.add(`validate`, { unschemaedKeys: keysAndTypes }, { trait: this })
            } else if (code === `invalid_type`) {
              const definedPaths = [] as (string | number)[]

              for (const path of error.path) {
                const value = get(data, path)

                if (value === UNDEFINED_VALUE) {
                  // if value was never defined (most key was not declared as a possible tag name) ignore it. there is already another error to handle this shit
                  continue
                }

                debugger
                definedPaths.push(path)
              }

              if (definedPaths.length > 0) {
                // ERROR: Unimplemented error for invalid type in defined tags
                debugger
                // this._errors.add(`validate`, { unschemaedKeys: keysAndTypes }, { trait: this })
              }
            } else {
              console.error(chalk.bgRed(`${` `.repeat(50)}Unimplemented schema error code "${chalk.bold(code)}"${` `.repeat(50)}`))

              // ERROR: Unimplemented schema error code
              debugger
            }
          }
        } else {
          debugger
        }
      } catch (ex) {
        // just go, testing time
      }
    }

    if (log) {
      const numberOfErrors = this._errors.count(`validate`)
      if (numberOfErrors === 0) log.add(chalk.italic.gray(`no validating errors`)).verbose({ duration: true })
      else log.add(chalk.italic(`${chalk.bgYellow.bold(` ${numberOfErrors} `)} validating error${numberOfErrors === 1 ? `` : `s`}`)).verbose({ duration: true })

      log.tab(-1)
    }
  }
}
