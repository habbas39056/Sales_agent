import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, PlusCircle, Calendar, Clock, CheckSquare, MessageSquare, RotateCcw, DollarSign, LogOut, Shield } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ClientsList from './pages/ClientsList';
import ClientProfile from './pages/ClientProfile';
import InvoiceManagement from './pages/InvoiceManagement';
import CreateInvoice from './pages/CreateInvoice';
import ProjectsList from './pages/ProjectsList';
import ProjectDetails from './pages/ProjectDetails';
import AddStep from './pages/AddStep';
import ClientPortal from './pages/ClientPortal';
import PmPortal from './pages/PmPortal';
import SalesPortal from './pages/SalesPortal';
import ProductionPortal from './pages/ProductionPortal';
import RequestRevision from './pages/RequestRevision';
import TeamManagement from './pages/TeamManagement';
import Commissions from './pages/Commissions';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import Header from './components/Header';
import './App.css';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    return <Navigate to="/" replace />;
  }
  return children;
};
function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === '/';
  const isClientPortal = location.pathname.startsWith('/client-portal');
  const showSidebar = !isLoginPage && !isClientPortal;

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="app-container">
      {showSidebar && (
        <aside className="sidebar">
          <div className="sidebar-brand" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem 1.5rem 1rem 1.5rem' }}>
            <img src="/logo.png" alt="Adwise Labs Logo" style={{ width: '100%', maxWidth: '240px', height: 'auto', display: 'block', margin: '0 auto' }} />
          </div>
          
          <div className="sidebar-menu-title">Main Menu</div>
          <ul className="nav-links">
            <li><Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}><LayoutDashboard size={20} /> Dashboard</Link></li>
            <li><Link to="/clients" className={`sidebar-link ${location.pathname === '/clients' ? 'active' : ''}`}><Users size={20} /> Client Management</Link></li>
            <li><Link to="/team" className={`sidebar-link ${location.pathname === '/team' ? 'active' : ''}`}><Shield size={20} /> Team Management</Link></li>
            <li><Link to="/invoices" className={`sidebar-link ${location.pathname === '/invoices' ? 'active' : ''}`}><FileText size={20} /> Invoice Management</Link></li>
            <li><Link to="/projects" className={`sidebar-link ${location.pathname === '/projects' ? 'active' : ''}`}><PlusCircle size={20} /> Project Creation</Link></li>

            <li><Link to="/deadlines" className={location.pathname.startsWith('/deadlines') ? 'active' : ''}><Clock size={20} /> Deadline Workflow</Link></li>
            <li><Link to="/expenses" className={`sidebar-link ${location.pathname === '/expenses' ? 'active' : ''}`}><DollarSign size={20} /> Expenses</Link></li>
            <li><Link to="/commissions" className={location.pathname.startsWith('/commissions') ? 'active' : ''}><DollarSign size={20} /> Commissions</Link></li>
            <li><Link to="/reports" className={location.pathname.startsWith('/reports') ? 'active' : ''}><FileText size={20} /> System Reports</Link></li>
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
        {showSidebar && <Header />}
        <main className="main-content" style={!showSidebar ? { padding: 0, maxWidth: '100%', height: '100vh' } : { height: 'calc(100vh - 70px)' }}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><ClientsList /></ProtectedRoute>} />
            <Route path="/clients/:id" element={<ProtectedRoute><ClientProfile /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><InvoiceManagement /></ProtectedRoute>} />
            <Route path="/invoices/new" element={<ProtectedRoute><CreateInvoice /></ProtectedRoute>} />
            <Route path="/invoices/edit/:id" element={<ProtectedRoute><CreateInvoice /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ProjectsList /></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
            <Route path="/projects/:id/steps/new" element={<ProtectedRoute><AddStep /></ProtectedRoute>} />
            <Route path="/client-portal" element={<ProtectedRoute><ClientPortal /></ProtectedRoute>} />
            <Route path="/client-portal/revision/:projectId/:stepId" element={<ProtectedRoute><RequestRevision /></ProtectedRoute>} />
            <Route path="/pm" element={<ProtectedRoute><PmPortal /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><SalesPortal /></ProtectedRoute>} />
            <Route path="/production" element={<ProtectedRoute><ProductionPortal /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
            <Route path="/commissions" element={<ProtectedRoute><Commissions /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          </Routes>
        </main>
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
