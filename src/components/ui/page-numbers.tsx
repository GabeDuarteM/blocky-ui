"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface PageNumbersProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PageNumbers({
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
        className="h-7 w-16 px-1 text-center text-xs tabular-nums"
      />
    );
  }

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      className="text-muted-foreground h-7 px-2 text-xs tabular-nums"
    >
      {currentPage + 1} / {totalPages}
    </Button>
  );
}
