import { Link, Navigate, useParams } from "react-router-dom";
import type { RequirementType } from "../domain/course";
import type { SyllabusData } from "../domain/syllabus";
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

function syllabusValue(value: string | number | null, suffix = "") {
  return value === null || value === "" ? "未登録" : `${value}${suffix}`;
}

function SyllabusTextSection({
  heading,
  value,
  initiallyOpen = false,
}: {
  heading: string;
  value: string | null;
  initiallyOpen?: boolean;
}) {
  if (!value) return null;
  return (
    <details className="syllabus-details" open={initiallyOpen}>
      <summary>{heading}</summary>
      <div className="syllabus-copy">{value}</div>
    </details>
  );
}

function SyllabusSection({ syllabus }: { syllabus: SyllabusData }) {
  const sourcePages = syllabus.source.pages.join("、");
  return (
    <section className="course-detail-card syllabus-card" aria-labelledby="syllabus-heading">
      <div className="syllabus-heading-row">
        <div>
          <p className="section-kicker">Official source · {syllabus.academicYear}</p>
          <h2 id="syllabus-heading">シラバス</h2>
        </div>
        <span className="syllabus-source-badge">2026年度</span>
      </div>

      <p className="syllabus-official-note">
        2026年度公式シラバスをもとに表示しています。最新情報はUNIPA・大学公式資料を確認してください。このアプリは非公式です。
      </p>

      <dl className="syllabus-facts">
        <div><dt>担当教員</dt><dd>{syllabusValue(syllabus.instructor)}</dd></div>
        <div><dt>単位数</dt><dd>{syllabusValue(syllabus.credits, "単位")}</dd></div>
        <div><dt>開講学期</dt><dd>{syllabusValue(syllabus.semester)}</dd></div>
        <div><dt>授業形態</dt><dd>{syllabusValue(syllabus.classFormat)}</dd></div>
        <div><dt>科目コード</dt><dd>{syllabusValue(syllabus.courseCode)}</dd></div>
      </dl>

      <details className="syllabus-details syllabus-details--metadata">
        <summary>シラバス基本情報を詳しく見る</summary>
        <dl className="syllabus-facts syllabus-facts--secondary">
          <div><dt>シラバス上の科目名</dt><dd>{syllabus.courseName}</dd></div>
          <div><dt>配当学年</dt><dd>{syllabusValue(syllabus.grade)}</dd></div>
          <div><dt>科目分類</dt><dd>{syllabusValue(syllabus.category)}</dd></div>
          <div><dt>必修・選択の別</dt><dd>{syllabusValue(syllabus.requiredElective)}</dd></div>
          <div><dt>アクティブ・ラーニング</dt><dd>{syllabusValue(syllabus.activeLearning)}</dd></div>
        </dl>
      </details>

      <div className="syllabus-sections">
        <SyllabusTextSection heading="授業概要" value={syllabus.overview} initiallyOpen />
        <SyllabusTextSection heading="到達目標" value={syllabus.objectives} initiallyOpen />
        {syllabus.lessonPlan && syllabus.lessonPlan.length > 0 && (
          <details className="syllabus-details syllabus-plan-details">
            <summary>授業計画（{syllabus.lessonPlan.length}回）</summary>
            <ol className="syllabus-plan">
              {syllabus.lessonPlan.map((lesson, index) => (
                <li key={`${lesson.number ?? "unknown"}-${index}`}>
                  <h3>{lesson.number === null ? "回数未登録" : `第${lesson.number}回`}</h3>
                  {lesson.topic && <p className="syllabus-topic">{lesson.topic}</p>}
                  {lesson.content && <div className="syllabus-copy">{lesson.content}</div>}
                </li>
              ))}
            </ol>
          </details>
        )}
        <SyllabusTextSection heading="成績評価" value={syllabus.grading} />
        <SyllabusTextSection heading="事前・事後学習" value={syllabus.preparation} />
        <SyllabusTextSection heading="教科書" value={syllabus.textbooks} />
        <SyllabusTextSection heading="参考書" value={syllabus.references} />
        <SyllabusTextSection heading="注意事項" value={syllabus.notes} />
        <SyllabusTextSection heading="前年度からの振り返り" value={syllabus.previousYearReflection} />
      </div>

      <p className="syllabus-source">
        出典：{syllabus.source.documentName}（PDF {sourcePages}ページ）
      </p>
    </section>
  );
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

        {detail.syllabus ? (
          <SyllabusSection syllabus={detail.syllabus} />
        ) : (
          <section className="course-detail-card" aria-labelledby="syllabus-heading">
            <h2 id="syllabus-heading">シラバス</h2>
            <p>2026年度シラバスデータ未登録</p>
            <p>未登録は、科目が存在しない・開講されないことを意味しません。最新情報は公式シラバス・UNIPAで確認してください。</p>
          </section>
        )}
      </div>
    </main>
  );
}
