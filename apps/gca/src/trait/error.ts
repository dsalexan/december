import { cloneDeep, groupBy, isString, max, uniq } from "lodash"
import Trait, { TRAIT_PILELINES, TraitPipeline } from "."
import { TraitParserNode } from "./parser/node"
import LogBuilder from "@december/churchill/src/builder"
import chalk from "chalk"
import TraitTag, { TraitTagName } from "./tag/tag"
import { VariableType } from "@december/utils/src/typing/types"

export const TRAIT_ERROR_NAMES = [`missingTagName`, `unsuccessfulTagValueParsing`, `unschemaedKeys`] as const

export type TraitErrorName = (typeof TRAIT_ERROR_NAMES)[number]

export type TraitBaseError = {
  node?: TraitParserNode
  tag?: TraitTag
  trait?: Trait
  //
  key?: string
  type?: VariableType | undefined
}

export type TraitError = TraitBaseError & {
  _isTraitError: true
  trait: Trait
  pipeline: TraitPipeline
  name: TraitErrorName
  //
  message: string
}

export type TraitErrorMap = {
  missingTagName: string[]
  unsuccessfulTagValueParsing: string[]
  unschemaedKeys: { key: string; type?: VariableType }[]
}

/**
 * 0 - Log after parsing everything
 * 1 - Log after parsing line
 * 2 - Log after parsing tag
 */
export const ERROR_PRIORITY: Record<TraitErrorName, number> = {
  missingTagName: 0,
  unsuccessfulTagValueParsing: 0,
  unschemaedKeys: 0,
}

export class TraitErrorManager {
  trait: Trait | null
  store: Record<TraitPipeline, Record<TraitErrorName, TraitError[]>> = {} as any

  constructor(trait: Trait | null) {
    this.trait = trait

    // initializing storage
    this.clear()
  }

  getHighestErrorPriority(pipeline?: TraitPipeline) {
    let highestPriority = -1

    const pipelines = pipeline ? [pipeline] : TRAIT_PILELINES

    for (const pipeline of pipelines) {
      const errors = this.store[pipeline]

      for (const key of TRAIT_ERROR_NAMES) {
        if ((errors[key]?.length ?? 0) === 0) continue

        highestPriority = Math.max(highestPriority, ERROR_PRIORITY[key])
      }
    }

    return highestPriority
  }

  clear(pipeline?: TraitPipeline) {
    const pipelines = pipeline ? [pipeline] : TRAIT_PILELINES

    for (const pipeline of pipelines) {
      this.store[pipeline] = {} as any

      // dont initialize everywhere with everything, the debugging goes to hell
      // for (const name of TRAIT_ERROR_NAMES) {
      //   this.store[pipeline][name] = []
      // }
    }
  }

  add(pipeline: TraitPipeline, incompleteErrors: Partial<TraitErrorMap>, baseError: TraitBaseError) {
    if (this.trait === null) {
      throw new Error(`Cannot add error to a "generic error manager"`)
    }

    for (const errorName of TRAIT_ERROR_NAMES) {
      const errors = incompleteErrors[errorName] ?? []
      if (errors.length === 0) continue

      for (const incompleteError of errors) {
        let completeError: TraitError

        const isAlreadyCompleteError = (incompleteError as any)?._isTraitError
        if (isAlreadyCompleteError) completeError = incompleteError as any as TraitError
        else {
          // filling information about the error informed as argument
          completeError = {} as any as TraitError
          for (const key of Object.keys(baseError)) {
            // @ts-ignore
            completeError[key] = baseError[key]
          }

          // filling information about the error (shit the manager already knows)
          completeError._isTraitError = true
          completeError.trait = this.trait
          completeError.pipeline = pipeline
          completeError.name = errorName

          // adding the error itself
          if (isString(incompleteError)) completeError.message = incompleteError
          else {
            for (const key of Object.keys(incompleteError)) {
              // @ts-ignore
              completeError[key] = incompleteError[key]
            }
          }
        }

        if (this.store[pipeline][errorName] === undefined) this.store[pipeline][errorName] = []
        this.store[pipeline][errorName].push(completeError)
      }
    }
  }

  copy(errorManager: TraitErrorManager) {
    // initializing storage
    for (const pipeline of TRAIT_PILELINES) {
      for (const errorName of TRAIT_ERROR_NAMES) {
        const errors = errorManager.store[pipeline][errorName] ?? []
        if (errors.length === 0) continue

        if (this.store[pipeline][errorName] === undefined) this.store[pipeline][errorName] = []
        this.store[pipeline][errorName].push(...errors)
      }
    }
  }

