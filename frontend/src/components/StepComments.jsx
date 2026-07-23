import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Send, User, MessageSquare } from 'lucide-react';
import './StepComments.css';

export default function StepComments({ stepId, currentUser }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchComments = async () => {
    try {
      const res = await axios.get(`/api/projects/steps/${stepId}/comments`);
      setComments(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch comments', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 4000);
    return () => clearInterval(interval);
  }, [stepId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || sending) return;

    const user = currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) {
      alert('User session not found. Please log in.');
      return;
    }

    setSending(true);
    try {
      const res = await axios.post(`/api/projects/steps/${stepId}/comments`, {
        user_id: user.id,
        message: newComment.trim()
      });
      setComments(prev => [...prev, res.data]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment', err);
    } finally {
      setSending(false);
    }
  };

  const user = currentUser || JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className="step-comments-chat">
      <div className="comments-messages-container">
        {loading ? (
          <p className="empty-tab-msg">Loading discussion...</p>
        ) : comments.length === 0 ? (
          <div className="empty-comments-box">
            <MessageSquare size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
            <p className="empty-tab-msg" style={{ margin: 0 }}>No comments yet. Start a discussion with your client or team!</p>
          </div>
        ) : (
          comments.map(c => {
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
          placeholder="Type a message/comment to reply..." 
          value={newComment} 
          onChange={(e) => setNewComment(e.target.value)}
          disabled={sending}
        />
        <button type="submit" className="btn-send-comment" disabled={!newComment.trim() || sending}>
          <Send size={16} /> Send
        </button>
      </form>
    </div>
  );
}
