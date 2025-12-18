import z from "zod";

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: unknown[];
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: JsonSchemaProperty;
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export function convertJsonSchemaToZod(jsonSchema: unknown): z.ZodTypeAny {
  if (!jsonSchema || typeof jsonSchema !== "object") {
    return z.unknown();
  }

  const schema = jsonSchema as JsonSchema;

  if (schema.type === "object" && schema.properties) {
    const shape: Record<string, z.ZodTypeAny> = {};
    const requiredFields = schema.required || [];

    for (const [key, property] of Object.entries(schema.properties)) {
      const isRequired = requiredFields.includes(key);
      let zodSchema: z.ZodTypeAny;

      if (property.type === "string") {
        zodSchema = z.string();
        if (property.enum && Array.isArray(property.enum) && property.enum.length > 0) {
          const enumValues = property.enum.filter((v): v is string => typeof v === "string");
          if (enumValues.length > 0) {
            if (enumValues.length === 1) {
              zodSchema = z.literal(enumValues[0]);
            } else {
              zodSchema = z.enum(enumValues as [string, ...string[]]);
            }
          }
        }
      } else if (property.type === "number") {
        zodSchema = z.number();
      } else if (property.type === "boolean") {
        zodSchema = z.boolean();
      } else if (property.type === "array" && property.items) {
        const itemSchema = convertJsonSchemaToZod(property.items);
        zodSchema = z.array(itemSchema);
      } else if (property.type === "object" && property.properties) {
        zodSchema = convertJsonSchemaToZod(property);
      } else {
        zodSchema = z.unknown();
      }

      if (property.description) {
        zodSchema = zodSchema.describe(property.description);
      }

      shape[key] = isRequired ? zodSchema : zodSchema.optional();
    }

    return z.object(shape);
  }

  return z.unknown();
}
