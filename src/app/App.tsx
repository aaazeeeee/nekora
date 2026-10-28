import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useRouteError,
} from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { AuthPage } from '../features/auth/AuthPage';
const WorkspaceLayout = lazy(() =>
  import('../features/documents/WorkspaceLayout').then((module) => ({
    default: module.WorkspaceLayout,
  })),
);
const Dashboard = lazy(() =>
  import('../features/documents/Dashboard').then((module) => ({
    default: module.Dashboard,
  })),
);
const EditorPage = lazy(() =>
  import('../features/editor/EditorPage').then((module) => ({
    default: module.EditorPage,
  })),
);
function Protected() {
  const { session, loading, error } = useAuth();
  if (loading)
    return (
      <main className="page-state" role="status">
        <LoaderCircle className="spin" />
        Opening your workspace…
      </main>
    );
  if (!session)
    return (
      <>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <AuthPage />
      </>
    );
  return (
    <Suspense
      fallback={
        <main className="page-state" role="status">
          <LoaderCircle className="spin" />
          Loading workspace…
        </main>
      }
    >
      <Outlet />
    </Suspense>
  );
}
function RouteError() {
  useRouteError();
  return (
    <main className="page-state">
      <h1>Something interrupted your workspace.</h1>
      <p>Your saved documents are safe. Reload to try again.</p>
      <a href="/">Return to workspace</a>
    </main>
  );
}
const router = createBrowserRouter([
  {
    element: <Protected />,
    errorElement: <RouteError />,
    children: [
      {
        element: <WorkspaceLayout />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/documents/:id', element: <EditorPage /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
