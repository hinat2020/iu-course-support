import { Link, useLocation } from "react-router-dom";
import { useAppState } from "../state/useAppState";

const navigationItems = [
  { href: "/home", label: "ホーム", shortLabel: "ホーム" },
  { href: "/registration/2026-fall", label: "1年後期履修登録", shortLabel: "履修登録" },
  { href: "/graduation", label: "卒業設計", shortLabel: "卒業設計" },
  { href: "/settings", label: "設定", shortLabel: "設定" },
] as const;

const registrationRoutePrefixes = [
  "/registration",
  "/timetable",
  "/plan",
  "/lottery",
  "/special",
  "/review",
  "/courses",
] as const;

function isNavigationItemActive(href: string, pathname: string) {
  if (href === "/registration/2026-fall") {
    return registrationRoutePrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  }
  if (href === "/graduation") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname === href;
}

export function AppNavigation() {
  const { state } = useAppState();
  const location = useLocation();
  const isSetupRoute = location.pathname === "/" || location.pathname.startsWith("/setup");

  if (!state.setupCompleted || isSetupRoute) return null;

  return (
    <nav className="app-navigation" aria-label="主要ナビゲーション">
      <div className="app-navigation__inner">
        {navigationItems.map((item) => {
          const isActive = isNavigationItemActive(item.href, location.pathname);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={isActive ? "app-navigation__link is-active" : "app-navigation__link"}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              <span className="app-navigation__mark" aria-hidden="true" />
              <span className="app-navigation__short">{item.shortLabel}</span>
              <span className="app-navigation__full">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
