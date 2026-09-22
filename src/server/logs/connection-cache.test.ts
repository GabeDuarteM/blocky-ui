import { expect, it, vi } from "vitest";
import { cachedConnection } from "~/server/logs/connection-cache";

const target = {
  host: "mariadb",
  username: "blocky",
  password: "test",
  database: "blocky",
};

it("shares connections when nested option keys appear in a different order", () => {
  const connections = new Map<string, object>();
  const create = vi.fn(() => ({}));
  const first = cachedConnection(
    {
      ...target,
      options: {
        connectionLimit: 5,
        ssl: { ca: ["first", "second"], rejectUnauthorized: true },
      },
    },
    connections,
    create,
  );
  const second = cachedConnection(
    {
      ...target,
      options: {
        connectionLimit: 5,
        ssl: { ca: ["first", "second"], rejectUnauthorized: true },
      },
    },
    connections,
    create,
  );

  expect(second).toBe(first);
  expect(create).toHaveBeenCalledTimes(1);
});

it.each([
  { connectionLimit: 10, ssl: { ca: ["first", "second"] } },
  { connectionLimit: 5, ssl: { ca: ["second", "first"] } },
])("keeps different option values and array orders separate: %j", (options) => {
  const connections = new Map<string, object>();
  const create = vi.fn(() => ({}));
  const first = cachedConnection(
    {
      ...target,
      options: { connectionLimit: 5, ssl: { ca: ["first", "second"] } },
    },
    connections,
    create,
  );
  const second = cachedConnection({ ...target, options }, connections, create);

  expect(second).not.toBe(first);
  expect(create).toHaveBeenCalledTimes(2);
});
