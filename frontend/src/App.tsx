import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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

// Page animation variants — enter is easeOut, exit is easeIn for natural feel
const pageVariants = {
  initial: { opacity: 0, y: 16, scale: 0.985 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.30, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.985,
    transition: { duration: 0.18, ease: [0.55, 0, 1, 0.45] },
  },
};

// Minimal variant for users who prefer reduced motion
const reducedVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit:    { opacity: 0, transition: { duration: 0.10 } },
};

export default function App() {
  const { me, loading } = useAuth();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const variants = prefersReducedMotion ? reducedVariants : pageVariants;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-[#8A8AA0]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D0D8E8] border-t-teal-500 animate-spin" />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ width: "100%", minHeight: "100vh" }}
        >
          <Routes location={location}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AppShell>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ width: "100%", willChange: "transform, opacity" }}
        >
          <Routes location={location}>
            <Route path="/pos"               element={<POSPage />} />
            <Route path="/inventory"         element={<InventoryPage />} />
            <Route path="/scan-stock"        element={<ScanStockPage />} />
            <Route path="/pharmacy"          element={<PharmacyPage mode="batches" />} />
            <Route path="/pharmacy/expiry"   element={<PharmacyPage mode="expiry" />} />
            <Route path="/purchases"         element={<DocumentsPage docType="purchase" />} />
            <Route path="/sales"             element={<DocumentsPage docType="sale" />} />
            <Route path="/inventory-reports" element={<InventoryReportsPage />} />
            <Route path="/barcodes"          element={<BarcodeLabelsPage />} />
            <Route path="/updates"           element={<UpdatesPage />} />
            <Route path="/products"          element={<ProductsPage />} />
            <Route path="/billing"           element={<BillingPage />} />
            <Route path="/billing/new"       element={<NewInvoicePage />} />
            <Route path="/billing/:id"       element={<InvoiceDetailPage />} />
            <Route path="/customers"         element={<CustomersPage />} />
            <Route path="/customers/:id"     element={<CustomerDetailPage />} />
            <Route path="/reports"           element={<ReportsPage />} />
            <Route path="/employees"         element={<EmployeesPage />} />
            <Route path="/leave-requests"    element={<LeaveRequestsPage />} />
            <Route path="/payroll"           element={<PayrollPage />} />
            <Route path="/dashboard"         element={<DashboardPage />} />
            <Route path="/assistant"         element={<AssistantPage />} />
            <Route path="/team" element={
              (me.user.is_platform_admin || ["owner", "admin"].includes(me.user.role))
                ? <TeamPage />
                : <Navigate to="/billing" replace />
            } />
            <Route path="/settings" element={
              (me.user.is_platform_admin || ["owner", "admin"].includes(me.user.role))
                ? <SettingsPage />
                : <Navigate to="/billing" replace />
            } />
            <Route path="/admin/tenants"     element={me.user.is_platform_admin ? <TenantsPage />     : <Navigate to="/billing" replace />} />
            <Route path="/admin/tenants/:id" element={me.user.is_platform_admin ? <TenantDetailPage /> : <Navigate to="/billing" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
