import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VersionMeta } from "../types";

type VersionDropdownProps = {
  versions: VersionMeta[];
  selected: string | undefined;
  onChange: (version: string) => void;
};

export function VersionDropdown({ versions, selected, onChange }: VersionDropdownProps) {
  return (
    <Select value={selected ?? ""} onValueChange={onChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Selecionar versão" />
      </SelectTrigger>
      <SelectContent>
        {versions.map((v) => (
          <SelectItem key={v.version} value={v.version}>
            {v.isCurrent ? `${v.version} · current` : v.version}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
