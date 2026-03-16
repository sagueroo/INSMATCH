import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Register from './components/Register';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('login');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('first_name');
    localStorage.removeItem('last_name');
    setIsAuthenticated(false);
    setCurrentView('login');
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (isAuthenticated) {
    return <Dashboard onLogout={handleLogout} />;
  }

  if (currentView === 'register') {
    return (
      <Register onGoToLogin={() => setCurrentView('login')} />
    );
  }

  return (
    <Login
      onLoginSuccess={handleLoginSuccess}
      onGoToRegister={() => setCurrentView('register')}
    />
  );
}

export default App;