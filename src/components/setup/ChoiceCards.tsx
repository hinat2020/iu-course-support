type Choice<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type ChoiceCardsProps<T extends string> = {
  legend: string;
  name: string;
  value: T | null;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
  columns?: "compact" | "wide";
};

export function ChoiceCards<T extends string>({
  legend,
  name,
  value,
  choices,
  onChange,
  columns = "wide",
}: ChoiceCardsProps<T>) {
  return (
    <fieldset className="choice-fieldset">
      <legend>{legend}</legend>
      <div className={`choice-grid choice-grid--${columns}`}>
        {choices.map((choice) => (
          <label className="choice-card" key={choice.value}>
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
            />
            <span>
              <strong>{choice.label}</strong>
              {choice.description && <small>{choice.description}</small>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
