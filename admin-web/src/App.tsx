import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './layouts/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { ConfigPage } from './pages/ConfigPage';
import { ServersPage } from './pages/ServersPage';
import { FilesPage } from './pages/FilesPage';
import { UsersPage } from './pages/UsersPage';
import { NewsPage } from './pages/NewsPage';
import { NewsTagsPage } from './pages/NewsTagsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AdminLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/servers" element={<ServersPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/tags" element={<NewsTagsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
