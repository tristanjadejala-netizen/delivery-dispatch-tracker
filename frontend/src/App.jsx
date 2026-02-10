import { Routes, Route, Navigate } from "react-router-dom";

// Pages
import Login from "./pages/Login";
import DispatcherLayout from "./pages/DispatcherLayout";
import DispatcherOverview from "./pages/DispatcherOverview";
import DispatcherDashboard from "./pages/DispatcherDashboard"; 
import DispatcherDrivers from "./pages/DispatcherDrivers";
import DispatcherMap from "./pages/DispatcherMap";
import CreateOrder from "./pages/CreateOrder";

import DriverLayout from "./pages/DriverLayout";
import DriverHome from "./pages/DriverHome";
import DriverAssigned from "./pages/DriverAssigned";
import DriverProfile from "./pages/DriverProfile";

import AdminDrivers from "./pages/AdminDrivers";
import Register from "./pages/Register";
import CustomerDashboard from "./pages/CustomerDashboard";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CompleteSignup from "./pages/CompleteSignup";
import DispatcherReports from "./pages/DispatcherReports";
import ResetPasswordSuccess from "./pages/ResetPasswordSuccess";

function RequireAuth({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({ role, children }) {
  const savedRole = localStorage.getItem("role");
  if (!savedRole) return <Navigate to="/login" replace />;
  if (savedRole !== role) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Password reset success */}
      <Route path="/reset-success" element={<ResetPasswordSuccess />} />

      <Route path="/complete-signup" element={<CompleteSignup />} />

      <Route
        path="/customer"
        element={
          <RequireAuth>
            <RequireRole role="CUSTOMER">
              <CustomerDashboard />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* Dispatcher */}
      <Route
        path="/dispatcher"
        element={
          <RequireAuth>
            <DispatcherLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<DispatcherOverview />} />
        <Route path="deliveries" element={<DispatcherDashboard />} />
        <Route path="drivers" element={<DispatcherDrivers />} />
        <Route path="map" element={<DispatcherMap />} />
        <Route path="create" element={<CreateOrder />} />
        <Route path="reports" element={<DispatcherReports />} />
      </Route>

      {/* Driver */}
      <Route
        path="/driver"
        element={
          <RequireAuth>
            <RequireRole role="DRIVER">
              <DriverLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<DriverHome />} />
        <Route path="assigned" element={<DriverAssigned />} />
        <Route path="profile" element={<DriverProfile />} />
      </Route>

      {/* Admin */}
      <Route
        path="/admin/drivers"
        element={
          <RequireAuth>
            <RequireRole role="ADMIN">
              <AdminDrivers />
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
