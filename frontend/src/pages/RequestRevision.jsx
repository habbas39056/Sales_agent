import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Upload, CheckCircle } from 'lucide-react';
import './Modal.css'; // Reusing modal styles or standard app styles

export default function RequestRevision() {
  const { projectId, stepId } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [step, setStep] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProjectData();
  }, []);

  const fetchProjectData = async () => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        navigate('/');
        return;
      }
      const user = JSON.parse(userStr);
      
      const res = await axios.get(`http://localhost:5000/api/clients/user/${user.id}/portal-data`);
      const proj = res.data.projects.find(p => p.id === parseInt(projectId));
      
      if (proj) {
        setProject(proj);
        const stp = proj.steps.find(s => s.id === parseInt(stepId));
        if (stp) {
          setStep(stp);
          setTitle(`Revision for Step: ${stp.title}`);
        }
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('step_id', stepId);
      if (imageFiles.length > 0) {
        imageFiles.forEach(file => formData.append('images', file));
      }

      await axios.post(`http://localhost:5000/api/projects/${projectId}/request-revision`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      alert('Revision requested successfully!');
      navigate('/client-portal');
    } catch (err) {
      console.error(err);
      const errorMsg = err.response && err.response.data && err.response.data.error ? err.response.data.error : err.message;
      alert(`Failed to request revision: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    let pastedFiles = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        pastedFiles.push(items[i].getAsFile());
      }
    }
    if (pastedFiles.length > 0) {
      setImageFiles(prev => [...prev, ...pastedFiles]);
    }
  };

  if (loading) return <div className="portal-loading">Loading...</div>;
  if (!project) return <div className="portal-loading">Project not found.</div>;

  return (
    <div className="app-container" style={{ padding: '2rem', width: '100%', margin: '0 auto' }}>
      <button 
        className="btn-link" 
        onClick={() => navigate('/client-portal')} 
        style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '1rem', cursor: 'pointer', padding: 0 }}
      >
        <ArrowLeft size={18} /> Back to Portal
      </button>

      <div className="card">
        <h2 style={{ marginBottom: '0.5rem' }}>Request Revision</h2>
        <p className="text-secondary" style={{ marginBottom: '2rem' }}>
          Please provide detailed feedback. This will consume one of your free revision cycles.
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <div className="card" style={{ flex: 1, backgroundColor: '#f8fafc', borderColor: '#e2e8f0', margin: 0, padding: '1rem' }}>
            <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Project</h4>
            <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>{project.title}</p>
          </div>
          <div className="card" style={{ flex: 1, backgroundColor: '#f8fafc', borderColor: '#e2e8f0', margin: 0, padding: '1rem' }}>
            <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Remaining Cycles</h4>
            <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>
              <strong>{project.revision_cycles_remaining}</strong> of <strong>{project.revision_cycles_included}</strong>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Description *</label>
            <textarea 
              rows="12" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              onPaste={handlePaste}
              required 
              placeholder="Describe what needs to be changed in detail... (You can also Paste an image here using Ctrl+V or Cmd+V)"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', resize: 'vertical', fontSize: '1rem' }}
            ></textarea>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Upload Screenshot (Optional)</label>
            <div style={{ border: '2px dashed #cbd5e1', padding: '2rem', textAlign: 'center', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
              <input 
                type="file" 
                accept="image/*" 
                multiple
                onChange={(e) => setImageFiles(prev => [...prev, ...Array.from(e.target.files)])} 
                id="screenshot-upload"
                style={{ display: 'none' }}
              />
              <label htmlFor="screenshot-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={32} color="#64748b" />
                <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Click to select files</span>
                <span className="text-secondary" style={{ fontSize: '0.85rem' }}>PNG, JPG up to 5MB (Max 5)</span>
              </label>
              
              {imageFiles.length > 0 && (
                <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
                  {imageFiles.map((file, idx) => (
                    <div key={idx} style={{ position: 'relative', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.5rem', backgroundColor: 'white' }}>
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt="preview" 
                        style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px' }} 
                      />
                      <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name || `Pasted Image ${idx+1}`}
                      </div>
                      <button 
                        type="button"
                        onClick={() => setImageFiles(prev => prev.filter((_, i) => i !== idx))}
                        style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => navigate('/client-portal')}
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Revision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
