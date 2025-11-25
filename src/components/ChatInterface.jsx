import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { initializeChat, createContextualChat } from '../lib/gemini'
import { supabase } from '../lib/supabaseClient'
import { documentContextService } from '../services/documentContextService'
import { Send, LogOut, History, BookOpen, FileText, Download, X, Upload, ExternalLink, Plus } from 'lucide-react'
import logo from '../assets/logo.png'
import DocumentUpload from './DocumentUpload'

// --- Markdown, Sanitizer & Code Highlighting Imports ---
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

// Emoji support
const emojiMap = {
  ":)": "😊",
  ":(": "😞",
  ":D": "😄",
  "<3": "❤️",
}

// Multi-language formatting improvements
const improveLanguageFormatting = (text) => {
  return text
    .replace(/Shona:/gi, "### 🇿🇼 Shona")
    .replace(/Ndebele:/gi, "### 🟤 Ndebele")
    .replace(/English:/gi, "### 🇬🇧 English")
}

// Replace emoji text with actual emoji
const parseEmoji = (text) => {
  let out = text
  Object.entries(emojiMap).forEach(([key, emoji]) => {
    out = out.replaceAll(key, emoji)
  })
  return out
}

// --- Final formatter applied before render ---
const formatMessage = (raw) => {
  if (!raw) return ""

  let processed = raw
  processed = parseEmoji(processed)
  processed = improveLanguageFormatting(processed)

  // Markdown → HTML
  let html = marked.parse(processed, {
    breaks: true,
    gfm: true,
    highlight: (code, lang) => {
      return hljs.highlightAuto(code, [lang]).value
    },
  })

  // Security sanitize
  return DOMPurify.sanitize(html)
}

// --- Initial welcome message ---
const INITIAL_WELCOME_MESSAGE = {
  role: 'model',
  content: 'Ndinonzwisisa. Ngiyaqonda. I will respond in the language you use. You can also upload and read your notes!',
}

