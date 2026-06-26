import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ChallengeRules from './pages/resources/ChallengeRules';
import StarterKit from './pages/resources/StarterKit';
import DataPolicy from './pages/legal/DataPolicy';
import Terms from './pages/legal/Terms';
import CodeOfConduct from './pages/legal/CodeOfConduct';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { AuthLayout } from './layouts/AuthLayout';
import { GameCanvas } from './components/game/GameCanvas';
import { LobbyLayout } from './layouts/LobbyLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminMapList } from './pages/admin/AdminMapList';
import { AdminCharacters } from './pages/admin/AdminCharacters';
import { AdminNPCDefinitions } from './pages/admin/AdminNPCDefinitions';
import { AdminNPCs } from './pages/admin/AdminNPCs';
import { AdminAITester } from './pages/admin/AdminAITester';
import { AdminMissions } from './pages/admin/AdminMissions';
import { AdminItems } from './pages/admin/AdminItems';
import { AdminShops } from './pages/admin/AdminShops';
import { AdminEnemies } from './pages/admin/AdminEnemies';
import { AdminEnemyDefinitions } from './pages/admin/AdminEnemyDefinitions';
import { AdminChallenges } from './pages/admin/AdminChallenges';
import { AdminWhatsApp } from './pages/admin/AdminWhatsApp';
import PracticePage from './pages/PracticePage';
import { Dashboard } from './pages/Dashboard';
import { useAuthStore } from './store/authStore';


const PrivateRoute = ({ children }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const user = useAuthStore(state => state.user);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Force registered users (not guests) to complete companion guide onboarding
  const isGuest = user?.is_guest || user?.username?.startsWith('Guest_') || false;
  if (!isGuest && user && !user.companion_npc_id) {
    return <Navigate to="/register" replace />;
  }

  return children;
};

// Catch-all for unknown routes: send authenticated users to the dashboard and
// everyone else to login, instead of rendering a blank page.
const NotFoundRedirect = () => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/event" element={<LandingPage />} />

        {/* Resource Routes */}
        <Route path="/rules" element={<ChallengeRules />} />
        <Route path="/starter-kit" element={<StarterKit />} />

        {/* Legal Routes */}
        <Route path="/privacy" element={<DataPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/code-of-conduct" element={<CodeOfConduct />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<RegisterForm />} />
        </Route>

        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />

        <Route path="/lobby" element={
          <PrivateRoute>
            <LobbyLayout />
          </PrivateRoute>
        } />
        <Route path="/game/:roomId" element={
          <PrivateRoute>
            <GameCanvas />
          </PrivateRoute>
        } />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="maps" element={<AdminMapList />} />
          <Route path="characters" element={<AdminCharacters />} />
          <Route path="npcs" element={<AdminNPCDefinitions />} />
          <Route path="npcsprites" element={<AdminNPCs />} />
          <Route path="items" element={<AdminItems />} />
          <Route path="shops" element={<AdminShops />} />
          <Route path="missions" element={<AdminMissions />} />
          <Route path="enemies" element={<AdminEnemies />} />
          <Route path="enemy-models" element={<AdminEnemyDefinitions />} />
          <Route path="ai-test" element={<AdminAITester />} />
          <Route path="challenges" element={<AdminChallenges />} />
          <Route path="whatsapp" element={<AdminWhatsApp />} />
          {/* Unknown /admin/* subpath -> admin home instead of a blank Outlet */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* English Learning / Pronunciation Routes */}
        <Route path="/learn" element={
          <PrivateRoute>
            <PracticePage />
          </PrivateRoute>
        } />

        {/* Catch-all: unknown route -> dashboard if logged in, else login */}
        <Route path="*" element={<NotFoundRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;
