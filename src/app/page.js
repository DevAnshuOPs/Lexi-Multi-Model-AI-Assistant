'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, Square, X, Volume2, Plus, Activity, FileText, Video, Settings, Sun, Moon } from 'lucide-react';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  
  const [attachment, setAttachment] = useState(null); // { file, preview, type }
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConversationMode, setIsConversationMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Settings & Personalization State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [customInstructions, setCustomInstructions] = useState('');
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [selectedLang, setSelectedLang] = useState('en-US');

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const textareaRef = useRef(null);

  // Initialize Voices & Theme
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0 && !selectedVoiceURI) {
        // Find default or first english voice
        const defaultVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
        setSelectedVoiceURI(defaultVoice.voiceURI);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    // Apply theme
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [theme]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 150);
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [input]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

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
             
             // Send both text and raw audio to the backend!
             if (data.text) {
               if (isAutoMode) {
                 await handleSendMessage(data.text, audioBlob);
               } else {
                 setInput((prev) => prev ? prev + ' ' + data.text : data.text);
                 // Store audioBlob in state if we want manual submit to include it, 
                 // but for now, auto-submit in conversation mode is primary use-case.
                 // We'll attach it directly.
                 setAttachment({ file: audioBlob, preview: null, type: 'audio' });
               }
             } else {
               // If Whisper fails to hear speech, we still send the audio to Gemini!
               if (isAutoMode) {
                 await handleSendMessage("Listen to this audio.", audioBlob);
               } else {
                 setAttachment({ file: audioBlob, preview: null, type: 'audio' });
                 setInput("Listen to this audio.");
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
      if (isSpeaking) {
        window.speechSynthesis.cancel();
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

  const speakText = (text, onEndCallback) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (selectedVoiceURI) {
        const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
        if (voice) utterance.voice = voice;
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEndCallback) onEndCallback();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        if (onEndCallback) onEndCallback();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      if (onEndCallback) onEndCallback();
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
      formData.append('systemPrompt', customInstructions);
      
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
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply
      }]);

      if (isConversationMode || textOverride !== null) {
        speakText(data.reply, () => {
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

  // Extract unique languages from available voices
  const availableLangs = [...new Set(voices.map(v => v.lang))].sort();

  return (
    <main className="app-container">
      <header className="header">
        <div className="header-left">
          <div style={{ width: '32px', height: '32px', background: 'var(--accent-gradient)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
            LX
          </div>
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
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>LEXI Preferences</h2>
              <button className="action-btn" onClick={() => setIsSettingsOpen(false)}><X size={18}/></button>
            </div>
            
            <div className="form-group">
              <label>Personalization Instructions (System Prompt)</label>
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
                <option value="en-US">English (US)</option>
                {availableLangs.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Voice (Text-to-Speech)</label>
              <select value={selectedVoiceURI} onChange={e => setSelectedVoiceURI(e.target.value)}>
                {voices.filter(v => v.lang.includes(selectedLang.split('-')[0])).map(voice => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </div>

            <button className="modal-close" onClick={() => setIsSettingsOpen(false)}>Save Settings</button>
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
                  onClick={() => speakText(msg.content)} 
                  style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '50%', padding: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  title="Listen"
                >
                  <Volume2 size={14} />
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
            placeholder={isConversationMode ? (isRecording ? "Listening... (Click Sound Wave to stop)" : (isSpeaking ? "LEXI is speaking... (Click Sound Wave to interrupt)" : "Waiting...")) : "Type a message..."}
            rows={1}
            disabled={isConversationMode}
          />

          <button type="submit" className="action-btn primary" disabled={(!input.trim() && !attachment) || isLoading || isConversationMode}>
            <Send size={18} />
          </button>
        </div>
      </form>
    </main>
  );
}
