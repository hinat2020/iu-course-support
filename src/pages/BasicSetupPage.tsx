import { ChoiceCards } from "../components/setup/ChoiceCards";
import { SetupActions } from "../components/setup/SetupActions";
import { SetupLayout } from "../components/setup/SetupLayout";
import type { TimetableModel } from "../domain/timetable";
import type { EnglishTrack } from "../domain/user";
import {
  englishTrackChoices,
  timetableModelChoices,
} from "../data/2026/setup";
import { selectIsBasicSetupComplete } from "../state/selectors";
import { useAppState } from "../state/useAppState";

export function BasicSetupPage() {
  const { state, dispatch } = useAppState();
  const isComplete = selectIsBasicSetupComplete(state);

  return (
    <SetupLayout
      step={1}
      title="基本設定"
      description={<p>後期の履修候補を絞り込むため、2項目を選択してください。</p>}
      actions={
        <SetupActions
          backTo="/"
          nextTo="/setup/first-semester/required"
          nextDisabled={!isComplete}
        />
      }
    >
      <ChoiceCards<TimetableModel>
        legend="時間割モデル（必須）"
        name="timetable-model"
        value={state.user.timetableModel}
        choices={timetableModelChoices}
        columns="compact"
        onChange={(payload) =>
          dispatch({ type: "SET_TIMETABLE_MODEL", payload })
        }
      />
      <ChoiceCards<EnglishTrack>
        legend="英語クラス（必須）"
        name="english-track"
        value={state.user.englishTrack}
        choices={englishTrackChoices}
        onChange={(payload) =>
          dispatch({ type: "SET_ENGLISH_TRACK", payload })
        }
      />
      {!isComplete && (
        <p className="form-hint">両方を選択すると次へ進めます。</p>
      )}
    </SetupLayout>
  );
}
