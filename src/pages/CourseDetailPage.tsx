import { Link, Navigate, useParams } from "react-router-dom";
import type { RequirementType } from "../domain/course";
import type { RegistrationMethod, TimeSlot, Weekday } from "../domain/timetable";
import { selectCourseDetail } from "../state/courseDetailSelector";
import { useAppState } from "../state/useAppState";

const requirementTypeLabels: Record<RequirementType, string> = {
  required: "必修",
  required_elective: "選択必修",
  elective: "選択",
};
const registrationLabels: Record<RegistrationMethod, string> = {
  automatic: "自動登録",
  lottery: "通常抽選",
  special_lottery: "特殊抽選",
  office_procedure: "窓口手続き",
};
const weekdayLabels: Record<Weekday, string> = { mon: "月", tue: "火", wed: "水", thu: "木", fri: "金" };

function formatSlots(slots: readonly TimeSlot[]) {
  return slots.length > 0
    ? slots.map((slot) => `${weekdayLabels[slot.day]}曜${slot.period}限`).join("・")
    : "未設定";
}

export function CourseDetailPage() {
  const { state } = useAppState();
  const { courseId } = useParams();
  if (!courseId) return <Navigate to="/home" replace />;

  const detail = selectCourseDetail(state, courseId);
  if (!detail) {
    return (
      <main className="course-detail-page">
        <section className="course-not-found">
          <p className="eyebrow">Course not found</p>
          <h1>科目が見つかりません</h1>
          <p>指定された科目IDは{state.user.academicYear}年度データに登録されていません。</p>
          <Link className="button button--primary" to="/home">ホームへ戻る</Link>
        </section>
      </main>
    );
  }

  const { course, offering } = detail;
  return (
    <main className="course-detail-page">
      <div className="page-shell course-detail-shell">
        <header className="page-header">
          <div>
            <p className="eyebrow">Course details</p>
            <h1>{course.name}</h1>
            <p>{course.credits}単位・{requirementTypeLabels[course.requirementType]}</p>
          </div>
          <Link className="button button--secondary" to="/home">ホームへ戻る</Link>
        </header>

        <section className="course-detail-card" aria-labelledby="course-overview-heading">
          <h2 id="course-overview-heading">科目情報</h2>
          <dl className="course-detail-facts">
            <div><dt>区分</dt><dd>{requirementTypeLabels[course.requirementType]}</dd></div>
            <div><dt>要件群</dt><dd>{detail.requirementLabels.length > 0 ? detail.requirementLabels.join(" / ") : "該当なし"}</dd></div>
            <div><dt>曜日・時限</dt><dd>{offering?.scheduleOptions?.length ? offering.scheduleOptions.map((option) => option.label).join(" / ") : formatSlots(detail.slots)}</dd></div>
            <div><dt>登録方法</dt><dd>{detail.registrationMethod ? registrationLabels[detail.registrationMethod] : "未設定"}</dd></div>
            <div><dt>現在の状態</dt><dd>{detail.currentStatus}</dd></div>
            {detail.lotteryStatus && <div><dt>抽選状態</dt><dd>{detail.lotteryStatus}</dd></div>}
          </dl>
        </section>

        {detail.cap && (
          <section className="course-detail-card" aria-labelledby="course-cap-heading">
            <h2 id="course-cap-heading">CAPへの影響</h2>
            <p>{detail.cap.creditsAfterAdding === null ? "前期状況が未確認のため計算できません。" : `候補に含めた場合 ${detail.cap.creditsAfterAdding} / ${detail.cap.limit}単位`}</p>
          </section>
        )}

        {detail.warnings.length > 0 && (
          <section className="course-detail-card" aria-labelledby="course-warnings-heading">
            <h2 id="course-warnings-heading">時間割・注意事項</h2>
            <ul>{detail.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </section>
        )}

        <section className="course-detail-card" aria-labelledby="syllabus-heading">
          <h2 id="syllabus-heading">シラバス</h2>
          <p>シラバス情報は未登録です。</p>
          <p>最新情報は公式シラバス・UNIPAで確認してください。</p>
        </section>
      </div>
    </main>
  );
}
