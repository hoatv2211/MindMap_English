import { AppStoreProvider, useAppStore } from "./state/app-store";
import { AppShell } from "./components/AppShell";
import { AgentDrawer } from "./components/AgentDrawer";
import { TodayPage } from "./pages/TodayPage";
import { LibraryPage } from "./pages/LibraryPage";
import { MindmapPage } from "./pages/MindmapPage";
import { CreateMindmapPage } from "./pages/CreateMindmapPage";
import { LearningPage } from "./pages/LearningPage";
import { ProgressPage } from "./pages/ProgressPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PracticePage } from "./pages/PracticePage";
import { ReadingPage } from "./pages/ReadingPage";
import { AuthProvider, useAuth } from "./auth/auth-context";
import { AuthPage } from "./pages/AuthPage";

function AppContent(){const auth=useAuth();const {page,agentOpen}=useAppStore();if(auth.status!=="authenticated")return <AuthPage/>;const pages={today:<TodayPage/>,library:<LibraryPage/>,mindmap:<MindmapPage/>,create:<CreateMindmapPage/>,learning:<LearningPage/>,practice:<PracticePage/>,reading:<ReadingPage/>,progress:<ProgressPage/>,settings:<SettingsPage/>};return <AppShell>{pages[page]}{agentOpen&&<AgentDrawer/>}</AppShell>}
export function App(){return <AuthProvider><AppStoreProvider><AppContent/></AppStoreProvider></AuthProvider>}