const ChatInterface = () => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentChatId, setCurrentChatId] = useState(null)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState([])
  const [selectedNote, setSelectedNote] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [pdfViewerUrl, setPdfViewerUrl] = useState(null)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [showDocumentUpload, setShowDocumentUpload] = useState(false)
  const [chatDocuments, setChatDocuments] = useState([])
  const fileInputRef = useRef(null)

  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const messagesEndRef = useRef(null)
  const chatRef = useRef(null)

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (!chatRef.current) {
      chatRef.current = initializeChat()
      setMessages([INITIAL_WELCOME_MESSAGE])
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load chat documents when chat changes
  useEffect(() => {
    if (currentChatId) {
      loadChatDocuments()
    }
  }, [currentChatId])

  const loadChatDocuments = async () => {
    const result = await documentContextService.getChatDocumentContext(currentChatId)
    if (result.success) {
      setChatDocuments(result.data || [])
    }
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Get file icon
  const getFileIcon = (fileType) => {
    if (!fileType) return '📎'
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('text')) return '📝'
    if (fileType.includes('word')) return '📘'
    return '📎'
  }

  // Load user's notes
  const loadNotes = async () => {
    if (!user) return
    
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setNotes(data)
    }
  }

  useEffect(() => {
    if (showNotes) {
      loadNotes()
    }
  }, [showNotes, user])

  const createNewChat = async (documentContexts = []) => {
    if (!user?.id) return null

    const contextDocuments = documentContexts.map(doc => doc.file_name)

    const { data, error } = await supabase
      .from('chats')
      .insert([{ 
        user_id: user.id, 
        title: documentContexts.length > 0 ? `Chat with ${documentContexts.length} document(s)` : 'Chat nyowani',
        context_documents: contextDocuments,
        has_context: documentContexts.length > 0
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating chat:', error)
      return null
    }

    setCurrentChatId(data.id)
    
    // Initialize chat with document context
    const contextPrompt = documentContextService.buildContextPrompt(documentContexts)
    chatRef.current = createContextualChat(documentContexts)
    
    const welcomeMessage = documentContexts.length > 0 
      ? `Ndinonzwisisa. Ngiyaqonda. I will respond in the language you use. I see you've uploaded ${documentContexts.length} document(s) for context - I'll reference them in our discussion!`
      : INITIAL_WELCOME_MESSAGE.content

    setMessages([{ role: 'model', content: welcomeMessage }])

    return data
  }

  const saveMessage = async (chatId, role, content) => {
    if (!chatId) return

    await supabase.from('messages').insert([{ chat_id: chatId, role, content }])
  }

  // Handle document upload for chat context
  const handleDocumentsAdded = async (newDocuments) => {
    setChatDocuments(prev => [...prev, ...newDocuments])
    
    // Update chat title if it's the first documents
    if (chatDocuments.length === 0 && newDocuments.length > 0 && currentChatId) {
      await supabase
        .from('chats')
        .update({ 
          title: `Chat with ${newDocuments.length} document(s)`,
          has_context: true,
          context_documents: newDocuments.map(doc => doc.file_name)
        })
        .eq('id', currentChatId)
    }

    // Reinitialize chat with new context
    const allDocuments = [...chatDocuments, ...newDocuments]
    chatRef.current = createContextualChat(allDocuments)

    // Add system message about new context
    const contextMessage = {
      role: 'model',
      content: `I've updated my understanding with ${newDocuments.length} new document(s). I'll now reference all uploaded documents in our conversation.`
    }
    setMessages(prev => [...prev, contextMessage])
  }

  // PDF text extraction function
  const extractTextFromPDF = async (file) => {
    return `📚 PDF Document: ${file.name.replace('.pdf.pdf', '.pdf')}\n\n` +
      `This is a PDF document that has been successfully uploaded. You can:\n\n` +
      `• Click "Open PDF" to view the document in full screen\n` +
      `• Ask questions about the content and topics\n` +
      `• Request explanations of concepts from the PDF\n` +
      `• Get study tips and learning strategies\n` +
      `• Discuss key ideas and main points\n\n` +
      `Use the "Open PDF" button to read the document directly in your browser!`;
  };

  // Enhanced file upload function
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length || !user) return;

    setUploading(true);
    
    for (let file of files) {
      const fileExt = file.name.split('.').pop().toLowerCase();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('educational-notes')
        .upload(filePath, file);

      if (uploadError) {
        alert(`Failed to upload ${file.name}: ${uploadError.message}`);
        continue;
      }

      // Extract text content from file based on type
      let contentText = '';
      
      if (file.type === 'text/plain' || fileExt === 'txt') {
        // Text files
        contentText = await file.text();
      } else if (file.type === 'application/pdf' || fileExt === 'pdf') {
        // PDF files
        contentText = await extractTextFromPDF(file);
      } else if (file.type.includes('word') || fileExt === 'doc' || fileExt === 'docx') {
        // Word documents
        contentText = `📘 Word Document: ${file.name}\n\n` +
          `Document uploaded successfully. Use the "Ask About This Note" feature to discuss this document's content and get help with your studies.`;
      } else {
        // Other file types
        contentText = `📎 File: ${file.name}\n` +
          `Type: ${file.type || 'Unknown'}\n` +
          `Size: ${formatFileSize(file.size)}\n\n` +
          `Uploaded successfully. Use the "Ask About This Note" feature to discuss this file.`;
      }

      // Clean file name (remove duplicate extensions)
      const cleanFileName = file.name.replace('.pdf.pdf', '.pdf');

      // Create note record in database
      const { data: noteData, error: dbError } = await supabase
        .from('notes')
        .insert([{
          user_id: user.id,
          title: cleanFileName,
          file_name: cleanFileName,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          content_text: contentText
        }])
        .select()
        .single();

      if (dbError) {
        alert(`Failed to save ${file.name}: ${dbError.message}`);
      } else {
        console.log(`Successfully uploaded: ${file.name}`);
      }
    }
    
    setUploading(false);
    loadNotes();
    event.target.value = '';
  };

  // Enhanced note reading function
  const handleReadNote = async (note) => {
    setSelectedNote(note);
    
    // If we already have good content text, use it
    if (note.content_text && !note.content_text.includes('Content extraction requires additional processing')) {
      return;
    }

    // For PDF files, provide enhanced information
    if (note.file_type === 'application/pdf' || note.file_name?.endsWith('.pdf')) {
      const enhancedContent = `📚 PDF Document: ${note.title}\n\n` +
        `📄 File Type: PDF\n` +
        `💾 Size: ${formatFileSize(note.file_size)}\n` +
        `📅 Uploaded: ${new Date(note.created_at).toLocaleDateString()}\n\n` +
        `✨ This is a PDF document. You can:\n\n` +
        `• Click "Open PDF" to view the document in full screen\n` +
        `• Ask specific questions about topics you're studying\n` +
        `• Request summaries or explanations of concepts\n` +
        `• Get help with understanding the material\n` +
        `• Ask for study strategies related to this content\n\n` +
        `💡 Click "Open PDF" to read the document directly in your browser!`;
      
      setSelectedNote(prev => ({ ...prev, content_text: enhancedContent }));
    }
  };

  // Open PDF in modal
  const handleOpenPdf = async (note) => {
    try {
      const { data, error } = await supabase.storage
        .from('educational-notes')
        .createSignedUrl(note.file_path, 3600) // 1 hour expiry

      if (error) throw error

      setPdfViewerUrl(data.signedUrl)
      setShowPdfModal(true)
    } catch (error) {
      alert('Failed to open PDF: ' + error.message)
    }
  }

  // Download note file
  const handleDownloadNote = async (note) => {
    try {
      const { data, error } = await supabase.storage
        .from('educational-notes')
        .createSignedUrl(note.file_path, 3600)

      if (error) throw error

      window.open(data.signedUrl, '_blank')
    } catch (error) {
      alert('Failed to download file: ' + error.message)
    }
  }

  // Enhanced ask about note function
  const handleAskAboutNote = (note) => {
    let questionPrefix = '';
    
    if (note.file_type === 'application/pdf' || note.file_name?.endsWith('.pdf')) {
      questionPrefix = `I'm studying from the PDF "${note.title}". `;
    } else if (note.file_type.includes('word') || note.file_name?.endsWith('.doc') || note.file_name?.endsWith('.docx')) {
      questionPrefix = `I'm reviewing the document "${note.title}". `;
    } else if (note.file_type === 'text/plain' || note.file_name?.endsWith('.txt')) {
      questionPrefix = `I'm looking at my note "${note.title}". `;
    } else {
      questionPrefix = `I'm reviewing my file "${note.title}". `;
    }

    const defaultQuestion = `${questionPrefix}Can you help me understand this content?`;
    
    setInput(defaultQuestion);
    setShowNotes(false);
    
    // Auto-focus on the input field
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(defaultQuestion.length, defaultQuestion.length);
      }
    }, 100);
  };

  const handleSend = async () => {
    if (!input.trim() || loading || !chatRef.current) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    let chatId = currentChatId
    if (!chatId) {
      const newChat = await createNewChat()
      if (!newChat) {
        setLoading(false)
        return
      }
      chatId = newChat.id
    }

    const newUserMessage = { role: 'user', content: userMessage }
    setMessages((prev) => [...prev, newUserMessage])

    await saveMessage(chatId, 'user', userMessage)

    try {
      const result = await chatRef.current.sendMessage(userMessage)
      const resp = result.response ?? result

      let botResponse = ''
      if (typeof resp.text === 'function') botResponse = await resp.text()
      else botResponse = resp.text || JSON.stringify(resp)

      const newBotMessage = { role: 'model', content: botResponse }
      setMessages((prev) => [...prev, newBotMessage])

      await saveMessage(chatId, 'model', botResponse)
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: 'Pane dambudziko. Ngicela uzame futhi. There was a problem, try again.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img className="h-10 w-auto" src={logo} alt="Chat Logo" />
            <h1 className="text-xl font-semibold text-blue-900">
              Taurai Chat
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Document Context Indicator */}
            {chatDocuments.length > 0 && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                <FileText size={14} />
                <span>{chatDocuments.length} doc(s)</span>
              </div>
            )}

            <button
              onClick={() => setShowDocumentUpload(true)}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              <Plus size={18} />
              <span>Add Docs</span>
            </button>

            <button
              onClick={() => setShowNotes(true)}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              <BookOpen size={18} />
              <span>Notes</span>
            </button>

            <button
              onClick={() => navigate('/chats')}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              <History size={18} />
              <span>Chat History</span>
            </button>

            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* CHAT DOCUMENTS BAR */}
      {chatDocuments.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-4xl mx-auto px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="text-blue-600" size={16} />
                <span className="text-sm font-medium text-blue-900">
                  Chat Documents:
                </span>
              </div>
              <div className="flex space-x-2 overflow-x-auto">
                {chatDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center space-x-2 bg-white px-3 py-1 rounded-full border border-blue-200 text-xs text-blue-800 whitespace-nowrap"
                  >
                    <span>{getFileIcon(doc.file_type)}</span>
                    <span className="truncate max-w-xs">{doc.file_name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: formatMessage(message.content),
                  }}
                ></div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border rounded-lg px-4 py-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.4s' }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* INPUT */}
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-4">
            <textarea
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                chatDocuments.length > 0 
                  ? "Ask questions about your documents or start a new topic..."
                  : "Nyora mubvunzo wako muShona, Ndebele kana English..."
              }
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              rows="2"
            />

            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <Send size={18} />
              <span className="hidden sm:inline">Tumira</span>
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-2 text-center">
            {chatDocuments.length > 0 
              ? `Chatting with ${chatDocuments.length} document(s) as context • Ask about your uploaded files!`
              : 'Supports: English • Shona • Ndebele • Code • Emojis • Links • Notes • Documents'
            }
          </p>
        </div>
      </div>

      {/* DOCUMENT UPLOAD MODAL */}
      {showDocumentUpload && (
        <DocumentUpload
          chatId={currentChatId}
          userId={user?.id}
          onDocumentsAdded={handleDocumentsAdded}
          onClose={() => setShowDocumentUpload(false)}
        />
      )}

      {/* NOTES SECTION MODAL */}
      {showNotes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-3">
                <BookOpen className="text-blue-600" size={24} />
                <h2 className="text-xl font-semibold">My Notes</h2>
              </div>
              <button
                onClick={() => setShowNotes(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Notes List Sidebar */}
              <div className="w-1/3 border-r p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium text-gray-900">Uploaded Notes</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      multiple
                      accept=".txt,.pdf,.doc,.docx,.md"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors"
                    >
                      <Upload size={16} />
                      <span>{uploading ? 'Uploading...' : 'Upload'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>No notes uploaded yet</p>
                      <p className="text-sm mt-2">Upload PDF, TXT, or Word documents</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notes.map((note) => (
                        <div
                          key={note.id}
                          className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                            selectedNote?.id === note.id ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                          }`}
                          onClick={() => handleReadNote(note)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span className="text-lg">{getFileIcon(note.file_type)}</span>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-gray-900 truncate text-sm">{note.title}</h4>
                                <div className="flex space-x-2 text-xs text-gray-500 mt-1">
                                  <span>{formatFileSize(note.file_size)}</span>
                                  <span>•</span>
                                  <span>{new Date(note.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Note Content Panel */}
              <div className="flex-1 p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium text-gray-900">
                    {selectedNote ? selectedNote.title : 'Note Preview'}
                  </h3>
                  {selectedNote && (
                    <div className="flex space-x-2">
                      {/* Show Open PDF button for PDF files */}
                      {(selectedNote.file_type === 'application/pdf' || selectedNote.file_name?.endsWith('.pdf')) && (
                        <button
                          onClick={() => handleOpenPdf(selectedNote)}
                          className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
                        >
                          <ExternalLink size={14} />
                          <span>Open PDF</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleAskAboutNote(selectedNote)}
                        className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                      >
                        <FileText size={14} />
                        <span>Ask About This Note</span>
                      </button>
                      <button
                        onClick={() => handleDownloadNote(selectedNote)}
                        className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                      >
                        <Download size={14} />
                        <span>Download</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
                  {selectedNote ? (
                    <div className="bg-white p-6 rounded-lg border border-gray-200 h-full">
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">
                          {selectedNote.content_text || 'No content preview available for this file.'}
                        </pre>
                      </div>
                      
                      {/* Helpful tips based on file type */}
                      {(selectedNote.file_type === 'application/pdf' || selectedNote.file_name?.endsWith('.pdf')) && (
                        <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="text-sm text-purple-800">
                            <strong>📚 PDF Viewer Available:</strong> Click "Open PDF" to view this document in full screen. 
                            You can read the entire PDF directly in your browser while keeping the chat open for questions!
                          </p>
                        </div>
                      )}
                      
                      {selectedNote.content_text && selectedNote.file_type === 'text/plain' && (
                        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800">
                            <strong>💡 Ready to Learn:</strong> Click "Ask About This Note" to get detailed explanations, 
                            ask questions, or request summaries of this content.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-12">
                      <FileText size={64} className="mx-auto mb-4 text-gray-300" />
                      <p className="text-lg">Select a note to read its content</p>
                      <p className="text-sm mt-2">Click on any note from the list to view its content here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF VIEWER MODAL */}
      {showPdfModal && pdfViewerUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[95vh] flex flex-col">
            {/* PDF Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-3">
                <FileText className="text-red-600" size={24} />
                <h2 className="text-xl font-semibold">
                  {selectedNote?.title || 'PDF Document'}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadNote(selectedNote)}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 p-4">
              <div className="w-full h-full border-2 border-gray-300 rounded-lg bg-gray-100 flex items-center justify-center">
                <iframe
                  src={pdfViewerUrl}
                  className="w-full h-full rounded-lg"
                  title="PDF Viewer"
                  style={{ minHeight: '600px' }}
                />
              </div>
            </div>

            {/* PDF Modal Footer */}
            <div className="border-t p-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  PDF Viewer • Use the controls above to navigate through the document
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAskAboutNote(selectedNote)}
                    className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                  >
                    <FileText size={14} />
                    <span>Ask About This PDF</span>
                  </button>
                  <button
                    onClick={() => setShowPdfModal(false)}
                    className="flex items-center space-x-2 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
                  >
                    <X size={14} />
                    <span>Close</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatInterface