import chalk from "chalk"
import createLogger from "."

const logger = createLogger({ name: `december`, level: `silly` })

// const timer = logger.startTimer()

// logger.silly(`This is a silly message.`)
// logger.debug(`This is a debug message.`)
// logger.verbose(`This is a verbose message.`)
// logger.data(`This is a data message.`)
// logger.info(`This is an information message.`)
// logger.warn(`This is a warning message.`)
// logger.error(`This is an error message.`)

// timer.done({ message: `This is a message with a timer.` })

// const timer2 = logger.startTimer()

// const child = logger.child({ name: `january` })

// timer2.done({ message: `Took ∂duration to create a child logger` })

// child.log(`warn`, `This is a warning message from a child logger.`)

// const timer3 = logger.startTimer()

// setTimeout(() => {
//   timer3.done({ message: `Timer donning after timeout` })
// }, 250)

// const timer4 = logger.startTimer()

// setTimeout(() => {
//   timer4.done({ message: `Timer donning after timeout` })
// }, 1000)

// const timer5 = logger.startTimer()

// setTimeout(() => {
//   timer5.done({ message: `Timer donning after timeout` })
// }, 2000)

// logger.builder().add(`This is a message from a builder.`).data()
// logger.builder().add(chalk.red(`This is a red message from a builder.`)).data()
// logger.builder().add(`This is a green message from a builder, by style.`, [chalk.green]).data()

// const timerBuilder = logger.builder().startTimer()
// timerBuilder.done(`warn`, `This is a message from a builder with a timer. It took ${chalk.red(`∂duration`)}`)

// const timerBuilder2 = logger.builder().startTimer()
// timerBuilder2.done(`warn`, `This is another message from a builder with a timer.`)

// const builder = logger.builder().startTimer(`test`).add(`This is a message from a builder with a timer inline.`)
// setTimeout(() => builder.add(`It took ${chalk.bold(builder.profiler(`test`).done())}ms to create this message.`).verbose(), 500)

const builder2 = logger.builder().startTimer(`test2`)
builder2.add(`This is a message from a builder starting with a timer`).verbose()
setTimeout(() => {
  builder2.add(`Something hapenned here in between`).verbose()
  setTimeout(() => builder2.add(`Builder2's timer finished.`).info({ profiler: `test2` }), 500)
}, 100)