  get(priority: number) {
    const errors: TraitError[] = []

    for (const pipeline of TRAIT_PILELINES) {
      const pipelineErrors = this.store[pipeline]

      for (const key of TRAIT_ERROR_NAMES) {
        if ((pipelineErrors[key]?.length ?? 0) === 0) continue

        if (ERROR_PRIORITY[key] === priority) {
          errors.push(...pipelineErrors[key])
        }
      }
    }

    return errors
  }

  count(pipeline?: TraitPipeline) {
    let count = 0

    const pipelines = pipeline ? [pipeline] : TRAIT_PILELINES

    for (const pipeline of pipelines) {
      const pipelineErrors = this.store[pipeline]

      for (const key of TRAIT_ERROR_NAMES) {
        if ((pipelineErrors[key]?.length ?? 0) === 0) continue

        count += pipelineErrors[key].length
      }
    }

    return count
  }

  printErrors(log: LogBuilder, allErrors: TraitError[], options: Partial<TraitErrorPrintOptions> = {}) {
    const { HIDE, KEYS_TO_HIDE_TYPE_IN_UNSCHEMAED_KEYS, KEYS_NOT_NOT_HIGHLIGHT_TYPE_IN_UNSCHEMAED_KEYS } = getPrintOptions(options)

    const byName = groupBy(allErrors, `name`)

    for (const name of TRAIT_ERROR_NAME_ORDERED) {
      const errors = byName[name] ?? []
      if (errors.length === 0) continue

      const prefix = `[${TRAIT_ERROR_NAME_DISPLAY[name]}] `

      if (HIDE.includes(name)) {
        log.add(chalk.bgGray.italic.dim(prefix)).add(chalk.grey.italic(`  (hidden)`)).warn()
        continue
      }

      log.add(chalk.bgYellow.italic.bold.dim(prefix)).warn()
      log.tab()

      // print errors
      if (name === `missingTagName`) {
        const byTagName = groupBy(errors, `message`)
        const allTagNames = Object.keys(byTagName).sort()

        for (const key of allTagNames) {
          const errors = byTagName[key]

          const byPipeline = groupBy(errors, `pipeline`)
          const pipelines = uniq(Object.keys(byPipeline))

          const pipelineDebug = pipelines.map(pipeline => {
            const CAP = 50
            const NUMBER_OF_TRAITS = byPipeline[pipeline].length
            let traitsDebug = byPipeline[pipeline].map(error => error.trait._id).join(`,`)
            let suffix = ``

            if (traitsDebug.length > CAP) {
              traitsDebug = `${traitsDebug.slice(0, CAP - 2 - NUMBER_OF_TRAITS.toString().length)}`
              suffix = `${chalk.gray.italic(` +${NUMBER_OF_TRAITS}`)}`
            }

            return `[${traitsDebug
              .split(`,`)
              .map(_index => chalk.bold(_index))
              .join(`,`)}${suffix}]::${pipeline}`
          })

          log.add(chalk.white(key))
          log.add(chalk.grey(`@ ${pipelineDebug}`))
          log.warn()
        }
      } else if (name === `unsuccessfulTagValueParsing`) {
        const byTraitAndPipeline = groupBy(errors, error => `${error.trait}::${error.pipeline}`)

        for (const key of Object.keys(byTraitAndPipeline)) {
          const errors = byTraitAndPipeline[key]

          log.add(chalk.gray(`${chalk.white(errors[0].trait._id)}${`::${errors[0].pipeline}`}   ${chalk.bold(errors[0].trait.section)}`))
          log.warn()

          log.tab()

          for (const error of errors) {
            const CAP_AT = 180
            const node = error.tag?.valueNode?.context ?? `unknown node`
            log.add(chalk.italic.grey(`[${chalk.white(error.tag?.name ?? `unknown tag`)}/${node}]`))
            log.add(chalk.white(error.message.length > CAP_AT ? `${error.message.slice(0, CAP_AT - 5)}${chalk.bgGray(`[...]`)}` : error.message))
            log.warn()
          }

          log.tab(-1)
        }
      } else if (name === `unschemaedKeys`) {
        const byTagName = groupBy(errors, `key`)
        const allTagNames = Object.keys(byTagName).sort()
        const PAD_TAG_NAME = max(allTagNames.map(string => string.length))!

        for (const tagName of allTagNames) {
          const errorsByTagName = byTagName[tagName]

          const bySection = groupBy(errorsByTagName, error => error.trait.section)
          const numberOfSections = Object.keys(bySection).length

          const allSections = Object.keys(bySection)
          for (let i = 0; i < allSections.length; i++) {
            if (i === 0) {
              let tagColor = chalk.white
              if (KEYS_NOT_NOT_HIGHLIGHT_TYPE_IN_UNSCHEMAED_KEYS.includes(tagName)) tagColor = chalk.white.bold.bgRedBright

              log.add(tagColor(` ` + tagName.padEnd(PAD_TAG_NAME + 1, ` `)))
            } else log.add(` `.repeat(PAD_TAG_NAME + 2))

            const section = allSections[i]
            const errors = bySection[section]

            const byPipeline = groupBy(errors, `pipeline`)
            const pipelines = uniq(Object.keys(byPipeline))

            const pipelineDebug = pipelines.map(pipeline => {
              const CAP = 50
              const NUMBER_OF_TRAITS = byPipeline[pipeline].length
              let traitsDebug = byPipeline[pipeline].map(error => error.trait._id).join(`,`)
              let suffix = ``

              if (traitsDebug.length > CAP) {
                traitsDebug = `${traitsDebug.slice(0, CAP - 2 - NUMBER_OF_TRAITS.toString().length)}`
                suffix = `${chalk.gray.italic(` +${NUMBER_OF_TRAITS}`)}`
              }

              return `[${traitsDebug
                .split(`,`)
                .map(_index => chalk.bold(_index))
                .join(`,`)}${suffix}]::${pipeline}`
            })

            const uniqTypes = [] as any

            let typeColor = chalk.grey.italic
            if (!KEYS_TO_HIDE_TYPE_IN_UNSCHEMAED_KEYS.includes(tagName)) {
              // eslint-disable-next-line no-control-regex
              const ANSI = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g

              const uniqTypesClean = [] as any

              for (const { type } of errors) {
                const cleanType = type?.replace(ANSI, ``)
                if (uniqTypesClean.includes(cleanType!)) continue

                uniqTypesClean.push(cleanType)
                uniqTypes.push(type)
              }

              typeColor = uniqTypes.length > 3 ? chalk.bgRed : uniqTypes.length > 1 ? chalk.bgYellow : chalk.white
            } else {
              uniqTypes.push(`too complex...`)
            }

            if (KEYS_NOT_NOT_HIGHLIGHT_TYPE_IN_UNSCHEMAED_KEYS.includes(tagName)) typeColor = chalk.grey.italic

            log.add(chalk.gray.italic(section))
            log.add(chalk.grey(`@ ${pipelineDebug}`))
            log.add(chalk.gray(`  [${typeColor(uniqTypes.join(`, `))}]`))
            log.warn()
          }
        }
      } else {
        // GENERIC PRINTING
        for (const error of errors) {
          log.add(chalk.white(error.message))
          log.add(chalk.grey(`@ ${chalk.bold(error.trait)}::${error.pipeline}`))
          log.warn()
        }
      }

      log.tab(-1)
    }
  }
}

