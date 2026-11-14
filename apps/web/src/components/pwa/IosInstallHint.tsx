import type { RefObject } from "react";
import { Modal } from "../ui/Modal";

type IosInstallHintProps = {
  onClose: () => void;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function IosInstallHint({ onClose, open, returnFocusRef }: IosInstallHintProps) {
  if (!open) return null;

  return (
    <Modal
      description="O Safari no iPhone e iPad não oferece um botão nativo de instalação."
      onClose={onClose}
      open={open}
      returnFocusRef={returnFocusRef}
      title="Adicionar à Tela de Início"
    >
      <ol className="home-portal-ios-steps">
        <li>Abra o RuneCodex no Safari.</li>
        <li>
          Toque em <strong>Compartilhar</strong>.
        </li>
        <li>
          Escolha <strong>Adicionar à Tela de Início</strong>.
        </li>
        <li>Confirme o nome RuneCodex e adicione o atalho.</li>
      </ol>
    </Modal>
  );
}