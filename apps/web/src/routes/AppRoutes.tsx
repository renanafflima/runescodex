import { Route, Routes } from "react-router-dom";
import { RequireAdmin } from "../components/auth/RequireAdmin";
import { RequireAuth } from "../components/auth/RequireAuth";
import { RequirePremium } from "../components/auth/RequirePremium";
import { AppLayout } from "../layouts/AppLayout";
import { AdminHuntUpdateRequestsPage } from "../pages/AdminHuntUpdateRequestsPage";
import { BestiaryCreaturePage } from "../pages/BestiaryCreaturePage";
import { BestiaryDetailPage } from "../pages/BestiaryDetailPage";
import { BestiaryHuntsPage } from "../pages/BestiaryHuntsPage";
import { BestiaryPage } from "../pages/BestiaryPage";
import { ForumComposePage } from "../pages/ForumComposePage";
import { ForumPage } from "../pages/ForumPage";
import { ForumThreadPage } from "../pages/ForumThreadPage";
import { CheckoutPage } from "../pages/CheckoutPage";
import { HomePage } from "../pages/HomePage";
import { HuntDetailPage } from "../pages/HuntDetailPage";
import { HuntsPage } from "../pages/HuntsPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProfilePage } from "../pages/ProfilePage";
import { RewardsPage } from "../pages/RewardsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route
          path="checkout"
          element={
            <RequireAuth>
              <CheckoutPage />
            </RequireAuth>
          }
        />
        <Route element={<RequirePremium />}>
          <Route path="hunts" element={<HuntsPage />} />
          <Route path="hunts/:slug" element={<HuntDetailPage />} />
          <Route path="bestiary" element={<BestiaryPage />} />
          <Route path="bestiary/:slug" element={<BestiaryCreaturePage />}>
            <Route index element={<BestiaryDetailPage />} />
            <Route path="hunts" element={<BestiaryHuntsPage />} />
          </Route>
          <Route path="forum" element={<ForumPage />} />
          <Route path="rewards" element={<RewardsPage />} />
          <Route path="forum/new" element={<ForumComposePage />} />
          <Route path="forum/:id" element={<ForumThreadPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route
          path="admin/hunt-update-requests"
          element={
            <RequireAdmin>
              <AdminHuntUpdateRequestsPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