export function getHighestErrorPriority(localErrors: Partial<Record<TraitErrorName, unknown[]>>) {
  let highestPriority = -1

  for (const key of TRAIT_ERROR_NAMES) {
    if ((localErrors[key]?.length ?? 0) === 0) continue

    highestPriority = Math.max(highestPriority, ERROR_PRIORITY[key])
  }

  return highestPriority
}

export const TRAIT_ERROR_NAME_DISPLAY = {
  missingTagName: `Missing Tag Name`,
  unsuccessfulTagValueParsing: `Unsuccessful Tag Value Parsing`,
  unschemaedKeys: `Unschemaed Keys`,
}

const TRAIT_ERROR_NAME_ORDERED = [`unschemaedKeys`, `missingTagName`, `unsuccessfulTagValueParsing`] as const

export type TraitErrorPrintOptions = {
  hide?: TraitErrorName[]
  tooComplexTypeInUnschemaedKeys?: string[]
  dontHighlightTypeInUnschamedKeys?: string[]
}

function getPrintOptions(options: Partial<TraitErrorPrintOptions> = {}) {
  const HIDE = options.hide ?? []

  const KEYS_TO_HIDE_TYPE_IN_UNSCHEMAED_KEYS = options.tooComplexTypeInUnschemaedKeys ?? []
  const KEYS_NOT_NOT_HIGHLIGHT_TYPE_IN_UNSCHEMAED_KEYS = options.dontHighlightTypeInUnschamedKeys ?? []

  return {
    HIDE,
    KEYS_TO_HIDE_TYPE_IN_UNSCHEMAED_KEYS,
    KEYS_NOT_NOT_HIGHLIGHT_TYPE_IN_UNSCHEMAED_KEYS,
  }
}
