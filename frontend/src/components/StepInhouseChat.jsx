import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Send, User, Lock } from 'lucide-react';
import './StepInhouseChat.css';

export default function StepInhouseChat({ stepId, currentUser }) {
  const [chats, setChats] = useState([]);
  const [newChat, setNewChat] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchChats = async () => {
    try {
      const res = await axios.get(`/api/projects/steps/${stepId}/inhouse-chats`);
      setChats(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch inhouse chats', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
    const interval = setInterval(fetchChats, 4000);
    return () => clearInterval(interval);
  }, [stepId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newChat.trim() || sending) return;

    const user = currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) {
      alert('User session not found. Please log in.');
      return;
    }

    setSending(true);
    try {
      const res = await axios.post(`/api/projects/steps/${stepId}/inhouse-chats`, {
        user_id: user.id,
        message: newChat.trim()
      });
      setChats(prev => [...prev, res.data]);
      setNewChat('');
    } catch (err) {
      console.error('Failed to post inhouse chat', err);
    } finally {
      setSending(false);
    }
  };

  const user = currentUser || JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className="step-inhouse-chat-wrapper">
      <div className="inhouse-chat-header">
        <Lock size={16} className="inhouse-icon" />
        <h4>Internal Team Chat</h4>
        <span className="inhouse-badge">Not visible to client</span>
      </div>
      <div className="step-comments-chat inhouse-variant">
        <div className="comments-messages-container">
          {loading ? (
            <p className="empty-tab-msg">Loading team chat...</p>
          ) : chats.length === 0 ? (
            <div className="empty-comments-box">
              <Lock size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
              <p className="empty-tab-msg" style={{ margin: 0 }}>No internal messages yet. Use this to chat privately with the team.</p>
            </div>
          ) : (
            chats.map(c => {
              const isMe = Number(c.user_id) === Number(user.id);
              return (
                <div key={c.id} className={`chat-message-row ${isMe ? 'my-message' : 'other-message'}`}>
                  <div className="chat-avatar">
                    {c.user_name ? c.user_name.charAt(0).toUpperCase() : <User size={16} />}
                  </div>
                  <div className="chat-bubble">
                    <div className="chat-author-line">
                      <span className="chat-author-name">{c.user_name || 'User'}</span>
                      {c.user_role && <span className={`chat-role-tag role-${c.user_role.toLowerCase().replace(/\s+/g, '-')}`}>{c.user_role}</span>}
                      <span className="chat-timestamp">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="chat-message-text">{c.message}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form className="comments-input-area" onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="Type an internal message to the team..." 
            value={newChat} 
            onChange={(e) => setNewChat(e.target.value)}
            disabled={sending}
          />
          <button type="submit" className="btn-send-comment inhouse-btn" disabled={!newChat.trim() || sending}>
            <Send size={16} /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
