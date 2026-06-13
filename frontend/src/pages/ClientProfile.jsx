import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { User, Phone, Mail, MapPin, Building, ArrowLeft, Folder, FileText, CreditCard, Activity } from 'lucide-react';
import './ClientProfile.css';

export default function ClientProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('projects');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientDetails();
  }, [id]);

  const fetchClientDetails = async () => {
    try {
      const res = await axios.get(`/api/clients/${id}/details`);
      setData(res.data);
    } catch (error) {
      console.error('Failed to fetch client details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading client profile...</div>;
  if (!data) return <div className="loading">Client not found.</div>;

  const { client, projects, invoices, subscriptions, files } = data;

  return (
    <div className="client-profile-container">
      <div className="profile-header">
        <Link to="/clients" className="back-link"><ArrowLeft size={16} /> Back to Clients</Link>
      </div>

      <div className="profile-card card">
        <div className="profile-main">
          {client.profile_image_url ? (
            <img src={client.profile_image_url} alt={client.full_name} className="profile-avatar" />
          ) : (
            <div className="profile-avatar placeholder"><User size={40} /></div>
          )}
          <div className="profile-info">
            <h1>{client.full_name}</h1>
            <div className="profile-meta">
              {client.business_name && <span className="meta-item"><Building size={16} /> {client.business_name}</span>}
              {client.email && <span className="meta-item"><Mail size={16} /> {client.email}</span>}
              {client.whatsapp_number && <span className="meta-item"><Phone size={16} /> {client.whatsapp_number}</span>}
              {client.physical_address && <span className="meta-item"><MapPin size={16} /> {client.physical_address}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        <button className={activeTab === 'projects' ? 'active' : ''} onClick={() => setActiveTab('projects')}><Activity size={18}/> Active Projects ({projects.length})</button>
        <button className={activeTab === 'invoices' ? 'active' : ''} onClick={() => setActiveTab('invoices')}><CreditCard size={18}/> Invoices ({invoices.length})</button>
        <button className={activeTab === 'subscriptions' ? 'active' : ''} onClick={() => setActiveTab('subscriptions')}><Folder size={18}/> Subscriptions ({subscriptions.length})</button>
        <button className={activeTab === 'files' ? 'active' : ''} onClick={() => setActiveTab('files')}><FileText size={18}/> Files ({files.length})</button>
      </div>

      <div className="tab-content card">
        {activeTab === 'projects' && (
          <div className="table-responsive-ref">
            <table className="ref-table">
              <thead>
                <tr>
                  <th>PROJECT TITLE</th>
                  <th>STATUS</th>
                  <th>LOCKED DEADLINE</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.title}</strong></td>
                    <td><span className={`status-pill ${p.status ? p.status.toLowerCase() : ''}`}>{p.status}</span></td>
                    <td>{p.locked_deadline ? new Date(p.locked_deadline).toLocaleDateString() : 'TBD'}</td>
                  </tr>
                ))}
                {projects.length === 0 && <tr><td colSpan="3" className="empty-state">No active projects.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="table-responsive-ref">
            <table className="ref-table">
              <thead>
                <tr>
                  <th>INVOICE #</th>
                  <th>AMOUNT</th>
                  <th>BALANCE</th>
                  <th>DUE DATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><strong>{inv.invoice_number}</strong></td>
                    <td>Rs {inv.amount}</td>
                    <td>Rs {inv.balance}</td>
                    <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                    <td><span className={`status-pill ${inv.status.toLowerCase()}`}>{inv.status}</span></td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan="5" className="empty-state">No invoices found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="table-responsive-ref">
            <table className="ref-table">
              <thead>
                <tr>
                  <th>PLAN NAME</th>
                  <th>PRICE</th>
                  <th>START DATE</th>
                  <th>END DATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(sub => (
                  <tr key={sub.id}>
                    <td><strong>{sub.plan_name}</strong></td>
                    <td>Rs {sub.price}</td>
                    <td>{sub.start_date ? new Date(sub.start_date).toLocaleDateString() : 'N/A'}</td>
                    <td>{sub.end_date ? new Date(sub.end_date).toLocaleDateString() : 'Ongoing'}</td>
                    <td><span className={`status-pill ${sub.status.toLowerCase()}`}>{sub.status}</span></td>
                  </tr>
                ))}
                {subscriptions.length === 0 && <tr><td colSpan="5" className="empty-state">No subscriptions found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="table-responsive-ref">
            <table className="ref-table">
              <thead>
                <tr>
                  <th>FILE NAME</th>
                  <th>PROJECT</th>
                  <th>UPLOADED AT</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.file_name}</strong></td>
                    <td>{f.project_title}</td>
                    <td>{new Date(f.submitted_at).toLocaleString()}</td>
                    <td><a href={f.file_url} target="_blank" rel="noreferrer" className="btn-link">Download</a></td>
                  </tr>
                ))}
                {files.length === 0 && <tr><td colSpan="4" className="empty-state">No files uploaded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
