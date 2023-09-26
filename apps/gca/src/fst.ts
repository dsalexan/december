import path from "path"
import fs from "fs"

import chalk from "chalk"
import { zip, last, chunk, sum, isNil, isEmpty, groupBy, uniq, range } from "lodash"

import churchill from "./logger"
import IndexedTrait, { TraitSection } from "./trait/indexed"
import IndexedCategory from "./category/indexed"

import { isNilOrEmpty, push } from "@december/utils"
import { NamedIndexMap, makeNamedIndexMap, pushToNamedIndexMap } from "./utils"
import Trait from "./trait"
import { TraitErrorManager } from "./trait/error"
import TraitTag, { TRAIT_TAG_NAMES } from "./trait/tag/tag"
import { FastIndex } from "./fstndx"

export const logger = churchill.child({ name: `fst` })

export class Fast {
  fstndx: FastIndex

  // file
  filename!: string
  directory!: string
  fullpath!: string
  content!: string[]

  // indexes
  traits: {
    byID: Record<string, IndexedTrait>
    byRow: Record<number, string>
    byNames: NamedIndexMap<string>
    bySection: Record<TraitSection, NamedIndexMap<string>>
  } = {} as any

  modifiers: {
    byRow: Record<number, IndexedTrait>
  } = {} as any

  constructor(fstndx: FastIndex) {
    this.fstndx = fstndx
    logger.verbose(`Instantiating Fast object`)
  }

