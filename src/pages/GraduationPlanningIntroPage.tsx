import { Link } from "react-router-dom";

const semesters = [
  { id: "1-first", label: "1年前期", status: "修得状況を反映" },
  { id: "1-second", label: "1年後期", status: "現在の履修計画を参照" },
  { id: "2-first", label: "2年前期", status: "科目を配置できます" },
  { id: "2-second", label: "2年後期", status: "科目を配置できます" },
  { id: "3-first", label: "3年前期", status: "科目を配置できます" },
  { id: "3-second", label: "3年後期", status: "科目を配置できます" },
  { id: "4-first", label: "4年前期", status: "科目を配置できます" },
  { id: "4-second", label: "4年後期", status: "科目を配置できます" },
] as const;

export function GraduationPlanningIntroPage() {
  return (
    <main className="graduation-page">
      <div className="graduation-shell">
        <header className="graduation-header">
          <div>
            <p className="eyebrow">Graduation planning</p>
            <h1>卒業設計</h1>
            <p>卒業までに、どの科目をどの学期に履修するかを組み立てる機能です。</p>
          </div>
          <Link className="button button--secondary" to="/home">履修サポートへ戻る</Link>
        </header>

        <aside className="graduation-status" role="status">
          <strong>8学期の履修計画を作成できます</strong>
          <span>科目を配置して、修得済み・履修予定を分けて確認します。</span>
        </aside>

        <section className="graduation-roadmap" aria-labelledby="graduation-roadmap-heading">
          <div className="graduation-section-heading">
            <p className="section-kicker">Eight semesters</p>
            <h2 id="graduation-roadmap-heading">8学期の履修計画</h2>
          </div>
          <ol className="graduation-semester-grid">
            {semesters.map((semester) => (
              <li key={semester.id}>
                <span>{semester.label}</span>
                <strong>{semester.status}</strong>
              </li>
            ))}
          </ol>
        </section>

        <Link className="button graduation-open-button" to="/graduation/plan">
          卒業設計を開く
        </Link>

        <aside className="graduation-notice" role="note">
          <strong>卒業を保証する機能ではありません</strong>
          <p>この機能は履修計画の補助です。最新の卒業要件・開講情報は大学公式資料を確認してください。</p>
        </aside>
      </div>
    </main>
  );
}
