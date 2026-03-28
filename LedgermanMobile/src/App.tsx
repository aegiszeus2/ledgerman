import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { setAuthToken, clearAuthToken, restoreAuthToken } from './services/api';
import PINLoginScreen from './screens/PINLoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import TimeEntryScreen from './screens/TimeEntryScreen';
import ProjectsScreen from './screens/ProjectsScreen';
import PhotoUploadScreen from './screens/PhotoUploadScreen';

type Screen = 'Login' | 'Dashboard' | 'TimeEntry' | 'Projects' | 'Photos';

export default function App() {
  const [authToken, setAuthTokenLocal] = useState<string | null>(null);
  const [worker, setWorker] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('Login');
  const [isInitializing, setIsInitializing] = useState(true);

  // Restore auth token on app startup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await restoreAuthToken();
        if (token) {
          setAuthTokenLocal(token);
          setCurrentScreen('Dashboard');
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
      } finally {
        setIsInitializing(false);
      }
    };
    initAuth();
  }, []);

  const handleLoginSuccess = (token: string, workerData: any) => {
    setAuthToken(token);
    setAuthTokenLocal(token);
    setWorker(workerData);
    setCurrentScreen('Dashboard');
  };

  const handleLogout = () => {
    clearAuthToken();
    setAuthTokenLocal(null);
    setWorker(null);
    setCurrentScreen('Login');
  };

  const handleNavigate = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Login':
        return <PINLoginScreen onLoginSuccess={handleLoginSuccess} />;
      case 'Dashboard':
        return (
          <DashboardScreen
            worker={worker}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      case 'TimeEntry':
        return (
          <TimeEntryScreen
            onSuccess={() => setCurrentScreen('Dashboard')}
            onGoBack={() => setCurrentScreen('Dashboard')}
          />
        );
      case 'Projects':
        return (
          <ProjectsScreen
            onGoBack={() => setCurrentScreen('Dashboard')}
            onNavigate={handleNavigate}
          />
        );
      case 'Photos':
        return (
          <PhotoUploadScreen
            onSuccess={() => setCurrentScreen('Dashboard')}
            onGoBack={() => setCurrentScreen('Dashboard')}
          />
        );
      default:
        return <DashboardScreen worker={worker} onLogout={handleLogout} onNavigate={handleNavigate} />;
    }
  };

  return <View style={{ flex: 1 }}>{renderScreen()}</View>;
}
