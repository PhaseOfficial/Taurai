import { supabase, NOTES_BUCKET } from '../lib/supabaseClient'

export const notesService = {
  // Upload note file
  async uploadNote(file, userId) {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${fileName}`

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(NOTES_BUCKET)
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Extract text content from file (basic implementation)
      let contentText = ''
      if (file.type === 'text/plain') {
        contentText = await file.text()
      } else if (file.type === 'application/pdf') {
        // For PDFs, we'd need a more sophisticated extraction
        contentText = `PDF file: ${file.name} - Content extraction requires additional processing`
      }

      // Create note record in database
      const { data: noteData, error: dbError } = await supabase
        .from('notes')
        .insert([{
          user_id: userId,
          title: file.name,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          content_text: contentText
        }])
        .select()
        .single()

      if (dbError) throw dbError

      return { success: true, data: noteData }
    } catch (error) {
      console.error('Error uploading note:', error)
      return { success: false, error: error.message }
    }
  },

  // Get user's notes
  async getUserNotes(userId) {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  // Get note download URL
  async getNoteDownloadUrl(filePath) {
    try {
      const { data, error } = await supabase.storage
        .from(NOTES_BUCKET)
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (error) throw error
      return { success: true, url: data.signedUrl }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  // Delete note
  async deleteNote(noteId, filePath) {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(NOTES_BUCKET)
        .remove([filePath])

      if (storageError) throw storageError

      // Delete from database
      const { error: dbError } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)

      if (dbError) throw dbError

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  // Extract text from file (basic implementation)
  async extractTextFromFile(file) {
    return new Promise((resolve) => {
      if (file.type === 'text/plain') {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result)
        reader.readAsText(file)
      } else {
        resolve(`File: ${file.name} - Content preview not available for this file type`)
      }
    })
  }
}