import { assetUrl } from "../../lib/assets";
import {
  elementAsset,
  elementLabel,
  normalizeCombatElement,
} from "../../domain/elements";

type ElementIconProps = {
  element: string;
  label?: string;
  size?: number;
};

export function ElementIcon({ element, label, size = 18 }: ElementIconProps) {
  const key = normalizeCombatElement(element);
  if (!key) return null;
  return (
    <img
      alt={label || elementLabel(key)}
      className="element-icon"
      height={size}
      src={assetUrl(elementAsset(key))}
      width={size}
    />
  );
}
