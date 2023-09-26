import { isNilOrEmpty } from "@december/utils"
import { cloneDeep, isEqual, isNil, last, max, min, range, uniq, unzip } from "lodash"

import churchill from "../../logger"
import { TraitParserNode } from "./node"
import { DEFAULT_SYNTAX_COMPONENTS, SYNTAX_COMPONENTS, SyntaxComponent, SyntaxName } from "./syntax"
import chalk from "chalk"
import TraitTag from "../tag/tag"

export const logger = churchill.child({ name: `parser` })

export class TraitParser {
  text: string

  // node
  root: TraitParserNode
  baseSyntaxes: SyntaxComponent[]

  constructor(text: string, syntaxes?: SyntaxComponent[]) {
    this.text = text

    this.root = new TraitParserNode(this, null, `root` as any, 0, SYNTAX_COMPONENTS.imaginary)

    this.baseSyntaxes = syntaxes ?? DEFAULT_SYNTAX_COMPONENTS
  }

  syntaxes(syntaxes: SyntaxName[] = []) {
    const bothSyntaxes = [...this.baseSyntaxes, ...syntaxes.map(name => SYNTAX_COMPONENTS[name])]

    return Object.fromEntries(bothSyntaxes.map(syntax => [syntax.name, syntax])) as Record<SyntaxName, SyntaxComponent>
  }

  characterSet(syntaxes: SyntaxName[] = []) {
    const allSyntaxes = this.syntaxes(syntaxes)

    return uniq(
      Object.values(allSyntaxes)
        .map(syntax => (syntax as any).set ?? [])
        .flat(),
    ) as string[]
  }

  getSyntaxFromCharacter(syntaxes: SyntaxName[] = []) {
    const allSyntaxes = Object.values(this.syntaxes(syntaxes))

    const SYNTAX_FROM_CHARACTER = Object.fromEntries(
      allSyntaxes
        .map(component => {
          const set = ((component as any).set ?? []) as string[]

          return set.map(character => [character, component])
        })
        .flat(),
    ) as Record<string, SyntaxComponent>

    return SYNTAX_FROM_CHARACTER
  }

  toString() {
    return `<tree#${this.root.id}>`
  }

  get(context: string) {
    return this.root.get(context)
  }

  printText() {
    const log = logger.builder()

    const characters = [...this.text]
    const charactersAndIndexes = characters.map((character, index) => [index, character])

    const separatorSize = this.text.length.toString().length

    const [indexes, allCharacters] = unzip(charactersAndIndexes) as [number[], string[]]
    log.add(chalk.grey(indexes.map(index => index.toString().padEnd(separatorSize)).join(` `))).debug()
    log.add(chalk.grey(allCharacters.map(character => character.padEnd(separatorSize)).join(` `))).debug()
  }

  print() {
    const log = logger.builder()

    // const characters = [...this.text]
    // const charactersAndIndexes = characters.map((character, index) => [index, character])

    // const [indexes, allCharacters] = unzip(charactersAndIndexes)

    // const maxLevel = this.root.byLevel().length

    // this.root.printCompact()

    log.add(`Printing something`)

    // const { lines, spaceSize } = this.root.preparePrint2(0)

    // log.add(` `.repeat(maxLevel.toString().length + 1))
    // log.add(chalk.grey(indexes.join(` `.repeat(spaceSize)))).debug()

    // log.add(` `.repeat(maxLevel.toString().length + 1))
    // log.add(chalk.grey(allCharacters.join(` `.repeat(spaceSize)))).debug()

    // log.add(` `).debug()

    // this.root.print2(lines, spaceSize)
  }

  parse(silent = true) {
    this.root.parse({}, silent)
    this.root.deepen()
    this.root.normalize()

    return true
  }
}
