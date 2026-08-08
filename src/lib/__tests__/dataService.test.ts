import { describe, it, expect, vi } from "vitest";

// The worker-backed db module touches SharedWorker at import time; stub it so
// the facade can be imported in a plain test environment.
vi.mock("../db", () => ({
  executeQuery: vi.fn(async () => ({ rows: [] })),
}));

import * as dataService from "../dataService";

// The facade must keep exposing everything the app imports from
// "@/lib/dataService"; a missing re-export would only surface at runtime in
// the page that uses it.
describe("dataService facade", () => {
  const expectedFunctions = [
    "autocompleteCharacter",
    "autocompletePerson",
    "autocompleteIndexer",
    "autocompleteStorycode",
    "autocompletePublisher",
    "autocompletePublicationTitle",
    "getLocalizedCharacterNames",
    "unifiedAutocomplete",
    "getStoryDetail",
    "resolveIssue",
    "getIssueDetail",
    "getSubseriesList",
    "getSubseriesDetail",
    "getUniverseList",
    "getUniverseDetail",
  ] as const;

  it.each(expectedFunctions)("re-exports %s as a function", (name) => {
    expect(typeof (dataService as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports nothing unexpected", () => {
    expect(Object.keys(dataService).sort()).toEqual([...expectedFunctions].sort());
  });
});
