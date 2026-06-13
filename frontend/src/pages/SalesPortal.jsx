import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function SalesPortal() {
  const [clients, setClients] = useState([]);
  const [newClient, setNewClient] = useState({ full_name: '', email: '' });
  
  const [newProject, setNewProject] = useState({ title: '', description: '', client_id: '', revision_cycles_included: 2 });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/clients');
      setClients(res.data);
    } catch (e) { console.error(e); }
  };

  const createClient = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/clients', newClient);
      setNewClient({ full_name: '', email: '' });
      fetchClients();
    } catch (e) { console.error(e); }
  };

  const createProject = async (e) => {
    e.preventDefault();
    if(!newProject.client_id) return alert("Select a client first");
    try {
      await axios.post('http://localhost:5000/api/projects', newProject);
      setNewProject({ title: '', description: '', client_id: '', revision_cycles_included: 2 });
      alert("Project Created Successfully!");
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <h1>Sales Portal</h1>
      <p className="text-secondary">Create clients and manage projects.</p>

      <div className="grid" style={{ marginTop: '2rem' }}>
        <div className="card">
          <h3>Create Client</h3>
          <form onSubmit={createClient} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <input 
              type="text" placeholder="Full Name" value={newClient.full_name} 
              onChange={e => setNewClient({...newClient, full_name: e.target.value})}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'white' }} required
            />
            <input 
              type="email" placeholder="Email" value={newClient.email} 
              onChange={e => setNewClient({...newClient, email: e.target.value})}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'white' }} required
            />
            <button type="submit" className="btn btn-primary">Save Client</button>
          </form>
        </div>

        <div className="card">
          <h3>Create Project</h3>
          <form onSubmit={createProject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <select 
              value={newProject.client_id}
              onChange={e => setNewProject({...newProject, client_id: e.target.value})}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'white' }} required>
              <option value="">Select Client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
            <input 
              type="text" placeholder="Project Title" value={newProject.title} 
              onChange={e => setNewProject({...newProject, title: e.target.value})}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'white' }} required
            />
            <textarea 
              placeholder="Description" value={newProject.description} 
              onChange={e => setNewProject({...newProject, description: e.target.value})}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'white' }} required
            />
            <input 
              type="number" placeholder="Included Revision Cycles" value={newProject.revision_cycles_included} 
              onChange={e => setNewProject({...newProject, revision_cycles_included: parseInt(e.target.value)})}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'white' }} required
            />
            <button type="submit" className="btn btn-accent">Create Project</button>
          </form>
        </div>
      </div>
    </div>
  );
}
