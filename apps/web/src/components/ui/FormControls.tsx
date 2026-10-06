import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Icon } from "./Icon";

type FieldFrameProps = {
  children: ReactNode;
  error?: string;
  hint?: string;
  id: string;
  label: string;
};

function FieldFrame({
  children,
  error,
  hint,
  id,
  label,
}: FieldFrameProps) {
  const descriptionId = error || hint ? `${id}-description` : undefined;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error || hint ? (
        <span
          className={error ? "field__message field__message--error" : "field__message"}
          id={descriptionId}
        >
          {error || hint}
        </span>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  hint?: string;
  label: string;
};

export function Input({
  className = "",
  error,
  hint,
  id: providedId,
  label,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const descriptionId = error || hint ? `${id}-description` : undefined;

  return (
    <FieldFrame error={error} hint={hint} id={id} label={label}>
      <input
        aria-describedby={descriptionId}
        aria-invalid={error ? true : undefined}
        className={`field__control ${className}`.trim()}
        id={id}
        {...props}
      />
    </FieldFrame>
  );
}

type SearchInputProps = Omit<InputProps, "label" | "type"> & {
  label?: string;
};

export function SearchInput({
  className = "",
  id: providedId,
  label = "Buscar",
  ...props
}: SearchInputProps) {
  const generatedId = useId();
  const id = providedId || generatedId;

  return (
    <div className="search-field">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Icon className="search-field__icon" name="search" size={18} />
      <input
        className={`field__control search-field__control ${className}`.trim()}
        id={id}
        type="search"
        {...props}
      />
    </div>
  );
}

type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string;
  hint?: string;
  label: string;
  options: SelectOption[];
};

export function Select({
  className = "",
  error,
  hint,
  id: providedId,
  label,
  options,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const descriptionId = error || hint ? `${id}-description` : undefined;

  return (
    <FieldFrame error={error} hint={hint} id={id} label={label}>
      <select
        aria-describedby={descriptionId}
        aria-invalid={error ? true : undefined}
        className={`field__control field__select ${className}`.trim()}
        id={id}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}
