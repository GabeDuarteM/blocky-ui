import { readFile } from "node:fs/promises";
import { env } from "~/env";
import {
  parseConfiguration,
  parseConfigurationYaml,
  type Configuration,
  type DatabaseTarget,
} from "~/server/config/schema";

let configuration: Promise<Configuration> | undefined;

async function readConfigurationFile(path: string, setting: string) {
  try {
    return await readFile(path, "utf8");
  } catch {
    throw new Error(`Cannot read the file configured by ${setting}`);
  }
}

async function resolveFileValue(value: string, setting: string) {
  const prefix = /^file:(?:\/\/)?/.exec(value);
  if (!prefix) {
    return value;
  }

  return (
    await readConfigurationFile(value.slice(prefix[0].length), setting)
  ).replace(/\r?\n$/, "");
}

type ConfigurationValue = NonNullable<DatabaseTarget["options"]>[string];

async function resolveFileValues(
  value: ConfigurationValue,
  path: (string | number)[],
  isRaw: ReturnType<typeof parseConfigurationYaml>["isRaw"],
): Promise<ConfigurationValue> {
  if (typeof value === "string") {
    return isRaw(path) ? value : resolveFileValue(value, path.join("."));
  }
  if (Array.isArray(value)) {
    return Promise.all(
      value.map((entry, index) =>
        resolveFileValues(entry, [...path, index], isRaw),
      ),
    );
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(async ([key, entry]) => [
          key,
          await resolveFileValues(entry, [...path, key], isRaw),
        ]),
      ),
    );
  }
  return value;
}

async function loadConfiguration(): Promise<Configuration> {
  if (env.BLOCKY_UI_CONFIG) {
    const contents = await readConfigurationFile(
      env.BLOCKY_UI_CONFIG,
      "BLOCKY_UI_CONFIG",
    );
    const { config, isRaw } = parseConfigurationYaml(contents);

    const logSources = Object.fromEntries(
      await Promise.all(
        Object.entries(config.logSources).map(async ([id, source]) => [
          id,
          {
            ...source,
            target: await resolveFileValues(
              source.target,
              ["logSources", id, "target"],
              isRaw,
            ),
          },
        ]),
      ),
    );

    return parseConfiguration({ ...config, logSources });
  }

  const logSource = env.DEMO_MODE
    ? { type: "csv", target: "demo" }
    : env.QUERY_LOG_TYPE
      ? {
          type: env.QUERY_LOG_TYPE,
          target: env.QUERY_LOG_TARGET,
          consoleProvider: env.QUERY_LOG_CONSOLE_PROVIDER,
        }
      : undefined;
  return parseConfiguration({
    instanceName: env.INSTANCE_NAME,
    demoMode: env.DEMO_MODE,
    servers: {
      default: {
        name: env.INSTANCE_NAME ?? "Blocky",
        url: env.BLOCKY_API_URL,
        headers: env.BLOCKY_REQUEST_HEADERS,
        logs: logSource ? { source: "default" } : undefined,
      },
    },
    logSources: logSource ? { default: logSource } : {},
  });
}

export function getConfiguration(): Promise<Configuration> {
  configuration ??= loadConfiguration();
  return configuration;
}
