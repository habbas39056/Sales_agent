import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, FileText, Eye, X, Check, Trash2, Printer, DollarSign, Edit } from 'lucide-react';
import Pagination from '../components/Pagination';
import './InvoiceManagement.css';

export default function InvoiceManagement() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [clientFilter, setClientFilter] = useState('All Clients');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  // Modals
  const [previewInvoice, setPreviewInvoice] = useState(null); // When not null, opens preview modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // Payment Form State
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Bank Transfer',
    notes: ''
  });

  const [termsAndConditions, setTermsAndConditions] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Load terms and conditions
      axios.get('/api/settings').then(res => {
        if (res.data && res.data.terms_and_conditions) {
          setTermsAndConditions(res.data.terms_and_conditions);
        }
      }).catch(err => console.error(err));

      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let queryParams = '';
      if (user) {
        queryParams = `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
      }

      const [invRes, cliRes, projRes, prodRes] = await Promise.all([
        axios.get(`/api/invoices${queryParams}`),
        axios.get(`/api/clients${queryParams}`),
        axios.get('/api/projects'),
        axios.get('/api/products')
      ]);
      setInvoices(invRes.data);
      setClients(cliRes.data);
      setProjects(projRes.data);
      setProducts(prodRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const openPreview = async (id) => {
    try {
      const res = await axios.get(`/api/invoices/${id}`);
      setPreviewInvoice(res.data);
    } catch (error) {
      console.error('Failed to load invoice preview:', error);
    }
  };

  const handlePaymentChange = (e) => {
    setPaymentData({ ...paymentData, [e.target.name]: e.target.value });
  };

  const openPaymentModal = () => {
    setPaymentData({
      amount: previewInvoice.balance || previewInvoice.amount,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'Bank Transfer',
      notes: ''
    });
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/api/invoices/${previewInvoice.id}/payments`, paymentData);
      setIsPaymentModalOpen(false);
      // Refresh the invoice preview data
      openPreview(previewInvoice.id);
      // Refresh the main list
      fetchData();
    } catch (error) {
      console.error('Failed to record payment:', error);
      alert(error.response?.data?.error || 'Error recording payment.');
    }
  };

  const handleDeleteInvoice = async (id) => {
    if (window.confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) {
      try {
        await axios.delete(`/api/invoices/${id}`);
        fetchData();
      } catch (error) {
        console.error('Failed to delete invoice:', error);
        alert(error.response?.data?.error || 'Failed to delete invoice');
      }
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const term = searchTerm.trim().toLowerCase();

    // Multi-field search across Invoice #, Client Name, Project Title, Amount, Balance, ID
    const matchesSearch = !term || 
      (inv.invoice_number && inv.invoice_number.toLowerCase().includes(term)) || 
      (inv.client_name && inv.client_name.toLowerCase().includes(term)) || 
      (inv.project_title && inv.project_title.toLowerCase().includes(term)) || 
      (inv.amount && inv.amount.toString().includes(term)) || 
      (inv.balance && inv.balance.toString().includes(term)) || 
      (inv.id && inv.id.toString().includes(term));

    const matchesStatus = statusFilter === 'All Statuses' || inv.status === statusFilter;
    const matchesClient = clientFilter === 'All Clients' || inv.client_name === clientFilter;

    // Date Range Filter
    let matchesDate = true;
    if (inv.issue_date) {
      const invDateStr = new Date(inv.issue_date).toISOString().slice(0, 10);
      if (fromDate && invDateStr < fromDate) matchesDate = false;
      if (toDate && invDateStr > toDate) matchesDate = false;
    }
    
    return matchesSearch && matchesStatus && matchesClient && matchesDate;
  });

  const currentInvoices = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="invoice-management-container modern-ui">
      <div className="recent-orders-panel" style={{ marginTop: '0' }}>
        <div className="panel-header-ref" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
            <div className="search-box-ref" style={{ flex: '1 1 220px', minWidth: '200px' }}>
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search by inv #, client, project, amount..." 
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <select 
              className="filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', outline: 'none' }}
            >
              <option value="All Statuses">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Overdue">Overdue</option>
            </select>

            <select 
              className="filter-select"
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', outline: 'none', maxWidth: '180px' }}
            >
              <option value="All Clients">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.full_name}>{c.full_name}</option>)}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '0.35rem 0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>From:</span>
              <input 
                type="date" 
                value={fromDate} 
                onChange={e => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', color: '#1e293b', outline: 'none' }}
              />
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>To:</span>
              <input 
                type="date" 
                value={toDate} 
                onChange={e => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', color: '#1e293b', outline: 'none' }}
              />
              {(fromDate || toDate) && (
                <button 
                  onClick={() => { setFromDate(''); setToDate(''); setCurrentPage(1); }}
                  style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', marginLeft: '0.25rem' }}
                  title="Clear Date Filter"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <button className="btn-primary" onClick={() => navigate('/invoices/new')} style={{ borderRadius: '20px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            <Plus size={16} /> Create Invoice
          </button>
        </div>

        <div className="table-responsive-ref">
          <table className="ref-table">
            <thead>
              <tr>
                <th>INVOICE #</th>
                <th>AMOUNT</th>
                <th>DATE</th>
                <th>CUSTOMER</th>
                <th>PROJECT</th>
                <th>DUE DATE</th>
                <th>BALANCE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {currentInvoices.map(inv => (
                <tr key={inv.id}>
                  <td><strong>{inv.invoice_number}</strong></td>
                  <td><strong>PKR {Number(inv.amount).toFixed(2)}</strong></td>
                  <td>{new Date(inv.issue_date).toLocaleDateString()}</td>
                  <td><strong>{inv.client_name}</strong></td>
                  <td>{inv.project_title || '-'}</td>
                  <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                  <td style={{ color: inv.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>PKR {Number(inv.balance).toFixed(2)}
                  </td>
                  <td>
                    <span className={`status-pill ${inv.status.toLowerCase()}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon view-btn" onClick={() => openPreview(inv.id)} title="Preview Invoice"><Eye size={18} /></button>
                      <button className="btn-icon edit-btn" onClick={() => navigate(`/invoices/edit/${inv.id}`)} title="Edit Invoice"><Edit size={18} /></button>
                      <button className="btn-icon delete-btn" onClick={() => handleDeleteInvoice(inv.id)} title="Delete Invoice"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {currentInvoices.length === 0 && (
                <tr>
                  <td colSpan="9" className="empty-state">No invoices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {filteredInvoices.length > 0 && (
          <Pagination 
            currentPage={currentPage}
            totalItems={filteredInvoices.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>



      {/* PREVIEW MODAL */}
      {previewInvoice && (
        <div className="modal-overlay">
          <div className="modal-content preview-modal">
            <div className="modal-header print-hide" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem'}}>
              <h2 style={{margin: 0}}>Invoice Preview</h2>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                {previewInvoice.status !== 'Paid' && (
                  <button className="btn-success" onClick={openPaymentModal}>
                    <DollarSign size={18} style={{marginRight:'0.5rem', verticalAlign:'middle'}}/> Record Payment
                  </button>
                )}
                <button className="btn" style={{backgroundColor: '#e2e8f0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'}} onClick={() => window.print()}><Printer size={18} /> Print</button>
                <button className="btn" style={{backgroundColor: '#e2e8f0', color: '#1e293b', padding: '0.5rem', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center'}} onClick={() => setPreviewInvoice(null)}><X size={20} /></button>
              </div>
            </div>
            
            <div className={`invoice-document ${previewInvoice.status === 'Paid' ? 'is-paid' : 'is-unpaid'}`} id="printable-invoice" style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
              
              {/* STAMP */}
              <div className="invoice-stamp">
                {previewInvoice.status === 'Paid' ? 'PAID' : (previewInvoice.status === 'Overdue' ? 'OVERDUE' : 'UNPAID')}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <img src="/Adwise-Labs-Primary-Logo.png" alt="Adwise Labs Logo" style={{ maxWidth: '220px', height: 'auto', display: 'block' }} />
                  </div>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Invoice {previewInvoice.invoice_number}</h2>
                  
                  <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Invoice To,</div>
                    <div>{previewInvoice.client_name}</div>
                    {previewInvoice.business_name && <div>{previewInvoice.business_name}</div>}
                    {previewInvoice.physical_address && <div style={{ maxWidth: '250px' }}>{previewInvoice.physical_address}</div>}
                    <div>{previewInvoice.client_email}</div>
                  </div>
                </div>
                
                <div style={{ flex: 1, textAlign: 'right', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Date: {new Date(previewInvoice.issue_date).toLocaleDateString()}</div>
                  <div style={{ letterSpacing: '2px', marginBottom: '1rem' }}>******************************</div>
                  
                  <div style={{ fontWeight: 'bold' }}>Account Title: Adwise labs</div>
                  <div style={{ fontWeight: 'bold' }}>Bank Al Falah</div>
                  <div style={{ fontWeight: 'bold' }}>Account Number: 56395002519988</div>
                  <div style={{ fontWeight: 'bold' }}>info@adwiselabs.com</div>
                  <div style={{ fontWeight: 'bold' }}>www.adwiselabs.com</div>
                </div>
              </div>

              <table className="invoice-table" style={{ border: '1px solid #000', marginBottom: '2rem' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #000', textAlign: 'left', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold' }}>Description</th>
                    <th style={{ border: '1px solid #000', textAlign: 'center', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold' }}>Qty</th>
                    <th style={{ border: '1px solid #000', textAlign: 'center', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold' }}>Rate</th>
                    <th style={{ border: '1px solid #000', textAlign: 'right', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewInvoice.items?.map(item => (
                    <tr key={item.id}>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem' }}>
                        <div>{item.description}</div>
                        {item.details && <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{item.details}</div>}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'center' }}>{item.quantity} {item.unit}</td>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'center' }}>PKR {Number(item.unit_price).toFixed(2)}</td>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right' }}>PKR {Number(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="3" style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>Sub Total</td>
                    <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>PKR {Number(previewInvoice.amount).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colSpan="3" style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>Total Paid</td>
                    <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>PKR {(previewInvoice.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colSpan="3" style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>Total Amount Receivable</td>
                    <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>PKR {Number(previewInvoice.balance).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ textAlign: 'center', color: '#0369a1', fontSize: '0.9rem', fontWeight: 'bold', lineHeight: '1.6', marginTop: '3rem' }}>
                <div style={{ marginBottom: '0.5rem' }}>Prompt Payments are Appreciated!</div>
                <div style={{ marginBottom: '0.5rem' }}>Thank You</div>
                <div style={{ marginBottom: '0.5rem' }}>Accounts Department – Adwise Labs</div>
                <div style={{ color: '#000', fontSize: '0.8rem' }}>ADWISE LABS | A-205/II Saba Ave, DHA Karachi Phase VIII Zone A, 76500</div>
                <div style={{ color: '#000', fontSize: '0.8rem', fontWeight: 'normal' }}>Contact No. +1 (774) 674-1872 | +92 329 2371279 | Email: info@adwiselabs.com</div>
              </div>

              {/* SEPARATE PAGE: TERMS & CONDITIONS */}
              {termsAndConditions && (
                <div className="terms-page-break">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid #0f172a', paddingBottom: '1rem' }}>
                    <img src="/Adwise-Labs-Primary-Logo.png" alt="Adwise Labs Logo" style={{ maxWidth: '180px', height: 'auto' }} />
                    <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Terms & Conditions</h2>
                  </div>
                  
                  <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                    {termsAndConditions}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Record Payment</h2>
              <button className="btn-close" onClick={() => setIsPaymentModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="form-group">
                <label>Amount Received *</label>
                <input type="number" name="amount" value={paymentData.amount} onChange={handlePaymentChange} min="0.01" step="0.01" max={previewInvoice?.balance} required />
              </div>
              <div className="form-group">
                <label>Payment Date *</label>
                <input type="date" name="payment_date" value={paymentData.payment_date} onChange={handlePaymentChange} required />
              </div>
              <div className="form-group">
                <label>Payment Method</label>
                <select name="payment_method" value={paymentData.payment_method} onChange={handlePaymentChange}>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notes / Ref (Optional)</label>
                <input type="text" name="notes" value={paymentData.notes} onChange={handlePaymentChange} />
              </div>
              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-success">Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
