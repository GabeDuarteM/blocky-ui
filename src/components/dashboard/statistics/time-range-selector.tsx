"use client";

import { useCallback } from "react";
import { Button } from "~/components/ui/button";
import type { TimeRange } from "~/lib/constants";
import { TIME_RANGES } from "~/lib/constants";

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1">
      {TIME_RANGES.map((range) => (
        <TimeRangeButton
          key={range}
          range={range}
          value={value}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function TimeRangeButton({
  range,
  value,
  onChange,
}: TimeRangeSelectorProps & { range: TimeRange }) {
  const selectRange = useCallback(() => onChange(range), [onChange, range]);
  return (
    <Button
      variant={value === range ? "default" : "outline"}
      size="responsive"
      aria-pressed={value === range}
      onClick={selectRange}
    >
      {range}
    </Button>
  );
}
