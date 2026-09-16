import { Link, Navigate } from "react-router-dom";
import { useAppState } from "../state/useAppState";

export function HomePage() {
  const { state } = useAppState();
  const { timetableModel, englishTrack } = state.user;

  if (!state.setupCompleted || timetableModel === null || englishTrack === null) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <main className="app-home-page">
      <div className="app-home-shell">
        <header className="app-home-header">
          <div>
            <p className="home-brand">iU</p>
            <h1>履修サポート</h1>
            <p>
              {state.user.academicYear}年度入学・{state.user.grade}年生・後期
              <span>{timetableModel}モデル / {englishTrack === "advanced" ? "Advanced" : "通常"}</span>
            </p>
          </div>
          <aside className="app-home-notice" role="note">
            <strong>非公式ツール</strong>
            <span>最終確認はUNIPA・大学公式資料で行ってください</span>
          </aside>
        </header>

        <section className="app-home-section" aria-labelledby="app-home-services-heading">
          <div className="app-home-section-heading">
            <p className="section-kicker">Main services</p>
            <h2 id="app-home-services-heading">利用する機能を選ぶ</h2>
          </div>

          <div className="app-home-service-grid">
            <Link className="app-home-service app-home-service--registration" to="/registration/2026-fall">
              <span className="app-home-service__label">
                {state.user.academicYear}年度・{state.user.grade}年後期
              </span>
              <strong>1年後期 履修登録</strong>
              <p>履修候補、抽選、CAP、必修時間割と最終確認をまとめて確認します。</p>
              <span className="app-home-service__action">履修登録を確認する</span>
            </Link>

            <Link className="app-home-service app-home-service--graduation" to="/graduation">
              <span className="app-home-service__label">卒業までの履修計画</span>
              <strong>卒業設計</strong>
              <p>卒業までに、どの科目をどの学期に履修するかを組み立てる機能です。</p>
              <span className="app-home-service__status">8学期の履修予定を整理できます</span>
              <span className="app-home-service__action">卒業設計を開く</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
