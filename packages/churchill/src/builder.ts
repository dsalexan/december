import * as chalk from "chalk"
import { Churchill } from "."
import { cloneDeep, isNil, isString } from "lodash"

export class Profiler {
  logger: Churchill
  start: number // Date.now()
  name?: string

  constructor(logger: Churchill, name?: string) {
    this.logger = logger
    this.start = Date.now()
    this.name = name
  }

  done(level?: LogLevel, message?: string) {
    const duration = Date.now() - this.start
    if (this.name !== undefined) delete this.logger.store.profilers[this.name]

    if (level === undefined) return duration

    this.logger.log(level, message ?? `Took ∂duration`, { durationMs: duration })
  }
}

export type LogCallback = (error?: any, level?: string, message?: string, meta?: any) => void

export interface LogEntry {
  level: string
  message: string
  [optionName: string]: any
}

export interface LogMethod {
  (level: string, message: string, callback: LogCallback): LogBuilder
  (level: string, message: string, meta: any, callback: LogCallback): LogBuilder
  (level: string, message: string, ...meta: any[]): LogBuilder
  (entry: LogEntry): LogBuilder
  (level: string, message: any): LogBuilder
}

export interface LeveledLogMethod {
  (message: string, callback: LogCallback): LogBuilder
  (message: string, meta: any, callback: LogCallback): LogBuilder
  (message: string, ...meta: any[]): LogBuilder
  (message: any): LogBuilder
  (infoObject: object): LogBuilder
}

export type LogBuilderBuildOptions = { colorize?: boolean; separator?: string }

export type LogLevel = `error` | `warn` | `info` | `data` | `verbose` | `debug` | `silly`

export type LogBuilderOptions = {
  separator: string
}

export default class LogBuilder {
  logger: Churchill
  tabColumn: number = 0
  padding: {
    start: number
    end: number
  } = {
    start: 0,
    end: 0,
  }
  separator: string = ` `

  style: (string | chalk.Chalk)[] = []
  components: LogComponent[] = []

  constructor(logger: Churchill, options?: Partial<LogBuilderBuildOptions>) {
    this.logger = logger
    this._defaultOptions(options)
  }

  _defaultOptions(options: Partial<LogBuilderBuildOptions> = {}) {
    this.separator = options.separator ?? ` `
  }

  builder(): LogBuilder {
    const childBuilder = new LogBuilder(this.logger)

    childBuilder.tabColumn = this.tabColumn
    childBuilder.padding = cloneDeep(this.padding)
    childBuilder.style = cloneDeep(this.style)
    childBuilder.components = cloneDeep(this.components)
    childBuilder.separator = this.separator

    return childBuilder
  }

  tab(size?: number): this {
    if (size === undefined) size = this.tabColumn + 1

    if (size < 0) this.tabColumn += size
    else this.tabColumn = size

    if (this.tabColumn < 0) this.tabColumn = 0

    return this
  }

  addTab(size?: number): this {
    this.add(`  `.repeat(size ?? 1))

    return this
  }

  add(component: LogComponent): this
  add(data: any, style?: (string | chalk.Chalk)[]): this
  add(componentOrData: LogComponent | any, style: (string | chalk.Chalk)[] = []): this {
    let component: LogComponent
    let data: any

    if (componentOrData instanceof LogComponent) {
      component = componentOrData
    } else {
      data = componentOrData
      component = new LogComponent(data, style)
    }

    this.components.push(component)

    return this
  }

  buildForTerminal({ colorize = false, separator = ` ` }: LogBuilderBuildOptions = {}) {
    const text = this.components.map(component => component.buildForTerminal({ colorize, baseStyle: this.style })).join(separator)

    return text
  }

  startTimer(): Profiler
  startTimer(name: string): this
  startTimer(name?: string): Profiler | this {
    const profiler = new Profiler(this.logger, name)

    if (name === undefined) return profiler

    this.logger.store.profilers[name] = profiler

    return this
  }

