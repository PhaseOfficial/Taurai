import { supabase } from '../lib/supabaseClient'

export const documentContextService = {
  // Extract and store document context for a chat
  async createDocumentContext(chatId, file, userId, extractedText) {
    try {
      const fileExt = file.name.split('.').pop().toLowerCase()
      const fileName = `${userId}/${chatId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${fileName}`

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('educational-notes')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Create document context record
      const { data: contextData, error: contextError } = await supabase
        .from('document_contexts')
        .insert([{
          chat_id: chatId,
          user_id: userId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          extracted_text: extractedText,
          summary: await this.generateSummary(extractedText, file.type),
          context_keywords: await this.extractKeywords(extractedText)
        }])
        .select()
        .single()

      if (contextError) throw contextError

      return { success: true, data: contextData }
    } catch (error) {
      console.error('Error creating document context:', error)
      return { success: false, error: error.message }
    }
  },

  // Get document context for a chat
  async getChatDocumentContext(chatId) {
    try {
      const { data, error } = await supabase
        .from('document_contexts')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  // Generate AI-powered summary
  async generateSummary(text, fileType) {
    if (!text || text.length < 50) {
      return `Uploaded ${fileType.includes('pdf') ? 'PDF document' : 'file'} for educational discussion`
    }

    // Simple summary extraction (first 200 chars + key indicators)
    const sentences = text.split('.').filter(s => s.trim().length > 10)
    const keySentences = sentences.slice(0, 3).join('. ')
    
    return keySentences.length > 50 ? keySentences + '...' : 
           text.substring(0, 150) + (text.length > 150 ? '...' : '')
  },

  // Extract keywords from text
  async extractKeywords(text) {
    if (!text) return []
    
    // Simple keyword extraction (can be enhanced with NLP libraries)
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
    
    const wordFreq = {}
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    })
    
    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word)
  },

  // Build context prompt for Gemini
  buildContextPrompt(documentContexts) {
    if (!documentContexts || documentContexts.length === 0) return ''

    let contextPrompt = '\n\nCONTEXT FROM UPLOADED DOCUMENTS:\n'
    
    documentContexts.forEach((doc, index) => {
      contextPrompt += `\n--- Document ${index + 1}: ${doc.file_name} ---\n`
      
      if (doc.summary) {
        contextPrompt += `Summary: ${doc.summary}\n`
      }
      
      if (doc.extracted_text && doc.extracted_text.length < 1000) {
        contextPrompt += `Content: ${doc.extracted_text}\n`
      } else if (doc.extracted_text) {
        contextPrompt += `Key Content: ${doc.extracted_text.substring(0, 800)}...\n`
      }
      
      if (doc.context_keywords && doc.context_keywords.length > 0) {
        contextPrompt += `Keywords: ${doc.context_keywords.join(', ')}\n`
      }
    })

    contextPrompt += '\nPlease reference and discuss these documents in your responses when relevant.\n'
    return contextPrompt
  }
}