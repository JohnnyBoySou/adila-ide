import { describe, expect, it } from "vitest";
import { createEditorStore } from "./editorStore";

describe("createEditorStore find/replace", () => {
  it("replaces current match and recomputes matches", () => {
    const store = createEditorStore("one two one", "plaintext");
    const s = store.getState();

    s.setFindQuery("one");
    s.setFindReplacement("three");
    s.computeFindMatches();
    expect(store.getState().findMatches).toHaveLength(2);

    store.getState().replaceCurrent();
    expect(store.getState().getValue()).toBe("three two one");
    expect(store.getState().findMatches).toHaveLength(1);
  });

  it("replaces all matches in bottom-up edit order", () => {
    const store = createEditorStore("foo\nfoo\nbar", "plaintext");
    const s = store.getState();

    s.setFindQuery("foo");
    s.setFindReplacement("baz");
    s.computeFindMatches();
    store.getState().replaceAll();

    expect(store.getState().getValue()).toBe("baz\nbaz\nbar");
    expect(store.getState().findMatches).toHaveLength(0);
  });

  it("keeps regex errors in state", () => {
    const store = createEditorStore("text", "plaintext");
    const s = store.getState();

    s.setFindQuery("[");
    s.setFindOptions({ findRegex: true });
    s.computeFindMatches();

    expect(store.getState().findError).toBeTruthy();
    expect(store.getState().findMatches).toHaveLength(0);
  });
});
