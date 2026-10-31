import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from '@/context/auth-context';
import { AuthLayout } from '@/components/layout/auth';
import { DashboardLayout } from '@/components/layout/dashboard';
import { ProtectedRoute } from '@/components/global/protected-route';
import { PageLoading } from '@/components/global/page-loading';
import { ErrorFallback } from '@/components/global/error-fallback';
import { ROUTES } from '@/constants/routes';
const LoginPage = lazy(() => import('@/pages/auth/login'));
const SignupPage = lazy(() => import('@/pages/auth/signup'));
const VerifyOtpPage = lazy(() => import('@/pages/auth/verify-otp'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/forgot-password'));
const DashboardPage = lazy(() => import('@/pages/dashboard'));
const NotFoundPage = lazy(() => import('@/pages/not-found'));
export function App(): React.JSX.Element {
  return <ErrorBoundary FallbackComponent={ErrorFallback}><BrowserRouter><AuthProvider>
    <Suspense fallback={<PageLoading />}><Routes>
      <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route element={<AuthLayout />}>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} /><Route path={ROUTES.SIGNUP} element={<SignupPage />} />
        <Route path={ROUTES.VERIFY_OTP} element={<VerifyOtpPage />} /><Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
      </Route>
      <Route element={<ProtectedRoute />}><Route element={<DashboardLayout />}><Route path={ROUTES.DASHBOARD} element={<DashboardPage />} /></Route></Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes></Suspense>
    <ToastContainer position="top-right" autoClose={4000} closeOnClick theme="light" />
  </AuthProvider></BrowserRouter></ErrorBoundary>;
}
