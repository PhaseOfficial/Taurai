import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { ArrowLeft, Trash2 } from 'lucide-react'

const ChatHistory = () => {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchChats()
  }, [user])

  const fetchChats = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error) {
      setChats(data)
    }
    setLoading(false)
  }

  const deleteChat = async (chatId) => {
    await supabase.from('chats').delete().eq('id', chatId)
    setChats(chats.filter(chat => chat.id !== chatId))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
            <span>Dzokera kuchat</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Chat History</h1>
        </div>

        {chats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Hapana chat dzekare</p>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Tanga chat nyowani
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-center">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => navigate('/')}
                  >
                    <h3 className="font-medium text-gray-900">
                      {chat.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {new Date(chat.created_at).toLocaleDateString('en-ZW', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteChat(chat.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatHistory