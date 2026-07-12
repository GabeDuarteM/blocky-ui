import { type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { formatCount } from "~/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  valueLabel?: string;
  icon: LucideIcon;
  badge?: {
    value: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
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
  value,
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
        <CardContent>
          <Skeleton className="mb-2 h-8 w-20" />
          {detail !== undefined && <Skeleton className="h-2 w-full" />}
        </CardContent>
      </Card>
    );
  }

  const titleElement = (
    <CardTitle className="text-muted-foreground cursor-default text-sm font-medium">
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
        <Icon className="text-muted-foreground h-5 w-5" />
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold">{formatValue(value)}</span>
          {valueLabel && (
            <span className="text-foreground text-sm font-medium">
              {valueLabel}
            </span>
          )}
          {badge && (
            <Badge variant={badge.variant ?? "secondary"}>{badge.value}</Badge>
          )}
        </div>
        {detail && (
          <p className="text-muted-foreground mt-2 text-xs tabular-nums">
            {detail}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
