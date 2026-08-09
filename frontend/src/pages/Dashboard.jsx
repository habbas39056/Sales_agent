import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ShoppingCart, Users, Package, Banknote, MoreHorizontal } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedGoalUser, setSelectedGoalUser] = useState('all');
  const [selectedGoalMonth, setSelectedGoalMonth] = useState('current');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState('This Year');
  const [dashboardCategory, setDashboardCategory] = useState('All Categories');
  const [dashboardStartDate, setDashboardStartDate] = useState('');
  const [dashboardEndDate, setDashboardEndDate] = useState('');
  const navigate = useNavigate();

  const currentUserStr = localStorage.getItem('user');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const isAdmin = currentUser?.role === 'Admin';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        
        if (user) {
          if (user.role === 'Production') {
            navigate('/production');
            return;
          }
          if (user.role === 'Sales' || user.role === 'Sales Rep') {
            navigate('/sales');
            return;
          }
          if (user.role === 'Client') {
            navigate('/client-portal');
            return;
          }
        }

        let queryParams = '';
        if (user) {
          queryParams = `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
        }
        const requests = [
          axios.get(`/api/clients${queryParams}`),
          axios.get(`/api/projects${queryParams}`),
          axios.get(`/api/invoices${queryParams}`),
          axios.get('/api/settings')
        ];
        if (user?.role === 'Admin') {
          requests.push(axios.get('/api/users'));
        }

        const results = await Promise.all(requests);
        setClients(results[0].data);
        setProjects(results[1].data);
        setInvoices(results[2].data);
        
        const settingsRes = results[3];
        if (settingsRes && settingsRes.data) {
          if (settingsRes.data.dashboard_default_date) {
            setPerformanceFilter(settingsRes.data.dashboard_default_date);
          }
          if (settingsRes.data.dashboard_default_category) {
            setDashboardCategory(settingsRes.data.dashboard_default_category);
          }
          if (settingsRes.data.dashboard_start_date) {
            setDashboardStartDate(settingsRes.data.dashboard_start_date);
          }
          if (settingsRes.data.dashboard_end_date) {
            setDashboardEndDate(settingsRes.data.dashboard_end_date);
          }
        }

        if (results[4]) {
          setTeamMembers(results[4].data || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Apply Dashboard Category & Date Filters
  let filteredProjects = dashboardCategory === 'All Categories'
    ? projects
    : projects.filter(p => p.category === dashboardCategory);

  let filteredInvoices = dashboardCategory === 'All Categories'
    ? invoices
    : invoices.filter(inv => {
        const proj = projects.find(p => p.id === inv.project_id);
        return proj && proj.category === dashboardCategory;
      });

  if (performanceFilter === 'Custom' && (dashboardStartDate || dashboardEndDate)) {
    filteredProjects = filteredProjects.filter(p => {
      const pDateStr = new Date(p.start_date || p.created_at).toISOString().slice(0, 10);
      if (dashboardStartDate && pDateStr < dashboardStartDate) return false;
      if (dashboardEndDate && pDateStr > dashboardEndDate) return false;
      return true;
    });

    filteredInvoices = filteredInvoices.filter(inv => {
      const invDateStr = new Date(inv.issue_date || inv.created_at).toISOString().slice(0, 10);
      if (dashboardStartDate && invDateStr < dashboardStartDate) return false;
      if (dashboardEndDate && invDateStr > dashboardEndDate) return false;
      return true;
    });
  }

  const totalRevenue = filteredInvoices.reduce((sum, inv) => {
    const amount = parseFloat(inv.amount || 0);
    const balance = parseFloat(inv.balance || 0);
    return sum + (amount - balance);
  }, 0);

  const overdueInvoicesCount = filteredInvoices.filter(inv => inv.status === 'Overdue').length;

  // Aggregate Data for Performance Overview (Bar Chart)
  let performanceData = [];
  const now = new Date();
  
  if (performanceFilter === 'This Year') {
    const monthMap = { 0: 'Jan', 1: 'Feb', 2: 'Mar', 3: 'Apr', 4: 'May', 5: 'Jun', 6: 'Jul', 7: 'Aug', 8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dec' };
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      performanceData.push({
        name: monthMap[d.getMonth()],
        Sales: 0,
        Revenue: 0,
        monthInt: d.getMonth(),
        yearInt: d.getFullYear()
      });
    }

    filteredInvoices.forEach(inv => {
      if (!inv.issue_date) return;
      const d = new Date(inv.issue_date);
      const entry = performanceData.find(p => p.monthInt === d.getMonth() && p.yearInt === d.getFullYear());
      if (entry) {
        const amount = parseFloat(inv.amount || 0);
        const balance = parseFloat(inv.balance || 0);
        entry.Sales += amount;
        entry.Revenue += (amount - balance);
      }
    });
  } else if (performanceFilter === 'This Month') {
    // 4 weeks of the month
    for (let i = 1; i <= 4; i++) {
      performanceData.push({ name: `Week ${i}`, Sales: 0, Revenue: 0, weekInt: i });
    }
    filteredInvoices.forEach(inv => {
      if (!inv.issue_date) return;
      const d = new Date(inv.issue_date);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        const weekNum = Math.ceil(d.getDate() / 7);
        const entry = performanceData.find(p => p.weekInt === (weekNum > 4 ? 4 : weekNum));
        if (entry) {
          const amount = parseFloat(inv.amount || 0);
          const balance = parseFloat(inv.balance || 0);
          entry.Sales += amount;
          entry.Revenue += (amount - balance);
        }
      }
    });
  } else if (performanceFilter === 'This Week') {
    // Last 7 days
    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      performanceData.push({
        name: daysMap[d.getDay()],
        Sales: 0,
        Revenue: 0,
        dateString: d.toDateString()
      });
    }
    filteredInvoices.forEach(inv => {
      if (!inv.issue_date) return;
      const d = new Date(inv.issue_date);
      const entry = performanceData.find(p => p.dateString === d.toDateString());
      if (entry) {
        const amount = parseFloat(inv.amount || 0);
        const balance = parseFloat(inv.balance || 0);
        entry.Sales += amount;
        entry.Revenue += (amount - balance);
      }
    });
  } else if (performanceFilter === 'Custom' && (dashboardStartDate || dashboardEndDate)) {
    // Basic day-by-day aggregate for custom range
    const start = dashboardStartDate ? new Date(dashboardStartDate) : new Date(now.getFullYear(), 0, 1);
    const end = dashboardEndDate ? new Date(dashboardEndDate) : now;
    
    // Create an entry for each date with data
    const tempMap = {};
    filteredInvoices.forEach(inv => {
      if (!inv.issue_date && !inv.created_at) return;
      const d = new Date(inv.issue_date || inv.created_at);
      const dateString = d.toISOString().slice(0, 10);
      if (!tempMap[dateString]) {
        tempMap[dateString] = { name: dateString, Sales: 0, Revenue: 0, ms: d.getTime() };
      }
      const amount = parseFloat(inv.amount || 0);
      const balance = parseFloat(inv.balance || 0);
      tempMap[dateString].Sales += amount;
      tempMap[dateString].Revenue += (amount - balance);
    });
    performanceData = Object.values(tempMap).sort((a,b) => a.ms - b.ms);
  }

  // Sales Overview Radial Gauge
  const totalInvoiced = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  const paidPercentage = totalInvoiced > 0 ? Math.round((totalRevenue / totalInvoiced) * 100) : 0;
  const gaugeData = [
    { name: 'Paid', value: paidPercentage },
    { name: 'Unpaid', value: 100 - paidPercentage }
  ];

  const recentInvoices = [...filteredInvoices]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .filter(inv => inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   (inv.client_name && inv.client_name.toLowerCase().includes(searchTerm.toLowerCase())))
    .slice(0, 5);

  // Calculate Monthly Goal Stats for selected month & year
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    monthOptions.push({ val, label, year: d.getFullYear(), month: d.getMonth() });
  }

  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth();

  if (selectedGoalMonth && selectedGoalMonth !== 'current') {
    const [y, m] = selectedGoalMonth.split('-').map(Number);
    targetYear = y;
    targetMonth = m - 1;
  }

  const targetDateObj = new Date(targetYear, targetMonth, 1);
  const currentMonthName = targetDateObj.toLocaleString('en-US', { month: 'short' });
  const currentYear = targetDateObj.getFullYear();
  const monthGoalTitle = `Monthly Goal — ${currentMonthName} ${currentYear}`;

  const currentMonthInvoices = filteredInvoices.filter(inv => {
    if (!inv.issue_date && !inv.created_at) return false;
    const d = new Date(inv.issue_date || inv.created_at);
    return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  });

  const parseGoal = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  let goalTarget = 0;
  let goalReceived = 0;

  if (isAdmin) {
    if (selectedGoalUser === 'all') {
      // Overall Team Target
      goalTarget = teamMembers.reduce((sum, member) => sum + parseGoal(member.monthly_goal), 0);
      
      goalReceived = currentMonthInvoices.reduce((sum, inv) => {
        const amount = parseFloat(inv.amount || 0);
        const balance = parseFloat(inv.balance || 0);
        return sum + (amount - balance);
      }, 0);
    } else {
      // Specific Selected Team Member
      const selectedMember = teamMembers.find(m => String(m.id) === String(selectedGoalUser));
      goalTarget = parseGoal(selectedMember?.monthly_goal);
      
      const memberInvoices = currentMonthInvoices.filter(inv => 
        String(inv.agent_id) === String(selectedGoalUser) || String(inv.created_by) === String(selectedGoalUser)
      );
      
      goalReceived = memberInvoices.reduce((sum, inv) => {
        const amount = parseFloat(inv.amount || 0);
        const balance = parseFloat(inv.balance || 0);
        return sum + (amount - balance);
      }, 0);
    }
  } else {
    // Non-Admin (Sales Rep / Employee)
    goalTarget = parseGoal(currentUser?.monthly_goal);
    goalReceived = currentMonthInvoices.reduce((sum, inv) => {
      const amount = parseFloat(inv.amount || 0);
      const balance = parseFloat(inv.balance || 0);
      return sum + (amount - balance);
    }, 0);
  }

  const goalRemaining = goalTarget > 0 ? Math.max(0, goalTarget - goalReceived) : 0;
  const goalPercent = goalTarget > 0 ? Math.min(100, Math.round((goalReceived / goalTarget) * 100)) : 0;
  const isCurrentMonth = targetYear === now.getFullYear() && targetMonth === now.getMonth();
  const daysInTargetMonth = isCurrentMonth ? now.getDate() : new Date(targetYear, targetMonth + 1, 0).getDate();
  const goalAvgDaily = daysInTargetMonth > 0 ? Math.round(goalReceived / daysInTargetMonth) : 0;

  if (loading) {
    return <div className="dashboard-loading">Loading Dashboard...</div>;
  }

  return (
    <div className="dashboard-container modern-ui">
      
      {(dashboardCategory !== 'All Categories' || performanceFilter === 'Custom') && (
        <div style={{
          backgroundColor: '#e0f2fe',
          color: '#0284c7',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          fontWeight: '500',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>
            Showing Data For: 
            {dashboardCategory !== 'All Categories' && <strong> {dashboardCategory}</strong>}
            {performanceFilter === 'Custom' && <strong> [Custom Dates Active]</strong>}
          </span>
          <span style={{fontSize: '0.8rem', opacity: 0.8}}>(Configure in Settings)</span>
        </div>
      )}

      {/* Top Stat Cards Grid */}
      <div className="stats-grid-4">
        <div className="stat-card-ref primary-card">
          <div className="stat-content-ref">
            <span className="stat-title-ref">Total Revenue</span>
            <div className="stat-val-row">
              <span className="stat-number-ref">PKR {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="stat-badge-ref positive">↑ 4.9%</span>
            </div>
            <span className="stat-subtitle-ref">Last month: PKR 12,045</span>
          </div>
          <div className="stat-icon-ref icon-white">
            <Banknote size={20} />
          </div>
        </div>

        <div className="stat-card-ref">
          <div className="stat-content-ref">
            <span className="stat-title-ref">Total Clients</span>
            <div className="stat-val-row">
              <span className="stat-number-ref">{clients.length}</span>
              <span className="stat-badge-ref positive">↑ 7.5%</span>
            </div>
            <span className="stat-subtitle-ref">Last month: 89</span>
          </div>
          <div className="stat-icon-ref icon-orange">
            <Users size={20} />
          </div>
        </div>

        <div className="stat-card-ref">
          <div className="stat-content-ref">
            <span className="stat-title-ref">Total Projects</span>
            <div className="stat-val-row">
              <span className="stat-number-ref">{filteredProjects.length}</span>
              <span className="stat-badge-ref positive">On Track</span>
            </div>
          </div>
          <div className="stat-icon-ref icon-blue">
            <Package size={20} />
          </div>
        </div>

        <div className="stat-card-ref">
          <div className="stat-content-ref">
            <span className="stat-title-ref">Overdue Invoices</span>
            <div className="stat-val-row">
              <span className="stat-number-ref">{overdueInvoicesCount}</span>
              <span className="stat-badge-ref negative">- 0.0%</span>
            </div>
            <span className="stat-subtitle-ref">Last month: 2</span>
          </div>
          <div className="stat-icon-ref icon-purple">
            <ShoppingCart size={20} />
          </div>
        </div>
      </div>

      {/* Monthly Goal Progress Bar Card */}
      <div className="monthly-goal-card">
        <div className="monthly-goal-header">
          <div className="monthly-goal-title-group">
            <span className="monthly-goal-title">{monthGoalTitle}</span>
            {isAdmin && (
              <select 
                className="monthly-goal-select"
                value={selectedGoalUser}
                onChange={(e) => setSelectedGoalUser(e.target.value)}
              >
                <option value="all">Overall Team Goal</option>
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id}>{member.name} ({member.role})</option>
                ))}
              </select>
            )}
            <select
              className="monthly-goal-select"
              value={selectedGoalMonth}
              onChange={(e) => setSelectedGoalMonth(e.target.value)}
            >
              {monthOptions.map(opt => (
                <option key={opt.val} value={opt.val}>{opt.label}</option>
              ))}
            </select>
          </div>
          <span className="monthly-goal-percent">{goalPercent}%</span>
        </div>

        <div className="monthly-goal-progress-track">
          <div className="monthly-goal-progress-bar" style={{ width: `${goalPercent}%` }}></div>
        </div>

        <div className="monthly-goal-stats-row">
          <div className="monthly-goal-stat-item">
            <span className="monthly-goal-stat-label">Received:</span>
            <span className="monthly-goal-stat-value">PKR {goalReceived.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          </div>
          <div className="monthly-goal-stat-item">
            <span className="monthly-goal-stat-label">Target:</span>
            <span className="monthly-goal-stat-value">PKR {goalTarget.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          </div>
          <div className="monthly-goal-stat-item">
            <span className="monthly-goal-stat-label">Remaining:</span>
            <span className="monthly-goal-stat-value">PKR {goalRemaining.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          </div>
          <div className="monthly-goal-stat-item">
            <span className="monthly-goal-stat-label">Avg:</span>
            <span className="monthly-goal-stat-value">PKR {goalAvgDaily.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>

      {/* Middle Row Charts */}
      <div className="charts-row">
        <div className="chart-panel performance-overview">
          <div className="panel-header-ref">
            <h2>Performance Overview</h2>
            <div className="dropdown-wrapper" style={{position: 'relative'}}>
              <select 
                className="dropdown-btn-ref" 
                value={performanceFilter}
                onChange={(e) => setPerformanceFilter(e.target.value)}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer', border: 'none', background: '#f8fafc', outline: 'none' }}
              >
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="This Year">This Year</option>
              </select>
              <ChevronDown size={16} style={{position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#475569'}} />
            </div>
          </div>
          <div className="bar-chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={performanceData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => `${val/1000}k`} />
                <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="Sales" fill="#f1f5f9" radius={[6, 6, 6, 6]} barSize={40} />
                <Bar dataKey="Revenue" fill="#8b5cf6" radius={[6, 6, 6, 6]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-panel sales-overview">
          <div className="panel-header-ref">
            <h2>Sales Overview</h2>
            <button className="icon-btn-ref"><MoreHorizontal size={20} /></button>
          </div>
          <div className="gauge-container">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={gaugeData}
                  cx="50%"
                  cy="100%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="#f59e0b" />
                  <Cell fill="#fef3c7" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="gauge-label">
              <span className="gauge-percent">{paidPercentage}%</span>
              <span className="gauge-text">Revenue Collected</span>
            </div>
          </div>
          <div className="gauge-footer-stats">
            <div className="g-stat">
              <span className="g-label">Total Invoiced</span>
              <div className="g-val">
                <strong>PKR {(totalInvoiced / 1000).toFixed(1)}k</strong>
                <span className="g-badge">4.5% ↗</span>
              </div>
            </div>
            <div className="g-stat">
              <span className="g-label">Total Revenue</span>
              <div className="g-val">
                <strong>PKR {(totalRevenue / 1000).toFixed(1)}k</strong>
                <span className="g-badge dark">4.5% ↗</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row Table */}
      <div className="recent-orders-panel">
        <div className="panel-header-ref">
          <h2>Recent Invoices</h2>
          <div className="table-actions">
            <div className="search-box-ref">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search invoices..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="dropdown-btn-ref">
              Sort by <ChevronDown size={16} />
            </button>
          </div>
        </div>
        
        <div className="table-responsive-ref">
          <table className="ref-table">
            <thead>
              <tr>
                <th><input type="checkbox" /></th>
                <th>Invoice Info</th>
                <th>Invoice Id</th>
                <th>Date</th>
                <th>Client Name</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td><input type="checkbox" /></td>
                  <td>
                    <div className="info-cell">
                      <div className="info-icon"></div>
                      <span>{inv.client_name ? `Invoice for ${inv.client_name}` : 'Project Invoice'}</span>
                    </div>
                  </td>
                  <td className="fw-500">#{inv.invoice_number}</td>
                  <td>{new Date(inv.issue_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td>{inv.client_name || 'N/A'}</td>
                  <td>
                    <span className={`status-pill ${inv.status.toLowerCase()}`}>{inv.status}</span>
                  </td>
                  <td className="fw-600">PKR {parseFloat(inv.amount || 0).toFixed(2)}</td>
                </tr>
              ))}
              {recentInvoices.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-state">No recent invoices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
