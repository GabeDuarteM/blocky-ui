import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { TRPCQueryKey } from "@trpc/tanstack-react-query";
import { expect, it } from "vitest";
import { keepDataWhenOnlyChanged } from "~/lib/keep-previous-data";

interface TopListInput {
  serverIds: string[];
  range: string;
  offset: number;
}

const firstPage: TopListInput = {
  serverIds: ["home"],
  range: "24h",
  offset: 0,
};

function topListKey(input: TopListInput): TRPCQueryKey {
  return [["logs", "topList"], { input, type: "query" }];
}

function observe(input: TopListInput) {
  return {
    queryKey: topListKey(input),
    queryFn: () => new Promise<string>(() => undefined),
    placeholderData: keepDataWhenOnlyChanged(input, ["offset"]),
  };
}

function switchFromFirstPage(next: TopListInput) {
  const client = new QueryClient();
  client.setQueryData(topListKey(firstPage), "first page");
  const observer = new QueryObserver(client, observe(firstPage));
  const unsubscribe = observer.subscribe(() => undefined);

  observer.setOptions(observe(next));
  const result = observer.getCurrentResult();
  unsubscribe();

  return result;
}

it("keeps the previous data when only the page changes", () => {
  expect(switchFromFirstPage({ ...firstPage, offset: 5 })).toMatchObject({
    data: "first page",
    isPlaceholderData: true,
  });
});

it.each([
  ["range", { ...firstPage, range: "7d" }],
  ["server selection", { ...firstPage, serverIds: ["home", "office"] }],
])("drops the previous data when the %s changes", (_, next) => {
  expect(switchFromFirstPage(next)).toMatchObject({
    data: undefined,
    isPlaceholderData: false,
    isLoading: true,
  });
});
