import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, PlusCircle, Calendar, Clock, CheckSquare, MessageSquare, RotateCcw, CreditCard, Banknote, LogOut, Shield, Settings as SettingsIcon, CheckCircle2, FolderKanban, TrendingUp, FileSpreadsheet, Package, CheckCircle, Activity, PieChart, ChevronDown, Briefcase, Target } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ClientsList from './pages/ClientsList';
import LeadsManagement from './pages/LeadsManagement';
import ClientProfile from './pages/ClientProfile';
import InvoiceManagement from './pages/InvoiceManagement';
import CreateInvoice from './pages/CreateInvoice';
import QuotationsList from './pages/QuotationsList';
import CreateQuotation from './pages/CreateQuotation';
import ProjectsList from './pages/ProjectsList';
import ProjectDetails from './pages/ProjectDetails';
import ProjectManagement from './pages/ProjectManagement';
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
import ItemsList from './pages/ItemsList';
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

  const [expandedModules, setExpandedModules] = React.useState(() => {
    const path = window.location.pathname;
    return {
      users: path.startsWith('/clients') || path.startsWith('/team'),
      sales: path.startsWith('/leads'),
      operations: path.startsWith('/projects') || path.startsWith('/tasks') || path.startsWith('/project-management') || path.startsWith('/deadlines'),
      finance: path.startsWith('/invoices') || path.startsWith('/quotations') || path.startsWith('/expenses') || path.startsWith('/commissions') || path.startsWith('/payroll'),
      reports: path.startsWith('/reports')
    };
  });

  // Auto-expand module if navigating into its submodules
  React.useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/clients') || path.startsWith('/team')) {
      setExpandedModules(prev => ({ ...prev, users: true }));
    } else if (path.startsWith('/leads')) {
      setExpandedModules(prev => ({ ...prev, sales: true }));
    } else if (path.startsWith('/projects') || path.startsWith('/tasks') || path.startsWith('/project-management') || path.startsWith('/deadlines')) {
      setExpandedModules(prev => ({ ...prev, operations: true }));
    } else if (path.startsWith('/invoices') || path.startsWith('/quotations') || path.startsWith('/expenses') || path.startsWith('/commissions') || path.startsWith('/payroll')) {
      setExpandedModules(prev => ({ ...prev, finance: true }));
    } else if (path.startsWith('/reports')) {
      setExpandedModules(prev => ({ ...prev, reports: true }));
    }
  }, [location.pathname]);

  const toggleModule = (moduleKey) => {
    setExpandedModules(prev => ({ ...prev, [moduleKey]: !prev[moduleKey] }));
  };

  // Permission evaluations
  const canAccessDashboard = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('DASHBOARD'));
  const canAccessSalesPortal = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('SALES_PORTAL'));
  const canAccessPmPortal = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('PM_PORTAL'));
  const canAccessProductionPortal = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('PRODUCTION_PORTAL'));
  const canAccessClientPortal = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('CLIENT_PORTAL'));

  const canAccessClients = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('CLIENTS'));
  const canAccessTeam = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('STAFF MANAGEMENT'));
  const hasUserManagement = canAccessClients || canAccessTeam;

  const canAccessLeads = !user || user.role === 'Admin' || (user.modules_access && (user.modules_access.includes('LEADS') || user.modules_access.includes('SALES')));

  const canAccessProjectCreation = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('PROJECTS'));
  const canAccessProjectManagement = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('PROJECT_MANAGEMENT'));
  const canAccessMyTasks = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('TASKS'));
  const canAccessDeadlinesWorkflow = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('DEADLINES'));
  const canAccessDeadlinesApproval = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('DEADLINES_APPROVAL'));
  const hasOperations = canAccessProjectCreation || canAccessProjectManagement || canAccessMyTasks || canAccessDeadlinesWorkflow || canAccessDeadlinesApproval;

  const canAccessInvoiceManagement = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('INVOICES'));
  const canAccessQuotations = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('QUOTATIONS'));
  const canAccessItems = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('ITEMS'));
  const canAccessExpenses = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('CASHBOOK'));
  const canAccessFuturePayables = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('FUTURE_PAYABLES'));
  const canAccessCommissions = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('COMMISSIONS'));
  const canAccessPayroll = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('PAYROLL'));
  const hasFinance = canAccessInvoiceManagement || canAccessQuotations || canAccessItems || canAccessExpenses || canAccessFuturePayables || canAccessCommissions || canAccessPayroll;

  const canAccessReportSales = !user || user.role === 'Admin' || (user.modules_access && (user.modules_access.includes('REPORTS') || user.modules_access.includes('REPORT_SALES')));
  const canAccessReportSalesperson = !user || user.role === 'Admin' || (user.modules_access && (user.modules_access.includes('REPORTS') || user.modules_access.includes('REPORT_SALESPERSON')));
  const canAccessReportClients = !user || user.role === 'Admin' || (user.modules_access && (user.modules_access.includes('REPORTS') || user.modules_access.includes('REPORT_CLIENTS')));
  const canAccessReportTeam = !user || user.role === 'Admin' || (user.modules_access && (user.modules_access.includes('REPORTS') || user.modules_access.includes('REPORT_TEAM')));
  const canAccessReportExpenses = !user || user.role === 'Admin' || (user.modules_access && (user.modules_access.includes('REPORTS') || user.modules_access.includes('REPORT_EXPENSES')));
  const canAccessReportProfit = !user || user.role === 'Admin' || (user.modules_access && (user.modules_access.includes('REPORTS') || user.modules_access.includes('REPORT_PROFIT')));
  const canAccessReportAccounting = !user || user.role === 'Admin' || (user.modules_access && (user.modules_access.includes('REPORTS') || user.modules_access.includes('REPORT_ACCOUNTING')));
  const canAccessReportInvoicesAging = !user || user.role === 'Admin' || (user.modules_access && (user.modules_access.includes('REPORTS') || user.modules_access.includes('REPORT_INVOICES_AGING')));
  const canAccessReportCashFlow = !user || user.role === 'Admin' || (user.modules_access && (user.modules_access.includes('REPORTS') || user.modules_access.includes('REPORT_CASH_FLOW')));
  const canAccessReportRevenueConcentration = !user || user.role === 'Admin' || (user.modules_access && (user.modules_access.includes('REPORTS') || user.modules_access.includes('REPORT_REVENUE_CONCENTRATION')));

  const hasReports = canAccessReportSales || canAccessReportSalesperson || canAccessReportClients || canAccessReportTeam || canAccessReportExpenses || canAccessReportProfit || canAccessReportAccounting || canAccessReportInvoicesAging || canAccessReportCashFlow || canAccessReportRevenueConcentration;
  const hasSettings = !user || user.role === 'Admin' || (user.modules_access && user.modules_access.includes('SETTINGS'));

  // Active module checks
  const isUsersActive = location.pathname.startsWith('/clients') || location.pathname.startsWith('/team');
  const isSalesActive = location.pathname.startsWith('/leads');
  const isOperationsActive = location.pathname.startsWith('/projects') || location.pathname.startsWith('/tasks') || location.pathname.startsWith('/project-management') || location.pathname.startsWith('/deadlines');
  const isFinanceActive = location.pathname.startsWith('/invoices') || location.pathname.startsWith('/quotations') || location.pathname.startsWith('/expenses') || location.pathname.startsWith('/commissions') || location.pathname.startsWith('/payroll');
  const isReportsActive = location.pathname.startsWith('/reports');

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
          <div className="sidebar-brand" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1.25rem 1.25rem 1.25rem 1.25rem' }}>
            <img src="/logo.webp" alt="Adwise Labs" style={{ width: '100%', maxWidth: '210px', height: 'auto', display: 'block', maxHeight: '46px', objectFit: 'contain' }} />
          </div>
          
          <div className="sidebar-menu-title">Main Menu</div>
          <ul className="nav-links">
            {/* 1. Dashboard */}
            <li>
              <Link to={getDashboardPath()} className={location.pathname === getDashboardPath() ? 'active' : ''}>
                <LayoutDashboard size={20} /> Dashboard
              </Link>
            </li>
            
            {/* 2. User Management Module */}
            {hasUserManagement && (
              <li className="module-group">
                <button 
                  type="button"
                  onClick={() => toggleModule('users')}
                  className={`module-header-btn ${isUsersActive ? 'is-active' : ''}`}
                >
                  <div className="module-header-content">
                    <Users size={20} />
                    <span className="module-title">User Management</span>
                  </div>
                  <div className="module-header-right">
                    {isUsersActive && <div className="module-active-pill" />}
                    <ChevronDown size={16} className={`module-chevron ${expandedModules.users ? 'rotated' : ''}`} />
                  </div>
                </button>
                {expandedModules.users && (
                  <ul className="submodule-list">
                    {canAccessClients && (
                      <li>
                        <Link 
                          to="/clients" 
                          className={`submodule-link ${location.pathname === '/clients' ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Client Management</span>
                        </Link>
                      </li>
                    )}
                    {canAccessTeam && (
                      <li>
                        <Link 
                          to="/team" 
                          className={`submodule-link ${location.pathname === '/team' ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Team Management</span>
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            )}

            {/* Sales & Leads Module */}
            {canAccessLeads && (
              <li className="module-group">
                <button 
                  type="button"
                  onClick={() => toggleModule('sales')}
                  className={`module-header-btn ${isSalesActive ? 'is-active' : ''}`}
                >
                  <div className="module-header-content">
                    <Target size={20} />
                    <span className="module-title">Sales & Leads</span>
                  </div>
                  <div className="module-header-right">
                    {isSalesActive && <div className="module-active-pill" />}
                    <ChevronDown size={16} className={`module-chevron ${expandedModules.sales ? 'rotated' : ''}`} />
                  </div>
                </button>
                {expandedModules.sales && (
                  <ul className="submodule-list">
                    <li>
                      <Link 
                        to="/leads" 
                        className={`submodule-link ${location.pathname === '/leads' ? 'active' : ''}`}
                      >
                        <div className="submodule-dot" />
                        <span>Leads Management</span>
                      </Link>
                    </li>
                  </ul>
                )}
              </li>
            )}

            {/* 3. Operations & Projects Module */}
            {hasOperations && (
              <li className="module-group">
                <button 
                  type="button"
                  onClick={() => toggleModule('operations')}
                  className={`module-header-btn ${isOperationsActive ? 'is-active' : ''}`}
                >
                  <div className="module-header-content">
                    <Briefcase size={20} />
                    <span className="module-title">Operations & Projects</span>
                  </div>
                  <div className="module-header-right">
                    {isOperationsActive && <div className="module-active-pill" />}
                    <ChevronDown size={16} className={`module-chevron ${expandedModules.operations ? 'rotated' : ''}`} />
                  </div>
                </button>
                {expandedModules.operations && (
                  <ul className="submodule-list">
                    {canAccessProjectCreation && (
                      <li>
                        <Link 
                          to="/projects" 
                          className={`submodule-link ${location.pathname === '/projects' ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Project Creation</span>
                        </Link>
                      </li>
                    )}
                    {canAccessProjectManagement && (
                      <li>
                        <Link 
                          to="/project-management" 
                          className={`submodule-link ${location.pathname === '/project-management' ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Project Management</span>
                        </Link>
                      </li>
                    )}
                    {canAccessMyTasks && user && user.role !== 'Client' && (
                      <li>
                        <Link 
                          to="/tasks" 
                          className={`submodule-link ${location.pathname === '/tasks' ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>My Tasks</span>
                        </Link>
                      </li>
                    )}
                    {canAccessDeadlinesWorkflow && (
                      <li>
                        <Link 
                          to="/deadlines" 
                          className={`submodule-link ${location.pathname === '/deadlines' && !location.search.includes('tab=approval') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Deadline Workflow</span>
                        </Link>
                      </li>
                    )}
                    {canAccessDeadlinesApproval && (user?.role === 'Admin' || user?.role === 'Product Manager' || user?.role === 'PM' || user?.role === 'Project Manager') && (
                      <li>
                        <Link 
                          to="/deadlines?tab=approval" 
                          className={`submodule-link ${location.pathname.startsWith('/deadlines') && location.search.includes('tab=approval') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Tasks for Approval</span>
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            )}

            {/* 4. Financial Management Module */}
            {hasFinance && (
              <li className="module-group">
                <button 
                  type="button"
                  onClick={() => toggleModule('finance')}
                  className={`module-header-btn ${isFinanceActive ? 'is-active' : ''}`}
                >
                  <div className="module-header-content">
                    <CreditCard size={20} />
                    <span className="module-title">Financial Management</span>
                  </div>
                  <div className="module-header-right">
                    {isFinanceActive && <div className="module-active-pill" />}
                    <ChevronDown size={16} className={`module-chevron ${expandedModules.finance ? 'rotated' : ''}`} />
                  </div>
                </button>
                {expandedModules.finance && (
                  <ul className="submodule-list">
                    {canAccessInvoiceManagement && (
                      <li>
                        <Link 
                          to="/invoices" 
                          className={`submodule-link ${location.pathname === '/invoices' ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Invoice Management</span>
                        </Link>
                      </li>
                    )}
                    {canAccessQuotations && (
                      <li>
                        <Link 
                          to="/quotations" 
                          className={`submodule-link ${location.pathname.startsWith('/quotations') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Quotations</span>
                        </Link>
                      </li>
                    )}
                    {canAccessItems && (
                      <li>
                        <Link 
                          to="/items" 
                          className={`submodule-link ${location.pathname === '/items' ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Items Catalog</span>
                        </Link>
                      </li>
                    )}
                    {canAccessExpenses && (
                      <li>
                        <Link 
                          to="/expenses" 
                          className={`submodule-link ${location.pathname === '/expenses' && !location.search.includes('tab=future-payables') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Expenses & Ledger</span>
                        </Link>
                      </li>
                    )}
                    {canAccessFuturePayables && (
                      <li>
                        <Link 
                          to="/expenses?tab=future-payables" 
                          className={`submodule-link ${location.pathname === '/expenses' && location.search.includes('tab=future-payables') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Future Payables</span>
                        </Link>
                      </li>
                    )}
                    {canAccessCommissions && (
                      <li>
                        <Link 
                          to="/commissions" 
                          className={`submodule-link ${location.pathname.startsWith('/commissions') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Commissions</span>
                        </Link>
                      </li>
                    )}
                    {canAccessPayroll && (
                      <li>
                        <Link 
                          to="/payroll" 
                          className={`submodule-link ${location.pathname.startsWith('/payroll') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Payroll</span>
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            )}

            {/* 5. Reports & Analytics Module */}
            {hasReports && (
              <li className="module-group">
                <button 
                  type="button"
                  onClick={() => toggleModule('reports')}
                  className={`module-header-btn ${isReportsActive ? 'is-active' : ''}`}
                >
                  <div className="module-header-content">
                    <TrendingUp size={20} />
                    <span className="module-title">Reports & Analytics</span>
                  </div>
                  <div className="module-header-right">
                    {isReportsActive && <div className="module-active-pill" />}
                    <ChevronDown size={16} className={`module-chevron ${expandedModules.reports ? 'rotated' : ''}`} />
                  </div>
                </button>
                {expandedModules.reports && (
                  <ul className="submodule-list">
                    {canAccessReportSales && (
                      <li>
                        <Link 
                          to="/reports" 
                          className={`submodule-link ${location.pathname === '/reports' && (location.search === '' || location.search.includes('tab=sales')) ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Sales Reports</span>
                        </Link>
                      </li>
                    )}
                    {canAccessReportSalesperson && (
                      <li>
                        <Link 
                          to="/reports?tab=salesperson-leads" 
                          className={`submodule-link ${location.pathname === '/reports' && location.search.includes('tab=salesperson-leads') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Salesperson Performance</span>
                        </Link>
                      </li>
                    )}
                    {canAccessReportClients && (
                      <li>
                        <Link 
                          to="/reports?tab=clients" 
                          className={`submodule-link ${location.pathname === '/reports' && location.search.includes('tab=clients') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Client Reports</span>
                        </Link>
                      </li>
                    )}
                    {canAccessReportTeam && (
                      <li>
                        <Link 
                          to="/reports?tab=team" 
                          className={`submodule-link ${location.pathname === '/reports' && location.search.includes('tab=team') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Employee & Team</span>
                        </Link>
                      </li>
                    )}
                    {canAccessReportExpenses && (
                      <li>
                        <Link 
                          to="/reports?tab=expenses" 
                          className={`submodule-link ${location.pathname === '/reports' && location.search.includes('tab=expenses') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Expense Reports</span>
                        </Link>
                      </li>
                    )}
                    {canAccessReportProfit && (
                      <li>
                        <Link 
                          to="/reports?tab=profit" 
                          className={`submodule-link ${location.pathname === '/reports' && location.search.includes('tab=profit') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Expenses vs Income</span>
                        </Link>
                      </li>
                    )}
                    {canAccessReportAccounting && (
                      <li>
                        <Link 
                          to="/reports?tab=accounting" 
                          className={`submodule-link ${location.pathname === '/reports' && location.search.includes('tab=accounting') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Finance & Accounting</span>
                        </Link>
                      </li>
                    )}
                    {canAccessReportInvoicesAging && (
                      <li>
                        <Link 
                          to="/reports?tab=invoices-aging" 
                          className={`submodule-link ${location.pathname === '/reports' && location.search.includes('tab=invoices-aging') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Invoicing Aging</span>
                        </Link>
                      </li>
                    )}
                    {canAccessReportCashFlow && (
                      <li>
                        <Link 
                          to="/reports?tab=cash-flow" 
                          className={`submodule-link ${location.pathname === '/reports' && location.search.includes('tab=cash-flow') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Cash Flow</span>
                        </Link>
                      </li>
                    )}
                    {canAccessReportRevenueConcentration && (
                      <li>
                        <Link 
                          to="/reports?tab=revenue-concentration" 
                          className={`submodule-link ${location.pathname === '/reports' && location.search.includes('tab=revenue-concentration') ? 'active' : ''}`}
                        >
                          <div className="submodule-dot" />
                          <span>Revenue Concentration</span>
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            )}

            {/* 6. Settings */}
            {hasSettings && (
              <li>
                <Link to="/settings" className={`sidebar-link ${location.pathname.startsWith('/settings') ? 'active' : ''}`}>
                  <SettingsIcon size={20} /> Settings
                </Link>
              </li>
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
            <Route path="/leads" element={<ProtectedRoute><LeadsManagement /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><InvoiceManagement /></ProtectedRoute>} />
            <Route path="/invoices/new" element={<ProtectedRoute><CreateInvoice /></ProtectedRoute>} />
            <Route path="/invoices/edit/:id" element={<ProtectedRoute><CreateInvoice /></ProtectedRoute>} />
            <Route path="/quotations" element={<ProtectedRoute><QuotationsList /></ProtectedRoute>} />
            <Route path="/quotations/new" element={<ProtectedRoute><CreateQuotation /></ProtectedRoute>} />
            <Route path="/quotations/edit/:id" element={<ProtectedRoute><CreateQuotation /></ProtectedRoute>} />
            <Route path="/items" element={<ProtectedRoute><ItemsList /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ProjectsList /></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
            <Route path="/project-management" element={<ProtectedRoute><ProjectManagement /></ProtectedRoute>} />
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
