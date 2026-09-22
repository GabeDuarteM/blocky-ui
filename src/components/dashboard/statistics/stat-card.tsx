import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, type BadgeVariants } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { formatCount } from "~/lib/utils";

interface StatCardProps {
  title: string;
  value?: string | number;
  children?: ReactNode;
  valueLabel?: string;
  icon: LucideIcon;
  badge?: {
    value: string;
    variant?: BadgeVariants;
  };
  detail?: string;
  isLoading?: boolean;
  tooltip?: string;
}

function formatValue(value: string | number): string {
  if (typeof value === "number") {
    return formatCount(value);
  }
  return value;
}

export function StatCard({
  title,
  value = 0,
  children,
  valueLabel,
  icon: Icon,
  badge,
  detail,
  isLoading,
  tooltip,
}: StatCardProps) {
  if (isLoading) {
    return (
      <Card className="gap-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-5 rounded" />
        </CardHeader>
        <CardContent className="min-h-15">
          <Skeleton className="mb-2 h-9 w-20" />
          {children || detail !== undefined ? (
            <Skeleton className="h-4 w-full" />
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const titleElement = (
    <CardTitle className="cursor-default font-medium text-muted-foreground text-sm">
      {title}
    </CardTitle>
  );

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-center justify-between">
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>{titleElement}</TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          titleElement
        )}
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="min-h-15">
        {children ?? (
          <>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="font-bold text-3xl">{formatValue(value)}</span>
              {valueLabel ? (
                <span className="font-medium text-foreground text-sm">
                  {valueLabel}
                </span>
              ) : null}
              {badge ? (
                <Badge variant={badge.variant ?? "secondary"}>
                  {badge.value}
                </Badge>
              ) : null}
            </div>
            {detail ? (
              <p className="mt-2 text-muted-foreground text-xs tabular-nums">
                {detail}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
