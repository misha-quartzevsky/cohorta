/**
 * ============================================
 *  ProtectedRoute.tsx — Auth Guard
 * ============================================
 *
 * Layout route that redirects unauthenticated
 * visitors to `/login`, remembering the page they
 * tried to open so Login can send them back.
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";

import { pb } from "../lib/pocketbase";

function ProtectedRoute() {
  const location = useLocation();

  if (!pb.authStore.isValid) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" state={{ from }} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;