import { lazy, memo, Suspense } from "react";
import { Notifications } from "@/features/notifications/Notifications";
import { QuickOpen } from "@/features/editor/QuickOpen";
import { ThemePicker } from "@/features/editor/ThemePicker";
import { useUiStore } from "@/stores/uiStore";

const CommandPalette = lazy(() =>
  import("@/features/command-palette/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);

/**
 * Camada de overlays controlados por flags em useUiStore.
 *
 * Vive isolado do App pra que abrir/fechar palette/quickOpen/themePicker/
 * notifications não força um re-render do componente raiz (que cascataria pra
 * Sidebar, PaneTree, etc.). Cada overlay subscreve a sua própria flag.
 */
type Props = {
  rootPath: string;
  onOpenFile: (path: string) => void;
  onOpenThemeEditor: () => void;
  onOpenNotifications: () => void;
  notificationsOpen: boolean;
};

export const Overlays = memo(function Overlays({
  rootPath,
  onOpenFile,
  onOpenThemeEditor,
  onOpenNotifications,
  notificationsOpen,
}: Props) {
  return (
    <>
      <PaletteOverlay />
      <ThemePickerOverlay onOpenEditor={onOpenThemeEditor} />
      <QuickOpenOverlay rootPath={rootPath} onOpenFile={onOpenFile} />
      <NotificationsOverlay open={notificationsOpen} onOpen={onOpenNotifications} />
    </>
  );
});

const PaletteOverlay = memo(function PaletteOverlay() {
  const open = useUiStore((s) => s.paletteOpen);
  const initialQuery = useUiStore((s) => s.paletteInitialQuery);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <CommandPalette
        open
        onOpenChange={(o) => useUiStore.getState().setPaletteOpen(o)}
        initialQuery={initialQuery}
      />
    </Suspense>
  );
});

const ThemePickerOverlay = memo(function ThemePickerOverlay({
  onOpenEditor,
}: { onOpenEditor: () => void }) {
  const open = useUiStore((s) => s.themePickerOpen);
  return (
    <ThemePicker
      open={open}
      onClose={() => useUiStore.getState().setThemePickerOpen(false)}
      onOpenEditor={onOpenEditor}
    />
  );
});

const QuickOpenOverlay = memo(function QuickOpenOverlay({
  rootPath,
  onOpenFile,
}: { rootPath: string; onOpenFile: (path: string) => void }) {
  const open = useUiStore((s) => s.quickOpenOpen);
  return (
    <QuickOpen
      open={open}
      rootPath={rootPath}
      onClose={() => useUiStore.getState().setQuickOpenOpen(false)}
      onOpenFile={(path) => {
        useUiStore.getState().setQuickOpenOpen(false);
        onOpenFile(path);
      }}
    />
  );
});

const NotificationsOverlay = memo(function NotificationsOverlay({
  open,
  onOpen,
}: { open: boolean; onOpen: () => void }) {
  return <Notifications centerOpen={open} onOpenCenter={onOpen} />;
});
