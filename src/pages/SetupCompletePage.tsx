import { Link } from "react-router-dom";
import { firstSemesterSetupData } from "../data/2026/setup";

export function SetupCompletePage() {
  return (
    <main className="complete-page">
      <section className="complete-card">
        <div className="complete-icon" aria-hidden="true">
          ✓
        </div>
        <p className="eyebrow">Setup complete</p>
        <h1>初期設定が完了しました。</h1>
        <p>
          {firstSemesterSetupData.academicYear}
          年度後期の必修時間割を確認できます。
        </p>
        <Link className="button button--primary button--full" to="/timetable">
          後期必修時間割を確認する
        </Link>
        <Link className="complete-secondary-link" to="/setup/review">
          設定内容を確認する
        </Link>
      </section>
    </main>
  );
}
