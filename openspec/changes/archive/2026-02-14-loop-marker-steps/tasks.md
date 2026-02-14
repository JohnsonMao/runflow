## 1. Core: StepContext and executor pushMarkerStep

- [x] 1.1 Add `pushMarkerStep?: (stepId: string, log: string) => void` to StepContext in packages/core/src/types.ts
- [x] 1.2 In executor, build stepContext with pushMarkerStep that pushes `{ stepId, success: true, log }` to the same steps array used by runSubFlow
- [x] 1.3 Pass pushMarkerStep through tempStepContext in runStepById (used by runSubFlow) so body steps and callers share the same reference

## 2. Loop handler: marker steps

- [x] 2.1 In loop handler, before first runSubFlow call `context.pushMarkerStep?.(markerIdStart, 'loop start')` (e.g. markerIdStart = `${step.id}._start`)
- [x] 2.2 After each runSubFlow (round complete), call `context.pushMarkerStep?.(markerIdIter, \`iteration ${i}/${n}\`)`
- [x] 2.3 Before returning loop StepResult, optionally call `context.pushMarkerStep?.(markerIdEnd, 'loop complete')`
- [x] 2.4 Add or adjust tests: RunResult.steps order includes marker steps between body steps when loop uses pushMarkerStep
