import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { User, Phone, Mail, MapPin, Building, ArrowLeft, Folder, FileText, CreditCard, Activity, StickyNote, Plus, Trash2, Edit, X } from 'lucide-react';
import './ClientProfile.css';

export default function ClientProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('projects');
  const [loading, setLoading] = useState(true);

  // Note Modal & Creation State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

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

  const handleOpenAddNote = () => {
    setEditingNote(null);
    setNoteContent('');
    setIsNoteModalOpen(true);
  };

  const handleOpenEditNote = (note) => {
    setEditingNote(note);
    setNoteContent(note.content);
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim()) {
      alert('Please enter note content.');
      return;
    }

    setSubmittingNote(true);
    try {
      if (editingNote) {
        await axios.put(`/api/clients/notes/${editingNote.id}`, {
          content: noteContent.trim(),
          user_id: currentUser.id,
          role: currentUser.role
        });
      } else {
        await axios.post('/api/clients/notes', {
          client_id: id,
          content: noteContent.trim(),
          created_by: currentUser.id
        });
      }
      setIsNoteModalOpen(false);
      setEditingNote(null);
      setNoteContent('');
      await fetchClientDetails();
    } catch (error) {
      console.error('Failed to save note:', error);
      alert(error.response?.data?.error || 'Failed to save note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await axios.delete(`/api/clients/notes/${noteId}?user_id=${currentUser.id}&role=${currentUser.role}`);
      await fetchClientDetails();
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert(error.response?.data?.error || 'Failed to delete note.');
    }
  };

  if (loading) return <div className="loading">Loading client profile...</div>;
  if (!data) return <div className="loading">Client not found.</div>;

  const { client, projects, invoices, subscriptions, files, notes = [] } = data;

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
        <button className={activeTab === 'notes' ? 'active' : ''} onClick={() => setActiveTab('notes')}><StickyNote size={18}/> Notes ({notes.length})</button>
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

        {activeTab === 'notes' && (
          <div>
            <div className="notes-section-header">
              <div>
                <h3>Client Notes & Collaboration</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Notes created here are instantly visible to the client in their portal under "Files & Notes".
                </p>
              </div>
              <button type="button" className="btn-add-note" onClick={handleOpenAddNote}>
                <Plus size={16} /> Add Note for Client
              </button>
            </div>

            {notes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <StickyNote size={40} color="#94a3b8" style={{ marginBottom: '0.75rem' }} />
                <h4 style={{ margin: '0 0 0.4rem 0', color: '#1e293b' }}>No Notes Recorded Yet</h4>
                <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.9rem', color: '#64748b' }}>
                  Keep instructions, reminders, or discussion notes for {client.full_name}.
                </p>
                <button type="button" className="btn-add-note" onClick={handleOpenAddNote}>
                  <Plus size={16} /> Create First Note
                </button>
              </div>
            ) : (
              <div className="client-notes-grid">
                {notes.map(note => {
                  const isAuthorAdmin = ['Admin', 'Super Admin', 'Project Manager', 'PM', 'Product Manager'].includes(note.created_by_role);
                  const isAuthorClient = note.created_by_role === 'Client';
                  
                  return (
                    <div key={note.id} className="client-note-card">
                      <div className="client-note-header">
                        <div className="note-author-info">
                          <span className="note-author-name">{note.created_by_name || 'Staff Member'}</span>
                          <span className={`note-role-badge ${isAuthorAdmin ? 'admin' : isAuthorClient ? 'client' : 'staff'}`}>
                            {isAuthorAdmin ? '🛡️ Admin' : isAuthorClient ? '👤 Client' : note.created_by_role || 'Staff'}
                          </span>
                          <span className="note-date">{new Date(note.created_at).toLocaleString()}</span>
                        </div>
                        <div className="note-card-actions">
                          <button 
                            type="button" 
                            className="note-btn-action edit" 
                            title="Edit Note"
                            onClick={() => handleOpenEditNote(note)}
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            type="button" 
                            className="note-btn-action delete" 
                            title="Delete Note"
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <p className="note-content-body">{note.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE / EDIT NOTE MODAL */}
      {isNoteModalOpen && (
        <div className="client-note-modal-overlay" onClick={() => setIsNoteModalOpen(false)}>
          <div className="client-note-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>{editingNote ? 'Edit Client Note' : `Add Note for ${client.full_name}`}</h3>
              <button 
                type="button" 
                onClick={() => setIsNoteModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="note-hint">
              📌 Notes added here are published to the client's portal. Clients will be able to read this note, but cannot delete or edit Admin notes.
            </p>

            <form onSubmit={handleSaveNote}>
              <textarea 
                placeholder="Write your note or instructions for the client..."
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                autoFocus
                required
              />

              <div className="client-note-modal-actions">
                <button 
                  type="button" 
                  onClick={() => setIsNoteModalOpen(false)}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submittingNote}
                  style={{ background: '#4f46e5', border: 'none', color: '#ffffff', padding: '0.6rem 1.4rem', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  {submittingNote ? 'Saving...' : editingNote ? 'Update Note' : 'Save & Publish Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
