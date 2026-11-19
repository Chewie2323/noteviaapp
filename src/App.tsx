import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider, useAuthState } from '@/lib/app';
import { auth, isSeeded, MODE } from '@/lib/backend';
import { TooltipProvider } from '@/components/ui/misc';
import { Layout } from '@/components/Layout';
import { FullLogo } from '@/components/common';
import { Button } from '@/components/ui/button';
import Landing from '@/pages/Landing';
import { Login, Register, ResetPassword, AcceptInvite } from '@/pages/Auth';
import { Privacy, Terms, Contact } from '@/pages/Legal';
import Home from '@/pages/Home';
import Workspace from '@/pages/Workspace';
import Notebooks from '@/pages/Notebooks';
import Documents from '@/pages/Documents';
import Classes, { ClassroomDetail } from '@/pages/Classes';
import Resources from '@/pages/Resources';
import Assignments, { AssignmentDetail } from '@/pages/Assignments';
import Calendar from '@/pages/Calendar';
import { SharedWithMe, Favourites, Downloads, RecycleBin, SettingsPage } from '@/pages/Personal';
import Admin from '@/pages/Admin';

const NotebookEditor = lazy(() => import('@/pages/NotebookEditor'));
const WhiteboardEditor = lazy(() => import('@/pages/WhiteboardEditor'));
const PdfAnnotator = lazy(() => import('@/pages/PdfAnnotator'));
const PageEditor = lazy(() => import('@/pages/PageEditor'));
const Split = lazy(() => import('@/pages/Split'));
const Router = import.meta.env.VITE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter;

export function Loading({ label }: { label?: string }) {
  return (
    <div className="grid h-[100dvh] place-items-center bg-background">
      <div className="flex flex-col items-center gap-5">
        <FullLogo width={190} className="animate-pulse" />
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(MODE === 'supabase');
  useEffect(() => {
    if (MODE !== 'demo') return;
    (async () => { if (!(await isSeeded())) { const { seedDemo } = await import('@/lib/seed'); await seedDemo(); } setReady(true); })();
  }, []);
  if (!ready) return <Loading label="Preparing the demo workspace…" />;
  return <TooltipProvider delayDuration={300}><Router><Inner /></Router></TooltipProvider>;
}

function RequireAuth({ user }: { user: any }) {
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (user.disabled) return (
    <div className="grid h-[100dvh] place-items-center bg-background p-6 text-center"><div><FullLogo width={160} className="mx-auto mb-6" /><h1 className="text-xl font-semibold">Account suspended</h1><p className="mt-2 text-sm text-muted-foreground">Please contact your administrator.</p><Button className="mt-5" onClick={() => auth.signOut()}>Sign out</Button></div></div>
  );
  return <AppProvider user={user}><Suspense fallback={<Loading />}><Layout /></Suspense></AppProvider>;
}

function Inner() {
  const user = useAuthState();
  if (user === undefined) return <Loading />;
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/app" replace /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/app" replace /> : <Register />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/invite/:token" element={user ? <AppProvider user={user}><AcceptInvite signedIn /></AppProvider> : <AcceptInvite />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/app" element={<RequireAuth user={user} />}>
        <Route index element={<Home />} />
        <Route path="workspace" element={<Workspace />} />
        <Route path="notebooks" element={<Notebooks />} />
        <Route path="notebooks/:id" element={<NotebookEditor />} />
        <Route path="whiteboards" element={<Notebooks />} />
        <Route path="whiteboards/:id" element={<WhiteboardEditor />} />
        <Route path="documents" element={<Documents />} />
        <Route path="pdf/:id" element={<PdfAnnotator />} />
        <Route path="pages/:id" element={<PageEditor />} />
        <Route path="split" element={<Split />} />
        <Route path="classes" element={<Classes />} />
        <Route path="classes/:id" element={<ClassroomDetail />} />
        <Route path="resources" element={<Resources />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="assignments/:id" element={<AssignmentDetail />} />
        <Route path="shared" element={<SharedWithMe />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="favourites" element={<Favourites />} />
        <Route path="downloads" element={<Downloads />} />
        <Route path="bin" element={<RecycleBin />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
