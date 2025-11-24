import { GoogleGenerativeAI } from '@google/generative-ai'

// The system instruction defines the model's behavior and persona
const SYSTEM_INSTRUCTION = `You are an educational assistant for Zimbabwean students. Always respond in both Shona and Ndebele languages.
Structure your responses with clear headings for each language. Be culturally appropriate and educational.
If a question is in English, respond in English first, then Shona, then Ndebele. If in Shona, respond in Shona first, then Ndebele.
If in Ndebele, respond in Ndebele first, then Shona.`

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

/**
 * Initializes a new chat session with a specified system instruction
 * and generation configuration.
 * @returns {object} A Chat object for the conversation.
 */
export const initializeChat = () => {
  // Pass the system instruction in the 'config' object when getting the model
  const model = genAI.getGenerativeModel({
    model: 'gemini-pro',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  })

  // Start the chat without the initial system instruction message in history.
  // The initial model response can be added if you want to set the tone immediately.
  return model.startChat({
    history: [
      {
        role: 'model',
        parts: [{ text: 'Ndinonzwisisa. I will respond in both Shona and Ndebele for educational purposes. Ngiyaqonda. Ngizophendula ngezilimi zombili iShona neNdebele ngezinjongo zemfundo.' }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 1000,
      temperature: 0.7,
    },
  })
}