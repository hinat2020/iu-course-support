import { Link, useNavigate } from "react-router-dom";

type SetupActionsProps = {
  backTo: string;
  nextTo: string;
  nextDisabled?: boolean;
  nextLabel?: string;
};

export function SetupActions({
  backTo,
  nextTo,
  nextDisabled = false,
  nextLabel = "次へ",
}: SetupActionsProps) {
  const navigate = useNavigate();

  return (
    <>
      <Link className="button button--secondary" to={backTo}>
        戻る
      </Link>
      <button
        className="button button--primary"
        type="button"
        disabled={nextDisabled}
        onClick={() => navigate(nextTo)}
      >
        {nextLabel}
      </button>
    </>
  );
}
