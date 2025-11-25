import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { notesService } from '../services/notesService'
import { Upload, FileText, Download, Trash2, X, BookOpen } from 'lucide-react'

const NotesSection = ({ isOpen, onClose }) => {
  const [notes, setNotes] = useState([])
  const [uploading, setUploading] = useState(false)
  const [selectedNote, setSelectedNote] = useState(null)
  const [previewContent, setPreviewContent] = useState('')
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef(null)
  const { user } = useAuth()

  useEffect(() => {
    if (isOpen && user) {
      loadNotes()
    }
  }, [isOpen, user])

  const loadNotes = async () => {
    setLoading(true)
    const result = await notesService.getUserNotes(user.id)
    if (result.success) {
      setNotes(result.data || [])
    }
    setLoading(false)
  }

  const handleFileUpload = async (event) => {
    const files = event.target.files
    if (!files.length || !user) return

    setUploading(true)
    
    for (let file of files) {
      const result = await notesService.uploadNote(file, user.id)
      if (!result.success) {
        alert(`Failed to upload ${file.name}: ${result.error}`)
      }
    }
    
    setUploading(false)
    loadNotes()
    event.target.value = '' // Reset file input
  }

  const handleDownload = async (note) => {
    const result = await notesService.getNoteDownloadUrl(note.file_path)
    if (result.success) {
      window.open(result.url, '_blank')
    } else {
      alert('Failed to download file: ' + result.error)
    }
  }

  const handleDelete = async (note) => {
    if (!confirm('Are you sure you want to delete this note?')) return

    const result = await notesService.deleteNote(note.id, note.file_path)
    if (result.success) {
      setNotes(notes.filter(n => n.id !== note.id))
      if (selectedNote?.id === note.id) {
        setSelectedNote(null)
      }
    } else {
      alert('Failed to delete note: ' + result.error)
    }
  }

  const handlePreview = async (note) => {
    setSelectedNote(note)
    if (note.content_text) {
      setPreviewContent(note.content_text)
    } else {
      setPreviewContent('No preview available for this file type')
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('text')) return '📝'
    if (fileType.includes('word')) return '📘'
    return '📎'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            <BookOpen className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold">My Notes</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Notes List */}
          <div className="w-1/2 border-r p-4 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Uploaded Notes</h3>
              <div>
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
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  <Upload size={16} />
                  <span>{uploading ? 'Uploading...' : 'Upload Notes'}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No notes uploaded yet</p>
                  <p className="text-sm">Upload PDF, TXT, or DOC files</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        selectedNote?.id === note.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      onClick={() => handlePreview(note)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">{getFileIcon(note.file_type)}</span>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium truncate">{note.title}</h4>
                            <div className="flex space-x-2 text-xs text-gray-500">
                              <span>{formatFileSize(note.file_size)}</span>
                              <span>•</span>
                              <span>{new Date(note.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(note)
                            }}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(note)
                            }}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="w-1/2 p-4 flex flex-col">
            <h3 className="font-medium mb-4">Preview</h3>
            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
              {selectedNote ? (
                <div>
                  <h4 className="font-semibold mb-2">{selectedNote.title}</h4>
                  <div className="whitespace-pre-wrap text-sm bg-white p-3 rounded border">
                    {previewContent}
                  </div>
                  {!selectedNote.content_text && (
                    <p className="text-xs text-gray-500 mt-2">
                      Full content preview not available. Download to view complete file.
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>Select a note to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotesSection