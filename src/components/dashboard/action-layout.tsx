import { type ReactNode } from "react";

export function ActionLayout({
  controls,
  children,
}: {
  controls?: ReactNode;
  children: ReactNode;
}) {
  if (!controls) {
    return children;
  }
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <div className="min-w-0">{controls}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
