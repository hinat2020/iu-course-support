import {
  useEffect,
  useReducer,
  useRef,
  type PropsWithChildren,
} from "react";
import { loadState, saveState } from "../storage/localStorage";
import { AppStateContext } from "./appStateContextValue";
import { appReducer } from "./reducer";

export function AppStateProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(appReducer, undefined, loadState);
  const lastSavedState = useRef(state);

  useEffect(() => {
    if (Object.is(lastSavedState.current, state)) return;

    saveState(state);
    lastSavedState.current = state;
  }, [state]);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
}
