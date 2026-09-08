import { Link } from "react-router-dom";
import { firstSemesterSetupData } from "../data/2026/setup";

export function WelcomePage() {
  return (
    <main className="welcome-page">
      <section className="welcome-card">
        <div className="brand-mark" aria-hidden="true">
          {firstSemesterSetupData.institutionName}
        </div>
        <p className="eyebrow">履修計画を、ひとつずつ確実に</p>
        <h1>{firstSemesterSetupData.applicationName}</h1>
        <p className="welcome-audience">
          <strong>{firstSemesterSetupData.academicYear}年度</strong>
          <span>{firstSemesterSetupData.target.grade}年生・後期向け</span>
        </p>
        <div className="notice" role="note">
          <strong>ご利用前に</strong>
          <p>
            このアプリは非公式の履修支援ツールです。
            最終的な履修登録内容・期限・抽選結果などは、必ずUNIPAおよび大学の公式資料を確認してください。
          </p>
        </div>
        <Link className="button button--primary button--full" to="/setup">
          はじめる
        </Link>
      </section>
    </main>
  );
}
