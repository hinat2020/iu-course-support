import type { Course } from "../../domain/course";
import type { PreviousCourseStatus } from "../../domain/user";
import { useAppState } from "../../state/useAppState";

type StatusChoice = {
  value: PreviousCourseStatus;
  label: string;
};

type CourseStatusListProps = {
  courses: readonly Course[];
  choices: readonly StatusChoice[];
};

export function CourseStatusList({
  courses,
  choices,
}: CourseStatusListProps) {
  const { state, dispatch } = useAppState();

  return (
    <div className="course-list">
      {courses.map((course) => {
        const record = state.firstSemester.courses[course.id];
        const selectedValue = record?.confirmedByUser ? record.status : null;

        return (
          <fieldset className="course-card" key={course.id}>
            <legend>
              <span>{course.name}</span>
              <small>{course.credits}単位</small>
            </legend>
            <div className="status-options">
              {choices.map((choice) => (
                <label key={choice.value}>
                  <input
                    type="radio"
                    name={`course-${course.id}`}
                    value={choice.value}
                    checked={selectedValue === choice.value}
                    onChange={() =>
                      dispatch({
                        type: "SET_PREVIOUS_COURSE_STATUS",
                        payload: {
                          courseId: course.id,
                          status: choice.value,
                        },
                      })
                    }
                  />
                  <span>{choice.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
