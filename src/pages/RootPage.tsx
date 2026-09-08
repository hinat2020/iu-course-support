import { Navigate } from "react-router-dom";
import { getRootDestination } from "../state/dashboardSelectors";
import { useAppState } from "../state/useAppState";
import { WelcomePage } from "./WelcomePage";

export function RootPage() {
  const { state } = useAppState();
  const destination = getRootDestination(state.setupCompleted);

  return destination ? <Navigate to={destination} replace /> : <WelcomePage />;
}
