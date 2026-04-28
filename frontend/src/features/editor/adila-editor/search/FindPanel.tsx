import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import type { EditorStore } from "../state/editorStore";

type Props = {
  store: EditorStore;
  open: boolean;
  onClose: () => void;
};

export function FindPanel({ store, open, onClose }: Props) {
  const state = useStore(store);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  // Sempre que query/options mudarem, recomputa.
  useEffect(() => {
    if (open) state.computeFindMatches();
  }, [
    state.findQuery,
    state.findCaseSensitive,
    state.findWholeWord,
    state.findRegex,
    open,
  ]);

  if (!open) return null;

  return (
    <div className="ade-find-panel">
      <input
        ref={inputRef}
        type="text"
        value={state.findQuery}
        onChange={(e) => state.setFindQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) state.findPrev();
            else state.findNext();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="Find"
        className="ade-find-input"
      />
      <span className="ade-find-count">
        {state.findMatches.length === 0
          ? "0"
          : `${state.findIndex + 1} / ${state.findMatches.length}`}
      </span>
      <button
        type="button"
        className={`ade-find-btn${state.findCaseSensitive ? " ade-active" : ""}`}
        title="Match Case"
        onClick={() => state.setFindOptions({ findCaseSensitive: !state.findCaseSensitive })}
      >
        Aa
      </button>
      <button
        type="button"
        className={`ade-find-btn${state.findWholeWord ? " ade-active" : ""}`}
        title="Whole Word"
        onClick={() => state.setFindOptions({ findWholeWord: !state.findWholeWord })}
      >
        ab
      </button>
      <button
        type="button"
        className={`ade-find-btn${state.findRegex ? " ade-active" : ""}`}
        title="Regex"
        onClick={() => state.setFindOptions({ findRegex: !state.findRegex })}
      >
        .*
      </button>
      <button type="button" className="ade-find-btn" onClick={() => state.findPrev()} title="Previous">↑</button>
      <button type="button" className="ade-find-btn" onClick={() => state.findNext()} title="Next">↓</button>
      <button type="button" className="ade-find-btn" onClick={onClose} title="Close">✕</button>
    </div>
  );
}
