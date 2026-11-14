import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

type ModalProps = {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  title: string;
};

export function Modal({
  children,
  description,
  footer,
  onClose,
  open,
  returnFocusRef,
  title,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      const closeButton = dialog.querySelector<HTMLButtonElement>(".icon-button");
      closeButton?.focus();
      return;
    }

    if (dialog.open) {
      dialog.close();
      returnFocusRef?.current?.focus();
    }
  }, [open, returnFocusRef]);

  function handleClose() {
    onClose();
    queueMicrotask(() => returnFocusRef?.current?.focus());
  }

  if (!open) return null;

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal="true"
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      onClose={handleClose}
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
        <IconButton label="Fechar modal" onClick={handleClose} variant="ghost">
          <Icon name="close" />
        </IconButton>
      </header>
      <div className="modal__content">{children}</div>
      {footer ? <footer className="modal__footer">{footer}</footer> : null}
    </dialog>
  );
}