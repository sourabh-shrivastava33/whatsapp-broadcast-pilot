import config from '../config.js';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Search from 'lucide-react/dist/esm/icons/search'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import User from 'lucide-react/dist/esm/icons/user'
import Send from 'lucide-react/dist/esm/icons/send'
import Paperclip from 'lucide-react/dist/esm/icons/paperclip'
import Smile from 'lucide-react/dist/esm/icons/smile'
import MoreVertical from 'lucide-react/dist/esm/icons/more-vertical'
import CheckCheck from 'lucide-react/dist/esm/icons/check-check'
import Lock from 'lucide-react/dist/esm/icons/lock'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Clock from 'lucide-react/dist/esm/icons/clock'
import RefreshCcw from 'lucide-react/dist/esm/icons/refresh-ccw'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'

import { Button, IconButton } from '../components/ui/Button'
import { LeadIntelligenceCard } from '../components/ui/LeadIntelligenceCard'
import { useAccounts } from '../store/AccountsContext'
// ... rest of imports
import { useToast } from '../store/ToastContext'
import { socket } from '../lib/socket'
import { InboxSkeleton } from './inbox/InboxSkeleton'
import { ConversationItem } from './inbox/ConversationItem'
import { MessageBubble } from './inbox/MessageBubble'
import './Inbox.css'

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

  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" })
  }, [])

  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch(config.API_URL + "/inbox")
      const data = await res.json()
      const uniqueData = Array.isArray(data) ? Array.from(new Map(data.map(item => [item.id, item])).values()) : []
      setConversations(uniqueData)
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch inbox', err)
    }
  }, [])

  const fetchMessages = useCallback(async (contactId) => {
    try {
      const res = await fetch(`${config.API_URL}/inbox/${contactId}`)
      const data = await res.json()
      setChatData(data)
      setConversations(prev => prev.map(c => c.id === contactId ? { ...c, unreadCount: 0 } : c))
    } catch (err) {
      console.error('Failed to fetch messages', err)
    }
  }, [])

  useEffect(() => {
    fetchInbox()
  }, [fetchInbox])

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId)
    }
  }, [selectedId, fetchMessages])

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
          messages: prev.messages.some(m => m.id === message.id) ? prev.messages : [...prev.messages, message],
          isWindowOpen: true 
        }));
      }
    };

    const handleContactUpdated = (updatedContact) => {
      if (!updatedContact?.id) return;
      setConversations(prev => prev.map(c => c.id === updatedContact.id ? { ...c, ...updatedContact } : c));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('contact_updated', handleContactUpdated);
    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('contact_updated', handleContactUpdated);
    };
  }, [selectedId]);

  useEffect(() => {
    // Instant scroll on first load or when messages change significantly
    const behavior = chatData.messages.length <= 1 ? "auto" : "smooth";
    scrollToBottom(behavior)
  }, [chatData.messages, scrollToBottom])

  const handleSelectContact = useCallback((id) => {
    setSelectedId(id)
    setShowChatOnMobile(true)
    setSearchParams({ contactId: id })
  }, [setSearchParams])

  const handleBackToList = useCallback(() => {
    setShowChatOnMobile(false)
    setSearchParams({})
  }, [setSearchParams])

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
      const res = await fetch(`${config.API_URL}/inbox/${selectedId}/send`, {
        method: 'POST',
        body: formData
      })
      
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || 'Failed to send message')
      
      setChatData(prev => ({
        ...prev,
        messages: prev.messages.some(m => m.id === result.id) ? prev.messages : [...prev.messages, result]
      }))
      setInputText('')
      setSelectedFile(null)
      setPreviewUrl(null)
    } catch (err) {
      toast({ type: 'error', title: 'Send Error', message: err.message })
    } finally {
      setSending(false)
    }
  }

  const filteredConversations = useMemo(() => (conversations || []).filter(c => {
    if (filter === 'replied') return c.category === 'replied'
    if (filter === 'broadcast') return c.category === 'broadcast_only'
    return true
  }), [conversations, filter])

  const selectedContact = useMemo(() => (conversations || []).find(c => c.id === selectedId), [conversations, selectedId])

  if (loading) return <InboxSkeleton />

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
            {filteredConversations.length === 0 ? (
              <div className="empty-chat-list">
                <MessageSquare size={32} opacity={0.2} />
                <p>No conversations</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <ConversationItem 
                  key={conv.id}
                  conv={conv}
                  isActive={selectedId === conv.id}
                  onClick={() => handleSelectContact(conv.id)}
                />
              ))
            )}
          </div>
        </aside>

        {/* Main Chat */}
        <main className="chat-main">
          {selectedId ? (
            <>
              <header className="chat-header">
                {/* ... (keep existing header content) */}
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
                            await fetch(`${config.API_URL}/contacts/${selectedId}`, {
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
                  <IconButton 
                    icon={MoreVertical} 
                    className="more-options-btn" 
                    aria-label="More options" 
                  />
                </div>
              </header>

              <div className="chat-messages">
                {chatData.messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} />
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

        {/* Right Sidebar: Lead Intelligence */}
        {selectedId && (
          <aside className="chat-info-sidebar">
            <LeadIntelligenceCard contact={selectedContact} />
          </aside>
        )}
      </div>
    </div>
  )
}
