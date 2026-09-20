"use client";

import { cn } from "~/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Button, buttonVariants } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface PageNumbersProps {
  grouped?: boolean;
  currentPage: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
}

export function PageNumbers({
  grouped = false,
  currentPage,
  totalPages,
  onPageChange,
}: PageNumbersProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const pageClassName = cn(
    "tabular-nums",
    grouped ? "min-w-24" : "text-muted-foreground h-7 px-2 text-xs",
  );

  if (totalPages === undefined) {
    return (
      <span
        aria-label={`Page ${currentPage + 1}, total pages unavailable`}
        className={cn(
          buttonVariants({
            variant: grouped ? "outline" : "ghost",
            size: grouped ? "responsive" : "default",
            groupPosition: grouped ? "middle" : undefined,
          }),
          pageClassName,
          "pointer-events-none",
        )}
      >
        {(currentPage + 1).toLocaleString()} / …
      </span>
    );
  }

  const handleClick = () => {
    setInputValue(String(currentPage + 1));
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    submitValue();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setIsEditing(false);
      submitValue();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  const submitValue = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(1, Math.min(parsed, totalPages));
      onPageChange(clamped - 1);
    } else {
      setInputValue(String(currentPage + 1));
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min={1}
        max={totalPages}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label={`Go to page (1-${totalPages})`}
        controlSize={grouped ? "responsive" : "default"}
        className={cn(
          "px-1 text-center tabular-nums",
          grouped
            ? "relative -ml-px w-24 rounded-none focus-visible:z-10"
            : "h-7 w-16 text-xs",
        )}
      />
    );
  }

  return (
    <Button
      variant={grouped ? "outline" : "ghost"}
      size={grouped ? "responsive" : "default"}
      groupPosition={grouped ? "middle" : undefined}
      onClick={handleClick}
      className={pageClassName}
    >
      {(currentPage + 1).toLocaleString()} / {totalPages.toLocaleString()}
    </Button>
  );
}
