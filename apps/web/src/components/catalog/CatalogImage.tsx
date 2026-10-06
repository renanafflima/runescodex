import { initialsFrom } from "../../domain/format";

type CatalogImageProps = {
  alt: string;
  className?: string;
  name?: string;
  src?: string | null;
};

export function CatalogImage({ alt, className = "", name = "", src }: CatalogImageProps) {
  if (src) {
    return <img alt={alt} className={`catalog-image ${className}`.trim()} src={src} />;
  }

  return (
    <span aria-hidden={alt ? undefined : true} className={`catalog-image catalog-image--fallback ${className}`.trim()}>
      {initialsFrom(name || alt)}
    </span>
  );
}
