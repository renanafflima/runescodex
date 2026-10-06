import type { SVGProps } from "react";

export type IconName =
  | "alert"
  | "book"
  | "chevron-right"
  | "close"
  | "download"
  | "gift"
  | "home"
  | "menu"
  | "message"
  | "refresh"
  | "search"
  | "swords"
  | "user";

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  label?: string;
  size?: number;
};

function IconPath({ name }: { name: IconName }) {
  switch (name) {
    case "alert":
      return (
        <>
          <path d="M12 3 2.8 19h18.4L12 3Z" />
          <path d="M12 9v4.5M12 17h.01" />
        </>
      );
    case "book":
      return (
        <>
          <path d="M4 4.8A3.8 3.8 0 0 1 7 4c2 0 3.5.8 5 2.2C13.5 4.8 15 4 17 4a3.8 3.8 0 0 1 3 .8v14a4.8 4.8 0 0 0-3-.8c-2 0-3.5.8-5 2.2C10.5 18.8 9 18 7 18a4.8 4.8 0 0 0-3 .8v-14Z" />
          <path d="M12 6.2v14" />
        </>
      );
    case "chevron-right":
      return <path d="m9 5 7 7-7 7" />;
    case "close":
      return <path d="m6 6 12 12M18 6 6 18" />;
    case "download":
      return (
        <>
          <path d="M12 3v12m0 0 5-5m-5 5-5-5" />
          <path d="M5 20h14" />
        </>
      );
    case "gift":
      return (
        <>
          <path d="M4 10h16v10H4V10Zm-1-4h18v4H3V6Z" />
          <path d="M12 6v14M12 6H8.5a2.5 2.5 0 1 1 2.5-2.5L12 6Zm0 0h3.5A2.5 2.5 0 1 0 13 3.5L12 6Z" />
        </>
      );
    case "home":
      return (
        <>
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10M9 20v-6h6v6" />
        </>
      );
    case "menu":
      return <path d="M4 7h16M4 12h16M4 17h16" />;
    case "message":
      return (
        <>
          <path d="M4 5h16v11H8l-4 4V5Z" />
          <path d="M8 9h8M8 12h5" />
        </>
      );
    case "refresh":
      return (
        <>
          <path d="M20 7v5h-5" />
          <path d="M19 12a7 7 0 1 0-2 5" />
        </>
      );
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </>
      );
    case "swords":
      return (
        <>
          <path d="m4 4 7 7M3 3l4 1-3 3-1-4Zm7 10-6 6" />
          <path d="m20 4-7 7m8-8-4 1 3 3 1-4Zm-7 10 6 6" />
        </>
      );
    case "user":
      return (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </>
      );
  }
}

export function Icon({
  name,
  label,
  size = 20,
  className,
  ...props
}: IconProps) {
  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className}
      fill="none"
      height={size}
      role={label ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {label ? <title>{label}</title> : null}
      <IconPath name={name} />
    </svg>
  );
}
