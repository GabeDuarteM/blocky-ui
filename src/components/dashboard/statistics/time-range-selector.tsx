"use client";

import { Button } from "~/components/ui/button";
import { TIME_RANGES, type TimeRange } from "~/lib/constants";
import { cn } from "~/lib/utils";

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1">
      {TIME_RANGES.map((range) => (
        <Button
          key={range}
          variant={value === range ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(range)}
          className={cn(
            "h-7 px-2.5 text-xs",
            value === range && "border border-transparent",
          )}
        >
          {range}
        </Button>
      ))}
    </div>
  );
}
