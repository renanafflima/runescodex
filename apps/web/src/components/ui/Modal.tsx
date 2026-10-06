import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

type ModalProps = {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
};

export function Modal({
  children,
  description,
  footer,
  onClose,
  open,
  title,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <header className="modal__header">
        <div>
          <h2 className="modal__title" id={titleId}>
            {title}
          </h2>
          {description ? (
            <p className="modal__description" id={descriptionId}>
              {description}
            </p>
          ) : null}
        </div>
        <IconButton label="Fechar modal" onClick={onClose} variant="ghost">
          <Icon name="close" />
        </IconButton>
      </header>
      <div className="modal__content">{children}</div>
      {footer ? <footer className="modal__footer">{footer}</footer> : null}
    </dialog>
  );
}
