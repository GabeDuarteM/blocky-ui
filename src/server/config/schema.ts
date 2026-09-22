import { parseDocument } from "yaml";
import { z } from "zod";

const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
const headersSchema = z.record(z.string(), z.string());
const databaseTargetSchema = z.strictObject({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65_535).optional(),
  username: z.string().min(1),
  password: z.string(),
  database: z.string().min(1),
  options: z.record(z.string(), z.json()).optional(),
});

const sourceSchema = z
  .discriminatedUnion("type", [
    z.strictObject({
      type: z.enum(["mysql", "postgresql", "timescale"]),
      target: z.union([z.string().min(1), databaseTargetSchema]),
      consoleProvider: z.literal("victorialogs").optional(),
    }),
    z.strictObject({
      type: z.enum(["sqlite", "csv", "csv-client", "console"]),
      target: z.string().min(1),
      consoleProvider: z.literal("victorialogs").optional(),
    }),
  ])
  .superRefine((source, ctx) => {
    if (
      (source.type === "postgresql" || source.type === "timescale") &&
      typeof source.target !== "string" &&
      !source.target.host.startsWith("file:") &&
      source.target.host.includes(":")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["target", "host"],
        message:
          "Due to upstream driver limitations, IPv6 addresses are not supported here. Use a hostname or IPv4 address.",
      });
    }

    if (source.type === "console" && !source.consoleProvider) {
      ctx.addIssue({
        code: "custom",
        path: ["consoleProvider"],
        message: "Required for console logs",
      });
    }

    if (source.type !== "console" && source.consoleProvider) {
      ctx.addIssue({
        code: "custom",
        path: ["consoleProvider"],
        message: "Only supported for console logs",
      });
    }
  });

const configurationSchema = z
  .strictObject({
    instanceName: z.string().min(1).optional(),
    demoMode: z.boolean().default(false),
    servers: z
      .record(
        idSchema,
        z.strictObject({
          name: z.string().min(1).optional(),
          url: z.url({ protocol: /^https?$/ }),
          headers: headersSchema.default({}),
          logs: z
            .strictObject({
              source: idSchema,
              hostname: z.string().min(1).optional(),
            })
            .optional(),
        }),
      )
      .refine(
        (servers) => Object.keys(servers).length > 0,
        "Configure at least one server",
      ),
    logSources: z.record(idSchema, sourceSchema).default({}),
  })
  .superRefine((config, ctx) => {
    const identities = new Set<string>();

    for (const [id, server] of Object.entries(config.servers)) {
      if (server.logs?.hostname) {
        const identity = JSON.stringify([
          server.logs.source,
          server.logs.hostname,
        ]);

        if (identities.has(identity)) {
          ctx.addIssue({
            code: "custom",
            path: ["servers", id, "logs", "hostname"],
            message: "A hostname can identify only one server in each source",
          });
        }

        identities.add(identity);
      }

      if (
        server.logs &&
        !Object.hasOwn(config.logSources, server.logs.source)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["servers", id, "logs", "source"],
          message: "Unknown log source",
        });
      }
    }
  });

export type Configuration = z.infer<typeof configurationSchema>;
export type DatabaseTarget = z.infer<typeof databaseTargetSchema>;

export function parseConfiguration(value: unknown) {
  const result = configurationSchema.safeParse(value);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => {
      const path = issue.path.join(".") || "root";
      return issue.code === "custom" ? `${path}: ${issue.message}` : path;
    });

    throw new Error(`Invalid Blocky UI configuration at: ${fields.join(", ")}`);
  }

  return result.data;
}

class RawString {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
}

export function parseConfigurationYaml(contents: string) {
  const rawFields = new WeakMap<object, Set<string>>();
  let value: unknown;

  try {
    const document = parseDocument(contents, {
      prettyErrors: false,
      logLevel: "silent",
      customTags: [
        { tag: "!raw", resolve: (raw: string) => new RawString(raw) },
      ],
    });
    if (document.errors.length || document.warnings.length) {
      throw new Error("Invalid YAML");
    }
    value = document.toJS({
      maxAliasCount: 100,
      reviver(this: object, key, entry) {
        if (entry instanceof RawString) {
          let fields = rawFields.get(this);
          if (!fields) {
            fields = new Set<string>();
            rawFields.set(this, fields);
          }
          fields.add(String(key));
          return entry.value;
        }
        return entry;
      },
    });
  } catch {
    // biome-ignore lint/style/useErrorCause: Source errors may expose configuration secrets.
    throw new Error("Invalid YAML in Blocky UI configuration");
  }

  return {
    config: parseConfiguration(value),
    isRaw(path: readonly (string | number)[]) {
      let node: unknown = value;
      for (const [index, key] of path.entries()) {
        if (node === null || typeof node !== "object") {
          return false;
        }
        if (index === path.length - 1) {
          return rawFields.get(node)?.has(String(key)) ?? false;
        }
        node = Reflect.get(node, key);
      }
      return false;
    },
  };
}
