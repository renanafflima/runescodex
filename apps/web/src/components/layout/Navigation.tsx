import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Icon, type IconName } from "../ui/Icon";

const navigationItems: Array<{
  icon: IconName;
  label: string;
  to: string;
}> = [
  { icon: "home", label: "Home", to: "/" },
  { icon: "swords", label: "Hunts", to: "/hunts" },
  { icon: "book", label: "Bestiário", to: "/bestiary" },
  { icon: "crown", label: "Bosstiário", to: "/bosstiary" },
  { icon: "message", label: "Fórum", to: "/forum" },
  { icon: "gift", label: "Rewards", to: "/rewards" },
  { icon: "user", label: "Perfil", to: "/profile" },
];

const adminNavigationItem = {
  icon: "crown" as const,
  label: "Administração",
  to: "/admin",
};

type NavigationProps = {
  onNavigate?: () => void;
  open?: boolean;
};

export function Navigation({ onNavigate, open = false }: NavigationProps) {
  const location = useLocation();
  const { user } = useAuth();
  const items = user?.role === "ADMIN" ? [...navigationItems, adminNavigationItem] : navigationItems;

  function isActive(to: string) {
    const [pathname, hash = ""] = to.split("#");
    if (hash) {
      return location.pathname === pathname && location.hash === `#${hash}`;
    }
    if (pathname === "/") {
      return location.pathname === "/" && !location.hash;
    }
    if (pathname === "/hunts") {
      return location.pathname === "/hunts" || location.pathname.startsWith("/hunts/");
    }
    if (pathname === "/bestiary") {
      return location.pathname === "/bestiary" || location.pathname.startsWith("/bestiary/");
    }
    if (pathname === "/bosstiary") {
      return location.pathname === "/bosstiary" || location.pathname.startsWith("/bosstiary/");
    }
    if (pathname === "/forum") {
      return location.pathname === "/forum" || location.pathname.startsWith("/forum/");
    }
    if (pathname === "/admin") {
      return location.pathname === "/admin" || location.pathname.startsWith("/admin/");
    }
    return location.pathname === pathname;
  }

  return (
    <nav
      aria-label="Navegação principal"
      className={`navigation ${open ? "navigation--open" : ""}`}
      id="primary-navigation"
    >
      <div className="navigation__links">
        {items.map((item) => (
          <Link
            aria-current={isActive(item.to) ? "page" : undefined}
            className={`navigation__link ${
              isActive(item.to) ? "navigation__link--active" : ""
            }`}
            key={item.label}
            onClick={onNavigate}
            to={item.to}
          >
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
