import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Phone, Mail, Globe, MapPin } from 'lucide-react';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await axios.post('http://localhost:5000/api/users/login', {
        email: username,
        password
      });
      // Save user info for portals to use
      const user = res.data.user;
      localStorage.setItem('user', JSON.stringify(user));
      
      // Role-based redirection
      if (user.role === 'Client') {
        navigate('/client-portal');
      } else if (user.role === 'Project Manager') {
        navigate('/pm');
      } else if (user.role === 'Sales Rep') {
        navigate('/sales');
      } else if (user.role === 'Production') {
        navigate('/production');
      } else {
        navigate('/dashboard'); // Admin or default
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setErrorMsg('Invalid email or password');
      } else {
        setErrorMsg('An error occurred during login');
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="brand-section">
          <div className="logo-container" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <img src="/logo.png" alt="Adwise Labs Logo" style={{ maxWidth: '220px', height: 'auto' }} />
          </div>
          <p className="platform-name">AdwiseSales AMS Platform</p>
          
          <div className="contact-box">
            <div className="contact-item">
              <Phone size={18} className="contact-icon" />
              <div>
                <strong>+1 385-699-4403</strong>
                <p>+92 329 2371279</p>
              </div>
            </div>
            
            <div className="contact-item">
              <Mail size={18} className="contact-icon" />
              <p>info@adwiselabs.com</p>
            </div>
            
            <div className="contact-item">
              <Globe size={18} className="contact-icon" />
              <p>www.adwiselabs.com</p>
            </div>
            
            <div className="contact-item">
              <MapPin size={18} className="contact-icon" />
              <div>
                <p>A-205/11 Saba Ave, DHA</p>
                <p>Karachi Phase VIII</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="login-right">
        <div className="login-form-container">
          <h2>AdwiseSales AMS Login</h2>
          <p className="login-subtitle">Sign in to your account</p>
          
          <form onSubmit={handleLogin} className="login-form">
            {errorMsg && <p style={{color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '-10px'}}>{errorMsg}</p>}
            <div className="form-group">
              <label>EMAIL</label>
              <input 
                type="email" 
                placeholder="Email Address" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label>PASSWORD</label>
              <input 
                type="password" 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <button type="submit" className="login-btn">Sign In</button>
          </form>
        </div>
      </div>
    </div>
  );
}
