'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, Square, X, Volume2, Plus, Activity, FileText, Video } from 'lucide-react';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  
  const [attachment, setAttachment] = useState(null); // { file, preview, type }
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConversationMode, setIsConversationMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 150);
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [input]);

  const startRecording = async (isAutoMode = false) => {
    try {
      // Disable audio processing so it can hear music/raw audio clearly
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
               body: JSON.stringify({ audio: base64Audio })
             });
             const data = await response.json();
             if (data.text) {
               if (isAutoMode) {
                 // In conversation mode, immediately send the text
                 await handleSendMessage(data.text);
               } else {
                 setInput((prev) => prev ? prev + ' ' + data.text : data.text);
               }
             } else {
               alert("Speech recognition failed: " + (data.error || "Unknown error"));
               if (isAutoMode) setIsConversationMode(false); // abort loop on error
             }
          } catch(err) {
             console.error(err);
             alert("Error transcribing voice");
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
      setIsConversationMode(false); // manual mic overrides conversation mode
      startRecording(false);
    }
  };

  const toggleConversationMode = () => {
    if (isConversationMode) {
      if (isSpeaking) {
        // Just interrupt her, keep conversation mode on
        window.speechSynthesis.cancel();
      } else {
        // Exit conversation mode entirely
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

  const handleSendMessage = async (textOverride = null) => {
    const textToSend = textOverride !== null ? textOverride : input;
    if ((!textToSend.trim() && !attachment) || isLoading) return;

    const userMessage = {
      role: 'user',
      content: textToSend,
      image: attachment?.type === 'image' ? attachment.preview : undefined,
      video: attachment?.type === 'video' ? attachment.file.name : undefined, // Basic handling for now
      file: attachment?.type === 'file' ? attachment.file.name : undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (textOverride === null) setInput('');
    removeAttachment();
    setIsLoading(true);

    // If we're in conversation mode and we used the mic to send this, 
    // we don't want to start listening AGAIN until the AI responds.
    // The loop logic is handled in the response below.

    try {
      const formData = new FormData();
      formData.append('messages', JSON.stringify(newMessages));
      if (attachment && (attachment.type === 'video' || attachment.type === 'file')) {
        formData.append('media', attachment.file);
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
          if (isConversationMode) {
            // Loop back to listening when she finishes speaking
            startRecording(true);
          }
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

  return (
    <main className="app-container">
      <header className="header">
        <div style={{ width: '32px', height: '32px', background: 'var(--accent-gradient)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
          LX
        </div>
        <h1>LEXI</h1>
      </header>

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
              {msg.image && (
                <img src={msg.image} alt="User upload" className="message-media" />
              )}
              {msg.video && (
                <div className="message-media file-attachment">🎥 Video: {msg.video}</div>
              )}
              {msg.file && (
                <div className="message-media file-attachment">📄 Document: {msg.file}</div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="message-wrapper ai">
            <div className="message-bubble typing-indicator">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
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
              <button type="button" className="remove-btn" onClick={removeAttachment}>
                <X size={12} />
              </button>
            </div>
          </div>
        )}
        
        <div className="input-row">
          <input
            type="file"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          
          {/* Attachment Menu */}
          <div style={{ position: 'relative' }}>
            <button 
              type="button" 
              className="action-btn" 
              onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
              title="Add Attachment"
            >
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
          
          <button 
            type="button" 
            className={`action-btn ${isConversationMode ? 'recording' : ''}`}
            onClick={toggleConversationMode}
            title="Conversation Mode (Sound Wave)"
          >
             <Activity size={20} className={isConversationMode ? 'pulse-anim' : ''} />
          </button>

          <button 
            type="button" 
            className={`action-btn ${isRecording && !isConversationMode ? 'recording' : ''}`}
            onClick={toggleRecording}
            title="Manual Voice Input"
          >
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

          <button 
            type="submit" 
            className="action-btn primary"
            disabled={(!input.trim() && !attachment) || isLoading || isConversationMode}
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </main>
  );
}
