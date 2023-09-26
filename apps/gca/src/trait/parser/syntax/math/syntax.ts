import { ArrayNode } from "mathjs"
import { makeSyntaticComponent } from "../component"
import { MathOperatorSyntaxComponent, MathSyntaxComponent, MathSyntaxNames, SyntaxComponent } from "../types"

export type MathJSNodeTypes = `OperatorNode` | `FunctionNode` | `SymbolNode` | `ConstantNode` | `ParenthesisNode` | `ArrayNode`

export const MathJSOperatorNodeMap = {
  xor: `xor`,
  and: `and`,
  or: `or`,
  bitOr: `|`,
  bitXor: `^|`,
  bitAnd: `&`,
  equal: `==`,
  unequal: `!=`,
  smaller: `<`,
  larger: `>`,
  smallerEq: `<=`,
  largerEq: `>=`,
  leftShift: `<<`,
  rightArithShift: `>>`,
  rightLogShift: `>>>`,
  to: `to`,
  add: `+`,
  subtract: `-`,
  multiply: `*`,
  divide: `/`,
  dotMultiply: `.*`,
  dotDivide: `./`,
  mod: `mod`,
  unaryPlus: `+`,
  unaryMinus: `-`,
  bitNot: `~`,
  not: `not`,
  pow: `^`,
  dotPow: `.^`,
  factorial: `!`,
}

export const MathJSInverseOperatorNodeMap = Object.fromEntries(Object.entries(MathJSOperatorNodeMap).map(([k, v]) => [v, k])) as Record<string, string>

export type MathOperators = keyof typeof MathJSOperatorNodeMap

export function makeMathComponent<TComponent extends SyntaxComponent = SyntaxComponent>(name: MathSyntaxNames, prefix: string, options?: Partial<{}>) {
  const component = makeSyntaticComponent<TComponent>(`math`, name, prefix, [])

  // if (name === `math_operator`) {
  //   const operator = component as MathOperatorSyntaxComponent

  //   // ERROR: Unimplemented for empty operator
  //   if (options?.operator === undefined) debugger
  //   else {
  //     operator.operator = options?.operator
  //   }
  // }

  return component
}

export const MATH_SYNTAX_COMPONENTS = {
  math: makeMathComponent<MathSyntaxComponent>(`math`, `π`),
  //
  math_operator: makeMathComponent<MathOperatorSyntaxComponent>(`math_operator`, `∮`),
  math_constant: makeMathComponent<MathOperatorSyntaxComponent>(`math_constant`, `∀`),
  math_symbol: makeMathComponent<MathOperatorSyntaxComponent>(`math_symbol`, `∑`),
  math_parenthesis: makeMathComponent<MathOperatorSyntaxComponent>(`math_parenthesis`, `ρ`),
  math_array: makeMathComponent<MathOperatorSyntaxComponent>(`math_array`, `β`),
} as Partial<Record<MathSyntaxNames, SyntaxComponent>>

export function mathJSNodeTypeToSyntaxName(nodeType: MathJSNodeTypes): MathSyntaxNames {
  switch (nodeType) {
    case `OperatorNode`:
      return `math_operator`
    case `FunctionNode`:
      return `math_function`
    case `SymbolNode`:
      return `math_symbol`
    case `ConstantNode`:
      return `math_constant`
    case `ParenthesisNode`:
      return `math_parenthesis`
    case `ArrayNode`:
      return `math_array`
  }

  // ERROR: Unimplemented mathjs node type
  debugger
}
