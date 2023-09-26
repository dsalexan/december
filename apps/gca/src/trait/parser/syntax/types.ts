import { MathOperators } from "./math/syntax"

type AsyntaticSyntaxTypes = `string` | `list`
type AsyntaticSyntaxNames = `string` | `list`

export type MathSyntaxNames = `math` | `math_operator` | `math_function` | `math_symbol` | `math_constant` | `math_parenthesis` | `math_array`

export type SyntaxType = AsyntaticSyntaxTypes | `enclosure` | `separator` | `math`
export type SyntaxName = AsyntaticSyntaxNames | `imaginary` | `parenthesis` | `braces` | `brackets` | `quotes` | `comma` | `pipe` | `colon` | MathSyntaxNames

type aaaaaa = Exclude<SyntaxType, AsyntaticSyntaxTypes>
//    ^?

export type ComponentBase<TType extends SyntaxType = SyntaxType, TName extends SyntaxName = SyntaxName> = {
  type: TType
  name: TName
  prefix: string
  mathWrappable: boolean
}

export type AsyntaticComponent = ComponentBase<AsyntaticSyntaxTypes, AsyntaticSyntaxNames>

export type SyntaxComponentBase<
  TType extends Exclude<SyntaxType, AsyntaticSyntaxTypes> = Exclude<SyntaxType, AsyntaticSyntaxTypes>,
  TName extends Exclude<SyntaxName, AsyntaticSyntaxNames> = Exclude<SyntaxName, AsyntaticSyntaxNames>,
> = ComponentBase<TType, TName> & {
  set: string[]
}

export type EnclosureSyntaxComponent = SyntaxComponentBase<`enclosure`, `imaginary` | `parenthesis` | `braces` | `brackets` | `quotes`> & {
  opener: string
  closer: string
  separators: string[]
  mathParent: boolean
}

export type SeparatorSyntaxComponent = SyntaxComponentBase<`separator`, `comma` | `pipe` | `colon`> & {
  char: string
  enclosures: SyntaxName[]
  prio: number
}

export type MathSyntaxComponent = SyntaxComponentBase<`math`, MathSyntaxNames>

export type MathOperatorSyntaxComponent = SyntaxComponentBase<`math`, `math_operator`>

export type SyntaxComponent = AsyntaticComponent | EnclosureSyntaxComponent | SeparatorSyntaxComponent | MathSyntaxComponent | MathOperatorSyntaxComponent
