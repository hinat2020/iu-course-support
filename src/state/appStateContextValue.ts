import { createContext, type Dispatch } from "react";
import type { AppAction } from "./actions";
import type { AppState } from "./initialState";

export type AppStateContextValue = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

export const AppStateContext = createContext<AppStateContextValue | null>(null);
