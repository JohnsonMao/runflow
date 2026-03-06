import command from './command'
import condition from './condition'
import flow from './flow'
import http from './http'
import loop from './loop'
import message from './message'
import set from './set'
import sleep from './sleep'

/** All built-in handler factories as an array. */
export const builtinHandlers = [
  condition,
  command,
  flow,
  http,
  loop,
  message,
  set,
  sleep,
]
