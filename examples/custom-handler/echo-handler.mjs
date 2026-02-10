/**
 * Example: custom step handler implementing IStepHandler.
 * Step type "echo" echoes the given "message" (or step id) to stdout.
 */
export default {
  validate(step) {
    return true
  },
  kill() {},
  async run(step, _context) {
    const message = step.message != null ? String(step.message) : step.id
    return {
      stepId: step.id,
      success: true,
      stdout: `${message}\n`,
      stderr: '',
    }
  },
}
