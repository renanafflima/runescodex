type PaginationProps = {
  disabled?: boolean;
  onChange: (page: number) => void;
  page: number;
  totalPages: number;
};

type PaginationItem = number | "ellipsis";

function paginationItems(page: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, 2, totalPages - 1, totalPages, page]);
  if (page > 1) pages.add(page - 1);
  if (page < totalPages) pages.add(page + 1);

  const sorted = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  const items: PaginationItem[] = [];
  let previous = 0;
  for (const value of sorted) {
    if (previous && value - previous > 1) items.push("ellipsis");
    items.push(value);
    previous = value;
  }
  return items;
}

/** Compact numbered pagination. Callers own the fetch behind onChange; this only renders controls. */
export function Pagination({ disabled = false, onChange, page, totalPages }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Paginação" className="pagination">
      <button
        aria-label="Página anterior"
        className="pagination__nav"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
        type="button"
      >
        ‹
      </button>
      <div className="pagination__pages">
        {paginationItems(page, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span className="pagination__ellipsis" key={`ellipsis-${index}`}>
              …
            </span>
          ) : (
            <button
              aria-current={item === page ? "page" : undefined}
              className={`pagination__page${item === page ? " is-active" : ""}`}
              disabled={disabled}
              key={item}
              onClick={() => onChange(item)}
              type="button"
            >
              {item}
            </button>
          ),
        )}
      </div>
      <button
        aria-label="Próxima página"
        className="pagination__nav"
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
        type="button"
      >
        ›
      </button>
    </nav>
  );
}
