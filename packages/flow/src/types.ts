import { z } from "zod";

type AnySchema = z.ZodTypeAny;
type ZodRawShapeCompat = Record<string, AnySchema>;

export const NodePositionSchema = z.tuple([z.number(), z.number()]);

const InputSchemaSchema = z.custom<AnySchema | ZodRawShapeCompat | undefined>((val) => {
  if (val === undefined) {
    return true;
  }
  if (val === null) {
    return false;
  }
  if (typeof val === "object") {
    return true;
  }
  return false;
}, "inputSchema must be a Zod schema (AnySchema), a ZodRawShapeCompat object, or undefined");

export const TriggerScheduleRuleSchema = z.object({
  interval: z
    .array(
      z.object({
        triggerAtHour: z.number().min(0).max(23),
        triggerAtMinute: z.number().min(0).max(59),
        daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
      })
    )
    .optional(),
  cron: z.string().optional(),
  timezone: z.string().optional(),
});

export const TriggerScheduleSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal("schedule"),
  parameters: TriggerScheduleRuleSchema,
});

export const TriggerWebhookAuthSchema = z.object({
  type: z.enum(["bearer", "basic", "header", "none"]),
  token: z.string().optional(),
  headerName: z.string().optional(),
});

export const TriggerWebhookSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal("webhook"),
  parameters: z.object({
    path: z.string(),
    method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("POST"),
    auth: TriggerWebhookAuthSchema.optional(),
    responseMode: z.enum(["responseNode", "lastNode", "firstNode"]).optional(),
  }),
});

export const TriggerMcpToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal("mcpTool"),
  parameters: z.object({
    title: z.string(),
    description: z.string(),
    inputSchema: InputSchemaSchema.optional(),
  }),
});

export const TriggerSchema = z.discriminatedUnion("type", [
  TriggerScheduleSchema,
  TriggerWebhookSchema,
  TriggerMcpToolSchema,
]);

export const NodeCredentialsSchema = z.object({
  credentialType: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export const NodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  position: NodePositionSchema,
  parameters: z.record(z.string(), z.unknown()),
  typeVersion: z.string().optional(),
  credentials: NodeCredentialsSchema.optional(),
  executeOnce: z.boolean().optional(),
  retryOnFail: z.boolean().optional(),
  notes: z.string().optional(),
  notesInFlow: z.boolean().optional(),
});

export const ConnectionTargetSchema = z.object({
  node: z.string(),
  type: z.string(),
  index: z.number(),
});

export const ConnectionSchema = z.object({
  main: z.array(z.array(ConnectionTargetSchema)),
});

export const FlowSettingsSchema = z.object({
  timezone: z.string().optional(),
  executionOrder: z.string().optional(),
  timeout: z.number().optional(),
});

export const TagSchema = z.object({
  name: z.string(),
  id: z.string(),
});

export const FlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().optional(),
  tags: z.array(TagSchema).optional(),
  active: z.boolean().optional().default(true),
  triggers: z.array(TriggerSchema).optional(),
  nodes: z.array(NodeSchema),
  connections: z.record(z.string(), ConnectionSchema),
  settings: FlowSettingsSchema.optional(),
});

export type NodePosition = z.infer<typeof NodePositionSchema>;
export type TriggerSchedule = z.infer<typeof TriggerScheduleSchema>;
export type TriggerWebhook = z.infer<typeof TriggerWebhookSchema>;
export type TriggerMcpTool = z.infer<typeof TriggerMcpToolSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type FlowSettings = z.infer<typeof FlowSettingsSchema>;
export type Tag = z.infer<typeof TagSchema>;
export type Flow = z.infer<typeof FlowSchema>;
