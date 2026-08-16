import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, PlusCircle, Calendar, Clock, CheckSquare, MessageSquare, RotateCcw, CreditCard, Banknote, LogOut, Shield, Settings as SettingsIcon, CheckCircle2 } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ClientsList from './pages/ClientsList';
import ClientProfile from './pages/ClientProfile';
import InvoiceManagement from './pages/InvoiceManagement';
import CreateInvoice from './pages/CreateInvoice';
import QuotationsList from './pages/QuotationsList';
import CreateQuotation from './pages/CreateQuotation';
import ProjectsList from './pages/ProjectsList';
import ProjectDetails from './pages/ProjectDetails';
import AddStep from './pages/AddStep';
import ClientPortal from './pages/ClientPortal';
import PmPortal from './pages/PmPortal';
import SalesPortal from './pages/SalesPortal';
import ProductionPortal from './pages/ProductionPortal';
import EmployeePortal from './pages/EmployeePortal';
import RequestRevision from './pages/RequestRevision';
import TeamManagement from './pages/TeamManagement';
import Commissions from './pages/Commissions';
import Reports from './pages/Reports';
import Payroll from './pages/Payroll';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import DeadlineWorkflow from './pages/DeadlineWorkflow';
import Tasks from './pages/Tasks';
import Header from './components/Header';
import './App.css';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  if (!userStr || !token) {
    return <Navigate to="/" replace />;
  }

  try {
    const payloadBase64 = token.split('.')[1];
    const decodedJson = atob(payloadBase64);
    const decoded = JSON.parse(decodedJson);
    const exp = decoded.exp * 1000;
    if (Date.now() >= exp) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('originalAdminUser');
      return <Navigate to="/" replace />;
    }
  } catch (e) {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('originalAdminUser');
    return <Navigate to="/" replace />;
  }

  return children;
};
function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  const user = userStr ? JSON.parse(userStr) : null;
  const originalAdminStr = localStorage.getItem('originalAdminUser');

  let isAuthenticated = false;
  if (userStr && token) {
    try {
      const payloadBase64 = token.split('.')[1];
      const decodedJson = atob(payloadBase64);
      const decoded = JSON.parse(decodedJson);
      if (Date.now() < decoded.exp * 1000) {
        isAuthenticated = true;
      }
    } catch (e) {
      // invalid token
    }
  }

  const isLoginPage = location.pathname === '/';
  const isClientPortal = location.pathname.startsWith('/client-portal');
  const showSidebar = isAuthenticated && !isLoginPage && !isClientPortal;
  const showHeader = isAuthenticated && !isLoginPage && !isClientPortal;

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('originalAdminUser');
    navigate('/');
  };

  const handleExitImpersonation = () => {
    if (originalAdminStr) {
      localStorage.setItem('user', originalAdminStr);
      localStorage.removeItem('originalAdminUser');
      window.location.href = '/team';
    }
  };

  const getDashboardPath = () => {
    if (!user) return '/dashboard';
    if (user.role === 'Production') return '/production';
    if (user.role === 'Product Manager' || user.role === 'PM' || user.role === 'Project Manager') return '/pm-portal';
    if (user.role === 'Client') return '/client-portal';
    return '/dashboard';
  };

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {originalAdminStr && (
        <div style={{ background: '#ef4444', color: '#fff', padding: '0.75rem', textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', zIndex: 9999 }}>
          You are currently viewing the platform as {user?.name} ({user?.role}).
          <button onClick={handleExitImpersonation} style={{ background: '#fff', color: '#ef4444', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>
            Exit Impersonation
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {showSidebar && (
          <aside className="sidebar">
          <div className="sidebar-brand" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem 1.5rem 1rem 1.5rem' }}>
            <img src="/logo.png" alt="Adwise Labs Logo" style={{ width: '100%', maxWidth: '240px', height: 'auto', display: 'block', margin: '0 auto' }} />
          </div>
          
          <div className="sidebar-menu-title">Main Menu</div>
          <ul className="nav-links">
            <li><Link to={getDashboardPath()} className={location.pathname === getDashboardPath() ? 'active' : ''}><LayoutDashboard size={20} /> Dashboard</Link></li>
            
            {(!user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('CLIENTS'))) && (
              <li><Link to="/clients" className={`sidebar-link ${location.pathname === '/clients' ? 'active' : ''}`}><Users size={20} /> Client Management</Link></li>
            )}
            
            {(!user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('STAFF MANAGEMENT'))) && (
              <li><Link to="/team" className={`sidebar-link ${location.pathname === '/team' ? 'active' : ''}`}><Shield size={20} /> Team Management</Link></li>
            )}
            
            {(!user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('INVOICES'))) && (
              <li><Link to="/invoices" className={`sidebar-link ${location.pathname === '/invoices' ? 'active' : ''}`}><FileText size={20} /> Invoice Management</Link></li>
            )}
            
            {(!user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('INVOICES'))) && (
              <li><Link to="/quotations" className={`sidebar-link ${location.pathname.startsWith('/quotations') ? 'active' : ''}`}><FileText size={20} /> Quotations</Link></li>
            )}
            
            {(!user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('PROJECTS'))) && (
              <>
                <li><Link to="/projects" className={`sidebar-link ${location.pathname === '/projects' ? 'active' : ''}`}><PlusCircle size={20} /> Project Creation</Link></li>
                {user && user.role !== 'Client' && (location.pathname.startsWith('/projects') || location.pathname.startsWith('/tasks')) && (
                  <li className="submenu-item">
                    <Link to="/tasks" className={`sidebar-link ${location.pathname === '/tasks' ? 'active' : ''}`} style={{ paddingLeft: '3.2rem', fontSize: '0.9rem', opacity: 0.9 }}>
                      <CheckSquare size={16} /> My Tasks
                    </Link>
                  </li>
                )}
              </>
            )}

            {(!user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('DEADLINES'))) && (
              <>
                <li>
                  <Link 
                    to="/deadlines" 
                    className={location.pathname === '/deadlines' && !location.search.includes('tab=approval') ? 'active' : ''}
                  >
                    <Clock size={20} /> Deadline Workflow
                  </Link>
                </li>
                {location.pathname.startsWith('/deadlines') && (user?.role === 'Admin' || user?.role === 'Product Manager' || user?.role === 'PM' || user?.role === 'Project Manager') && (
                  <li className="submenu-item">
                    <Link to="/deadlines?tab=approval" className={`sidebar-link ${location.search.includes('tab=approval') ? 'active' : ''}`} style={{ paddingLeft: '3.2rem', fontSize: '0.9rem', opacity: 0.9 }}>
                      <CheckCircle2 size={16} /> Tasks for Approval
                    </Link>
                  </li>
                )}
              </>
            )}
            
            {(!user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('CASHBOOK'))) && (
              <li><Link to="/expenses" className={`sidebar-link ${location.pathname === '/expenses' ? 'active' : ''}`}><CreditCard size={20} /> Expenses</Link></li>
            )}
            
            {(!user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('COMMISSIONS'))) && (
              <li><Link to="/commissions" className={location.pathname.startsWith('/commissions') ? 'active' : ''}><Banknote size={20} /> Commissions</Link></li>
            )}

            {(!user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('PAYROLL'))) && (
              <li><Link to="/payroll" className={location.pathname.startsWith('/payroll') ? 'active' : ''}><Banknote size={20} /> Payroll</Link></li>
            )}
            
            {(!user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('REPORTS'))) && (
              <li><Link to="/reports" className={location.pathname.startsWith('/reports') ? 'active' : ''}><FileText size={20} /> System Reports</Link></li>
            )}

            {(!user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('SETTINGS'))) && (
              <li><Link to="/settings" className={`sidebar-link ${location.pathname.startsWith('/settings') ? 'active' : ''}`}><SettingsIcon size={20} /> Settings</Link></li>
            )}
          </ul>

          <div className="sidebar-footer" style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button 
              onClick={handleLogout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', 
                padding: '0.75rem 1rem', background: 'transparent', border: 'none', 
                color: 'var(--danger, #ef4444)', fontSize: '1rem', fontWeight: '500', 
                cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </aside>
      )}
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {showHeader && <Header />}
        <main className="main-content" style={!showSidebar ? { padding: 0, maxWidth: '100%', height: '100vh', display: 'flex', flexDirection: 'column' } : { height: 'calc(100vh - 70px)' }}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><ClientsList /></ProtectedRoute>} />
            <Route path="/clients/:id" element={<ProtectedRoute><ClientProfile /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><InvoiceManagement /></ProtectedRoute>} />
            <Route path="/invoices/new" element={<ProtectedRoute><CreateInvoice /></ProtectedRoute>} />
            <Route path="/invoices/edit/:id" element={<ProtectedRoute><CreateInvoice /></ProtectedRoute>} />
            <Route path="/quotations" element={<ProtectedRoute><QuotationsList /></ProtectedRoute>} />
            <Route path="/quotations/new" element={<ProtectedRoute><CreateQuotation /></ProtectedRoute>} />
            <Route path="/quotations/edit/:id" element={<ProtectedRoute><CreateQuotation /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ProjectsList /></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
            <Route path="/projects/:id/steps/new" element={<ProtectedRoute><AddStep /></ProtectedRoute>} />
            <Route path="/projects/:id/steps/:step_id/edit" element={<ProtectedRoute><AddStep /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/deadlines" element={<ProtectedRoute><DeadlineWorkflow /></ProtectedRoute>} />
            <Route path="/client-portal" element={<ProtectedRoute><ClientPortal /></ProtectedRoute>} />
            <Route path="/client-portal/revision/:projectId/:stepId" element={<ProtectedRoute><RequestRevision /></ProtectedRoute>} />
            <Route path="/pm" element={<ProtectedRoute><PmPortal /></ProtectedRoute>} />
            <Route path="/pm-portal" element={<ProtectedRoute><PmPortal /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><SalesPortal /></ProtectedRoute>} />
            <Route path="/production" element={<ProtectedRoute><ProductionPortal /></ProtectedRoute>} />
            <Route path="/employee/:id" element={<ProtectedRoute><EmployeePortal /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
            <Route path="/commissions" element={<ProtectedRoute><Commissions /></ProtectedRoute>} />
            <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
