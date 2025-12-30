import { type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
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
  icon: LucideIcon;
  badge?: {
    value: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  progress?: number;
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
  icon: Icon,
  badge,
  progress,
  isLoading,
  tooltip,
}: StatCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-5 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mb-2 h-8 w-20" />
          {progress !== undefined && <Skeleton className="h-2 w-full" />}
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
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
          {badge && (
            <Badge variant={badge.variant ?? "secondary"}>{badge.value}</Badge>
          )}
        </div>
        {progress !== undefined && (
          <Progress value={progress} className="h-2" />
        )}
      </CardContent>
    </Card>
  );
}
