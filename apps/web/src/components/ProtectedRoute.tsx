/**
 * ============================================
 *  ProtectedRoute.tsx — Auth Guard
 * ============================================
 *
 * Layout route that redirects unauthenticated
 * visitors to `/login`, remembering the page they
 * tried to open so Login can send them back.
 */

import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { pb } from "../lib/pocketbase";
import PendingDeletionPage from "../pages/PendingDeletionPage";
import SaveStatusBanner from "./SaveStatusBanner";
import SessionGuard from "./SessionGuard";
import { startDraftSync } from "../services/draftSync";
import { fetchMyDeletionRequest } from "../services/deletionService";

function ProtectedRoute() {
  const location = useLocation();
  const valid = pb.authStore.isValid;
  // Идут 14 дней до удаления аккаунта: вместо приложения — экран с отменой.
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    fetchMyDeletionRequest().then((r) => {
      if (alive) setPending(r?.scheduled_for ? String(r.scheduled_for) : null);
    });
    return () => {
      alive = false;
    };
  }, [valid]);

  // Очередь несохранённого текста: повторяет отправку, пока приложение открыто.
  useEffect(() => (valid ? startDraftSync() : undefined), [valid]);

  if (!valid) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" state={{ from }} replace />;
  }

  if (pending) return <PendingDeletionPage scheduledFor={pending} onCancelled={() => setPending(null)} />;

  return (
    <>
      <SaveStatusBanner />
      <SessionGuard />
      <Outlet />
    </>
  );
}

export default ProtectedRoute;