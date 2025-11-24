import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { initializeChat } from '../lib/gemini'
import { supabase } from '../lib/supabaseClient'
import { Send, LogOut, History } from 'lucide-react'
import logo from '../assets/logo.png'

const ChatInterface = () => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentChatId, setCurrentChatId] = useState(null)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const createNewChat = async () => {
    const { data, error } = await supabase
      .from('chats')
      .insert([{ 
        user_id: user.id, 
        title: 'Chat nyowani' 
      }])
      .select()
      .single()

    if (!error) {
      setCurrentChatId(data.id)
      setMessages([])
    }
    return data
  }

  const saveMessage = async (chatId, role, content) => {
    await supabase
      .from('messages')
      .insert([{ 
        chat_id: chatId, 
        role, 
        content 
      }])
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    // Create new chat if none exists
    let chatId = currentChatId
    if (!chatId) {
      const newChat = await createNewChat()
      chatId = newChat.id
    }

    // Add user message to UI
    const newUserMessage = { role: 'user', content: userMessage }
    setMessages(prev => [...prev, newUserMessage])
    
    // Save user message to database
    await saveMessage(chatId, 'user', userMessage)

    try {
      const chat = initializeChat()
      const result = await chat.sendMessage(userMessage)
      const response = await result.response
      const botResponse = response.text()

      // Add bot response to UI
      const newBotMessage = { role: 'model', content: botResponse }
      setMessages(prev => [...prev, newBotMessage])
      
      // Save bot response to database
      await saveMessage(chatId, 'model', botResponse)

      // Update chat title with first message if it's the first exchange
      if (messages.length === 0) {
        await supabase
          .from('chats')
          .update({ title: userMessage.slice(0, 50) + '...' })
          .eq('id', chatId)
      }

    } catch (error) {
      console.error('Error:', error)
      const errorMessage = { 
        role: 'model', 
        content: 'Paine dambudziko, edza zvakare. There was a problem, please try again.' 
      }
      setMessages(prev => [...prev, errorMessage])
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
          <img className="h-10 w-auto" src={logo} alt="Chat yeDzidzo" />
            <h1 className="text-xl font-semibold text-blue-900">
              Taurai Chat
            </h1>
            <p className="text-sm text-gray-600">
              Inoshanda neShona neNdebele
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/chats')}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <History size={18} />
              <span>Chat History</span>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Tanga hurukuro nyowani
              </h2>
              <p className="text-gray-600">
                Bvunza mibvunzo yedzidzo muShona kana Ndebele
              </p>
            </div>
          ) : (
            <div className="space-y-6">
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
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-4">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Nyora mubvunzo wako muShona, Ndebele kana English..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="2"
                disabled={loading}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Send size={18} />
              <span>Tumira</span>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Shona • Ndebele • English • Dzidzo
          </p>
        </div>
      </div>
    </div>
  )
}

export default ChatInterface