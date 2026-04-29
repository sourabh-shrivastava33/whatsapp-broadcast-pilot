import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Search, 
  MessageSquare, 
  User, 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical,
  CheckCheck,
  Lock,
  Zap,
  Clock
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useAccounts } from '../store/AccountsContext'
import './Inbox.css'
import { socket } from '../lib/socket'

export default function Inbox() {
  const [searchParams] = useSearchParams()
  const urlContactId = searchParams.get('contactId')
  
  const { accounts } = useAccounts()
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(urlContactId)
  const [chatData, setChatData] = useState({ messages: [], isWindowOpen: false })
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState('all') // all | replied | broadcast
  
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Fetch conversation list
  const fetchInbox = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/inbox')
      const data = await res.json()
      setConversations(data)
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch inbox', err)
    }
  }

  // Fetch messages for selected contact
  const fetchMessages = async (contactId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/inbox/${contactId}`)
      const data = await res.json()
      setChatData(data)
      // Reset unread count locally
      setConversations(prev => prev.map(c => c.id === contactId ? { ...c, unreadCount: 0 } : c))
    } catch (err) {
      console.error('Failed to fetch messages', err)
    }
  }

  useEffect(() => {
    fetchInbox()
  }, [])

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId)
    }
  }, [selectedId])

  // Real-time listeners
  useEffect(() => {
    const handleNewMessage = (payload) => {
      const { message, contact: updatedContact } = payload;
      
      // Update conversation list
      setConversations(prev => {
        const exists = prev.find(c => c.id === updatedContact.id);
        if (exists) {
          return [
            { ...updatedContact, chatMessages: [message] },
            ...prev.filter(c => c.id !== updatedContact.id)
          ];
        } else {
          return [{ ...updatedContact, chatMessages: [message] }, ...prev];
        }
      });

      // If this contact is currently open, add message to chat
      if (selectedId === updatedContact.id) {
        setChatData(prev => ({
          ...prev,
          messages: [...prev.messages, message],
          isWindowOpen: true // Window opens on reply
        }));
      }
    };

    socket.on('new_message', handleNewMessage);
    return () => socket.off('new_message', handleNewMessage);
  }, [selectedId]);

  useEffect(() => {
    scrollToBottom()
  }, [chatData.messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!inputText.trim() || !selectedId || sending || !chatData.isWindowOpen) return

    setSending(true)
    try {
      const account = accounts.find(a => a.isActive) || accounts[0]
      if (!account) throw new Error('No active account found')

      const res = await fetch(`http://localhost:3001/api/inbox/${selectedId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: inputText,
          accountId: account.id
        })
      })
      
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || 'Failed to send message')
      
      setChatData(prev => ({ ...prev, messages: [...prev.messages, result] }))
      setInputText('')
    } catch (err) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  const filteredConversations = conversations.filter(c => {
    if (filter === 'replied') return c.category === 'replied'
    if (filter === 'broadcast') return c.category === 'broadcast_only'
    return true
  })

  const selectedContact = conversations.find(c => c.id === selectedId)

  return (
    <div className="page fade-in">
      <div className="inbox-page">
        {/* Sidebar */}
        <aside className="inbox-sidebar">
          <div className="sidebar-header">
            <h2 style={{ marginBottom: '12px' }}>Inbox</h2>
            <div className="inbox-tabs">
              <button 
                className={`inbox-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >All</button>
              <button 
                className={`inbox-tab ${filter === 'replied' ? 'active' : ''}`}
                onClick={() => setFilter('replied')}
              >Active</button>
              <button 
                className={`inbox-tab ${filter === 'broadcast' ? 'active' : ''}`}
                onClick={() => setFilter('broadcast')}
              >Leads</button>
            </div>
            <div className="search-bar" style={{ marginTop: '12px' }}>
              <Search size={16} />
              <input type="text" placeholder="Search..." />
            </div>
          </div>
          
          <div className="conversation-list">
            {loading ? (
              <div className="wizard-spinner" style={{ margin: '20px auto' }} />
            ) : filteredConversations.length === 0 ? (
              <div className="empty-chat" style={{ padding: '40px' }}>
                <MessageSquare size={32} opacity={0.2} />
                <p>No conversations</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <div 
                  key={conv.id} 
                  className={`conversation-item ${selectedId === conv.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(conv.id)}
                >
                  <div className="conversation-avatar">
                    <User size={20} />
                    {conv.isWindowOpen && <div className="online-indicator" />}
                  </div>
                  <div className="conversation-info">
                    <div className="info-top">
                      <span className="contact-name">{conv.name}</span>
                      <span className="last-time">
                        {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="info-bottom">
                      <span className="last-message">
                        {conv.chatMessages?.[0]?.body || 'Passive lead'}
                      </span>
                      {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat */}
        <main className="chat-main">
          {selectedId ? (
            <>
              <header className="chat-header">
                <div className="chat-header-info">
                  <div className="conversation-avatar" style={{ width: '36px', height: '36px' }}>
                    <User size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{selectedContact?.name}</div>
                    <div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {selectedContact?.phone}
                      {chatData.isWindowOpen ? 
                        <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Zap size={10} fill="currentColor" /> Window Open
                        </span> : 
                        <span style={{ color: 'var(--status-rejected)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Clock size={10} /> Window Closed
                        </span>
                      }
                    </div>
                  </div>
                </div>
                <div className="chat-header-actions">
                  <Button variant="ghost" size="sm"><MoreVertical size={18} /></Button>
                </div>
              </header>

              <div className="chat-messages">
                {chatData.messages.map(msg => (
                  <div key={msg.id} className={`message-wrapper ${msg.fromMe ? 'outgoing' : 'incoming'}`}>
                    <div className="message-bubble">
                      {msg.type === 'template_broadcast' && <span className="message-type-tag">Broadcast Campaign</span>}
                      <div className="message-body">{msg.body}</div>
                      <div className="message-footer">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.fromMe && <CheckCheck size={14} style={{ marginLeft: '4px', color: '#53bdeb' }} />}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {chatData.isWindowOpen ? (
                <form className="chat-input-area" onSubmit={handleSend}>
                  <Button type="button" variant="ghost" size="sm"><Smile size={20} /></Button>
                  <Button type="button" variant="ghost" size="sm"><Paperclip size={20} /></Button>
                  <div className="chat-input-wrapper">
                    <input 
                      className="chat-input" 
                      placeholder="Type a reply..." 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    icon={Send} 
                    disabled={!inputText.trim() || sending}
                  >
                    {sending ? '...' : ''}
                  </Button>
                </form>
              ) : (
                <div className="policy-blocker">
                  <Lock size={16} />
                  <span>The 24-hour service window is closed. Use a <strong>Template</strong> to re-engage this lead.</span>
                  <Button variant="primary" size="sm" style={{ marginLeft: 'auto' }}>Send Template</Button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-chat">
              <MessageSquare size={80} opacity={0.1} />
              <h2>Your Conversations</h2>
              <p>Select a contact to view history and manage the 24h Meta service window.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
