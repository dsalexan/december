import { makeSyntaticComponent } from "./component"
import { AsyntaticComponent, EnclosureSyntaxComponent, MathSyntaxComponent, SeparatorSyntaxComponent, SyntaxComponent, SyntaxName } from "./types"
import { MATH_SYNTAX_COMPONENTS } from "./math"

export type { SyntaxComponent } from "./types"
export type { SyntaxName } from "./types"
export type { SyntaxType } from "./types"
export type { EnclosureSyntaxComponent } from "./types"
export type { SeparatorSyntaxComponent } from "./types"
export type { SyntaxComponentBase } from "./types"

export { makeSyntaticComponent } from "./component"

export const SYNTAX_COMPONENTS = {
  string: makeSyntaticComponent<AsyntaticComponent>(`string`, `string`, `x`, [], { mathWrappable: true }),
  list: makeSyntaticComponent<AsyntaticComponent>(`list`, `list`, `l`, []),
  //
  imaginary: makeSyntaticComponent<EnclosureSyntaxComponent>(`enclosure`, `imaginary`, `ι`, [`⟨`, `⟩`], { mathParent: true }),
  parenthesis: makeSyntaticComponent<EnclosureSyntaxComponent>(`enclosure`, `parenthesis`, `ρ`, [`(`, `)`], { mathParent: true, mathWrappable: true }),
  braces: makeSyntaticComponent<EnclosureSyntaxComponent>(`enclosure`, `braces`, `γ`, [`{`, `}`]),
  brackets: makeSyntaticComponent<EnclosureSyntaxComponent>(`enclosure`, `brackets`, `β`, [`[`, `]`], { mathParent: true }),
  quotes: makeSyntaticComponent<EnclosureSyntaxComponent>(`enclosure`, `quotes`, `κ`, [`"`, `"`]),
  //
  comma: makeSyntaticComponent<SeparatorSyntaxComponent>(`separator`, `comma`, `C`, [`,`], { enclosures: [`imaginary`, `parenthesis`, `braces`, `brackets`], prio: 1 }),
  pipe: makeSyntaticComponent<SeparatorSyntaxComponent>(`separator`, `pipe`, `P`, [`|`], { enclosures: [`imaginary`, `parenthesis`, `braces`, `brackets`], prio: 3 }),
  colon: makeSyntaticComponent<SeparatorSyntaxComponent>(`separator`, `colon`, `N`, [`:`], { enclosures: [`imaginary`, `parenthesis`, `braces`, `brackets`], prio: 2 }),
  //
  ...MATH_SYNTAX_COMPONENTS,
} as Record<SyntaxName, SyntaxComponent>

export const DEFAULT_SYNTAX_COMPONENTS = ([`string`, `list`, `imaginary`, `parenthesis`, `braces`, `brackets`, `quotes`, `comma`, `pipe`] as SyntaxName[]).map(
  name => SYNTAX_COMPONENTS[name],
)
