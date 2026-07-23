import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Lock, 
  User, 
  Mail, 
  RefreshCw,
  FolderPlus,
  Plus,
  Trash2,
  Tag,
  Camera
} from 'lucide-react';
import './Settings.css';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('categories');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Project Categories State
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Personal Profile State
  const [profile, setProfile] = useState({
    name: '',
    username: '',
    email: '',
    role: '',
    profile_image_url: '',
    commission_percentage: '0.00'
  });

  // Password Change State
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load user profile
      const profileRes = await axios.get('/api/settings/profile');
      if (profileRes.data) {
        setProfile({
          name: profileRes.data.name || '',
          username: profileRes.data.username || '',
          email: profileRes.data.email || '',
          role: profileRes.data.role || '',
          profile_image_url: profileRes.data.profile_image_url || '',
          commission_percentage: profileRes.data.commission_percentage || '0.00'
        });
      }

      // Load project categories
      const categoriesRes = await axios.get('/api/project-categories');
      setCategories(categoriesRes.data || []);
    } catch (err) {
      console.error('Error loading settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => {
      setAlert({ type: '', message: '' });
    }, 4000);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      await axios.post('/api/project-categories', { name: newCategoryName.trim() });
      showAlert('success', 'Project category created successfully!');
      setNewCategoryName('');
      const categoriesRes = await axios.get('/api/project-categories');
      setCategories(categoriesRes.data || []);
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to add project category');
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return;

    try {
      await axios.delete(`/api/project-categories/${id}`);
      showAlert('success', `Category "${name}" deleted!`);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to delete category');
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      setSaving(true);
      const res = await axios.post('/api/settings/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const imageUrl = res.data.url;
      setProfile(prev => ({ ...prev, profile_image_url: imageUrl }));
      showAlert('success', 'Image uploaded! Click "Update Profile" to save your changes.');
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to upload image');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.put('/api/settings/profile', profile);
      showAlert('success', 'Personal profile updated successfully!');
      
      // Update localStorage user so username & profile image persist immediately
      const localUserStr = localStorage.getItem('user');
      if (localUserStr && res.data.user) {
        const localUser = JSON.parse(localUserStr);
        const updatedUser = { 
          ...localUser, 
          name: res.data.user.name, 
          email: res.data.user.email, 
          username: res.data.user.username,
          profile_image_url: res.data.user.profile_image_url 
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.dispatchEvent(new Event('user-updated'));
      }
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return showAlert('error', 'New passwords do not match');
    }
    if (passwords.newPassword.length < 6) {
      return showAlert('error', 'New password must be at least 6 characters long');
    }

    setSaving(true);
    try {
      await axios.put('/api/settings/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      showAlert('success', 'Password updated successfully!');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-container" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <RefreshCw size={36} className="spin-icon" style={{ animation: 'spin 1s linear infinite', color: 'var(--primary-color)' }} />
        <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading Settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-container">
      {/* Global Alert Notification */}
      {alert.message && (
        <div className={`alert-banner ${alert.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {alert.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Section Tabs */}
      <div className="settings-tabs">
        <button 
          className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`} 
          onClick={() => setActiveTab('categories')}
        >
          <FolderPlus size={18} /> Project Categories
        </button>
        <button 
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`} 
          onClick={() => setActiveTab('profile')}
        >
          <ShieldCheck size={18} /> Account & Security
        </button>
      </div>

      {/* SECTION 1: PROJECT CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="settings-card">
          <div className="card-title-section">
            <FolderPlus size={24} style={{ color: 'var(--primary-color)' }} />
            <div>
              <h3 className="card-title">Project Categories</h3>
              <p className="card-description">Create and manage project categories available during project creation</p>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem' }}>
              Active Categories ({categories.length})
            </h4>
            {categories.length === 0 ? (
              <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No project categories found. Add one below!</p>
            ) : (
              <div className="bank-list">
                {categories.map(cat => (
                  <div className="bank-item" key={cat.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Tag size={18} style={{ color: 'var(--primary-color)' }} />
                      <span className="bank-name">{cat.name}</span>
                    </div>
                    <button 
                      className="btn-delete-icon" 
                      onClick={() => handleDeleteCategory(cat.id, cat.name)} 
                      title="Delete Category"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleAddCategory} className="add-bank-row">
            <input 
              type="text" 
              className="form-input" 
              placeholder="Enter new Category Name (e.g. Mobile App Development, SEO, Graphic Design)" 
              value={newCategoryName} 
              onChange={(e) => setNewCategoryName(e.target.value)} 
              required 
            />
            <button type="submit" className="save-btn" style={{ padding: '0.75rem 1.25rem', whiteSpace: 'nowrap' }}>
              <Plus size={18} /> Add Category
            </button>
          </form>
        </div>
      )}

      {/* SECTION 2: ACCOUNT & SECURITY */}
      {activeTab === 'profile' && (
        <div>
          {/* User Profile Card */}
          <form onSubmit={handleSaveProfile}>
            <div className="settings-card">
              <div className="card-title-section">
                <User size={24} style={{ color: 'var(--primary-color)' }} />
                <div>
                  <h3 className="card-title">Personal Profile</h3>
                  <p className="card-description">Update your personal account information and profile picture</p>
                </div>
              </div>

              {/* Avatar Box with File Upload */}
              <div className="avatar-preview-box" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ position: 'relative' }}>
                  {profile.profile_image_url ? (
                    <img 
                      src={profile.profile_image_url} 
                      alt="Profile Avatar" 
                      style={{ width: '68px', height: '68px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                    />
                  ) : (
                    <div className="large-avatar">
                      {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}

                  <label 
                    htmlFor="avatar-file-input" 
                    style={{
                      position: 'absolute', bottom: '-2px', right: '-2px',
                      backgroundColor: 'var(--primary-color)', color: 'white',
                      borderRadius: '50%', width: '28px', height: '28px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                      transition: 'transform 0.15s ease'
                    }}
                    title="Upload Profile Picture"
                  >
                    <Camera size={15} />
                    <input 
                      id="avatar-file-input" 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={handleAvatarUpload} 
                    />
                  </label>
                </div>

                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{profile.name || 'User Profile'}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                      Role: {profile.role}
                    </span>
                    {profile.username && (
                      <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                        @{profile.username}
                      </span>
                    )}
                  </div>
                  <label htmlFor="avatar-file-input" style={{ display: 'inline-block', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
                    Change Profile Photo
                  </label>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label"><User size={16} /> Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={profile.name} 
                    onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={profile.username} 
                    onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))} 
                    placeholder="Enter username" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label"><Mail size={16} /> Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    value={profile.email} 
                    onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))} 
                    required 
                  />
                </div>
              </div>

              <div className="settings-actions">
                <button type="submit" className="save-btn" disabled={saving}>
                  <Save size={18} /> {saving ? 'Saving...' : 'Update Profile'}
                </button>
              </div>
            </div>
          </form>

          {/* Password Change Card */}
          <form onSubmit={handleChangePassword}>
            <div className="settings-card">
              <div className="card-title-section">
                <Lock size={24} style={{ color: 'var(--primary-color)' }} />
                <div>
                  <h3 className="card-title">Change Password</h3>
                  <p className="card-description">Ensure your account is protected with a strong, updated password</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label"><Lock size={16} /> Current Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    value={passwords.currentPassword} 
                    onChange={(e) => setPasswords(prev => ({ ...prev, currentPassword: e.target.value }))} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label"><Lock size={16} /> New Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    value={passwords.newPassword} 
                    onChange={(e) => setPasswords(prev => ({ ...prev, newPassword: e.target.value }))} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label"><Lock size={16} /> Confirm New Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    value={passwords.confirmPassword} 
                    onChange={(e) => setPasswords(prev => ({ ...prev, confirmPassword: e.target.value }))} 
                    required 
                  />
                </div>
              </div>

              <div className="settings-actions">
                <button type="submit" className="save-btn" disabled={saving}>
                  <Lock size={18} /> {saving ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
