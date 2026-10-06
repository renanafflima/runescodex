import type { HTMLAttributes, ReactNode } from "react";

type PageContainerProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  size?: "default" | "wide" | "narrow";
};

export function PageContainer({
  children,
  className = "",
  size = "default",
  ...props
}: PageContainerProps) {
  return (
    <div
      className={`page-container page-container--${size} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
