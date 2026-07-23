import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DollarSign, User, Filter, Calendar, RotateCcw, Search } from 'lucide-react';
import Pagination from '../components/Pagination';
import './InvoiceManagement.css'; // Reuse styles

export default function Commissions() {
  const [commissions, setCommissions] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    fetchSpecialists();
    fetchCommissions();
  }, []);

  useEffect(() => {
    fetchCommissions();
  }, [startDate, endDate, selectedAgent, selectedStatus]);

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

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedAgent('all');
    setSelectedStatus('all');
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

  const currentCommissions = filteredCommissions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalEarnedSum = commissions.reduce((sum, a) => sum + Number(a.total_earned || 0), 0);
  const totalPaidSum = commissions.reduce((sum, a) => sum + Number(a.total_paid_out || 0), 0);
  const totalPendingSum = totalEarnedSum - totalPaidSum;

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

          {(startDate || endDate || selectedAgent !== 'all' || selectedStatus !== 'all' || searchTerm) && (
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
        <div className="table-responsive-ref">
          <table className="ref-table">
            <thead>
              <tr>
                <th>AGENT NAME</th>
                <th>COMMISSION %</th>
                <th>TOTAL INVOICES</th>
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
                    <td style={{ color: '#dc2626', fontWeight: 'bold' }}>PKR {(Number(agent.total_earned || 0) - Number(agent.total_paid_out || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
        </div>

        {filteredCommissions.length > 0 && (
          <Pagination 
            currentPage={currentPage}
            totalItems={filteredCommissions.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  );
}
