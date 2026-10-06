import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Loading } from "./Feedback";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type SharedButtonProps = {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: ButtonVariant;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  SharedButtonProps & {
    loading?: boolean;
  };

function buttonClassName({
  className = "",
  fullWidth = false,
  size = "md",
  variant = "primary",
}: Omit<SharedButtonProps, "children" | "leadingIcon">) {
  return [
    "button",
    `button--${variant}`,
    `button--${size}`,
    fullWidth ? "button--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  className,
  disabled,
  fullWidth,
  leadingIcon,
  loading = false,
  size,
  type = "button",
  variant,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClassName({ className, fullWidth, size, variant })}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <Loading label="Carregando" size="sm" /> : leadingIcon}
      <span>{children}</span>
    </button>
  );
}

type ButtonLinkProps = LinkProps & SharedButtonProps;

export function ButtonLink({
  children,
  className,
  fullWidth,
  leadingIcon,
  size,
  variant,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClassName({ className, fullWidth, size, variant })}
      {...props}
    >
      {leadingIcon}
      <span>{children}</span>
    </Link>
  );
}
