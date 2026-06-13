import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ShoppingCart, Users, Package, DollarSign, MoreHorizontal } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState('This Year');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsRes, projectsRes, invoicesRes] = await Promise.all([
          axios.get('/api/clients'),
          axios.get('/api/projects'),
          axios.get('/api/invoices')
        ]);
        setClients(clientsRes.data);
        setProjects(projectsRes.data);
        setInvoices(invoicesRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalRevenue = invoices.reduce((sum, inv) => {
    const amount = parseFloat(inv.amount || 0);
    const balance = parseFloat(inv.balance || 0);
    return sum + (amount - balance);
  }, 0);

  const overdueInvoicesCount = invoices.filter(inv => inv.status === 'Overdue').length;

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

    invoices.forEach(inv => {
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
    invoices.forEach(inv => {
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
    invoices.forEach(inv => {
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
  }

  // Sales Overview Radial Gauge
  const totalInvoiced = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  const paidPercentage = totalInvoiced > 0 ? Math.round((totalRevenue / totalInvoiced) * 100) : 0;
  const gaugeData = [
    { name: 'Paid', value: paidPercentage },
    { name: 'Unpaid', value: 100 - paidPercentage }
  ];

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .filter(inv => inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   (inv.client_name && inv.client_name.toLowerCase().includes(searchTerm.toLowerCase())))
    .slice(0, 5);

  if (loading) {
    return <div className="dashboard-loading">Loading Dashboard...</div>;
  }

  return (
    <div className="dashboard-container modern-ui">
      
      {/* Top Stat Cards Grid */}
      <div className="stats-grid-4">
        <div className="stat-card-ref primary-card">
          <div className="stat-content-ref">
            <span className="stat-title-ref">Total Revenue</span>
            <div className="stat-val-row">
              <span className="stat-number-ref">PKR {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="stat-badge-ref positive">↑ 4.9%</span>
            </div>
            <span className="stat-subtitle-ref">Last month: $12,045</span>
          </div>
          <div className="stat-icon-ref icon-white">
            <DollarSign size={20} />
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
              <span className="stat-number-ref">{projects.length}</span>
              <span className="stat-badge-ref negative">↓ 6.0%</span>
            </div>
            <span className="stat-subtitle-ref">Last month: 60</span>
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
