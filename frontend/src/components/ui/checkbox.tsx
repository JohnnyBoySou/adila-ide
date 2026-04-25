import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
}: CheckboxProps) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      whileTap={{ scale: 0.88 }}
      className={cn(
        "peer inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary border-primary" : "bg-transparent border-input hover:border-ring/60",
        className,
      )}
    >
      <motion.svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3 text-primary-foreground"
        initial={false}
        animate={checked ? "checked" : "unchecked"}
      >
        <motion.path
          d="M3 8.5l3 3 7-7"
          variants={{
            checked: { pathLength: 1, opacity: 1 },
            unchecked: { pathLength: 0, opacity: 0 },
          }}
          transition={{
            pathLength: { type: "spring", stiffness: 380, damping: 28 },
            opacity: { duration: 0.12 },
          }}
        />
      </motion.svg>
    </motion.button>
  );
}
