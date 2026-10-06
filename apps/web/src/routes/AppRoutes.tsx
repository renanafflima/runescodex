import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "../components/auth/RequireAuth";
import { AppLayout } from "../layouts/AppLayout";
import { AdminHuntUpdateRequestsPage } from "../pages/AdminHuntUpdateRequestsPage";
import { BestiaryDetailPage } from "../pages/BestiaryDetailPage";
import { BestiaryPage } from "../pages/BestiaryPage";
import { HomePage } from "../pages/HomePage";
import { HuntDetailPage } from "../pages/HuntDetailPage";
import { HuntsPage } from "../pages/HuntsPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProfilePage } from "../pages/ProfilePage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="hunts" element={<HuntsPage />} />
        <Route path="hunts/:slug" element={<HuntDetailPage />} />
        <Route path="bestiary" element={<BestiaryPage />} />
        <Route path="bestiary/:slug" element={<BestiaryDetailPage />} />
        <Route
          path="profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route path="admin/hunt-update-requests" element={<AdminHuntUpdateRequestsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
