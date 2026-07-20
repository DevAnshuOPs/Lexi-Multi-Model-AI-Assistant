'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, Square, X, Volume2, Plus, Activity, FileText, Video, Settings, Sun, Moon, MessageSquare, PlusCircle, Trash2, LogOut, Menu } from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';

const LexiLogo = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="lexi-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
      <filter id="lexi-glow">
        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <rect width="100" height="100" rx="24" fill="url(#lexi-grad)" />
    <path d="M30 50 A 20 20 0 0 1 70 50 A 20 20 0 0 1 30 50" fill="transparent" stroke="white" strokeWidth="6" opacity="0.8" />
    <circle cx="50" cy="50" r="12" fill="white" filter="url(#lexi-glow)" />
    <path d="M50 20 L50 30 M50 70 L50 80 M20 50 L30 50 M70 50 L80 50" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.6"/>
  </svg>
);

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'zh-CN', name: 'Chinese (Mandarin)' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'ru-RU', name: 'Russian' },
  { code: 'ar-SA', name: 'Arabic' },
  // Indian Languages
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'bn-IN', name: 'Bengali' },
  { code: 'mr-IN', name: 'Marathi' },
  { code: 'gu-IN', name: 'Gujarati' },
  { code: 'pa-IN', name: 'Punjabi' },
  { code: 'ta-IN', name: 'Tamil' },
  { code: 'te-IN', name: 'Telugu' },
  { code: 'kn-IN', name: 'Kannada' },
  { code: 'ml-IN', name: 'Malayalam' },
  { code: 'or-IN', name: 'Odia' },
  { code: 'ur-IN', name: 'Urdu' }
];

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  
  const [attachment, setAttachment] = useState(null); 
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConversationMode, setIsConversationMode] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  
  // Database Chat History State
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  
  // Settings & Personalization State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [customInstructions, setCustomInstructions] = useState('');
  const [selectedLang, setSelectedLang] = useState('en-US');

  const { data: session, status } = useSession();

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const textareaRef = useRef(null);
  const audioQueueRef = useRef([]);
  const currentAudioRef = useRef(null);

  // Initialize Data
  useEffect(() => {
    if (session) {
      fetchChats();
      fetchSettings();
    }
  }, [session]);

  // Update Theme Class
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [theme]);

  // Global mouse tracker for ambient slime glow
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      document.body.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.body.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.theme) setTheme(data.theme);
        if (data.language) setSelectedLang(data.language);
        if (data.instructions) setCustomInstructions(data.instructions);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch('/api/chats');
      const data = await res.json();
      setChats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadChat = async (id) => {
    setIsLoading(true);
    setIsMobileSidebarOpen(false);
    try {
      const res = await fetch(`/api/chats/${id}`);
      const data = await res.json();
      setCurrentChatId(data.id);
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setIsMobileSidebarOpen(false);
  };

  const deleteChat = async (id, e) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chats/${id}`, { method: 'DELETE' });
      if (currentChatId === id) startNewChat();
      fetchChats();
    } catch (e) {
      console.error(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 150);
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [input]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    saveSettings({ theme: newTheme, language: selectedLang, instructions: customInstructions });
  };

  const closeSettings = () => {
    setIsSettingsOpen(false);
    saveSettings({ theme, language: selectedLang, instructions: customInstructions });
  };

  const startRecording = async (isAutoMode = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
      });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          try {
             setIsLoading(true);
             const response = await fetch('/api/transcribe', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ audio: base64Audio, language: selectedLang })
             });
             const data = await response.json();
             
             if (data.text) {
               if (isAutoMode) {
                 await handleSendMessage(data.text, audioBlob);
               } else {
                 setInput((prev) => prev ? prev + ' ' + data.text : data.text);
                 // NO audio blob attachment for manual mic - just voice to text!
               }
             } else {
               if (isAutoMode) {
                 await handleSendMessage("Listen to this audio.", audioBlob);
               } else {
                 alert("Could not detect any speech.");
               }
             }
          } catch(err) {
             console.error(err);
             alert("Error processing audio");
             if (isAutoMode) setIsConversationMode(false);
          } finally {
             setIsLoading(false);
          }
        };
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic access denied:', err);
      alert('Could not access microphone.');
      setIsConversationMode(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setIsConversationMode(false);
      startRecording(false);
    }
  };

  const toggleConversationMode = () => {
    if (isConversationMode) {
      if (speakingIndex !== null) {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        audioQueueRef.current = [];
        setSpeakingIndex(null);
      } else {
        setIsConversationMode(false);
        if (isRecording) stopRecording();
      }
    } else {
      setIsConversationMode(true);
      startRecording(true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'file';
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment({ file, preview: reader.result, type });
        setIsAttachmentMenuOpen(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = (acceptType) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptType;
      fileInputRef.current.click();
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const playNextAudioChunk = (onEndCallback) => {
    if (audioQueueRef.current.length === 0) {
      setSpeakingIndex(null);
      if (onEndCallback) onEndCallback();
      return;
    }
    const base64 = audioQueueRef.current.shift();
    const audio = new Audio(`data:audio/mp3;base64,${base64}`);
    currentAudioRef.current = audio;
    
    audio.onended = () => playNextAudioChunk(onEndCallback);
    audio.onerror = () => playNextAudioChunk(onEndCallback);
    audio.play();
  };

  const speakText = async (text, index, onEndCallback) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    audioQueueRef.current = [];
    setSpeakingIndex(index);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang: selectedLang })
      });
      
      const data = await res.json();
      if (data.audioChunks && data.audioChunks.length > 0) {
        audioQueueRef.current = data.audioChunks;
        playNextAudioChunk(onEndCallback);
      } else {
        setSpeakingIndex(null);
        if (onEndCallback) onEndCallback();
      }
    } catch (e) {
      console.error('TTS Error:', e);
      setSpeakingIndex(null);
      if (onEndCallback) onEndCallback();
    }
  };

  const handleSpeakToggle = (text, index) => {
    if (speakingIndex === index) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      audioQueueRef.current = [];
      setSpeakingIndex(null);
    } else {
      speakText(text, index);
    }
  };

  const handleSendMessage = async (textOverride = null, audioOverride = null) => {
    const textToSend = textOverride !== null ? textOverride : input;
    const finalAudio = audioOverride || (attachment?.type === 'audio' ? attachment.file : null);
    
    if ((!textToSend.trim() && !attachment && !finalAudio) || isLoading) return;

    const userMessage = {
      role: 'user',
      content: textToSend,
      image: attachment?.type === 'image' ? attachment.preview : undefined,
      video: attachment?.type === 'video' ? attachment.file.name : undefined,
      file: attachment?.type === 'file' ? attachment.file.name : undefined,
      audio: finalAudio ? 'Audio Recording attached' : undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (textOverride === null) setInput('');
    removeAttachment();
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('messages', JSON.stringify(newMessages));
      
      const langName = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.name || 'English';
      const augmentedPrompt = `${customInstructions}\n\nIMPORTANT: The user wants you to communicate (understand and reply) primarily in this language: ${langName}.`;
      formData.append('systemPrompt', augmentedPrompt);
      
      if (currentChatId) formData.append('chatId', currentChatId);
      
      if (attachment && (attachment.type === 'video' || attachment.type === 'file')) {
        formData.append('media', attachment.file);
      }
      
      if (finalAudio) {
        formData.append('audioFile', finalAudio);
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to fetch response');
      
      const data = await response.json();
      
      // Update Chat ID if this is a new chat
      if (!currentChatId && data.chatId) {
        setCurrentChatId(data.chatId);
        fetchChats(); // Refresh sidebar
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply
      }]);

      if (isConversationMode || textOverride !== null) {
        speakText(data.reply, messages.length + 1, () => {
          if (isConversationMode) startRecording(true);
        });
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
      if (isConversationMode) setIsConversationMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (status === 'loading') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--text-primary)' }}>
        <div className="pulse-anim"><LexiLogo size={80} /></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(168, 85, 247, 0.05)' }}>
        <div className="modal-content" style={{ maxWidth: '400px', width: '90%', textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ margin: '0 auto 1.5rem', display: 'flex', justifyContent: 'center' }}>
            <LexiLogo size={64} />
          </div>
          <h1 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Welcome to LEXI</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Log in to access your multimodal assistant.</p>
          
          <button 
            className="action-btn primary" 
            style={{ width: '100%', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', fontWeight: '600' }}
            onClick={() => signIn('google')}
          >
            Continue with Google
          </button>
          
          <button 
            className="action-btn primary" 
            style={{ width: '100%', padding: '1rem', borderRadius: '0.5rem', background: '#24292e', fontWeight: '600' }}
            onClick={() => signIn('github')}
          >
            Continue with GitHub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-container">
      <div className={`mobile-overlay ${isMobileSidebarOpen ? 'open' : ''}`} onClick={() => setIsMobileSidebarOpen(false)}></div>
      
      {/* Sidebar for Chat History */}
      <aside className={`sidebar ${isMobileSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={startNewChat}>
            <PlusCircle size={18} /> New Chat
          </button>
        </div>
        <div className="chat-list">
          {chats.map(chat => (
            <div key={chat.id} className={`chat-item ${currentChatId === chat.id ? 'active' : ''}`} onClick={() => loadChat(chat.id)}>
              <MessageSquare size={16} className="chat-icon" />
              <span className="chat-title">{chat.title}</span>
              <button className="delete-btn" onClick={(e) => deleteChat(chat.id, e)}><Trash2 size={14}/></button>
            </div>
          ))}
        </div>
        <div style={{ padding: '1rem', borderTop: '1px solid var(--panel-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            {session.user.image ? (
              <img src={session.user.image} alt="User" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
            ) : (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-gradient)' }} />
            )}
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{session.user.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{session.user.email}</div>
            </div>
          </div>
          <button 
            className="action-btn" 
            style={{ width: '100%', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', borderRadius: '0.5rem', padding: '0.5rem' }}
            onClick={() => signOut()}
          >
            <LogOut size={16} style={{ marginRight: '0.5rem' }} /> Log Out
          </button>
        </div>
      </aside>

      <main className="app-container">
        
        <header className="header" style={{ position: 'relative', zIndex: 2 }}>
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setIsMobileSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <LexiLogo size={32} />
            <h1>LEXI</h1>
          </div>
          <div className="header-right">
            <button className="action-btn" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="action-btn" onClick={() => setIsSettingsOpen(true)} title="Settings">
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="modal-overlay" onClick={closeSettings}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>LEXI Preferences</h2>
                <button className="action-btn" onClick={closeSettings}><X size={18}/></button>
              </div>
              
              <div className="form-group">
                <label>Personalization Instructions</label>
                <textarea 
                  rows={3} 
                  placeholder="e.g. Talk like a pirate, or keep responses under 2 sentences..."
                  value={customInstructions}
                  onChange={e => setCustomInstructions(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Language</label>
                <select value={selectedLang} onChange={e => setSelectedLang(e.target.value)}>
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              <button className="modal-close" onClick={closeSettings}>Save Settings</button>
            </div>
          </div>
        )}

        <div className="chat-container">
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-secondary)' }}>
              <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>I am LEXI. How can I help you?</h2>
              <p>Upload an image/file, speak, or type a message to start.</p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index} className={`message-wrapper ${msg.role}`}>
              <div className="message-bubble">
                {msg.role === 'assistant' && (
                  <button 
                    onClick={() => handleSpeakToggle(msg.content, index)} 
                    style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '50%', padding: '4px', cursor: 'pointer', color: speakingIndex === index ? 'var(--accent-color)' : 'var(--text-secondary)' }}
                    title={speakingIndex === index ? "Stop Speaking" : "Listen"}
                  >
                    {speakingIndex === index ? <Square size={14} fill="currentColor" /> : <Volume2 size={14} />}
                  </button>
                )}
                {msg.content && <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>}
                {msg.image && <img src={msg.image} alt="User upload" className="message-media" />}
                {msg.video && <div className="message-media file-attachment">🎥 Video: {msg.video}</div>}
                {msg.file && <div className="message-media file-attachment">📄 Document: {msg.file}</div>}
                {msg.audio && <div className="message-media file-attachment">🎙️ Audio Recording</div>}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message-wrapper ai">
              <div className="message-bubble typing-indicator">
                <div className="dot"></div><div className="dot"></div><div className="dot"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="input-container" onSubmit={handleSubmit}>
          {attachment && (
            <div className="preview-area">
              <div className="attachment-preview">
                {attachment.type === 'image' && <img src={attachment.preview} alt="Preview" />}
                {attachment.type === 'video' && <div className="file-preview"><Video size={24}/> <span>{attachment.file.name}</span></div>}
                {attachment.type === 'file' && <div className="file-preview"><FileText size={24}/> <span>{attachment.file.name}</span></div>}
                {attachment.type === 'audio' && <div className="file-preview"><Mic size={24}/> <span>Audio</span></div>}
                <button type="button" className="remove-btn" onClick={removeAttachment}><X size={12} /></button>
              </div>
            </div>
          )}
          
          <div className="input-row">
            <input type="file" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
            
            <div style={{ position: 'relative' }}>
              <button type="button" className="action-btn" onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)} title="Add Attachment">
                <Plus size={20} />
              </button>
              {isAttachmentMenuOpen && (
                <div className="attachment-menu">
                  <button type="button" onClick={() => triggerFileInput('image/*')}><ImageIcon size={16}/> Image</button>
                  <button type="button" onClick={() => triggerFileInput('video/*')}><Video size={16}/> Video</button>
                  <button type="button" onClick={() => triggerFileInput('.pdf,.txt,.doc,.docx')}><FileText size={16}/> Document</button>
                </div>
              )}
            </div>
            
            <button type="button" className={`action-btn ${isConversationMode ? 'recording' : ''}`} onClick={toggleConversationMode} title="Conversation Mode (Sound Wave)">
               <Activity size={20} className={isConversationMode ? 'pulse-anim' : ''} />
            </button>

            <button type="button" className={`action-btn ${isRecording && !isConversationMode ? 'recording' : ''}`} onClick={toggleRecording} title="Manual Voice Input">
              {isRecording && !isConversationMode ? <Square size={16} fill="currentColor" /> : <Mic size={20} />}
            </button>

            <textarea
              ref={textareaRef}
              className="text-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConversationMode ? (isRecording ? "Listening... (Click Sound Wave to stop)" : (speakingIndex !== null ? "LEXI is speaking... (Click Sound Wave to interrupt)" : "Waiting...")) : "Type a message..."}
              rows={1}
              disabled={isConversationMode}
            />

            <button type="submit" className="action-btn primary" disabled={(!input.trim() && !attachment) || isLoading || isConversationMode}>
              <Send size={18} />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
