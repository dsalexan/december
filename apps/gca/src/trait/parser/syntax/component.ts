import { omit } from "lodash"
import { EnclosureSyntaxComponent, SeparatorSyntaxComponent, SyntaxComponent, SyntaxName, SyntaxType } from "./types"

export function makeSyntaticComponent<TComponent extends SyntaxComponent>(
  type: SyntaxType,
  name: string,
  prefix: string,
  set: string[],
  options?: Partial<{ enclosures: SyntaxName[]; mathParent: boolean; mathWrappable: boolean; prio: number }>,
) {
  const base = {
    type,
    name,
    prefix,
    set,
    mathWrappable: options?.mathWrappable ?? false,
  } as TComponent

  if (set.length === 1) {
    const separator = base as SeparatorSyntaxComponent

    separator.char = set[0]

    separator.enclosures = options?.enclosures ?? []
    separator.prio = options?.prio ?? 0
  } else if (set.length === 2) {
    const enclosure = base as EnclosureSyntaxComponent

    enclosure.opener = set[0]
    enclosure.closer = set[1]
    enclosure.mathParent = options?.mathParent ?? false
  }

  return base as TComponent
}
