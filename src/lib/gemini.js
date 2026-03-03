import { supabase } from './supabaseClient'

const SYSTEM_INSTRUCTION = `
You are an educational assistant for Zimbabwean students.

RULES:
1. Respond ONLY in the language the user uses or explicitly requests.
2. Supported languages: English, Shona, Ndebele.
3. Do NOT translate into other languages unless the user requests a translation.
4. If a user switches languages, switch your response to that language.
5. Keep explanations clear, culturally appropriate, and educational.
6. When documents are provided as context, reference them appropriately in your responses.
7. Use the document context to provide more accurate and relevant educational support.
`

/**
 * Sends a message to the Supabase Edge Function
 * @param {Array} messages - Array of message objects {sender, text} or {role, content}
 * @param {string} systemPrompt - The system prompt/instruction
 * @returns {Promise<string>} The AI response
 */
export const callChatAI = async (messages, systemPrompt = SYSTEM_INSTRUCTION) => {
  // Normalize messages to {sender, text} for the edge function
  const normalizedMessages = messages.map(m => ({
    sender: (m.role === 'model' || m.sender === 'ai' || m.sender === 'assistant') ? 'assistant' : 'user',
    text: m.content || m.text
  }))

  try {
    const { data, error } = await supabase.functions.invoke('chat-ai', {
      body: {
        messages: normalizedMessages,
        systemPrompt
      }
    })

    if (error) throw error
    return data.reply
  } catch (error) {
    console.error('Error calling chat-ai edge function:', error)
    throw error
  }
}

/**
 * Initializes a new chat session with optional document context
 * Compatible with existing ChatInterface.jsx usage
 * @param {string} documentContext - Additional context from uploaded documents
 * @param {Array} initialHistory - Optional starting messages
 * @returns {object} A Chat object for the conversation.
 */
export const initializeChat = (documentContext = '', initialHistory = []) => {
  let history = [...initialHistory]
  const systemPrompt = SYSTEM_INSTRUCTION + documentContext

  return {
    sendMessage: async (text) => {
      // Add user message to history
      history.push({ role: 'user', content: text })
      
      try {
        const reply = await callChatAI(history, systemPrompt)
        
        // Add assistant response to history
        history.push({ role: 'model', content: reply })
        
        return {
          response: {
            text: () => Promise.resolve(reply)
          }
        }
      } catch (error) {
        // Remove the failed user message if you want to allow retry
        // history.pop() 
        throw error
      }
    }
  }
}

/**
 * Creates a chat session with document context
 */
export const createContextualChat = (documentContexts) => {
  const contextPrompt = documentContexts && documentContexts.length > 0 
    ? `\n\nDOCUMENT CONTEXT:\nThe user has provided these educational documents for reference. Please use them to provide more accurate and relevant responses:\n${documentContexts.map(doc => `- ${doc.file_name}: ${doc.summary || 'Educational document'}`).join('\n')}\n\nRefer to these documents when relevant to the conversation.`
    : ''

  return initializeChat(contextPrompt)
}
