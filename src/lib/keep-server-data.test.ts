import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { TRPCQueryKey } from "@trpc/tanstack-react-query";
import { expect, it } from "vitest";
import { keepDataForServers } from "~/lib/keep-server-data";

function rowsKey(serverIds: string[], offset: number): TRPCQueryKey {
  return [["logs", "rows"], { input: { serverIds, offset }, type: "query" }];
}

function observeRows(serverIds: string[], offset: number) {
  return {
    queryKey: rowsKey(serverIds, offset),
    queryFn: () => new Promise<string>(() => undefined),
    placeholderData: keepDataForServers(serverIds),
  };
}

function switchFromHomePage(serverIds: string[], offset: number) {
  const client = new QueryClient();
  client.setQueryData(rowsKey(["home"], 0), "home page 1");
  const observer = new QueryObserver(client, observeRows(["home"], 0));
  const unsubscribe = observer.subscribe(() => undefined);

  observer.setOptions(observeRows(serverIds, offset));
  const result = observer.getCurrentResult();
  unsubscribe();

  return result;
}

it("keeps the previous page while the next one loads for the same servers", () => {
  expect(switchFromHomePage(["home"], 10)).toMatchObject({
    data: "home page 1",
    isPlaceholderData: true,
  });
});

it("drops the previous data when the server selection changes", () => {
  expect(switchFromHomePage(["home", "office"], 0)).toMatchObject({
    data: undefined,
    isPlaceholderData: false,
    isLoading: true,
  });
});
