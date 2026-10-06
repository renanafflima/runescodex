import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
  size?: "sm" | "md";
  variant?: "default" | "ghost";
};

export function IconButton({
  children,
  className = "",
  label,
  size = "md",
  type = "button",
  variant = "default",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={[
        "icon-button",
        `icon-button--${size}`,
        `icon-button--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={label}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
