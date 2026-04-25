import { Select } from "@/components/ui/select";
import type { VersionMeta } from "../types";

type VersionDropdownProps = {
  versions: VersionMeta[];
  selected: string | undefined;
  onChange: (version: string) => void;
};

export function VersionDropdown({
  versions,
  selected,
  onChange,
}: VersionDropdownProps) {
  const options = versions.map((v) => ({
    value: v.version,
    label: v.isCurrent ? `${v.version} · current` : v.version,
  }));

  return (
    <Select
      className="w-40"
      value={selected ?? ""}
      onValueChange={onChange}
      options={options}
    />
  );
}
