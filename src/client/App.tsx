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

function AppContent(){const {page,agentOpen}=useAppStore();const pages={today:<TodayPage/>,library:<LibraryPage/>,mindmap:<MindmapPage/>,create:<CreateMindmapPage/>,learning:<LearningPage/>,progress:<ProgressPage/>,settings:<SettingsPage/>};return <AppShell>{pages[page]}{agentOpen&&<AgentDrawer/>}</AppShell>}
export function App(){return <AppStoreProvider><AppContent/></AppStoreProvider>}
