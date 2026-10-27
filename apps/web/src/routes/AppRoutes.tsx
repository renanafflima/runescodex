import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAdmin } from "../components/auth/RequireAdmin";
import { PageContainer } from "../components/layout/PageContainer";
import { RequireAuth } from "../components/auth/RequireAuth";
import { RequirePremium } from "../components/auth/RequirePremium";
import { AppLayout } from "../layouts/AppLayout";
import { AdminHuntUpdateRequestsPage } from "../pages/AdminHuntUpdateRequestsPage";
import {
  AdminAnalyticsPage,
  AdminBestiaryPage,
  AdminBossesPage,
  AdminForumPage,
  AdminHuntsPage,
  AdminRankingsPage,
  AdminUserDetailPage,
  AdminUsersPage,
} from "../pages/admin/AdminCatalogPages";
import { AdminAccessPage, AdminAuditPage, AdminRewardsPage, AdminSettingsPage } from "../pages/admin/AdminOperationsPages";
import { AdminLicensesPage } from "../pages/admin/AdminLicensesPage";
import { AdminReferralsPage } from "../pages/admin/AdminReferralsPage";
import { AdminOverviewPage } from "../pages/admin/AdminOverviewPage";
import { AdminTicketDetailPage } from "../pages/admin/AdminTicketDetailPage";
import { AdminTicketsPage } from "../pages/admin/AdminTicketsPage";
import { AdminShell } from "../pages/admin/admin-ui";
import { BestiaryCreaturePage } from "../pages/BestiaryCreaturePage";
import { BestiaryDetailPage } from "../pages/BestiaryDetailPage";
import { BestiaryHuntsPage } from "../pages/BestiaryHuntsPage";
import { BestiaryPage } from "../pages/BestiaryPage";
import { BosstiaryPage } from "../pages/BosstiaryPage";
import { ForumComposePage } from "../pages/ForumComposePage";
import { ForumPage } from "../pages/ForumPage";
import { ForumThreadPage } from "../pages/ForumThreadPage";
import { CheckoutPage } from "../pages/CheckoutPage";
import { HomePage } from "../pages/HomePage";
import { HuntDetailPage } from "../pages/HuntDetailPage";
import { HuntsPage } from "../pages/HuntsPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { AccountDevices } from "../pages/AccountDevices";
import { AccountReferrals } from "../pages/AccountReferrals";
import { ProfilePage } from "../pages/ProfilePage";
import { RewardsPage } from "../pages/RewardsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route
          path="account/referrals"
          element={
            <RequireAuth>
              <PageContainer className="profile-content" size="wide">
                <AccountReferrals />
              </PageContainer>
            </RequireAuth>
          }
        />
        <Route
          path="account/devices"
          element={
            <RequireAuth>
              <PageContainer className="profile-content" size="wide">
                <AccountDevices />
              </PageContainer>
            </RequireAuth>
          }
        />
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
          <Route path="bosstiary" element={<BosstiaryPage />} />
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
          path="admin"
          element={
            <RequireAdmin>
              <AdminShell />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminOverviewPage />} />
          <Route path="tickets" element={<AdminTicketsPage />} />
          <Route path="tickets/:id" element={<AdminTicketDetailPage />} />
          <Route path="hunts" element={<AdminHuntsPage />} />
          <Route path="bestiary" element={<AdminBestiaryPage />} />
          <Route path="bosses" element={<AdminBossesPage />} />
          <Route path="forum" element={<AdminForumPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="rankings" element={<AdminRankingsPage />} />
          <Route path="contributions" element={<AdminHuntUpdateRequestsPage />} />
          <Route path="rewards" element={<AdminRewardsPage />} />
          <Route path="licenses" element={<AdminLicensesPage />} />
          <Route path="referrals" element={<AdminReferralsPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
          <Route path="access" element={<AdminAccessPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="hunt-update-requests" element={<Navigate replace to="/admin/contributions" />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
