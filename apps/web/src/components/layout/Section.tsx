import { useId, type HTMLAttributes, type ReactNode } from "react";

type SectionProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  title?: string;
};

export function Section({
  actions,
  children,
  className = "",
  description,
  eyebrow,
  title,
  ...props
}: SectionProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={`section ${className}`.trim()}
      {...props}
    >
      {title || eyebrow || description || actions ? (
        <header className="section__header">
          <div className="section__heading">
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {title ? (
              <h2 className="section__title" id={headingId}>
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="section__description">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="section__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
