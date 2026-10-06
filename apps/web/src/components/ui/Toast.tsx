import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

type ToastProps = {
  message: string;
  onClose?: () => void;
  title: string;
  tone?: "info" | "success" | "error";
};

export function Toast({
  message,
  onClose,
  title,
  tone = "info",
}: ToastProps) {
  return (
    <div
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`toast toast--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className="toast__content">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      {onClose ? (
        <IconButton label="Fechar aviso" onClick={onClose} size="sm" variant="ghost">
          <Icon name="close" size={16} />
        </IconButton>
      ) : null}
    </div>
  );
}
