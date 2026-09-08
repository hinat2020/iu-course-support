import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  candidateCourses,
  candidateOfferings,
  registrationRules,
} from "../data/2026/coursePlanning";
import { regularLotteryData } from "../data/2026/lottery";
import {
  courseCatalog,
  courseOfferings,
} from "../data/2026/requiredTimetable";
import {
  firstSemesterElectiveCourses,
  firstSemesterRequiredCourses,
} from "../data/2026/setup";
import { calculateCap } from "../domain/cap";
import {
  formatLotteryDateTime,
  getLotteryStatusLabel,
  validateLotteryApplication,
} from "../domain/lottery";
import { buildLotteryCourseContexts } from "../domain/lotteryPlanning";
import { generateRequiredTimetable } from "../domain/requiredTimetable";
import { useAppState } from "../state/useAppState";

export function LotteryResultPage() {
  const { state, dispatch } = useAppState();
  const [winningOptionDrafts, setWinningOptionDrafts] = useState<
    Record<string, string>
  >({});
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
  const allContexts = buildLotteryCourseContexts({
    courses: selectedCourses,
    offerings: candidateOfferings,
    requiredCourses: requiredTimetable.courses,
    timetableModel,
    academicYear: state.user.academicYear,
    semester: state.user.semester,
  });
  const contexts = allContexts.filter(
    ({ course, offering }) =>
      offering.registrationMethod === "lottery" &&
      state.lotteries[course.id]?.applicationStatus === "applied",
  );
  const wonCourses = selectedCourses.filter(
    (course) => {
      const application = state.lotteries[course.id];
      return (
        application?.applicationStatus === "applied" &&
        application.resultStatus === "won"
      );
    },
  );
  const cap = calculateCap({
    firstSemester: state.firstSemester,
    firstSemesterCourses: [
      ...firstSemesterRequiredCourses,
      ...firstSemesterElectiveCourses,
    ],
    requiredSecondSemesterCourses: requiredTimetable.courses.map(
      ({ course }) => course,
    ),
    selectedCandidateCourses: selectedCourses,
    wonCandidateCourses: wonCourses,
    capLimit: registrationRules.annualCap,
  });
  const schedule = regularLotteryData.schedule;

  return (
    <main className="lottery-page">
      <div className="lottery-shell">
        <header className="lottery-header">
          <div>
            <p className="eyebrow">通常抽選</p>
            <h1>抽選結果と最終確認</h1>
            <p className="planning-subtitle">
              {timetableModel}モデル /{" "}
              {englishTrack === "advanced" ? "Advanced" : "通常"}
            </p>
          </div>
          <Link className="button button--secondary" to="/lottery">
            申込状況へ戻る
          </Link>
        </header>

        <section
          className="lottery-schedule lottery-schedule--compact"
          aria-labelledby="confirmation-heading"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Final confirmation</p>
              <h2 id="confirmation-heading">履修登録内容の最終確認期間</h2>
            </div>
          </div>
          <p className="confirmation-period">
            {formatLotteryDateTime(
              schedule.confirmationStartsAt,
              schedule.timezone,
            )}
            <span>〜</span>
            {formatLotteryDateTime(
              schedule.confirmationDeadline,
              schedule.timezone,
            )}
          </p>
          <p className="schedule-caption">
            期間外でも記録内容は変更できます。
          </p>
        </section>

        <aside className="official-notice" role="note">
          <strong>このアプリは非公式です。</strong>
          <p>
            UNIPAで抽選結果を確認して入力してください。実際の抽選申込・抽選結果・履修登録内容はUNIPAで確認してください。
          </p>
        </aside>

        <section className="cap-summary lottery-cap" aria-labelledby="result-cap">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Annual credit cap</p>
              <h2 id="result-cap">抽選結果を反映したCAP</h2>
            </div>
            <strong>{cap.limit}単位</strong>
          </div>
          {cap.confirmedAnnualCredits === null ? (
            <div className="cap-unknown">
              前期履修状況に未確認の科目があるため、現在CAPを確定できません。
            </div>
          ) : (
            <div className="cap-metrics cap-metrics--three">
              <div>
                <span>確定基礎</span>
                <strong>
                  {cap.confirmedAnnualCredits} / {cap.limit}単位
                </strong>
              </div>
              <div>
                <span>全候補に当選した場合</span>
                <strong>
                  {cap.maximumAnnualCredits} / {cap.limit}単位
                </strong>
              </div>
              <div
                className={
                  cap.resultExceeded ? "cap-metric--danger" : undefined
                }
              >
                <span>現在の当選結果</span>
                <strong>
                  {cap.resultReflectedAnnualCredits} / {cap.limit}単位
                </strong>
              </div>
            </div>
          )}
        </section>

        {contexts.length === 0 ? (
          <section className="lottery-empty">
            <h2>結果を入力する申込済み科目がありません。</h2>
            <p>抽選申込画面で申込状況を確認してください。</p>
            <Link className="button button--primary" to="/lottery">
              抽選申込を確認する
            </Link>
          </section>
        ) : (
          <section className="lottery-course-list" aria-label="抽選結果科目">
            {contexts.map(({ course, offering, scheduleEvaluation }) => {
              const application = state.lotteries[course.id];
              const availablePreferredOptions =
                scheduleEvaluation.options.filter(
                  (option) =>
                    !option.hasConflict &&
                    application.preferences.some(
                      (preference) =>
                        preference.scheduleOptionId === option.id,
                    ),
                );
              const storedWinningOptionIsAvailable =
                application.wonScheduleOptionId !== null &&
                availablePreferredOptions.some(
                  (option) =>
                    option.id === application.wonScheduleOptionId,
                );
              const selectedWinningOption =
                winningOptionDrafts[course.id] ??
                (storedWinningOptionIsAvailable
                  ? application.wonScheduleOptionId ?? ""
                  : application.resultStatus !== "won" &&
                      availablePreferredOptions.length === 1
                    ? availablePreferredOptions[0].id
                    : "");
              const requiresScheduleOption =
                offering.scheduleOptions !== undefined &&
                offering.scheduleOptions.length > 0;
              const issues = validateLotteryApplication({
                application,
                offering,
                scheduleEvaluation,
              });

              return (
                <article className="lottery-course-card" key={course.id}>
                  <div className="lottery-course-card__heading">
                    <div>
                      <span
                        className={
                          "result-badge result-badge--" +
                          (application.resultStatus ?? "pending")
                        }
                      >
                        {getLotteryStatusLabel(application)}
                      </span>
                      <h2>{course.name}</h2>
                    </div>
                    <strong>{course.credits}単位</strong>
                  </div>

                  {requiresScheduleOption && (
                    <label className="winning-option-select">
                      当選した授業枠
                      <select
                        value={selectedWinningOption}
                        onChange={(event) =>
                          setWinningOptionDrafts((current) => ({
                            ...current,
                            [course.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">選択してください</option>
                        {availablePreferredOptions.map((option) => (
                          <option value={option.id} key={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {availablePreferredOptions.length === 0 && (
                        <span className="field-help field-help--danger">
                          現在選択できる希望枠がありません。申込内容を確認してください。
                        </span>
                      )}
                    </label>
                  )}

                  <fieldset className="result-actions">
                    <legend>抽選結果</legend>
                    <button
                      className={
                        application.resultStatus === "won"
                          ? "result-choice result-choice--active"
                          : "result-choice"
                      }
                      type="button"
                      disabled={
                        requiresScheduleOption && !selectedWinningOption
                      }
                      onClick={() =>
                        dispatch({
                          type: "SET_LOTTERY_RESULT",
                          payload: {
                            courseId: course.id,
                            result: "won",
                            wonOfferingId: offering.id,
                            wonScheduleOptionId: requiresScheduleOption
                              ? selectedWinningOption
                              : null,
                          },
                        })
                      }
                    >
                      当選
                    </button>
                    <button
                      className={
                        application.resultStatus === "lost"
                          ? "result-choice result-choice--lost"
                          : "result-choice"
                      }
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "SET_LOTTERY_RESULT",
                          payload: {
                            courseId: course.id,
                            result: "lost",
                            wonOfferingId: null,
                            wonScheduleOptionId: null,
                          },
                        })
                      }
                    >
                      落選
                    </button>
                  </fieldset>

                  {application.resultStatus === "won" && (
                    <label className="confirmation-check">
                      <input
                        type="checkbox"
                        checked={
                          application.registrationConfirmation === "confirmed"
                        }
                        onChange={(event) =>
                          dispatch({
                            type: "SET_LOTTERY_REGISTRATION_CONFIRMATION",
                            payload: {
                              courseId: course.id,
                              status: event.target.checked
                                ? "confirmed"
                                : "unconfirmed",
                            },
                          })
                        }
                      />
                      <span>UNIPAの履修登録内容で確認済み</span>
                    </label>
                  )}

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

        <nav className="lottery-actions" aria-label="抽選画面の移動">
          <Link className="button button--secondary" to="/lottery">
            申込状況へ戻る
          </Link>
          <Link className="button button--primary" to="/plan">
            履修プランへ戻る
          </Link>
          <Link className="button button--secondary" to="/special">
            特殊科目を確認する
          </Link>
        </nav>
      </div>
    </main>
  );
}
