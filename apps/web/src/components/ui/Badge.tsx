import type { HTMLAttributes, ReactNode } from "react";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: "gold" | "info" | "success" | "neutral";
};

export function Badge({
  children,
  className = "",
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span className={`badge badge--${tone} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
