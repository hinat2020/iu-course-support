import { NavLink, useLocation } from "react-router-dom";
import { useAppState } from "../state/useAppState";

const navigationItems = [
  { href: "/home", label: "ホーム", shortLabel: "ホーム" },
  { href: "/timetable", label: "必修時間割", shortLabel: "必修" },
  { href: "/plan", label: "履修候補", shortLabel: "候補" },
  { href: "/lottery", label: "抽選", shortLabel: "抽選" },
  { href: "/special", label: "特殊科目", shortLabel: "特殊" },
  { href: "/settings", label: "設定", shortLabel: "設定" },
] as const;

export function AppNavigation() {
  const { state } = useAppState();
  const location = useLocation();
  const isSetupRoute = location.pathname === "/" || location.pathname.startsWith("/setup");

  if (!state.setupCompleted || isSetupRoute) return null;

  return (
    <nav className="app-navigation" aria-label="主要ページ">
      <div className="app-navigation__inner">
        {navigationItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) => isActive ? "app-navigation__link is-active" : "app-navigation__link"}
            aria-label={item.label}
          >
            <span className="app-navigation__mark" aria-hidden="true" />
            <span className="app-navigation__short">{item.shortLabel}</span>
            <span className="app-navigation__full">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
