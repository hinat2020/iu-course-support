import { Link, Navigate } from "react-router-dom";
import {
  candidateCourses,
  candidateOfferings,
} from "../data/2026/coursePlanning";
import { regularLotteryData } from "../data/2026/lottery";
import {
  courseCatalog,
  courseOfferings,
} from "../data/2026/requiredTimetable";
import {
  createEmptyLotteryApplication,
  formatLotteryDateTime,
  getLotteryPhase,
  getLotteryPhaseLabel,
  normalizeLotteryPreferences,
  validateLotteryApplication,
  type LotteryApplication,
  type LotteryPreference,
} from "../domain/lottery";
import { buildLotteryCourseContexts } from "../domain/lotteryPlanning";
import { generateRequiredTimetable } from "../domain/requiredTimetable";
import { useAppState } from "../state/useAppState";

function getApplication(
  applications: Record<string, LotteryApplication>,
  courseId: string,
): LotteryApplication {
  return applications[courseId] ?? createEmptyLotteryApplication(courseId);
}

export function LotteryApplicationPage() {
  const { state, dispatch } = useAppState();
  const { timetableModel, englishTrack } = state.user;

  if (timetableModel === null || englishTrack === null) {
    return <Navigate to="/setup" replace />;
  }

  const selectedCourses = candidateCourses.filter(
    (course) => state.plannedCourses[course.id]?.selected === true,
  );
  const requiredTimetable = generateRequiredTimetable({
    timetableModel,
    englishTrack,
    academicYear: state.user.academicYear,
    grade: state.user.grade,
    semester: state.user.semester,
    courses: courseCatalog,
    offerings: courseOfferings,
  });
  const contexts = buildLotteryCourseContexts({
    courses: selectedCourses,
    offerings: candidateOfferings,
    requiredCourses: requiredTimetable.courses,
    timetableModel,
    academicYear: state.user.academicYear,
    semester: state.user.semester,
  }).filter(({ offering }) => offering.registrationMethod === "lottery");
  const phase = getLotteryPhase(new Date(), regularLotteryData.schedule);
  const schedule = regularLotteryData.schedule;

  function setPreference(
    application: LotteryApplication,
    offeringId: string,
    rank: number,
    scheduleOptionId: string,
  ) {
    const preferences: LotteryPreference[] = application.preferences.filter(
      (preference) => preference.rank !== rank,
    );

    if (scheduleOptionId) {
      preferences.push({ offeringId, scheduleOptionId, rank });
    }

    dispatch({
      type: "SET_LOTTERY_PREFERENCES",
      payload: {
        courseId: application.courseId,
        preferences: normalizeLotteryPreferences(preferences),
      },
    });
  }

  return (
    <main className="lottery-page">
      <div className="lottery-shell">
        <header className="lottery-header">
          <div>
            <p className="eyebrow">通常抽選</p>
            <h1>抽選申込の確認</h1>
            <p className="planning-subtitle">
              {timetableModel}モデル /{" "}
              {englishTrack === "advanced" ? "Advanced" : "通常"}
            </p>
          </div>
          <Link className="button button--secondary" to="/plan">
            履修候補へ戻る
          </Link>
        </header>

        <section className="lottery-schedule" aria-labelledby="schedule-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">2026 regular lottery</p>
              <h2 id="schedule-heading">通常抽選</h2>
            </div>
            <span className="phase-badge">{getLotteryPhaseLabel(phase)}</span>
          </div>
          <dl className="lottery-schedule__grid">
            <div>
              <dt>申込期間</dt>
              <dd>
                {formatLotteryDateTime(
                  schedule.applicationStartsAt,
                  schedule.timezone,
                )}
                <span>〜</span>
                {formatLotteryDateTime(
                  schedule.applicationDeadline,
                  schedule.timezone,
                )}
              </dd>
            </div>
            <div>
              <dt>結果公開</dt>
              <dd>
                {formatLotteryDateTime(
                  schedule.resultPublishedAt,
                  schedule.timezone,
                )}
              </dd>
            </div>
          </dl>
          <p className="schedule-caption">
            期限後も記録内容は変更できます。現在時刻による入力制限は行いません。
          </p>
        </section>

        <aside className="official-notice" role="note">
          <strong>このアプリは非公式です。</strong>
          <p>
            このアプリからUNIPAへの抽選申込は行われません。実際の抽選申込・抽選結果・履修登録内容はUNIPAで確認してください。
          </p>
        </aside>

        {contexts.length === 0 ? (
          <section className="lottery-empty">
            <h2>抽選申込を確認する履修候補がありません。</h2>
            <Link className="button button--primary" to="/plan">
              履修候補を選ぶ
            </Link>
          </section>
        ) : (
          <section className="lottery-course-list" aria-label="抽選申込科目">
            {contexts.map(({ course, offering, scheduleEvaluation }) => {
              const application = getApplication(state.lotteries, course.id);
              const rule = regularLotteryData.courses.find(
                (item) => item.courseId === course.id,
              );
              if (!rule) {
                throw new Error("Lottery rule not found: " + course.id);
              }

              const issues = validateLotteryApplication({
                application,
                offering,
                scheduleEvaluation,
              });
              const availableOptions = scheduleEvaluation.options.filter(
                (option) => !option.hasConflict,
              );
              const rankCount = Math.min(
                rule.maxPreferences,
                availableOptions.length,
              );

              return (
                <article className="lottery-course-card" key={course.id}>
                  <div className="lottery-course-card__heading">
                    <div>
                      <span className="lottery-badge">抽選対象</span>
                      <h2>{course.name}</h2>
                    </div>
                    <strong>{course.credits}単位</strong>
                  </div>

                  {offering.scheduleOptions &&
                    offering.scheduleOptions.length > 0 && (
                      <section className="preference-panel">
                        <h3>希望枠</h3>
                        <div className="schedule-option-statuses">
                          {scheduleEvaluation.options.map((option) => (
                            <div
                              className={
                                "schedule-option-status " +
                                (option.hasConflict
                                  ? "schedule-option-status--blocked"
                                  : "schedule-option-status--available")
                              }
                              key={option.id}
                            >
                              <strong>{option.label}</strong>
                              <span>
                                {option.hasConflict
                                  ? option.conflictsWith
                                      .map((conflict) => conflict.courseName)
                                      .join("、") +
                                    "と重複するため選択できません"
                                  : "選択可能"}
                              </span>
                            </div>
                          ))}
                        </div>

                        {rankCount > 0 ? (
                          <div className="preference-selects">
                            {Array.from(
                              { length: rankCount },
                              (_, index) => index + 1,
                            ).map((rank) => {
                              const current =
                                application.preferences.find(
                                  (preference) => preference.rank === rank,
                                )?.scheduleOptionId ?? "";
                              const selectedElsewhere = new Set(
                                application.preferences
                                  .filter(
                                    (preference) => preference.rank !== rank,
                                  )
                                  .map(
                                    (preference) =>
                                      preference.scheduleOptionId,
                                  )
                                  .filter(
                                    (value): value is string =>
                                      typeof value === "string",
                                  ),
                              );

                              return (
                                <label key={rank}>
                                  第{rank}希望
                                  <select
                                    value={current}
                                    onChange={(event) =>
                                      setPreference(
                                        application,
                                        offering.id,
                                        rank,
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <option value="">選択してください</option>
                                    {availableOptions.map((option) => (
                                      <option
                                        value={option.id}
                                        disabled={selectedElsewhere.has(
                                          option.id,
                                        )}
                                        key={option.id}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="validation-warning">
                            現在の設定では選択できる授業枠がありません。
                          </p>
                        )}
                      </section>
                    )}

                  <fieldset className="application-status">
                    <legend>申込状態</legend>
                    <label>
                      <input
                        type="radio"
                        name={"application-" + course.id}
                        checked={
                          application.applicationStatus === "not_applied"
                        }
                        onChange={() =>
                          dispatch({
                            type: "SET_LOTTERY_APPLICATION_STATUS",
                            payload: {
                              courseId: course.id,
                              status: "not_applied",
                            },
                          })
                        }
                      />
                      <span>未申込</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={"application-" + course.id}
                        checked={application.applicationStatus === "applied"}
                        onChange={() =>
                          dispatch({
                            type: "SET_LOTTERY_APPLICATION_STATUS",
                            payload: {
                              courseId: course.id,
                              status: "applied",
                              preferences:
                                offering.scheduleOptions &&
                                offering.scheduleOptions.length > 0
                                  ? application.preferences
                                  : [
                                      {
                                        offeringId: offering.id,
                                        scheduleOptionId: null,
                                        rank: 1,
                                      },
                                    ],
                            },
                          })
                        }
                      />
                      <span>申込済み（自分で確認）</span>
                    </label>
                  </fieldset>

                  {issues.length > 0 && (
                    <div className="validation-list" role="alert">
                      <strong>抽選内容を確認してください</strong>
                      <ul>
                        {issues.map((issue, index) => (
                          <li key={issue.code + "-" + index}>
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {contexts.length > 0 && (
          <nav className="lottery-actions" aria-label="抽選画面の移動">
            <Link className="button button--secondary" to="/plan">
              履修候補へ戻る
            </Link>
            <Link className="button button--primary" to="/lottery/results">
              抽選結果を確認する
            </Link>
          </nav>
        )}
      </div>
    </main>
  );
}
