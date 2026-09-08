import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { AppNavigation } from "../components/AppNavigation";
import { BasicSetupPage } from "../pages/BasicSetupPage";
import { CoursePlanningPage } from "../pages/CoursePlanningPage";
import { CourseDetailPage } from "../pages/CourseDetailPage";
import { DebugPage } from "../pages/DebugPage";
import { FirstSemesterElectivesPage } from "../pages/FirstSemesterElectivesPage";
import { FirstSemesterRequiredPage } from "../pages/FirstSemesterRequiredPage";
import { FinalReviewPage } from "../pages/FinalReviewPage";
import { HomePage } from "../pages/HomePage";
import { InnovationLecturePage } from "../pages/InnovationLecturePage";
import { InnovationMethodPage } from "../pages/InnovationMethodPage";
import { InnovationMethodSetupPage } from "../pages/InnovationMethodSetupPage";
import { LotteryApplicationPage } from "../pages/LotteryApplicationPage";
import { LotteryResultPage } from "../pages/LotteryResultPage";
import { RequiredTimetablePage } from "../pages/RequiredTimetablePage";
import { RootPage } from "../pages/RootPage";
import { SettingsPage } from "../pages/SettingsPage";
import { SetupCompletePage } from "../pages/SetupCompletePage";
import { SetupReviewPage } from "../pages/SetupReviewPage";
import { SpecialCoursesPage } from "../pages/SpecialCoursesPage";

export function AppRouter() {
  return (
    <HashRouter>
      <AppErrorBoundary>
        <Routes>
          <Route path="/" element={<RootPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/review" element={<FinalReviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/courses/:courseId" element={<CourseDetailPage />} />
          <Route path="/setup" element={<BasicSetupPage />} />
          <Route
            path="/setup/first-semester/required"
            element={<FirstSemesterRequiredPage />}
          />
          <Route
            path="/setup/first-semester/electives"
            element={<FirstSemesterElectivesPage />}
          />
          <Route
            path="/setup/innovation-method"
            element={<InnovationMethodSetupPage />}
          />
          <Route path="/setup/review" element={<SetupReviewPage />} />
          <Route path="/setup/complete" element={<SetupCompletePage />} />
          <Route path="/timetable" element={<RequiredTimetablePage />} />
          <Route path="/plan" element={<CoursePlanningPage />} />
          <Route path="/lottery" element={<LotteryApplicationPage />} />
          <Route path="/lottery/results" element={<LotteryResultPage />} />
          <Route path="/special" element={<SpecialCoursesPage />} />
          <Route
            path="/special/innovation-lecture"
            element={<InnovationLecturePage />}
          />
          <Route
            path="/special/innovation-method"
            element={<InnovationMethodPage />}
          />
          {import.meta.env.DEV && (
            <Route path="/debug" element={<DebugPage />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppErrorBoundary>
      <AppNavigation />
    </HashRouter>
  );
}