  profiler(name: string) {
    return this.logger.store.profilers[name]
  }

  // #region Winston Shadow

  // log: LogMethod
  log(level: LogLevel, ...meta: any[]): this {
    if (this.logger.isBrowser) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const consoleLevel = {
        error: `error`,
        warn: `warn`,
        info: `info`,
        data: `trace`, // replacing http for npm
        verbose: `trace`,
        debug: `trace`,
        silly: `trace`,
      }[level] as `error` | `warn` | `info` | `trace`

      throw new Error(`LogComponent#build is not implemented for browser`)

      // console[consoleLevel](...this.buildForBrowser())
    } else {
      if (!isNil(meta[0]?.profiler) && isString(meta[0]?.profiler)) {
        const profiler = this.profiler(meta[0]?.profiler)
        const duration = profiler.done()
        meta[0] = { ...(meta[0] ?? {}), durationMs: duration }
      }

      this.logger.log(level, `${`  `.repeat(this.tabColumn)}${this.buildForTerminal({ separator: this.separator })}`, ...meta)
    }

    this.components = []

    return this
  }

  // for cli and npm levels
  error(...meta: any[]) {
    return this.log(`error`, ...meta)
  }
  warn(...meta: any[]) {
    return this.log(`warn`, ...meta)
  }
  info(...meta: any[]) {
    return this.log(`info`, ...meta)
  }
  data(...meta: any[]) {
    return this.log(`data`, ...meta)
  }
  verbose(...meta: any[]) {
    return this.log(`verbose`, ...meta)
  }
  debug(...meta: any[]) {
    return this.log(`debug`, ...meta)
  }
  silly(...meta: any[]) {
    return this.log(`silly`, ...meta)
  }

  errorWithDuration(...meta: any[]) {
    return this.log(`error`, meta.length === 0 ? { duration: true } : [{ ...meta[0], duration: true }, ...meta.splice(1)])
  }
  warnWithDuration(...meta: any[]) {
    return this.log(`warn`, meta.length === 0 ? { duration: true } : [{ ...meta[0], duration: true }, ...meta.splice(1)])
  }
  infoWithDuration(...meta: any[]) {
    return this.log(`info`, meta.length === 0 ? { duration: true } : [{ ...meta[0], duration: true }, ...meta.splice(1)])
  }
  dataWithDuration(...meta: any[]) {
    return this.log(`data`, meta.length === 0 ? { duration: true } : [{ ...meta[0], duration: true }, ...meta.splice(1)])
  }
  verboseWithDuration(...meta: any[]) {
    return this.log(`verbose`, meta.length === 0 ? { duration: true } : [{ ...meta[0], duration: true }, ...meta.splice(1)])
  }
  debugWithDuration(...meta: any[]) {
    return this.log(`debug`, meta.length === 0 ? { duration: true } : [{ ...meta[0], duration: true }, ...meta.splice(1)])
  }
  sillyWithDuration(...meta: any[]) {
    return this.log(`silly`, meta.length === 0 ? { duration: true } : [{ ...meta[0], duration: true }, ...meta.splice(1)])
  }

  // #endregion
}

export type LogComponentBuildOptions = { baseStyle?: (string | chalk.Chalk)[]; colorize?: boolean; isBrowser?: boolean }
export class LogComponent {
  data: any
  style: (string | chalk.Chalk)[] = []

  constructor(data: any, style: (string | chalk.Chalk)[] = []) {
    this.data = data
    this.style = style
  }

  build(options: LogComponentBuildOptions = {}): string {
    if (options.isBrowser) {
      throw new Error(`LogComponent#build is not implemented for browser`)
    }

    return this.buildForTerminal(options)
  }

  buildForTerminal({ baseStyle = [] }: LogComponentBuildOptions = {}) {
    let text = this.data.toString()

    // if (colorize) {
    for (const style of [...baseStyle, ...this.style]) {
      text = (style as any)(text)
    }
    // }

    return text
  }
}
