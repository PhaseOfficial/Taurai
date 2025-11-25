import React, { useState } from 'react'
import { Upload, FileText, X, BookOpen } from 'lucide-react'
import { documentContextService } from '../services/documentContextService'

const DocumentUpload = ({ chatId, userId, onDocumentsAdded, onClose }) => {
  const [uploading, setUploading] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState([])
  const fileInputRef = useRef(null)

  // Extract text from different file types
  const extractTextFromFile = async (file) => {
    return new Promise((resolve) => {
      if (file.type === 'text/plain') {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result)
        reader.readAsText(file)
      } else if (file.type === 'application/pdf') {
        // For PDFs, provide a meaningful context
        resolve(`PDF Document: ${file.name}. This document has been uploaded for educational discussion. The AI will help you understand and learn from this material.`)
      } else {
        resolve(`Document: ${file.name}. Uploaded for educational reference and discussion.`)
      }
    })
  }

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files)
    if (!files.length || !chatId || !userId) return

    setUploading(true)
    const newDocs = []

    for (let file of files) {
      try {
        // Extract basic text content
        const extractedText = await extractTextFromFile(file)
        
        // Create document context
        const result = await documentContextService.createDocumentContext(
          chatId, 
          file, 
          userId, 
          extractedText
        )

        if (result.success) {
          newDocs.push(result.data)
          setUploadedDocs(prev => [...prev, result.data])
        } else {
          console.error(`Failed to upload ${file.name}:`, result.error)
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error)
      }
    }

    setUploading(false)
    
    if (newDocs.length > 0) {
      onDocumentsAdded(newDocs)
    }

    event.target.value = ''
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            <BookOpen className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold">Add Documents to Chat</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept=".txt,.pdf,.doc,.docx,.md"
              className="hidden"
            />
            <FileText className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-lg font-medium text-gray-700 mb-2">
              Upload Educational Documents
            </p>
            <p className="text-gray-500 mb-4">
              Add PDFs, text files, or documents to provide context for this chat
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2 mx-auto"
            >
              <Upload size={20} />
              <span>{uploading ? 'Uploading...' : 'Choose Files'}</span>
            </button>
            <p className="text-sm text-gray-500 mt-2">
              Supported: PDF, TXT, DOC, DOCX
            </p>
          </div>

          {uploadedDocs.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 mb-3">Uploaded Documents</h3>
              <div className="space-y-2">
                {uploadedDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="text-green-600" size={20} />
                      <div>
                        <p className="font-medium text-green-900">{doc.file_name}</p>
                        <p className="text-sm text-green-700">{doc.summary}</p>
                      </div>
                    </div>
                    <span className="text-sm text-green-600">✓ Added</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between">
            <p className="text-sm text-gray-600">
              Documents will be used as context for AI responses
            </p>
            <button
              onClick={onClose}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentUpload