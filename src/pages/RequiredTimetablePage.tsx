import { Link, Navigate } from "react-router-dom";
import {
  courseCatalog,
  courseOfferings,
} from "../data/2026/requiredTimetable";
import { englishTrackChoices } from "../data/2026/setup";
import { generateRequiredTimetable } from "../domain/requiredTimetable";
import type { Period, TimeSlot, Weekday } from "../domain/timetable";
import { useAppState } from "../state/useAppState";

const weekdays: readonly { id: Weekday; label: string }[] = [
  { id: "mon", label: "月" },
  { id: "tue", label: "火" },
  { id: "wed", label: "水" },
  { id: "thu", label: "木" },
  { id: "fri", label: "金" },
];
const periods: readonly Period[] = [1, 2, 3, 4, 5, 6];

function formatSlots(slots: readonly TimeSlot[]): string {
  return slots
    .map((slot) => {
      const weekday = weekdays.find((day) => day.id === slot.day);
      return `${weekday?.label ?? slot.day}曜${slot.period}限`;
    })
    .join("・");
}

export function RequiredTimetablePage() {
  const { state } = useAppState();
  const { timetableModel, englishTrack } = state.user;

  if (timetableModel === null || englishTrack === null) {
    return <Navigate to="/setup" replace />;
  }

  const timetable = generateRequiredTimetable({
    timetableModel,
    englishTrack,
    academicYear: state.user.academicYear,
    grade: state.user.grade,
    semester: state.user.semester,
    courses: courseCatalog,
    offerings: courseOfferings,
  });
  const englishTrackLabel =
    englishTrackChoices.find((choice) => choice.value === englishTrack)?.label ??
    englishTrack;

  return (
    <main className="timetable-page">
      <div className="timetable-shell">
        <header className="timetable-header">
          <div>
            <p className="eyebrow">
              {state.user.academicYear}年度・{state.user.grade}年生後期
            </p>
            <h1>後期必修時間割</h1>
          </div>
          <Link className="button button--secondary" to="/setup">
            基本設定を変更
          </Link>
        </header>

        <section className="timetable-summary" aria-label="時間割の概要">
          <div>
            <span>時間割モデル</span>
            <strong>{timetable.model}モデル</strong>
          </div>
          <div>
            <span>英語クラス</span>
            <strong>{englishTrackLabel}</strong>
          </div>
          <div>
            <span>必修</span>
            <strong>{timetable.courses.length}科目</strong>
          </div>
          <div>
            <span>合計</span>
            <strong>{timetable.totalCredits}単位</strong>
          </div>
        </section>

        {englishTrack === "normal" && (
          <p className="timetable-notice" role="note">
            実際の英語クラス番号・担当教員・教室はUNIPAで確認してください。
          </p>
        )}

        <section className="timetable-section" aria-labelledby="grid-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Weekly schedule</p>
              <h2 id="grid-heading">曜日・時限</h2>
            </div>
            <span className="scroll-hint">横にスクロールできます</span>
          </div>
          <div className="timetable-scroll" tabIndex={0}>
            <table className="timetable-grid">
              <caption className="sr-only">
                {timetable.model}モデル、{englishTrackLabel}の後期必修時間割
              </caption>
              <thead>
                <tr>
                  <th scope="col">時限</th>
                  {weekdays.map((weekday) => (
                    <th scope="col" key={weekday.id}>
                      {weekday.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period}>
                    <th scope="row">{period}限</th>
                    {weekdays.map((weekday) => {
                      const cellCourses = timetable.courses.filter(
                        ({ offering }) =>
                          offering.slots.some(
                            (slot) =>
                              slot.day === weekday.id && slot.period === period,
                          ),
                      );

                      return (
                        <td key={weekday.id}>
                          {cellCourses.map(({ course, offering }) => (
                            <div
                              className="timetable-cell__course"
                              data-english={
                                offering.englishTrack !== undefined || undefined
                              }
                              key={offering.id}
                            >
                              <span>{course.name}</span>
                              {offering.englishTrack && <small>英語</small>}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="required-list" aria-labelledby="required-list-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Required courses</p>
              <h2 id="required-list-heading">必修科目一覧</h2>
            </div>
          </div>
          <div className="required-course-grid">
            {timetable.courses.map(({ course, offering }) => (
              <article className="required-course-card" key={course.id}>
                <div className="required-course-card__heading">
                  <h3>{course.name}</h3>
                  <span className="requirement-badge">必修</span>
                </div>
                <dl>
                  <div>
                    <dt>単位数</dt>
                    <dd>{course.credits}単位</dd>
                  </div>
                  <div>
                    <dt>曜日・時限</dt>
                    <dd>{formatSlots(offering.slots)}</dd>
                  </div>
                </dl>
                {offering.englishTrack === "normal" && (
                  <p className="course-note">クラス詳細はUNIPAで確認</p>
                )}
                {offering.scheduleExceptions &&
                  offering.scheduleExceptions.length > 0 && (
                    <details className="schedule-exceptions">
                      <summary>特殊日程あり</summary>
                      <ul>
                        {offering.scheduleExceptions.map((exception) => (
                          <li
                            key={`${exception.type}-${exception.startDate}-${exception.endDate}`}
                          >
                            <strong>{exception.note}</strong>
                            {exception.startDate && (
                              <span>
                                {exception.startDate}
                                {exception.endDate &&
                                  exception.endDate !== exception.startDate &&
                                  `〜${exception.endDate}`}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                <Link className="text-link" to={`/courses/${course.id}`}>
                  科目詳細を見る
                </Link>
              </article>
            ))}
          </div>
        </section>

        <div className="timetable-next-action">
          <Link className="button button--primary" to="/plan">
            選択科目を検討する
          </Link>
        </div>
      </div>
    </main>
  );
}
