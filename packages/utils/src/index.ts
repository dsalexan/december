import { isEmpty, isNil } from "lodash"

export function push<TKey extends string | number | symbol = string | number | symbol, TValue = any>(map: Record<TKey, TValue[]>, key: TKey, value: TValue) {
  if (map[key] === undefined) map[key] = []

  map[key].push(value)
}

export function isNilOrEmpty(value: any): value is null | undefined | `` {
  return isNil(value) || isEmpty(value)
}

export * as typing from "./typing"
