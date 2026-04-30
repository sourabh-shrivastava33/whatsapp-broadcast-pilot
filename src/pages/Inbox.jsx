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
  Clock,
  RefreshCcw,
  ChevronLeft
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useAccounts } from '../store/AccountsContext'
import { useToast } from '../store/ToastContext'
import './Inbox.css'
import { socket } from '../lib/socket'

export default function Inbox() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlContactId = searchParams.get('contactId')
  
  const { accounts } = useAccounts()
  const { toast } = useToast()
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(urlContactId)
  const [chatData, setChatData] = useState({ messages: [], isWindowOpen: false })
  const [inputText, setInputText] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState('all') 
  const [showChatOnMobile, setShowChatOnMobile] = useState(!!urlContactId)
  
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchInbox = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/inbox')
      const data = await res.json()
      const uniqueData = Array.from(new Map(data.map(item => [item.id, item])).values())
      setConversations(uniqueData)
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch inbox', err)
    }
  }

  const fetchMessages = async (contactId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/inbox/${contactId}`)
      const data = await res.json()
      setChatData(data)
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

  useEffect(() => {
    const handleNewMessage = (payload) => {
      const { message, contact: updatedContact } = payload;
      setConversations(prev => {
        const otherConversations = prev.filter(c => c.id !== updatedContact.id);
        const newConv = { 
          ...updatedContact, 
          chatMessages: [message],
          unreadCount: (selectedId === updatedContact.id) ? 0 : (updatedContact.unreadCount || 1)
        };
        return [newConv, ...otherConversations];
      });

      if (selectedId === updatedContact.id) {
        setChatData(prev => ({
          ...prev,
          messages: [...prev.messages, message],
          isWindowOpen: true 
        }));
      }
    };

    socket.on('new_message', handleNewMessage);
    return () => socket.off('new_message', handleNewMessage);
  }, [selectedId]);

  useEffect(() => {
    scrollToBottom()
  }, [chatData.messages])

  const handleSelectContact = (id) => {
    setSelectedId(id)
    setShowChatOnMobile(true)
    setSearchParams({ contactId: id })
  }

  const handleBackToList = () => {
    setShowChatOnMobile(false)
    setSearchParams({})
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if ((!inputText.trim() && !selectedFile) || !selectedId || sending || !chatData.isWindowOpen) return

    setSending(true)
    const formData = new FormData()
    const activeAccount = accounts.find(a => a.isActive) || accounts[0]
    formData.append('accountId', activeAccount?.id)
    if (inputText.trim()) formData.append('text', inputText)
    if (selectedFile) formData.append('file', selectedFile)

    try {
      const res = await fetch(`http://localhost:3001/api/inbox/${selectedId}/send`, {
        method: 'POST',
        body: formData
      })
      
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || 'Failed to send message')
      
      setChatData(prev => ({ ...prev, messages: [...prev.messages, result] }))
      setInputText('')
      setSelectedFile(null)
      setPreviewUrl(null)
    } catch (err) {
      toast({ type: 'error', title: 'Send Error', message: err.message })
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
      <div className={`inbox-page ${showChatOnMobile ? 'mobile-show-chat' : ''}`}>
        {/* Sidebar */}
        <aside className="inbox-sidebar">
          <div className="sidebar-header">
            <h2>Inbox</h2>
            <div className="inbox-tabs">
              {['all', 'replied', 'broadcast'].map(f => (
                <button 
                  key={f}
                  className={`inbox-tab ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
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
              <div className="empty-chat-list">
                <MessageSquare size={32} opacity={0.2} />
                <p>No conversations</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <div 
                  key={conv.id} 
                  className={`conversation-item ${selectedId === conv.id ? 'active' : ''}`}
                  onClick={() => handleSelectContact(conv.id)}
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
                  <button className="inbox-mobile-back" onClick={handleBackToList}>
                    <ChevronLeft size={24} />
                  </button>
                  <div className="conversation-avatar" style={{ width: '36px', height: '36px' }}>
                    <User size={18} />
                  </div>
                  <div className="header-text">
                    <div className="header-name-row">
                      <div className="contact-name">{selectedContact?.name}</div>
                      <span className={`chip chip-lead-${selectedContact?.leadStage || 'NEW'}`}>
                        {selectedContact?.leadStage || 'NEW'}
                      </span>
                    </div>
                    <div className="header-sub-row">
                      <span className="contact-phone">{selectedContact?.phone}</span>
                      <span className={`window-status ${chatData.isWindowOpen ? 'open' : 'closed'}`}>
                        {chatData.isWindowOpen ? <Zap size={10} fill="currentColor" /> : <Clock size={10} />}
                        {chatData.isWindowOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="chat-header-actions">
                  <div className="lead-stage-selector hide-on-mobile">
                    {['HOT', 'COLD', 'CLOSED'].map(stage => (
                      <Button 
                        key={stage} 
                        variant="ghost" 
                        size="xs"
                        onClick={async () => {
                          try {
                            await fetch(`http://localhost:3001/api/contacts/${selectedId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ leadStage: stage })
                            });
                            toast({ type: 'success', message: `Lead marked as ${stage}` });
                            fetchInbox();
                          } catch (e) { toast({ type: 'error', message: 'Failed to update stage' }); }
                        }}
                      >
                        {stage}
                      </Button>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="btn-icon" aria-label="More options"><MoreVertical size={18} /></Button>
                </div>
              </header>

              <div className="chat-messages">
                {chatData.messages.map(msg => (
                  <div key={msg.id} className={`message-wrapper ${msg.fromMe ? 'outgoing' : 'incoming'}`}>
                    <div className="message-bubble">
                      {msg.type === 'template_broadcast' && <span className="message-type-tag">Broadcast Campaign</span>}
                      {msg.mediaUrl && (
                        <div className="message-media">
                          {msg.type === 'image' || (msg.type === 'template_broadcast' && msg.mediaUrl.match(/\.(jpg|jpeg|png|gif)$/i)) ? (
                            <img src={msg.mediaUrl} alt="Sent image" onClick={() => window.open(msg.mediaUrl, '_blank')} />
                          ) : msg.type === 'video' ? (
                            <video src={msg.mediaUrl} controls />
                          ) : (
                            <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="document-link">
                              <Paperclip size={16} /> 
                              <span className="file-label">{msg.body || 'Attachment'}</span>
                            </a>
                          )}
                        </div>
                      )}
                      <div className="message-body">{msg.body}</div>
                      <div className="message-footer">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.fromMe && <CheckCheck size={14} className={`status-icon ${msg.status || 'sent'}`} />}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {previewUrl && (
                <div className="media-preview-bar">
                  <div className="preview-container">
                    {selectedFile.type.startsWith('image/') ? (
                      <img src={previewUrl} alt="Preview" />
                    ) : (
                      <div className="file-icon-preview"><Paperclip size={24} /></div>
                    )}
                    <span className="file-name">{selectedFile.name}</span>
                    <button className="remove-preview" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}>×</button>
                  </div>
                </div>
              )}

              {chatData.isWindowOpen ? (
                <form className="chat-input-area" onSubmit={handleSend}>
                  <Button type="button" variant="ghost" size="sm" className="btn-icon" onClick={() => setInputText(prev => prev + '😊')}><Smile size={20} /></Button>
                  <label className="file-upload-label">
                    <input type="file" onChange={handleFileChange} style={{ display: 'none' }} />
                    <Paperclip size={20} />
                  </label>
                  <div className="chat-input-wrapper">
                    <input 
                      className="chat-input" 
                      placeholder="Type a message..." 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    size="sm"
                    icon={Send} 
                    disabled={(!inputText.trim() && !selectedFile) || sending}
                  />
                </form>
              ) : (
                <div className="policy-blocker">
                  <Lock size={14} />
                  <span>24h window closed. Use a <strong>Template</strong> to re-engage.</span>
                  <Button variant="primary" size="sm" className="hide-on-mobile">Send Template</Button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-chat-main">
              <div className="empty-chat-card">
                <div className="empty-chat-icon-pulse">
                  <MessageSquare size={48} className="icon-gradient" />
                </div>
                <h2>Select a Conversation</h2>
                <p>Choose a contact from the left to view their history and manage the 24h Meta service window.</p>
                <div className="empty-chat-actions">
                  <Button variant="primary" size="sm" onClick={() => window.location.href='/broadcast'}>Start Broadcast</Button>
                  <Button variant="ghost" size="sm" onClick={() => window.location.href='/contacts'}>View Contacts</Button>
                </div>
              </div>
              
              <div className="empty-chat-hint">
                <Lock size={12} />
                <span>End-to-end encrypted messaging via WhatsApp Cloud API</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
