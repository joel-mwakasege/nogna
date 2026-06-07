import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TenantProvider } from './contexts/TenantContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SlugRoute } from './components/SlugRoute';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Dashboard } from './pages/Dashboard';
import { CreateCustomer } from './pages/CreateCustomer';
import { CustomerList } from './pages/CustomerList';
import { CustomerDetails } from './pages/CustomerDetails';
import { CreateDocument } from './pages/CreateDocument';
import { DocumentDetails } from './pages/DocumentDetails';
import { DocumentList } from './pages/DocumentList';
import { InvoiceList } from './pages/InvoiceList';
import { AccountsList } from './pages/AccountsList';
import Customers from './pages/Customers';
import AccountDetails from './pages/AccountDetails';
import Bank from './pages/Bank';
import Settings from './pages/Settings';
import ExpenseList from './pages/ExpenseList';
import ExpenseForm from './pages/ExpenseForm';
import DepositList from './pages/DepositList';
import DepositForm from './pages/DepositForm';
import TransferForm from './pages/TransferForm';
import Reports from './pages/Reports';
import { Trash } from './pages/Trash';
import Login from './pages/Login';
import Setup from './pages/Setup';
import CompanySettings from './pages/CompanySettings';
import SaaSAdmin from './pages/SaaSAdmin';
import UserManagement from './pages/UserManagement';
import InviteAccept from './pages/InviteAccept';
import CompanyLogin from './pages/CompanyLogin';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            {/* Root — workspace finder */}
            <Route path="/" element={<Home />} />

            {/* Platform-level routes (SaaS admin only) */}
            <Route path="/login" element={<Login />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/invite/:token" element={<InviteAccept />} />
            <Route
              path="/saas-admin"
              element={<ProtectedRoute><SaaSAdmin /></ProtectedRoute>}
            />

            {/* Company login */}
            <Route
              path="/:slug"
              element={
                <TenantProvider>
                  <CompanyLogin />
                </TenantProvider>
              }
            />

            {/* Password reset (arrives here from Supabase email link) */}
            <Route
              path="/:slug/reset-password"
              element={
                <TenantProvider>
                  <ResetPassword />
                </TenantProvider>
              }
            />

            {/* All company-scoped app pages */}
            <Route
              path="/:slug/*"
              element={
                <TenantProvider>
                  <SlugRoute>
                    <div className="min-h-screen flex flex-col">
                      <Header />
                      <div className="flex-grow">
                        <Routes>
                          <Route path="/" element={<Navigate to="dashboard" replace />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/customers" element={<Customers />} />
                          <Route path="/customers/new" element={<CreateCustomer />} />
                          <Route path="/customers/:id" element={<CustomerDetails />} />
                          <Route path="/customers/edit/:id" element={<CreateCustomer />} />
                          <Route path="/documents" element={<Navigate to="../customers" replace />} />
                          <Route path="/documents/new" element={<CreateDocument />} />
                          <Route path="/documents/:id" element={<DocumentDetails />} />
                          <Route path="/invoices" element={<Navigate to="../customers" replace />} />
                          <Route path="/bank" element={<Bank />} />
                          <Route path="/accounts" element={<Navigate to="../bank" replace />} />
                          <Route path="/accounts/:id" element={<AccountDetails />} />
                          <Route path="/transfers/new" element={<TransferForm />} />
                          <Route path="/expenses" element={<Navigate to="../bank" replace />} />
                          <Route path="/expenses/create" element={<ExpenseForm />} />
                          <Route path="/expenses/edit/:id" element={<ExpenseForm />} />
                          <Route path="/deposits" element={<Navigate to="../bank" replace />} />
                          <Route path="/deposits/create" element={<DepositForm />} />
                          <Route path="/deposits/edit/:id" element={<DepositForm />} />
                          <Route path="/reports" element={<Navigate to="../customers" replace />} />
                          <Route path="/trash" element={<Trash />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/company-settings" element={<CompanySettings />} />
                          <Route path="/user-management" element={<UserManagement />} />
                        </Routes>
                      </div>
                      <Footer />
                    </div>
                  </SlugRoute>
                </TenantProvider>
              }
            />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
