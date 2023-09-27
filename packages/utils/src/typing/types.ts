export type VariableType = `string` | `number` | `bigint` | `boolean` | `symbol` | `undefined` | `function` | `object` | `array`

export const PrimitiveVariableTypes = [`string`, `number`, `bigint`, `boolean`, `symbol`, `undefined`] as VariableType[]

export const VariableTypes = [...PrimitiveVariableTypes, `function`, `object`, `array`] as const
