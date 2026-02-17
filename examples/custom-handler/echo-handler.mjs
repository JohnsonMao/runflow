// Custom step handler example: type "echo"; writes step.message into outputs.
// Run CLI from repo root so @runflow/core (context.stepResult) resolves.
function validate(step) {
  if (step.message !== undefined)
    return true
  return 'echo step requires message (string)'
}

function kill() {}

async function run(step, context) {
  const message = step.message != null ? String(step.message) : ''
  return context.stepResult(step.id, true, {
    outputs: { message, echoed: true },
    log: `echo: ${message}`,
  })
}

export default { validate, kill, run }
