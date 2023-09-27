import { intersection } from "lodash"
import { TraitParserNode } from "."
import { SyntaxName } from "../syntax"

export function removeWrapper(string: string) {
  return string.substring(1, string.length - 1)
}

export function hasOnlyborn(node: TraitParserNode) {
  return node.children.length === 1
}

export function hasOnlybornAnd(node: TraitParserNode, names: SyntaxName[]) {
  return hasOnlyborn(node) && names.includes(node.children[0].syntax.name)
}

export function isOnlyborn(nodes: TraitParserNode[]) {
  return nodes.length === 1
}

export function isOnlybornAnd(nodes: TraitParserNode[], names: SyntaxName[]) {
  return isOnlyborn(nodes) && names.includes(nodes[0].syntax.name)
}

export function areSyntaxes(nodes: TraitParserNode[], names: SyntaxName[]) {
  return (
    intersection(
      nodes.map(node => node.syntax.name),
      names,
    ).length === nodes.length
  )
}

export function someAreSyntaxes(nodes: TraitParserNode[], names: SyntaxName[]) {
  return (
    intersection(
      nodes.map(node => node.syntax.name),
      names,
    ).length > 0
  )
}

export function isSyntax(node: TraitParserNode, names: SyntaxName[]) {
  return names.includes(node.syntax.name)
}

export function trimAndUnwrap(node: TraitParserNode, names: SyntaxName[]) {
  const trimmed = node.substring.trim()

  // if node is not of an expected syntax, just trim substring
  if (!names.includes(node.syntax.name)) return trimmed

  // ERROR: Untested
  if (node.children.length !== 1) debugger

  // if node is of an expected syntax, recursivelly unwrap it
  const fewerNames = names.filter(name => name !== node.syntax.name)
  return trimAndUnwrap(node.children[0], fewerNames)
}
