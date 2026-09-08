import { CourseStatusList } from "../components/setup/CourseStatusList";
import { SetupActions } from "../components/setup/SetupActions";
import { SetupLayout } from "../components/setup/SetupLayout";
import {
  firstSemesterElectiveCourses,
} from "../data/2026/setup";
import { selectAreFirstSemesterCoursesComplete } from "../state/selectors";
import { useAppState } from "../state/useAppState";

const electiveCourseIds = firstSemesterElectiveCourses.map(
  (course) => course.id,
);

const electiveStatusChoices = [
  { value: "earned", label: "履修して修得した" },
  { value: "failed", label: "履修したが未修得" },
  { value: "not_taken", label: "履修していない" },
  { value: "unknown", label: "わからない" },
] as const;

export function FirstSemesterElectivesPage() {
  const { state } = useAppState();
  const isComplete = selectAreFirstSemesterCoursesComplete(
    state,
    electiveCourseIds,
  );

  return (
    <SetupLayout
      step={3}
      title="前期に履修した選択必修・選択科目"
      description={
        <p>
          未修得だった科目も年間履修上限の計算に関係するため、履修した科目は成績に関係なく登録してください。
        </p>
      }
      actions={
        <SetupActions
          backTo="/setup/first-semester/required"
          nextTo="/setup/innovation-method"
          nextDisabled={!isComplete}
        />
      }
    >
      <CourseStatusList
        courses={firstSemesterElectiveCourses}
        choices={electiveStatusChoices}
      />
    </SetupLayout>
  );
}
