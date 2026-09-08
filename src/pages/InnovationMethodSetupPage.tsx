import { ChoiceCards } from "../components/setup/ChoiceCards";
import { SetupActions } from "../components/setup/SetupActions";
import { SetupLayout } from "../components/setup/SetupLayout";
import type {
  FirstSemesterInnovationModuleType,
  FirstSemesterInnovationRegistration,
} from "../state/actions";
import {
  firstSemesterSetupData,
  innovationMethodModuleChoices,
} from "../data/2026/setup";
import { selectInnovationMethodSetupSummary } from "../state/selectors";
import { useAppState } from "../state/useAppState";

type RegistrationChoice = "yes" | "no" | "unknown";

const registrationChoices = [
  { value: "yes", label: "はい" },
  { value: "no", label: "いいえ" },
  { value: "unknown", label: "わからない" },
] as const;

function toRegistrationValue(
  choice: RegistrationChoice,
): FirstSemesterInnovationRegistration {
  if (choice === "yes") return true;
  if (choice === "no") return false;
  return "unknown";
}

export function InnovationMethodSetupPage() {
  const { state, dispatch } = useAppState();
  const innovation = state.firstSemester.innovationMethod;
  const summary = selectInnovationMethodSetupSummary(state);
  const registrationChoice: RegistrationChoice | null =
    !innovation.confirmedByUser
      ? null
      : innovation.registeredInFirstSemester === true
        ? "yes"
        : innovation.registeredInFirstSemester === false
          ? "no"
          : "unknown";

  return (
    <SetupLayout
      step={4}
      title="イノベーション技法"
      description={<p>前期の履修登録状況を確認します。</p>}
      actions={
        <SetupActions
          backTo="/setup/first-semester/electives"
          nextTo="/setup/review"
          nextDisabled={!summary.isComplete}
        />
      }
    >
      <ChoiceCards<RegistrationChoice>
        legend={`前期に「${firstSemesterSetupData.innovationMethod.courseLabel}」を履修登録していましたか？`}
        name="innovation-registration"
        value={registrationChoice}
        choices={registrationChoices}
        onChange={(choice) =>
          dispatch({
            type: "SET_FIRST_SEMESTER_INNOVATION_REGISTRATION",
            payload: toRegistrationValue(choice),
          })
        }
      />

      {innovation.registeredInFirstSemester === true &&
        innovation.confirmedByUser && (
          <ChoiceCards<Exclude<FirstSemesterInnovationModuleType, null>>
            legend="どちらのモジュールでしたか？"
            name="innovation-module"
            value={innovation.moduleType}
            choices={innovationMethodModuleChoices}
            onChange={(payload) =>
              dispatch({
                type: "SET_FIRST_SEMESTER_INNOVATION_MODULE_TYPE",
                payload,
              })
            }
          />
        )}

      {!summary.isComplete && (
        <p className="form-hint">
          「はい」の場合はモジュールも選択してください。「わからない」も有効な回答です。
        </p>
      )}
    </SetupLayout>
  );
}
