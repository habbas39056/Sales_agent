import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Banknote, User, Filter, Calendar, RotateCcw, Search } from 'lucide-react';
import Pagination from '../components/Pagination';
import './InvoiceManagement.css'; // Reuse styles

export default function Commissions() {
  const [commissions, setCommissions] = useState([]);
  const [breakdownData, setBreakdownData] = useState([]);
  const [forfeitedCommissions, setForfeitedCommissions] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('summary'); // 'summary' or 'breakdown'

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedTargetRole, setSelectedTargetRole] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    fetchSpecialists();
    fetchCommissions();
    fetchBreakdown();
    fetchForfeitedCommissions();
  }, []);

  useEffect(() => {
    fetchCommissions();
    fetchBreakdown();
    fetchForfeitedCommissions();
  }, [startDate, endDate, selectedAgent, selectedStatus, selectedTargetRole]);

  const fetchSpecialists = async () => {
    try {
      const res = await axios.get('/api/users/specialists');
      setAgentsList(res.data);
    } catch (err) {
      console.error('Failed to fetch specialists list', err);
    }
  };

  const fetchCommissions = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let url = '/api/commissions';
      const params = new URLSearchParams();

      if (user) {
        params.append('user_id', user.id);
        params.append('role', user.role);
      }
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedAgent && selectedAgent !== 'all') params.append('agent_id', selectedAgent);
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedTargetRole && selectedTargetRole !== 'all') params.append('target_role', selectedTargetRole);

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await axios.get(url);
      setCommissions(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch commissions:', error);
      setLoading(false);
    }
  };

  const fetchBreakdown = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let url = '/api/commissions/breakdown';
      const params = new URLSearchParams();

      if (user) {
        params.append('user_id', user.id);
        params.append('role', user.role);
      }
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedAgent && selectedAgent !== 'all') params.append('agent_id', selectedAgent);
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedTargetRole && selectedTargetRole !== 'all') params.append('target_role', selectedTargetRole);

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await axios.get(url);
      setBreakdownData(res.data);
    } catch (error) {
      console.error('Failed to fetch breakdown:', error);
    }
  };

  const fetchForfeitedCommissions = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let url = '/api/commissions/forfeited';
      const params = new URLSearchParams();

      if (user) {
        params.append('user_id', user.id);
        params.append('role', user.role);
      }
      
      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await axios.get(url);
      setForfeitedCommissions(res.data || []);
    } catch (error) {
      console.error('Failed to fetch forfeited commissions:', error);
    }
  };

  const handleForgiveLate = async (projectId, stepId) => {
    if (!window.confirm('Are you sure you want to forgive this late delivery and pay the commission?')) return;
    try {
      await axios.post(`/api/projects/${projectId}/steps/${stepId}/forgive-late`, { forgive: true });
      fetchCommissions();
      fetchForfeitedCommissions();
    } catch(err) {
      console.error('Failed to toggle forgive late', err);
      alert('Failed to update commission');
    }
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedAgent('all');
    setSelectedStatus('all');
    setSelectedTargetRole('all');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const filteredCommissions = commissions.filter(agent => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || 
      (agent.name && agent.name.toLowerCase().includes(term)) || 
      (agent.commission_percentage && agent.commission_percentage.toString().includes(term)) || 
      (agent.total_earned && agent.total_earned.toString().includes(term)) || 
      (agent.total_paid_out && agent.total_paid_out.toString().includes(term)) || 
      (agent.total_invoices && agent.total_invoices.toString().includes(term));
    return matchesSearch;
  });

  const filteredBreakdown = breakdownData.filter(item => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      (item.agent_name && item.agent_name.toLowerCase().includes(term)) ||
      (item.project_title && item.project_title.toLowerCase().includes(term)) ||
      (item.step_title && item.step_title.toLowerCase().includes(term)) ||
      (item.invoice_numbers && item.invoice_numbers.join(', ').toLowerCase().includes(term));
    return matchesSearch;
  });

  const currentCommissions = filteredCommissions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const currentBreakdown = filteredBreakdown.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalEarnedSum = commissions.reduce((sum, a) => sum + Number(a.total_earned || 0), 0);
  const totalPaidSum = commissions.reduce((sum, a) => sum + Number(a.total_paid_out || 0), 0);
  const totalPendingSum = commissions.reduce((sum, a) => sum + Number(a.pending_payout || 0), 0);

  return (
    <div className="invoice-management-container modern-ui">
      
      {/* 1. Metrics Cards Above */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>TOTAL EARNED</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#4f46e5', marginTop: '0.25rem' }}>PKR {totalEarnedSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>PAID OUT</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#16a34a', marginTop: '0.25rem' }}>PKR {totalPaidSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>PENDING PAYOUT</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#dc2626', marginTop: '0.25rem' }}>PKR {totalPendingSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* 2. Filter & Search Toolbar Below Cards */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1, alignItems: 'center' }}>
            {/* Search Box */}
            <div className="search-box-ref" style={{ flex: '1 1 220px', minWidth: '200px' }}>
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search by agent, invoice #, client, amount..." 
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Admin Only Filters */}
            {JSON.parse(localStorage.getItem('user') || '{}')?.role === 'Admin' && (
              <>
                {/* Role Select */}
                <select 
                  value={selectedTargetRole} 
                  onChange={(e) => {
                    setSelectedTargetRole(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', outline: 'none', color: '#334155' }}
                >
                  <option value="all">All Roles</option>
                  <option value="Sales">Sales</option>
                  <option value="Production">Production</option>
                  <option value="Project Manager">Project Manager</option>
                </select>

                {/* Agent Select */}
                <select 
                  value={selectedAgent} 
                  onChange={(e) => {
                    setSelectedAgent(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', outline: 'none', color: '#334155' }}
                >
                  <option value="all">All Agents</option>
                  {agentsList.map(a => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
                </select>
              </>
            )}

            {/* Status Select */}
            <select 
              value={selectedStatus} 
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', outline: 'none', color: '#334155' }}
            >
              <option value="all">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Overdue">Overdue</option>
            </select>

            {/* Date Range Fields */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '0.35rem 0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>From:</span>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', color: '#1e293b', outline: 'none' }}
              />
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>To:</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', color: '#1e293b', outline: 'none' }}
              />
              {(startDate || endDate) && (
                <button 
                  onClick={() => { setStartDate(''); setEndDate(''); setCurrentPage(1); }}
                  style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', marginLeft: '0.25rem' }}
                  title="Clear Date Filter"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {(startDate || endDate || selectedAgent !== 'all' || selectedStatus !== 'all' || selectedTargetRole !== 'all' || searchTerm) && (
            <button 
              onClick={resetFilters} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '20px', color: '#475569', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              <RotateCcw size={14} /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Table & Pagination */}
      <div className="recent-orders-panel">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
          <button 
            onClick={() => { setViewMode('summary'); setCurrentPage(1); }}
            style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '1rem', fontWeight: viewMode === 'summary' ? 'bold' : 'normal', color: viewMode === 'summary' ? '#4f46e5' : '#64748b', cursor: 'pointer', borderBottom: viewMode === 'summary' ? '2px solid #4f46e5' : '2px solid transparent' }}
          >
            Agent Summary
          </button>
          <button 
            onClick={() => { setViewMode('breakdown'); setCurrentPage(1); }}
            style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '1rem', fontWeight: viewMode === 'breakdown' ? 'bold' : 'normal', color: viewMode === 'breakdown' ? '#4f46e5' : '#64748b', cursor: 'pointer', borderBottom: viewMode === 'breakdown' ? '2px solid #4f46e5' : '2px solid transparent' }}
          >
            Detailed Breakdown
          </button>
        </div>

        <div className="table-responsive-ref">
          {viewMode === 'summary' ? (
            <table className="ref-table">
            <thead>
              <tr>
                <th>AGENT NAME</th>
                <th>COMMISSION %</th>
                <th>COMPLETED TASKS</th>
                <th>TOTAL EARNED</th>
                <th>PAID OUT</th>
                <th>PENDING PAYOUT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="empty-state">Loading commissions...</td></tr>
              ) : (
                currentCommissions.map((agent) => (
                  <tr key={agent.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <User size={16} style={{ color: '#64748b' }} />
                        <strong>{agent.name}</strong>
                      </div>
                    </td>
                    <td>{agent.commission_percentage || 0}%</td>
                    <td>{agent.total_invoices}</td>
                    <td style={{ color: '#4f46e5', fontWeight: 'bold' }}>PKR {Number(agent.total_earned || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ color: '#16a34a', fontWeight: 'bold' }}>PKR {Number(agent.total_paid_out || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="metric-cell text-red font-bold">
                        PKR {Number(agent.pending_payout || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
              {!loading && currentCommissions.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-state">No commissions match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
          ) : (
            <table className="ref-table">
              <thead>
                <tr>
                  <th>AGENT</th>
                  <th>PROJECT / STEP</th>
                  <th>INVOICE & PAID %</th>
                  <th>COMM. %</th>
                  <th>POTENTIAL</th>
                  <th>EARNED</th>
                  <th>PENDING</th>
                  <th>DATE</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="empty-state">Loading breakdown...</td></tr>
                ) : (
                  currentBreakdown.map((item, idx) => {
                    const totalInv = parseFloat(item.invoice_total_amount || 0);
                    const paidInv = parseFloat(item.invoice_paid_amount || 0);
                    const paidFraction = totalInv > 0 ? (paidInv / totalInv) * 100 : 0;
                    
                    return (
                      <tr key={idx}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <User size={16} style={{ color: '#64748b' }} />
                            <div>
                              <strong>{item.agent_name}</strong>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.agent_role}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div><strong>{item.project_title}</strong></div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.step_title}</div>
                        </td>
                        <td style={{ width: '220px' }}>
                          <div style={{ marginBottom: '0.3rem' }}>
                            {item.invoice_numbers && item.invoice_numbers.length > 0 
                              ? item.invoice_numbers.map(inv => <span key={inv} style={{ display: 'inline-block', background: '#f8fafc', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', marginRight: '0.2rem', border: '1px solid #e2e8f0', color: '#475569' }}>{inv}</span>)
                              : <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>N/A</span>}
                          </div>
                          {totalInv > 0 ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem', color: '#64748b' }}>
                                <span>Paid: {paidFraction.toFixed(1)}%</span>
                                <span>Total: {totalInv.toLocaleString(undefined, {minimumFractionDigits:0})}</span>
                              </div>
                              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${paidFraction}%`, height: '100%', background: paidFraction >= 100 ? '#10b981' : '#3b82f6' }}></div>
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No amounts</span>
                          )}
                        </td>
                        <td style={{ fontWeight: '600', color: '#475569' }}>
                          {item.commission_percentage || 0}%
                        </td>
                        <td style={{ color: '#64748b' }}>
                          PKR {Number(item.potential_commission || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ fontWeight: 'bold', color: '#16a34a' }}>
                          PKR {Number(item.earned_commission || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ fontWeight: 'bold', color: '#dc2626' }}>
                          PKR {Number(item.pending_commission || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
                      </tr>
                    );
                  })
                )}
                {!loading && currentBreakdown.length === 0 && (
                  <tr>
                    <td colSpan="8" className="empty-state">No breakdown records match the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {viewMode === 'summary' && filteredCommissions.length > 0 && (
          <Pagination 
            currentPage={currentPage}
            totalItems={filteredCommissions.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
        {viewMode === 'breakdown' && filteredBreakdown.length > 0 && (
          <Pagination 
            currentPage={currentPage}
            totalItems={filteredBreakdown.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* 4. Forfeited / Late Commissions Section */}
      {(forfeitedCommissions.length > 0 || loading) && (
        <div className="recent-orders-panel" style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⚠️ Forfeited Commissions (Late Delivery)
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
            These steps were completed after their deadline and their commission was reduced to 0. Admins can override this penalty.
          </p>
          <div className="table-responsive-ref">
            <table className="ref-table">
              <thead>
                <tr>
                  <th>AGENT NAME</th>
                  <th>PROJECT & STEP</th>
                  <th>DEADLINE</th>
                  <th>COMPLETED ON</th>
                  <th>LOST COMMISSION</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="empty-state">Loading forfeited commissions...</td></tr>
                ) : (
                  forfeitedCommissions.map((fc, idx) => (
                    <tr key={idx} style={{ background: '#fef2f2' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={16} style={{ color: '#64748b' }} />
                          <strong>{fc.agent_name}</strong>
                        </div>
                      </td>
                      <td>
                        <div><strong style={{ color: '#334155' }}>{fc.project_title}</strong></div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Step: {fc.step_title}</div>
                      </td>
                      <td style={{ color: '#b45309', fontWeight: '600' }}>{new Date(fc.deadline).toLocaleDateString()}</td>
                      <td style={{ color: '#b91c1c', fontWeight: '600' }}>{new Date(fc.completed_at).toLocaleString()}</td>
                      <td style={{ color: '#dc2626', fontWeight: 'bold' }}>
                        PKR {Number(fc.potential_commission || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td>
                        {JSON.parse(localStorage.getItem('user') || '{}')?.role === 'Admin' ? (
                          <button 
                            onClick={() => handleForgiveLate(fc.project_id, fc.step_id)}
                            style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                          >
                            Forgive & Pay
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Admin Only</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
                {!loading && forfeitedCommissions.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-state">No forfeited commissions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
