"use client";

import { Button } from "~/components/ui/button";
import { TIME_RANGES, type TimeRange } from "~/lib/constants";

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
          size="responsive"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
        >
          {range}
        </Button>
      ))}
    </div>
  );
}
