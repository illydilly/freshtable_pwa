import { useState, useEffect } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { IngredientsPage } from './pages/IngredientsPage';
import { RecipesPage } from './pages/RecipesPage';
import { MealDiaryPage } from './pages/MealDiaryPage';
import { NutritionPage } from './pages/NutritionPage';
import { ShoppingListPage } from './pages/ShoppingListPage';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('userName');
    if (savedUser) {
      setIsAuthenticated(true);
      setUserName(savedUser);
    }
  }, []);

  const handleLoginSuccess = (name) => {
    setIsAuthenticated(true);
    setUserName(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('userName');
    setIsAuthenticated(false);
    setUserName('');
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route 
          path="/" 
          element={<DashboardPage userName={userName} onLogout={handleLogout} />} 
        />
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/ingredients" element={<IngredientsPage />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/meal-diary" element={<MealDiaryPage />} />
        <Route path="/nutrition" element={<NutritionPage />} />
        <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
        <Route path="/alerts" element={<NotificationSettingsPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/shopping-list" element={<ShoppingListPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/recipe-recommendations" element={<RecommendationsPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
}