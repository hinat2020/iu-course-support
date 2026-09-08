import { useState } from "react";
import { Link } from "react-router-dom";
import { specialCoursesData } from "../data/2026/specialCourses";
import {
  getInnovationLectureCreditLabel,
  getSpecialLotteryPhase,
  getSpecialLotteryPhaseLabel,
  type InnovationLecturePreference,
} from "../domain/innovation";
import { formatLotteryDateTime } from "../domain/lottery";
import { useAppState } from "../state/useAppState";

export function InnovationLecturePage() {
  const { state, dispatch } = useAppState();
  const lecture = state.innovationLecture;
  const data = specialCoursesData.innovationLecture;
  const schedule = specialCoursesData.specialLottery.schedule;
  const phase = getSpecialLotteryPhase(new Date(), schedule);
  const creditLabel = getInnovationLectureCreditLabel(
    lecture.previousEarnedCount,
  );
  const [winningClassDraft, setWinningClassDraft] = useState(
    lecture.wonClassId ?? "",
  );
  const classById = new Map(data.classes.map((item) => [item.id, item]));
  const preferredClassIds = new Set(
    lecture.preferences.map((preference) => preference.classId),
  );

  function updatePreference(rank: number, classId: string) {
    const preferences: InnovationLecturePreference[] =
      lecture.preferences.filter((preference) => preference.rank !== rank);
    if (classId) preferences.push({ classId, rank });
    dispatch({ type: "SET_INNOVATION_LECTURE_PREFERENCES", payload: preferences });
  }

  return (
    <main className="special-page">
      <div className="special-shell">
        <header className="special-header">
          <div>
            <p className="eyebrow">特殊科目 / special lottery</p>
            <h1>イノベーション特講</h1>
            <p>a／bは選択する授業名ではなく、修得順に付く単位区分です。</p>
          </div>
          <Link className="button button--secondary" to="/special">
            特殊科目一覧へ
          </Link>
        </header>

        <aside className="official-notice" role="note">
          <strong>このアプリは非公式です。</strong>
          <p>
            通常の「抽選希望登録」とは申込方法が異なります。UNIPAで案内される専用申込フォームを確認してください。
          </p>
          <p>
            実際の申込・抽選結果・履修登録内容はUNIPAおよび大学からの案内で確認してください。
          </p>
        </aside>

        <section className="special-summary" aria-labelledby="lecture-credit-heading">
          <div>
            <p className="section-kicker">Credit order</p>
            <h2 id="lecture-credit-heading">修得順の確認</h2>
          </div>
          <fieldset className="inline-choice-group">
            <legend>これまでの修得数</legend>
            {[0, 1, 2].map((count) => (
              <label key={count}>
                <input
                  type="radio"
                  name="lecture-earned-count"
                  checked={lecture.previousEarnedCount === count}
                  onChange={() =>
                    dispatch({
                      type: "SET_INNOVATION_LECTURE_PREVIOUS_EARNED_COUNT",
                      payload: count as 0 | 1 | 2,
                    })
                  }
                />
                <span>{count}単位</span>
              </label>
            ))}
          </fieldset>
          <div className="next-credit-card">
            {creditLabel === "completed" ? (
              <strong>イノベーション特講a/bは修得済みです</strong>
            ) : (
              <>
                <span>次に修得する単位</span>
                <strong>イノベーション特講{creditLabel}</strong>
              </>
            )}
          </div>
        </section>

        <section className="special-schedule" aria-labelledby="special-schedule-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">2026 special lottery</p>
              <h2 id="special-schedule-heading">特殊抽選の日程</h2>
            </div>
            <span className="special-phase-badge">{getSpecialLotteryPhaseLabel(phase)}</span>
          </div>
          <dl>
            <div>
              <dt>申込期間</dt>
              <dd>
                {formatLotteryDateTime(schedule.applicationStartsAt, schedule.timezone)} 〜 {formatLotteryDateTime(schedule.applicationDeadline, schedule.timezone)}
              </dd>
            </div>
            <div>
              <dt>結果公開</dt>
              <dd>{formatLotteryDateTime(schedule.resultPublishedAt, schedule.timezone)}</dd>
            </div>
          </dl>
          <p>期限外でも記録は変更できます。日時による入力制限は行いません。</p>
        </section>

        {creditLabel !== "completed" && (
          <section className="special-workflow" aria-labelledby="lecture-classes-heading">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Classes</p>
                <h2 id="lecture-classes-heading">2026年度後期 開講クラス</h2>
              </div>
            </div>

            <div className="lecture-class-grid">
              {data.classes.map((item) => (
                <article key={item.id}>
                  <span className="special-badge">特殊抽選</span>
                  <h3>{item.label}</h3>
                  <p>正式な曜日・時限はUNIPAまたは時間割表で確認してください。</p>
                </article>
              ))}
            </div>

            <div className="preference-grid">
              {[1, 2].map((rank) => {
                const current =
                  lecture.preferences.find((item) => item.rank === rank)?.classId ?? "";
                return (
                  <label key={rank}>
                    第{rank}希望
                    <select
                      value={current}
                      onChange={(event) => updatePreference(rank, event.target.value)}
                    >
                      <option value="">選択してください</option>
                      {data.classes.map((item) => (
                        <option
                          value={item.id}
                          disabled={preferredClassIds.has(item.id) && current !== item.id}
                          key={item.id}
                        >
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>

            <fieldset className="inline-choice-group">
              <legend>申込状態</legend>
              <label>
                <input
                  type="radio"
                  name="lecture-application"
                  checked={lecture.applicationStatus === "not_applied"}
                  onChange={() =>
                    dispatch({
                      type: "SET_INNOVATION_LECTURE_APPLICATION_STATUS",
                      payload: "not_applied",
                    })
                  }
                />
                <span>未申込</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="lecture-application"
                  checked={lecture.applicationStatus === "applied"}
                  onChange={() =>
                    dispatch({
                      type: "SET_INNOVATION_LECTURE_APPLICATION_STATUS",
                      payload: "applied",
                    })
                  }
                />
                <span>申込済み（自分で確認）</span>
              </label>
            </fieldset>

            {lecture.applicationStatus === "applied" && (
              <div className="special-result-panel">
                <label>
                  当選したクラス
                  <select
                    value={winningClassDraft}
                    onChange={(event) => setWinningClassDraft(event.target.value)}
                  >
                    <option value="">選択してください</option>
                    {lecture.preferences.map((preference) => {
                      const item = classById.get(preference.classId);
                      return item ? (
                        <option value={item.id} key={item.id}>
                          第{preference.rank}希望：{item.label}
                        </option>
                      ) : null;
                    })}
                  </select>
                </label>
                <div className="result-button-row" role="group" aria-label="特講の抽選結果">
                  <button
                    className={lecture.resultStatus === "won" ? "result-choice result-choice--active" : "result-choice"}
                    type="button"
                    disabled={!winningClassDraft}
                    onClick={() =>
                      dispatch({
                        type: "SET_INNOVATION_LECTURE_RESULT",
                        payload: { result: "won", wonClassId: winningClassDraft },
                      })
                    }
                  >
                    当選
                  </button>
                  <button
                    className={lecture.resultStatus === "lost" ? "result-choice result-choice--lost" : "result-choice"}
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "SET_INNOVATION_LECTURE_RESULT",
                        payload: { result: "lost" },
                      })
                    }
                  >
                    落選
                  </button>
                </div>
                {lecture.resultStatus === "won" && (
                  <label className="confirmation-check">
                    <input
                      type="checkbox"
                      checked={lecture.registrationConfirmation === "confirmed"}
                      onChange={(event) =>
                        dispatch({
                          type: "SET_INNOVATION_LECTURE_REGISTRATION_CONFIRMATION",
                          payload: event.target.checked ? "confirmed" : "unconfirmed",
                        })
                      }
                    />
                    <span>UNIPAの履修登録内容で確認済み</span>
                  </label>
                )}
                {lecture.preferences.length === 0 && (
                  <p className="field-help field-help--danger" role="alert">
                    申込済みですが希望クラスが登録されていません。
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        <section className="correction-section" aria-labelledby="lecture-correction-heading">
          <h2 id="lecture-correction-heading">特殊科目Correction期間</h2>
          <ul>
            {specialCoursesData.specialLottery.correctionPeriods.map((period) => (
              <li key={period.id}>
                {formatLotteryDateTime(period.startsAt, schedule.timezone)} 〜 {formatLotteryDateTime(period.endsAt, schedule.timezone)}
              </li>
            ))}
          </ul>
          <p>案内表示のみです。期間外でも記録内容は変更できます。</p>
        </section>

        <aside className="special-cap-note">
          特殊科目の年間履修上限上の扱いは、公式資料・UNIPAで確認してください。現在のCAPには自動加算していません。
        </aside>
      </div>
    </main>
  );
}
