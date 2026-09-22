import type { ComponentProps } from "react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

const STATUS_COLORS = {
  success: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  danger: "border-red-500/30 text-red-700 dark:text-red-400",
  warning: "border-amber-500/30 text-amber-700 dark:text-amber-400",
};

export function StatusBadge({
  tone,
  className,
  ...props
}: Omit<ComponentProps<typeof Badge>, "variant"> & {
  tone: keyof typeof STATUS_COLORS;
}) {
  return (
    <Badge
      {...props}
      variant="outline"
      className={cn(STATUS_COLORS[tone], className)}
    />
  );
}
