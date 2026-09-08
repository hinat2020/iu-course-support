import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { selectFinalReviewSummary } from "../state/dashboardSelectors";
import { useAppState } from "../state/useAppState";

const checklistItems = [
  "必修科目がUNIPAに登録されている",
  "当選した通常抽選科目が登録されている",
  "不要な科目が登録されていない",
  "イノベーション特講・技法を確認した",
  "年間履修上限を確認した",
  "大学からの最新のお知らせを確認した",
] as const;

function CourseList({ names, empty }: { names: string[]; empty: string }) {
  if (names.length === 0) return <p className="review-empty">{empty}</p>;
  return <ul>{names.map((name) => <li key={name}>{name}</li>)}</ul>;
}

export function FinalReviewPage() {
  const { state } = useAppState();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const { timetableModel, englishTrack } = state.user;

  if (timetableModel === null || englishTrack === null) {
    return <Navigate to="/setup" replace />;
  }

  const summary = selectFinalReviewSummary(state);
  if (!summary.requiredTimetable || !summary.cap) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <main className="review-page">
      <div className="review-shell">
        <header className="review-header">
          <div>
            <p className="eyebrow">UNIPA final check</p>
            <h1>最終履修確認</h1>
            <p>この画面を見ながら、実際の登録内容をUNIPAで確認してください。</p>
          </div>
          <Link className="button button--secondary" to="/home">ホームへ戻る</Link>
        </header>

        <aside className="official-notice" role="note">
          <strong>このアプリだけでは履修登録完了を判断できません。</strong>
          <p>最新情報は公式シラバス・UNIPAで確認してください。</p>
        </aside>

        <div className="review-grid">
          <section className="review-card">
            <p className="section-kicker">Profile</p>
            <h2>基本設定</h2>
            <strong>{timetableModel}モデル / {englishTrack === "advanced" ? "Advanced" : "通常"}</strong>
            <Link to="/settings">設定を確認する</Link>
          </section>

          <section className="review-card">
            <p className="section-kicker">Required</p>
            <h2>必修</h2>
            <strong>{summary.requiredTimetable.courses.length}科目 / {summary.requiredTimetable.totalCredits}単位</strong>
            <p>プロジェクト入門には特殊日程があります。</p>
            <Link to="/timetable">時間割を確認する</Link>
          </section>

          <section className="review-card review-card--wide">
            <p className="section-kicker">Regular lottery</p>
            <h2>通常抽選</h2>
            <div className="review-lottery-grid">
              <div>
                <h3>当選した科目</h3>
                <CourseList names={summary.normalLottery.won.map((course) => course.name)} empty="当選として記録された科目はありません。" />
              </div>
              <div>
                <h3>UNIPA確認済み</h3>
                <CourseList names={summary.normalLottery.confirmed.map((course) => course.name)} empty="確認済みの当選科目はありません。" />
              </div>
              <div>
                <h3>UNIPA未確認</h3>
                <CourseList names={summary.normalLottery.unconfirmed.map((course) => course.name)} empty="未確認の当選科目はありません。" />
              </div>
              <div>
                <h3>落選</h3>
                <CourseList names={summary.normalLottery.lost.map((course) => course.name)} empty="落選として記録された科目はありません。" />
              </div>
            </div>
            {summary.normalLottery.pending.length > 0 && (
              <p className="review-warning" role="status">
                抽選結果が未入力です：{summary.normalLottery.pending.map((course) => course.name).join("、")}
              </p>
            )}
            {summary.normalLottery.notApplied.length > 0 && (
              <p className="review-warning" role="status">
                抽選申込状況が未確認です：{summary.normalLottery.notApplied.map((course) => course.name).join("、")}
              </p>
            )}
            <Link to="/lottery/results">通常抽選を確認する</Link>
          </section>

          <section className="review-card review-card--wide">
            <p className="section-kicker">Special courses</p>
            <h2>特殊科目</h2>
            <dl className="review-special-list">
              <div><dt>イノベーション特講</dt><dd>{summary.special.lecture}</dd></div>
              <div><dt>イノベーション技法</dt><dd>{summary.special.method}</dd></div>
            </dl>
            <p>特殊科目のCAP・卒業要件上の扱いは公式資料で確認してください。</p>
            <Link to="/special">特殊科目を確認する</Link>
          </section>

          <section className="review-card review-card--wide">
            <p className="section-kicker">Annual credit cap</p>
            <h2>CAP</h2>
            {summary.cap.confirmedAnnualCredits === null ? (
              <p className="review-warning">前期履修状況に未確認項目があるため計算できません。</p>
            ) : (
              <dl className="review-cap-list">
                <div><dt>確定基礎</dt><dd>{summary.cap.confirmedAnnualCredits} / {summary.cap.limit}</dd></div>
                <div><dt>全候補に当選した場合</dt><dd>{summary.cap.maximumAnnualCredits} / {summary.cap.limit}</dd></div>
                <div><dt>現在の当選結果</dt><dd>{summary.cap.resultReflectedAnnualCredits} / {summary.cap.limit}</dd></div>
              </dl>
            )}
          </section>

          <section className="review-card review-card--wide">
            <p className="section-kicker">Open items</p>
            <h2>注意事項</h2>
            {summary.warnings.map((warning) => (
              <div className={`review-notice review-notice--${warning.severity}`} key={warning.id}>
                <strong>{warning.title}</strong>
                <span>{warning.message}</span>
                {warning.href && <Link to={warning.href}>確認する</Link>}
              </div>
            ))}
          </section>

          <section className="review-card review-card--wide" aria-labelledby="official-checklist-heading">
            <p className="section-kicker">Your checklist</p>
            <h2 id="official-checklist-heading">UNIPAで以下を確認してください</h2>
            <p className="review-check-note">
              これはこの画面だけの補助チェックです。大学側の履修登録完了を意味せず、保存もされません。
            </p>
            <div className="review-checklist">
              {checklistItems.map((item) => (
                <label key={item}>
                  <input
                    type="checkbox"
                    checked={checked[item] ?? false}
                    onChange={(event) => setChecked((current) => ({ ...current, [item]: event.target.checked }))}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
