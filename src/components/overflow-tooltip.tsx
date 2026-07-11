"use client";

import { useRef, useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface OverflowTooltipProps {
  text: string;
  className?: string;
}

export function OverflowTooltip({ text, className }: OverflowTooltipProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    const element = textRef.current;
    const isOverflowing =
      element !== null && element.scrollWidth > element.clientWidth;

    setIsOpen(nextOpen && isOverflowing);
  };

  return (
    <Tooltip open={isOpen} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>
        <div ref={textRef} className={cn("truncate", className)}>
          {text}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}