  extract(filename: string, directory = `.`) {
    const directory_ = directory.endsWith(`/`) ? directory.slice(0, -1) : directory

    // opening file
    this.filename = filename
    this.directory = directory_
    this.fullpath = path.resolve(`${directory_}/${filename}`)

    const log = logger.builder()
    log.tab()

    log.add(`Open fast from "${this.fullpath}"`).debug()

    const fst = fs.readFileSync(this.fullpath, `utf-8`)
    this.content = fst.split(/\r?\n/g)

    log.add(`Found ${chalk.bold(this.content.length)} lines`).verbose({ duration: true })

    // parse raw entries into Traits
    const _placeholder = /^[-]+$/
    const traits = [] as Trait[]
    const errors = {} as any

    const traitLogger = churchill.child({ name: `trait`, level: `data` }).builder().tab()

    const errorManager = new TraitErrorManager(null)

    for (let i = 0; i < this.content.length; i++) {
      const line = this.content[i]
      if (line === ``) continue

      // const GOOD_TESTING_CASES = [11893, 3375, 1588, 802, 759, 575, 563, 541, 498, 452, 308, 241, 228, 205, 166, 147, 135, 122, 112, 111, 105, 102, 92, 68, 50, 36, 47, 7, 2, 0]
      // const EXPANDED_TESTING_CASES = uniq(GOOD_TESTING_CASES.map(_index => range(-2, 2 + 1).map(mod => _index + mod)).flat())
      // if (!EXPANDED_TESTING_CASES.includes(i)) continue
      // if (![7, 2, 0].includes(i)) continue
      // if (![147].includes(i)) continue
      // if (![459].includes(i)) continue
      // if (![541].includes(i)) continue

      const typing = this.fstndx.traits.byID[i]

      traitLogger
        .add(
          chalk.grey(
            `${chalk.bgBlue.black(` [${chalk.bold(i)}] | ${chalk.italic(typing.section ?? `<unknown section>`)} `)} | ${chalk.italic(
              line.length > 100 ? line.substring(0, 97) + `...` : line,
            )}`,
          ),
        )
        .verbose({ duration: true })

      const trait = new Trait(line, i, { fst: i + 1, fstndx: typing._row + 1 })
      trait.section = typing.section

      // ERROR: Unimplemented for sectionless trait
      if (isNil(trait.section)) debugger

      traitLogger.tab()

      trait.parse(traitLogger)

      // PRINT A LOT OF SHIT TO DEBUG
      const PRINT_A_LOT_OF_SHIT_TO_DEBUG = false && [241].includes(i)
      if (PRINT_A_LOT_OF_SHIT_TO_DEBUG) {
        const root = trait._parser.root
        // root.printCompact()
        root.print({ calculateLevels: [2, 3], lineSizeWithoutLevenPadding: 200, dontRepeatDigitsInHeader: true })

        const context = `ρ3.ab`
        const node = trait._parser.get(context)
        if (!node) traitLogger.add(chalk.bgRed(` Could not find node "${chalk.bold(context)}" at trait ${chalk.bold(i)} `)).error()
        else node.printRelevant({ sections: [`context`], lineSizeWithoutLevenPadding: 240 })
      }

      trait.compile(traitLogger)
      trait.mount(traitLogger)

      // REFERENCES TO SPEED-UP ERROR RESOLUTION
      TRAIT_TAG_NAMES // TraitTag.TRAIT_TAG_NAMES

      /**
       * HOW TO RESOLVE ERRORS
       *
       * First it is important to understand the order. The printing will show:
       *    unschemaedKeys > missingTagName > unsuccessfulTagValueParsing
       *
       *  [Unschemaed Keys]
       *  Will show all tags that are not tracked by the trait section's schema.
       *  Will also show a breakdown of all types of values that are present in all lines for that tag/section.
       *    This breakdown is useful to understand which tag to implement next (and how to implement it).
       *  Although this error type is only thrown at VALIDATE, it is the most important one for the big picture.
       *  It is IMPORTANT to prioritize resolution of SIMPLER tags (usually primitives), to remove clutter from the console (specially at [Unsuccessful Tag Value Parsing])
       *
       *  Resolution:
       *   - Go to src/trait/sections
       *   - Create a new .ts file for the section
       *   - Implement the necessary tags (name and type) in zod schema format
       *   - Update the general definition of trait (TraitDefinition) in src/trait/sections/index.ts
       *
       *  [Missing Tag Name]
       *  Will show all tags that are not properly registered within the trait pipeline.
       *  To "register" a tag is simply to add its name to TRAIT_TAG_NAMES.
       *
       *  Resolution:
       *    - Go to src/trait/sections/tag.ts (TraitTag)
       *    - Add tag name to "TRAIT_TAG_NAMES"
       *    - This will probably stop the next execution at TraitTag.parseValue(...), at "ERROR: Unimplemented tag name"
       *      - That section of the code properly parses the value of the tag, and its complexity can vary A LOT.
       *      - That's why it is important to check the Unschemaed Keys first, to get a glimpse of how the implementation will go down.
       *
       *  [Unsuccessful Tag Value Parsing]
       *  Will show, trait by trait, all the tags that were not parsed.
       *  Usually that means that the tag name is not yet registered within the code.
       *    If a tag is registered but not parsed, the code execution would stop at the debugger in TraitTag.parseValue(...) "ERROR: Unimplemented tag name"
       *
       *  Resolution:
       *    - Register the tag name (see [Missing Tag Name])
       *    - Upon register the code execution will halt at the appropriate breakpoint
       *    - Implement the tag value parsing (complexity may vary A LOT)
       */

      if (trait.getHighestErrorPriority() >= 1) {
        debugger
      }

      trait.validate(traitLogger)
      errorManager.copy(trait._errors)

      // const entry = new GDF(shiftLine)
      // entry._index = entries.length
      // entry._row = i

      // const _data = entry._data
      // const data = entry.data

      // // console.log(` `)
      // // TypedValue.print(_data)
      // // console.log(data)
      // // console.log(` \n \n \n \n \n \n \n`)
      // // debugger

      // // ERROR: every entry should have a name
      // try {
      //   if (entry.data.name.match(_placeholder)) continue
      // } catch (ex) {
      //   console.log(ex)
      //   console.log(``)
      //   console.log(entry)
      //   console.log(``)
      //   console.log(`book???`)
      //   debugger
      // }

      traits.push(trait)

      traitLogger.tab(-1)
    }

    log
      .add(`  `)
      .add(`Extracted ${chalk.bold(traits.length)} traits`)
      .verbose({ duration: true })

    if (errorManager.getHighestErrorPriority() >= 0) {
      const errors = errorManager.get(0)

      traitLogger.add(` `).warn()
      traitLogger.add(chalk.white.bold(`Low Priority Errors`)).warn()
      errorManager.printErrors(traitLogger.tab(), errors, {
        hide: [`unsuccessfulTagValueParsing`],
        tooComplexTypeInUnschemaedKeys: [
          `x`,
          `default`,
          `gives`,
          `damage`,
          `initmods`,
          `creates`,
          `notes`,
          `damtype`,
          `needs`,
          `adds`,
          `itemnotes`,
          `skillused`,
          `uses_settings`,
          `uses`,
          `usernotes`,
          `units`,
          `taboo`,
          `subsfor`,
          `shots`,
          `shortcat`,
          `select9`,
          `select8`,
          `select7`,
          `select6`,
          `select5`,
          `select4`,
          `select3`,
          `select2`,
          `select1`,
          `select0`,
          `replacetags`,
          `rof`,
          `reach`,
          `rcl`,
          `rangemax`,
          `rangehalfdam`,
          `parry`,
          `mods`,
          `mode`,
          `minst`,
          `levelnames`,
          `lc`,
          `conditional`,
          `acc`,
        ],
        dontHighlightTypeInUnschamedKeys: [`cat`, `description`],
      })
      traitLogger.tab(-1)
    }

    return traits
  }
}
