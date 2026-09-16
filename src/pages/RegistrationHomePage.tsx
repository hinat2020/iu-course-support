import { Link, Navigate } from "react-router-dom";
import { formatLotteryDateTime } from "../domain/lottery";
import {
  regularLotteryData,
  selectDashboardSummary,
} from "../state/dashboardSelectors";
import { useAppState } from "../state/useAppState";

export function RegistrationHomePage() {
  const { state } = useAppState();
  const { timetableModel, englishTrack } = state.user;

  if (timetableModel === null || englishTrack === null) {
    return <Navigate to="/setup" replace />;
  }

  const summary = selectDashboardSummary(state);
  const required = summary.requiredTimetable;
  if (!required || !summary.cap) return <Navigate to="/setup" replace />;

  const lotteryItems = [
    ["未申込", summary.lottery.notApplied],
    ["申込済み", summary.lottery.applied],
    ["結果待ち", summary.lottery.pending],
    ["当選", summary.lottery.won],
    ["落選", summary.lottery.lost],
    ["UNIPA未確認", summary.lottery.unconfirmed],
  ] as const;
  const visibleLotteryItems = lotteryItems.filter(([, count]) => count > 0);

  return (
    <main className="home-page">
      <div className="home-shell">
        <header className="home-hero">
          <div>
            <p className="home-brand">iU 履修サポート</p>
            <h1>1年後期 履修登録 <span>{state.user.academicYear}年度入学・{state.user.grade}年生・後期</span></h1>
            <p className="home-profile">
              {timetableModel}モデル / {englishTrack === "advanced" ? "Advanced" : "通常"}
            </p>
          </div>
          <aside className="home-official-note" role="note">
            <strong>非公式ツール</strong>
            <span>最終確認はUNIPA・大学公式資料で行ってください</span>
          </aside>
        </header>

        <section className="home-tasks" aria-labelledby="home-tasks-heading">
          <div className="home-section-heading">
            <div>
              <p className="section-kicker">Next actions</p>
              <h2 id="home-tasks-heading">やること</h2>
            </div>
            <span>{summary.tasks.length}件</span>
          </div>
          {summary.tasks.length === 0 ? (
            <p className="home-empty-state">
              現在、入力済みデータから検出された未確認項目はありません。最終確認は必ずUNIPAで行ってください。
            </p>
          ) : (
            <div className="home-task-list">
              {summary.tasks.map((task) => (
                <Link
                  className={`home-task home-task--${task.severity}`}
                  to={task.href}
                  key={task.id}
                >
                  <span>{task.severity === "important" ? "要確認" : task.severity === "warning" ? "注意" : "案内"}</span>
                  <strong>{task.title}</strong>
                  {task.description && <small>{task.description}</small>}
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="home-dashboard-grid">
          <section className="home-card home-card--wide" aria-labelledby="home-cap-heading">
            <div className="home-section-heading">
              <div>
                <p className="section-kicker">Annual credit cap</p>
                <h2 id="home-cap-heading">年間履修上限</h2>
              </div>
              <strong>{summary.cap.limit}単位</strong>
            </div>
            {summary.cap.confirmedAnnualCredits === null ? (
              <p className="home-warning-copy">
                前期履修状況に未確認項目があるため計算できません。
              </p>
            ) : (
              <div className="home-metric-grid">
                <div><span>確定基礎</span><strong>{summary.cap.confirmedAnnualCredits} / {summary.cap.limit}</strong></div>
                <div><span>全候補に当選した場合</span><strong>{summary.cap.maximumAnnualCredits} / {summary.cap.limit}</strong></div>
                <div><span>現在の当選結果</span><strong>{summary.cap.resultReflectedAnnualCredits} / {summary.cap.limit}</strong></div>
              </div>
            )}
            <p className="home-card-note">特殊科目は自動加算していません。</p>
            <Link className="text-link" to="/plan">CAPと候補を見る</Link>
          </section>

          <section className="home-card" aria-labelledby="home-required-heading">
            <p className="section-kicker">Required</p>
            <h2 id="home-required-heading">後期必修</h2>
            <div className="home-big-number">{required.courses.length}<span>科目</span></div>
            <strong>{required.totalCredits}単位</strong>
            <p className="home-card-note">プロジェクト入門には特殊日程があります。</p>
            <Link className="button button--secondary" to="/timetable">時間割を見る</Link>
          </section>

          <section className="home-card" aria-labelledby="home-candidates-heading">
            <p className="section-kicker">Candidates</p>
            <h2 id="home-candidates-heading">履修候補</h2>
            <div className="home-big-number">{summary.selectedCandidates.length}<span>/ {summary.candidateTotal}科目</span></div>
            <p className={summary.candidateConflictCount > 0 ? "home-warning-copy" : "home-card-note"}>
              時間割重複あり {summary.candidateConflictCount}件
            </p>
            <Link className="button button--secondary" to="/plan">履修候補を見る</Link>
          </section>

          <section className="home-card home-card--wide" aria-labelledby="home-lottery-heading">
            <div className="home-section-heading">
              <div>
                <p className="section-kicker">Regular lottery</p>
                <h2 id="home-lottery-heading">通常抽選</h2>
              </div>
              <span>
                締切 {formatLotteryDateTime(
                  regularLotteryData.schedule.applicationDeadline,
                  regularLotteryData.schedule.timezone,
                )}
              </span>
            </div>
            {visibleLotteryItems.length === 0 ? (
              <p className="home-empty-state">履修候補または抽選記録はありません。</p>
            ) : (
              <dl className="home-status-grid">
                {visibleLotteryItems.map(([label, count]) => (
                  <div key={label}><dt>{label}</dt><dd>{count}</dd></div>
                ))}
              </dl>
            )}
            <Link className="button button--secondary" to="/lottery">抽選を確認する</Link>
          </section>

          <section className="home-card home-card--wide" aria-labelledby="home-requirements-heading">
            <p className="section-kicker">Requirements</p>
            <h2 id="home-requirements-heading">選択必修修得状況</h2>
            <div className="home-requirement-list">
              {summary.requirements.map((item) => (
                <div key={item.groupId}>
                  <span>{item.symbol} {item.label}</span>
                  <strong>{item.earnedCredits} / {item.requiredCredits}</strong>
                </div>
              ))}
            </div>
            <Link className="text-link" to="/plan">詳しく見る</Link>
          </section>

          <section className="home-card home-card--wide" aria-labelledby="home-special-heading">
            <p className="section-kicker">Special courses</p>
            <h2 id="home-special-heading">特殊科目</h2>
            <dl className="home-special-list">
              <div><dt>イノベーション特講</dt><dd>{summary.special.lecture}</dd></div>
              <div><dt>イノベーション技法</dt><dd>{summary.special.method}</dd></div>
            </dl>
            <Link className="button button--secondary" to="/special">特殊科目を見る</Link>
          </section>

          <section className="home-card home-card--wide" aria-labelledby="home-warnings-heading">
            <p className="section-kicker">Notes</p>
            <h2 id="home-warnings-heading">注意・未確認事項</h2>
            <ul className="home-warning-list">
              {summary.warnings.map((warning) => (
                <li key={warning.id}>
                  <strong>{warning.title}</strong>
                  <span>{warning.message}</span>
                  {warning.href && <Link to={warning.href}>確認する</Link>}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <Link className="button button--primary home-review-button" to="/review">
          最終履修確認をする
        </Link>
      </div>
    </main>
  );
}
