import { Header } from "./components/Header";
import { ReleaseNotes } from "./components/ReleaseNotes";
import { useProduct } from "./hooks/useProduct";
import { useUpdateState } from "./hooks/useUpdateState";

export function AboutView() {
  const product = useProduct();
  const updateState = useUpdateState();
  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: "var(--vscode-editor-background)",
        color: "var(--vscode-foreground)",
      }}
    >
      <Header product={product} updateState={updateState} />
      <ReleaseNotes updateState={updateState} />
    </div>
  );
}

