import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Timesheet from './components/Timesheet';
import Salary from './components/Salary';
import About from './components/About';
import { UserProvider, useUser } from './contexts/UserContext';

const ProtectedRoute = () => {
  const { user } = useUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

export default function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/timesheet" element={<Timesheet />} />
            <Route path="/salary" element={<Salary />} />
            <Route path="/about" element={<About />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}
