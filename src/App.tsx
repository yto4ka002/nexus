import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { NotificationDrawer } from './components/NotificationDrawer';
import { ToastContainer } from './components/ToastContainer';
import { ConfirmDialog } from './components/ConfirmDialog';

import { HomeView } from './views/HomeView';
import { ProjectsView } from './views/ProjectsView';
import { SettingsView } from './views/SettingsView';

const MainContent: React.FC = () => {
  const { activeSection } = useApp();

  return (
    <main className="content-area" style={{ width: '100%', height: 'calc(100vh - 56px)', overflowY: 'auto' }}>
      {activeSection === 'home' && <HomeView />}
      {activeSection === 'projects' && <ProjectsView />}
      {activeSection === 'settings' && <SettingsView />}
    </main>
  );
};

export function App() {
  return (
    <AppProvider>
      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <Header />
        <MainContent />

        {/* Global Drawers & Toasts */}
        <NotificationDrawer />
        <ToastContainer />
        <ConfirmDialog />
      </div>
    </AppProvider>
  );
}

export default App;
