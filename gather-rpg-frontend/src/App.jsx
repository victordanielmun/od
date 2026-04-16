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
import PracticePage from './pages/PracticePage';
import { useAuthStore } from './store/authStore';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
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
          <Route path="ai-test" element={<AdminAITester />} />
        </Route>

        {/* English Learning / Pronunciation Routes */}
        <Route path="/learn" element={
          <PrivateRoute>
            <PracticePage />
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
