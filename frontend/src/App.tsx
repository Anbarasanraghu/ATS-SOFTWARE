import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import POSPage from "./pages/POSPage";
import ProductsPage from "./pages/ProductsPage";
import InventoryPage from "./pages/InventoryPage";
import ScanStockPage from "./pages/ScanStockPage";
import PharmacyPage from "./pages/PharmacyPage";
import UpdatesPage from "./pages/UpdatesPage";
import DocumentsPage from "./pages/DocumentsPage";
import InventoryReportsPage from "./pages/InventoryReportsPage";
import BarcodeLabelsPage from "./pages/BarcodeLabelsPage";
import BillingPage from "./pages/BillingPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import NewInvoicePage from "./pages/NewInvoicePage";
import CustomersPage from "./pages/CustomersPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import ReportsPage from "./pages/ReportsPage";
import EmployeesPage from "./pages/EmployeesPage";
import LeaveRequestsPage from "./pages/LeaveRequestsPage";
import PayrollPage from "./pages/PayrollPage";
import TenantsPage from "./pages/admin/TenantsPage";
import TenantDetailPage from "./pages/admin/TenantDetailPage";
import SettingsPage from "./pages/SettingsPage";
import AssistantPage from "./pages/AssistantPage";
import TeamPage from "./pages/TeamPage";
import DashboardPage from "./pages/DashboardPage";

export default function App() {
  const { me, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>;
  if (!me) return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
  return (
    <AppShell>
      <Routes>
        <Route path="/pos"            element={<POSPage />} />
        <Route path="/inventory"      element={<InventoryPage />} />
        <Route path="/scan-stock"     element={<ScanStockPage />} />
        <Route path="/pharmacy"          element={<PharmacyPage mode="batches" />} />
        <Route path="/pharmacy/expiry"   element={<PharmacyPage mode="expiry" />} />
        <Route path="/purchases"      element={<DocumentsPage docType="purchase" />} />
        <Route path="/sales"          element={<DocumentsPage docType="sale" />} />
        <Route path="/inventory-reports" element={<InventoryReportsPage />} />
        <Route path="/barcodes"       element={<BarcodeLabelsPage />} />
        <Route path="/updates"        element={<UpdatesPage />} />
        <Route path="/products"       element={<ProductsPage />} />
        <Route path="/billing"        element={<BillingPage />} />
        <Route path="/billing/new"    element={<NewInvoicePage />} />
        <Route path="/billing/:id"    element={<InvoiceDetailPage />} />
        <Route path="/customers"      element={<CustomersPage />} />
        <Route path="/customers/:id"  element={<CustomerDetailPage />} />
        <Route path="/reports"        element={<ReportsPage />} />
        <Route path="/employees"      element={<EmployeesPage />} />
        <Route path="/leave-requests" element={<LeaveRequestsPage />} />
        <Route path="/payroll"        element={<PayrollPage />} />
        <Route path="/dashboard"           element={<DashboardPage />} />
        <Route path="/assistant"           element={<AssistantPage />} />
        <Route path="/team"                element={(me.user.is_platform_admin || ["owner", "admin"].includes(me.user.role)) ? <TeamPage /> : <Navigate to="/billing" replace />} />
        <Route path="/settings"            element={(me.user.is_platform_admin || ["owner", "admin"].includes(me.user.role)) ? <SettingsPage /> : <Navigate to="/billing" replace />} />
        {/* Platform-admin only — non-admins are bounced even via direct URL. */}
        <Route path="/admin/tenants"      element={me.user.is_platform_admin ? <TenantsPage /> : <Navigate to="/billing" replace />} />
        <Route path="/admin/tenants/:id"  element={me.user.is_platform_admin ? <TenantDetailPage /> : <Navigate to="/billing" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}
