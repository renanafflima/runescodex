import type { ButtonHTMLAttributes } from "react";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function Chip({ active = false, className = "", type = "button", ...props }: ChipProps) {
  return (
    <button
      className={`chip ${active ? "chip--active" : ""} ${className}`.trim()}
      type={type}
      {...props}
    />
  );
}
