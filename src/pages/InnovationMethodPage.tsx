import { Link } from "react-router-dom";
import {
  candidateCourses,
  candidateOfferings,
} from "../data/2026/coursePlanning";
import {
  courseCatalog,
  courseOfferings,
} from "../data/2026/requiredTimetable";
import { specialCoursesData } from "../data/2026/specialCourses";
import {
  getOfferingSlots,
  resolveCandidateOffering,
  type ScheduledCourse,
} from "../domain/coursePlanning";
import {
  calculateInnovationMethodLectureProgress,
  evaluateInnovationMiniCourseConflicts,
  getInnovationCreditLabel,
  getInnovationMethodEnrollmentMode,
  getSpecialLotteryPhase,
  getSpecialLotteryPhaseLabel,
  type InnovationMiniCourseStatus,
} from "../domain/innovation";
import { formatLotteryDateTime } from "../domain/lottery";
import { generateRequiredTimetable } from "../domain/requiredTimetable";
import type { TimeSlot, Weekday } from "../domain/timetable";
import { useAppState } from "../state/useAppState";

const weekdayLabels: Record<Weekday, string> = {
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
};

const miniCourseStatusLabels: Record<InnovationMiniCourseStatus, string> = {
  planned: "受講予定",
  registered: "受講登録済み",
  passed: "合格",
  failed: "不合格",
};

function formatSlots(slots: readonly TimeSlot[]): string {
  return slots
    .map((slot) => weekdayLabels[slot.day] + "曜" + slot.period + "限")
    .join("・");
}

function formatCourseDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function InnovationMethodPage() {
  const { state, dispatch } = useAppState();
  const firstSemester = state.firstSemester.innovationMethod;
  const method = state.innovationMethod;
  const data = specialCoursesData.innovationMethod;
  const schedule = specialCoursesData.specialLottery.schedule;
  const enrollmentMode = getInnovationMethodEnrollmentMode(
    firstSemester.registeredInFirstSemester,
  );
  const targetCredit = getInnovationCreditLabel(method.previousEarnedCount);
  const effectiveModuleType =
    enrollmentMode === "new_second_semester"
      ? "lecture"
      : enrollmentMode === "continuation" &&
          (firstSemester.moduleType === "lecture" ||
            firstSemester.moduleType === "event")
        ? firstSemester.moduleType
        : null;
  const phase = getSpecialLotteryPhase(new Date(), schedule);
  const progress =
    targetCredit === "completed"
      ? null
      : calculateInnovationMethodLectureProgress({
          academicYear: specialCoursesData.academicYear,
          targetCredit,
          records: method.lectureModule.miniCourses,
          miniCourses: data.lecture.miniCourses,
          requiredSessionCount: data.lecture.requiredPassedSessionCount,
        });

  const existingSchedules: ScheduledCourse[] = [];
  const { timetableModel, englishTrack } = state.user;
  if (timetableModel !== null && englishTrack !== null) {
    const required = generateRequiredTimetable({
      timetableModel,
      englishTrack,
      academicYear: state.user.academicYear,
      grade: state.user.grade,
      semester: state.user.semester,
      courses: courseCatalog,
      offerings: courseOfferings,
    });
    existingSchedules.push(
      ...required.courses.map(({ course, offering }) => ({
        courseId: course.id,
        courseName: course.name,
        slots: offering.slots,
      })),
    );

    for (const course of candidateCourses) {
      const application = state.lotteries[course.id];
      if (
        application?.applicationStatus !== "applied" ||
        application.resultStatus !== "won"
      ) {
        continue;
      }
      const offering = resolveCandidateOffering({
        courseId: course.id,
        timetableModel,
        academicYear: state.user.academicYear,
        semester: state.user.semester,
        offerings: candidateOfferings,
      });
      const wonOption = offering.scheduleOptions?.find(
        (option) => option.id === application.wonScheduleOptionId,
      );
      existingSchedules.push({
        courseId: course.id,
        courseName: course.name,
        slots: wonOption?.slots ?? getOfferingSlots(offering),
      });
    }
  }

  return (
    <main className="special-page">
      <div className="special-shell">
        <header className="special-header">
          <div>
            <p className="eyebrow">特殊科目 / progress</p>
            <h1>イノベーション技法</h1>
            <p>a／bは内容の選択肢ではなく、モジュールを修得した順に付く単位区分です。</p>
          </div>
          <Link className="button button--secondary" to="/special">
            特殊科目一覧へ
          </Link>
        </header>

        <aside className="official-notice" role="note">
          <strong>このアプリは非公式です。</strong>
          <p>
            実際の申込・抽選結果・履修登録内容はUNIPAおよび大学からの案内で確認してください。
          </p>
        </aside>

        <section className="special-summary" aria-labelledby="method-credit-heading">
          <div>
            <p className="section-kicker">Credit order</p>
            <h2 id="method-credit-heading">修得順の確認</h2>
          </div>
          <fieldset className="inline-choice-group">
            <legend>これまでの修得数</legend>
            {[0, 1, 2].map((count) => (
              <label key={count}>
                <input
                  type="radio"
                  name="method-earned-count"
                  checked={method.previousEarnedCount === count}
                  onChange={() =>
                    dispatch({
                      type: "SET_INNOVATION_METHOD_PREVIOUS_EARNED_COUNT",
                      payload: count as 0 | 1 | 2,
                    })
                  }
                />
                <span>{count}単位</span>
              </label>
            ))}
          </fieldset>
          <div className="next-credit-card">
            {targetCredit === "completed" ? (
              <strong>イノベーション技法a/bは修得済みです</strong>
            ) : (
              <>
                <span>次に修得する単位</span>
                <strong>イノベーション技法{targetCredit}</strong>
              </>
            )}
          </div>
        </section>

        <section className="enrollment-state" aria-labelledby="enrollment-heading">
          <p className="section-kicker">Enrollment</p>
          <h2 id="enrollment-heading">後期の扱い</h2>
          {enrollmentMode === "continuation" && (
            <div className="state-message state-message--success">
              <strong>前期から継続</strong>
              <span>後期は自動履修登録</span>
            </div>
          )}
          {enrollmentMode === "new_second_semester" && (
            <div className="state-message">
              <strong>後期から講座系を新規申込</strong>
              <span>イベント系は後期から新規開始できません。</span>
            </div>
          )}
          {enrollmentMode === "needs_confirmation" && (
            <div className="state-message state-message--warning" role="alert">
              <strong>前期の履修登録状況を確認してください。</strong>
              <span>継続か新規申込かを判断できません。</span>
              <Link to="/setup/innovation-method">前期状況を確認する</Link>
            </div>
          )}
          {enrollmentMode === "continuation" && effectiveModuleType === null && (
            <div className="state-message state-message--warning" role="alert">
              <strong>前期のモジュール種別を確認してください。</strong>
              <span>講座系かイベント系かを判断できません。</span>
              <Link to="/setup/innovation-method">モジュールを確認する</Link>
            </div>
          )}
        </section>

        {enrollmentMode === "new_second_semester" && targetCredit !== "completed" && (
          <section className="special-workflow" aria-labelledby="method-application-heading">
            <div className="section-heading">
              <div>
                <p className="section-kicker">New application</p>
                <h2 id="method-application-heading">講座系の新規申込</h2>
              </div>
              <span className="special-phase-badge">{getSpecialLotteryPhaseLabel(phase)}</span>
            </div>
            <p>
              通常の「抽選希望登録」とは申込方法が異なります。UNIPAで案内される専用申込フォームを確認してください。
            </p>
            <dl className="special-application-dates">
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
            <p className="field-help">期限外でも記録を変更できます。</p>

            <fieldset className="inline-choice-group">
              <legend>申込状態</legend>
              <label>
                <input
                  type="radio"
                  name="method-application"
                  checked={method.newLectureApplication.applicationStatus === "not_applied"}
                  onChange={() =>
                    dispatch({
                      type: "SET_INNOVATION_METHOD_APPLICATION_STATUS",
                      payload: "not_applied",
                    })
                  }
                />
                <span>未申込</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="method-application"
                  checked={method.newLectureApplication.applicationStatus === "applied"}
                  onChange={() =>
                    dispatch({
                      type: "SET_INNOVATION_METHOD_APPLICATION_STATUS",
                      payload: "applied",
                    })
                  }
                />
                <span>申込済み（自分で確認）</span>
              </label>
            </fieldset>

            {method.newLectureApplication.applicationStatus === "applied" && (
              <div className="special-result-panel">
                <div className="result-button-row" role="group" aria-label="技法講座系の抽選結果">
                  <button
                    className={method.newLectureApplication.resultStatus === "won" ? "result-choice result-choice--active" : "result-choice"}
                    type="button"
                    onClick={() => dispatch({ type: "SET_INNOVATION_METHOD_RESULT", payload: "won" })}
                  >
                    当選
                  </button>
                  <button
                    className={method.newLectureApplication.resultStatus === "lost" ? "result-choice result-choice--lost" : "result-choice"}
                    type="button"
                    onClick={() => dispatch({ type: "SET_INNOVATION_METHOD_RESULT", payload: "lost" })}
                  >
                    落選
                  </button>
                </div>
                {method.newLectureApplication.resultStatus === "won" && (
                  <label className="confirmation-check">
                    <input
                      type="checkbox"
                      checked={method.newLectureApplication.registrationConfirmation === "confirmed"}
                      onChange={(event) =>
                        dispatch({
                          type: "SET_INNOVATION_METHOD_REGISTRATION_CONFIRMATION",
                          payload: event.target.checked ? "confirmed" : "unconfirmed",
                        })
                      }
                    />
                    <span>UNIPAの履修登録内容で確認済み</span>
                  </label>
                )}
              </div>
            )}
          </section>
        )}

        {effectiveModuleType === "lecture" && targetCredit !== "completed" && progress && (
          <section className="lecture-progress-section" aria-labelledby="lecture-progress-heading">
            <div className="progress-hero">
              <div>
                <p className="section-kicker">Passed sessions</p>
                <h2 id="lecture-progress-heading">合格した講座の授業回数</h2>
              </div>
              <strong>{progress.passedSessionCount} / {progress.requiredSessionCount}回</strong>
              <span>{progress.completed ? "8回以上に到達" : `あと${progress.remainingSessionCount}回`}</span>
            </div>
            <p className="section-description">
              受講予定・登録済み・不合格は加算しません。同一年度内の合格講座だけを集計します。
            </p>

            <div className="mini-course-grid">
              {data.lecture.miniCourses.map((course) => {
                const record = method.lectureModule.miniCourses.find(
                  (item) =>
                    item.academicYear === course.academicYear &&
                    item.miniCourseId === course.id,
                );
                const conflicts = evaluateInnovationMiniCourseConflicts(
                  course,
                  existingSchedules,
                );
                return (
                  <article className="mini-course-card" key={course.id}>
                    <div className="mini-course-card__heading">
                      <div>
                        <span className="special-badge">講座系</span>
                        <h3>{course.name}</h3>
                      </div>
                      <strong>{course.sessionCount}回</strong>
                    </div>
                    <dl>
                      <div><dt>担当者</dt><dd>{course.instructor}</dd></div>
                      <div><dt>曜日・時限</dt><dd>{formatSlots(course.slots)}</dd></div>
                      <div>
                        <dt>日程</dt>
                        <dd>
                          {course.dates
                            ? course.dates.map(formatCourseDate).join("、")
                            : (course.scheduleNote ?? "日程未確定")}
                        </dd>
                      </div>
                    </dl>
                    {conflicts.length > 0 && (
                      <div className="mini-course-warning" role="status">
                        {conflicts.map((conflict) => (
                          <p key={conflict.courseId}>{conflict.courseName}と時間割が重複します</p>
                        ))}
                      </div>
                    )}
                    <label className="mini-course-control">
                      受講状況
                      <select
                        value={record?.status ?? ""}
                        onChange={(event) =>
                          dispatch({
                            type: "SET_INNOVATION_METHOD_MINI_COURSE_STATUS",
                            payload: {
                              academicYear: course.academicYear,
                              miniCourseId: course.id,
                              status: (event.target.value || null) as InnovationMiniCourseStatus | null,
                            },
                          })
                        }
                      >
                        <option value="">未選択</option>
                        {Object.entries(miniCourseStatusLabels).map(([value, label]) => (
                          <option value={value} key={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    {record?.status === "passed" && (
                      <label className="mini-course-control">
                        単位への使用
                        <select
                          value={record.alreadyUsedForCredit ?? ""}
                          onChange={(event) =>
                            dispatch({
                              type: "SET_INNOVATION_METHOD_MINI_COURSE_CREDIT_USE",
                              payload: {
                                academicYear: course.academicYear,
                                miniCourseId: course.id,
                                alreadyUsedForCredit: (event.target.value || null) as "a" | "b" | null,
                              },
                            })
                          }
                        >
                          <option value="">まだ単位に使用していない</option>
                          <option value="a">aの取得に使用済み</option>
                          <option value="b">bの取得に使用済み</option>
                        </select>
                      </label>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {effectiveModuleType === "event" && targetCredit !== "completed" && (
          <section className="event-progress-section" aria-labelledby="event-progress-heading">
            <p className="section-kicker">Event module</p>
            <h2 id="event-progress-heading">イベント系の活動記録</h2>
            <p>前期からイベント系を登録しているため、後期も継続して記録します。</p>
            <label>
              対象イベント
              <select
                value={method.eventModule.eventId ?? ""}
                onChange={(event) =>
                  dispatch({ type: "SET_INNOVATION_METHOD_EVENT", payload: event.target.value || null })
                }
              >
                <option value="">選択してください</option>
                {data.event.events.map((event) => (
                  <option value={event.id} key={event.id}>{event.name}</option>
                ))}
              </select>
            </label>
            <label>
              自己管理用の参考時間
              <span className="event-hours-input">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={method.eventModule.estimatedHours ?? ""}
                  onChange={(event) =>
                    dispatch({
                      type: "SET_INNOVATION_METHOD_ESTIMATED_HOURS",
                      payload: event.target.value === "" ? undefined : Number(event.target.value),
                    })
                  }
                />
                <strong>/ {data.event.requiredEstimatedHours}時間</strong>
              </span>
            </label>
            <div className="event-reference-note" role="note">
              この時間は自己管理用の参考値です。正式な認定状況は大学へ確認してください。
              45時間に達しても単位取得済みとは自動判定しません。
            </div>
            {targetCredit === "b" && (
              <p className="event-role-warning" role="status">
                bをイベント系で取得する場合は、aとは異なる役割が必要です。
              </p>
            )}
          </section>
        )}

        <section className="correction-section" aria-labelledby="method-correction-heading">
          <h2 id="method-correction-heading">特殊科目Correction期間</h2>
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
          特殊科目の年間履修上限上の扱いは、公式資料・UNIPAで確認してください。Phase 5までのCAPには自動加算していません。
        </aside>
      </div>
    </main>
  );
}
