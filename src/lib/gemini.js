import { GoogleGenerativeAI } from '@google/generative-ai'

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

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

/**
 * Initializes a new chat session with optional document context
 * @param {string} documentContext - Additional context from uploaded documents
 * @returns {object} A Chat object for the conversation.
 */
export const initializeChat = (documentContext = '') => {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION + documentContext,
  })

  return model.startChat({
    generationConfig: {
      maxOutputTokens: 1000,
      temperature: 0.7,
    },
  })
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