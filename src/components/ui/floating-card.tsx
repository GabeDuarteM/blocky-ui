"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "~/lib/utils";

const OFFSET = 12;

interface FloatingCardProps {
  children: ReactNode;
  content: ReactNode;
  className?: string;
}

export function FloatingCard({
  children,
  content,
  className,
}: FloatingCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const tooltipWidth = tooltipRef.current?.offsetWidth ?? 256;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 100;

    let x = e.clientX + OFFSET;
    let y = e.clientY + OFFSET;

    if (x + tooltipWidth > viewportWidth) {
      x = e.clientX - tooltipWidth - OFFSET;
    }

    if (y + tooltipHeight > viewportHeight) {
      y = e.clientY - tooltipHeight - OFFSET;
    }

    setPosition({ x, y });
  }, []);

  return (
    <div
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onMouseMove={handleMouseMove}
    >
      {children}
      {isVisible &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            className={cn(
              "border-border bg-popover text-popover-foreground pointer-events-none fixed z-50 w-64 rounded-lg border p-3 shadow-lg",
              className,
            )}
            style={{
              left: position.x,
              top: position.y,
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
