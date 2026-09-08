import { useContext } from "react";
import {
  AppStateContext,
  type AppStateContextValue,
} from "./appStateContextValue";

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider.");
  }

  return context;
}
