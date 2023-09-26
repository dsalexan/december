import winston from "winston"
import { format } from "date-fns"

import simple from "./formats/simple"
import complex from "./formats/complex"
import timestamp from "./formats/timestamp"
import LogBuilder, { LogBuilderBuildOptions, Profiler } from "./builder"

// const logger = winston.createLogger({
//   level: `${input.level}`,
//   transports: [new winston.transports.Console()],
//   // format: winston.format.combine(winston.format.colorize({ all: true }), winston.format.simple()),
//   format: winston.format.colorize({ all: true }),
// })

export type ChurchillTimer = { timestamp: Date }

export type NullableLogBuilder = undefined | LogBuilder

export interface Churchill extends winston.Logger {
  isBrowser: boolean
  store: {
    lastTimestamp: Date | undefined
    //
    profilers: Record<string, Profiler>
  }

  child(input: { name?: string; level?: string }): this
  builder(options?: Partial<LogBuilderBuildOptions>): LogBuilder
}

const config = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    data: 3, // replacing http for npm
    verbose: 4,
    debug: 5,
    silly: 6,
  },
  colors: {
    // error: `red`,
    // debug: `blue`,
    // warn: `yellow`,
    // data: `magenta`,
    // info: `green`,
    // verbose: `cyan`,
    // silly: `grey`,
  },
}

winston.addColors(config.colors)

function createLogger(input: { name: string; level: string }, isBrowser = false) {
  // https://stackoverflow.com/a/69044670/20358783 more detailLocaleString
  const creationTimestamp = format(new Date(), `yyyy-MM-dd_HH-mm-ss`)

  const store = {
    lastTimestamp: undefined as Date | undefined,
    profilers: {} as Record<string, Profiler>,
  }

  const logger = winston.createLogger({
    levels: config.levels,
    level: `${input.level}`,
    transports: [
      new winston.transports.Console({
        level: `${input.level}`,
        format: winston.format.combine(
          winston.format.padLevels(config),
          timestamp({ store }),
          winston.format.splat(),
          winston.format.label({ label: input.name }),
          simple({ colorize: true }),
        ),
      }),

      // long-term
      new winston.transports.File({
        filename: `./logs/${input.name}/${creationTimestamp}_error.log`,
        level: `error`,
        format: winston.format.combine(timestamp({ store }), complex()),
      }),
      new winston.transports.File({
        filename: `./logs/${input.name}/${creationTimestamp}_warn.log`,
        level: `warn`,
        format: winston.format.combine(timestamp({ store }), complex()),
      }),
      new winston.transports.File({
        filename: `./logs/${input.name}/${creationTimestamp}_all.log`,
        level: `silly`,
        format: winston.format.combine(timestamp({ store }), complex()),
      }),

      // short-term
      new winston.transports.File({
        filename: `./logs/${input.name}/${`latest`}_error.log`,
        level: `error`,
        format: winston.format.combine(timestamp({ store }), complex()),
      }),
      new winston.transports.File({
        filename: `./logs/${input.name}/${`latest`}_warn.log`,
        level: `warn`,
        format: winston.format.combine(timestamp({ store }), complex()),
      }),
      new winston.transports.File({
        filename: `./logs/${input.name}/${`latest`}_all.log`,
        level: `silly`,
        format: winston.format.combine(timestamp({ store }), complex()),
      }),

      // application
      new winston.transports.File({
        format: winston.format.combine(timestamp({ store }), complex()),
        filename: `./logs/${input.name}.log`,
        level: `silly`,
      }),
    ],
  }) as Churchill

  logger.isBrowser = isBrowser
  logger.store = store
  logger.child = (childInput: { name?: string; level?: string }) => createLogger({ name: `${input.name}/${childInput.name ?? `child`}`, level: childInput.level ?? input.level })
  logger.builder = function (options) {
    return new LogBuilder(logger, options)
  }

  return logger
}

export default createLogger
