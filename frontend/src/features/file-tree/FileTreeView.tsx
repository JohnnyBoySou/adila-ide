import { FileTree } from "./components/FileTree";

export function FileTreeView() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1">
        <FileTree />
      </div>
    </div>
  );
}
