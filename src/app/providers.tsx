import type { PropsWithChildren } from "react";
import { AppStateProvider } from "../state/AppStateContext";

export function AppProviders({ children }: PropsWithChildren) {
  return <AppStateProvider>{children}</AppStateProvider>;
}
