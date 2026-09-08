import type { ReactNode } from "react";
import { firstSemesterSetupData } from "../../data/2026/setup";

type SetupLayoutProps = {
  step: number;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
};

export function SetupLayout({
  step,
  title,
  description,
  children,
  actions,
}: SetupLayoutProps) {
  return (
    <main className="setup-page">
      <div className="setup-shell">
        <header className="setup-header">
          <div className="setup-progress__label">
            <span>初期設定 {step}/5</span>
            <span>{step * 20}%</span>
          </div>
          <div
            className="setup-progress"
            role="progressbar"
            aria-label={`初期設定 ${step}/5`}
            aria-valuemin={1}
            aria-valuemax={5}
            aria-valuenow={step}
          >
            <span style={{ width: `${step * 20}%` }} />
          </div>
          <p className="eyebrow">
            {firstSemesterSetupData.academicYear}年度・
            {firstSemesterSetupData.target.grade}年生後期
          </p>
          <h1>{title}</h1>
          {description && <div className="setup-description">{description}</div>}
        </header>

        <div className="setup-content">{children}</div>
        {actions && <nav className="setup-actions">{actions}</nav>}
      </div>
    </main>
  );
}
