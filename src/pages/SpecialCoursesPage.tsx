import { Link } from "react-router-dom";

export function SpecialCoursesPage() {
  return (
    <main className="special-page">
      <div className="special-shell special-shell--narrow">
        <header className="special-header">
          <div>
            <p className="eyebrow">2026年度・1年生後期</p>
            <h1>特殊科目</h1>
            <p>
              通常抽選とは申込方法・期限・修得条件が異なる2科目を、専用画面で確認します。
            </p>
          </div>
          <Link className="button button--secondary" to="/plan">
            履修プランへ戻る
          </Link>
        </header>

        <aside className="official-notice" role="note">
          <strong>このアプリは非公式です。</strong>
          <p>
            実際の申込・抽選結果・履修登録内容はUNIPAおよび大学からの案内で確認してください。
          </p>
        </aside>

        <section className="special-course-menu" aria-label="特殊科目一覧">
          <article>
            <span className="special-badge">専用フロー</span>
            <h2>イノベーション特講</h2>
            <p>修得順にa／bが決まる特講クラスの希望・結果を記録します。</p>
            <Link className="button button--primary" to="/special/innovation-lecture">
              特講を確認する
            </Link>
          </article>
          <article>
            <span className="special-badge">専用フロー</span>
            <h2>イノベーション技法</h2>
            <p>前期からの継続判定と、講座系・イベント系の進捗を記録します。</p>
            <Link className="button button--primary" to="/special/innovation-method">
              技法を確認する
            </Link>
          </article>
        </section>
      </div>
    </main>
  );
}
