import { useState } from "react";
import { initialsFrom } from "../../domain/format";

type CatalogImageProps = {
  alt: string;
  className?: string;
  name?: string;
  src?: string | null;
};

export function CatalogImage({ alt, className = "", name = "", src }: CatalogImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src) && failedSrc === src;

  if (src && !failed) {
    return (
      <img
        alt={alt}
        className={`catalog-image ${className}`.trim()}
        onError={() => setFailedSrc(src)}
        src={src}
      />
    );
  }

  return (
    <span aria-hidden={alt ? undefined : true} className={`catalog-image catalog-image--fallback ${className}`.trim()}>
      {initialsFrom(name || alt)}
    </span>
  );
}
