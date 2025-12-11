import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { ref as dbRef, push, set } from 'firebase/database'
import { auth, database } from '../firebase/config'

function TryTools() {
  const [activeTab, setActiveTab] = useState<'single' | 'multi'>('single')
  const [user, setUser] = useState<User | null>(null)
  const [uploadedImages, setUploadedImages] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [])

  const handleUploadClick = () => {
    if (!user) {
      navigate('/login')
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      navigate('/login')
      return
    }

    const files = e.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    
    // Validate file types
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/tiff', 'image/tif']
    const validFiles = fileArray.filter(file => allowedTypes.includes(file.type))
    
    if (validFiles.length === 0) {
      setUploadError('Please upload PNG, JPG, or TIFF images only')
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Limit to single image for single tab, or 3-10 for multi tab
    if (activeTab === 'single' && validFiles.length > 1) {
      setUploadError('Please upload only one image for single image detection')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    if (activeTab === 'multi' && (validFiles.length < 3 || validFiles.length > 10)) {
      setUploadError('Please upload 3-10 images for multi-image tracking')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setUploadedImages(validFiles)
    setUploadError('')
    await uploadFiles(validFiles)
    
    // Reset file input after processing
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      navigate('/login')
      return
    }

    const files = Array.from(e.dataTransfer.files)
    
    // Validate file types
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/tiff', 'image/tif']
    const validFiles = files.filter(file => allowedTypes.includes(file.type))
    
    if (validFiles.length === 0) {
      setUploadError('Please upload PNG, JPG, or TIFF images only')
      return
    }

    if (activeTab === 'single' && validFiles.length > 1) {
      setUploadError('Please upload only one image for single image detection')
      return
    }

    if (activeTab === 'multi' && (validFiles.length < 3 || validFiles.length > 10)) {
      setUploadError('Please upload 3-10 images for multi-image tracking')
      return
    }

    setUploadedImages(validFiles)
    setUploadError('')
    await uploadFiles(validFiles)
  }

  // Convert file to base64 string
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
        } else {
          reject(new Error('Failed to convert file to base64'))
        }
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const uploadFiles = async (files: File[]) => {
    if (!user) return

    setIsUploading(true)
    setUploadProgress(0)
    setUploadError('')

    try {
      // Check file sizes (Realtime DB has 256MB limit per node, base64 adds ~33% overhead)
      const maxSizePerFile = 10 * 1024 * 1024 // 10MB per file (becomes ~13MB as base64)
      const oversizedFiles = files.filter(file => file.size > maxSizePerFile)
      
      if (oversizedFiles.length > 0) {
        setUploadError(`File(s) too large. Maximum size is 10MB per file. Please compress your images.`)
        setIsUploading(false)
        return
      }

      const totalFiles = files.length
      let processedFiles = 0

      const uploadPromises = files.map(async (file) => {
        try {
          // Convert file to base64
          const base64Data = await fileToBase64(file)
          
          // Update progress
          processedFiles++
          const progress = (processedFiles / totalFiles) * 100
          setUploadProgress(Math.min(progress, 95))

          // Store image data directly in Realtime Database
          const imageMetadata = {
            userId: user.uid,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            imageData: base64Data, // Store base64 image data
            uploadDate: new Date().toISOString(),
            analysisType: activeTab === 'single' ? 'single' : 'multi',
            status: 'uploaded',
          }

          const newMetadataRef = push(dbRef(database, `tcc-uploads/${user.uid}`))
          await set(newMetadataRef, imageMetadata)

          return { url: base64Data, metadata: imageMetadata }
        } catch (error: any) {
          console.error('Upload error:', error)
          throw new Error(`Failed to upload ${file.name}: ${error.message}`)
        }
      })

      await Promise.all(uploadPromises)
      setUploadProgress(100)
      
      // Clear files after successful upload
      setTimeout(() => {
        setUploadedImages([])
        setUploadProgress(0)
        setIsUploading(false)
      }, 2000)
    } catch (error: any) {
      console.error('Upload failed:', error)
      setUploadError(error.message || 'Failed to upload images. Please try again.')
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleButtonClick = () => {
    if (!user) {
      navigate('/login')
      return
    }
    if (uploadedImages.length === 0) {
      setUploadError('Please upload images first')
      return
    }
    // TODO: Handle detection/tracking when authenticated
    console.log('Processing images:', uploadedImages)
  }

  return (
    <section className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 pt-32 pb-16">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-orange-400/40 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200/90 shadow-glow">
          <span className="text-lg">⚙️</span> Analysis Tools
        </div>
        <h2 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl">
          TCC Detection &amp; Tracking Tools
        </h2>
        <p className="text-base leading-relaxed text-slate-300">
          Upload satellite imagery to detect TCCs and predict their evolution. Our AI models provide
          real-time analysis and cyclogenesis probability.
        </p>
      </div>

      <div className="mx-auto flex max-w-xl items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 text-sm font-semibold shadow-glow">
        <button
          onClick={() => setActiveTab('single')}
          className={`flex-1 rounded-xl px-4 py-3 transition ${
            activeTab === 'single'
              ? 'bg-gradient-to-r from-accent to-accentDark text-midnight shadow-glow'
              : 'text-slate-200 hover:text-white'
          }`}
          type="button"
        >
          Single Image Detection
        </button>
        <button
          onClick={() => setActiveTab('multi')}
          className={`flex-1 rounded-xl px-4 py-3 transition ${
            activeTab === 'multi'
              ? 'bg-gradient-to-r from-accent to-accentDark text-midnight shadow-glow'
              : 'text-slate-200 hover:text-white'
          }`}
          type="button"
        >
          Multi-Image Tracking
        </button>
      </div>

      {uploadError && (
        <div className="mx-auto max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {uploadError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {activeTab === 'single' ? (
          <ToolCard
            title="Upload Satellite Image"
            description="Drag & drop or click to upload — Supports: PNG, JPG, TIFF"
            cta="Detect TCC"
            user={user}
            uploadedImages={uploadedImages}
            uploadProgress={uploadProgress}
            isUploading={isUploading}
            onUploadClick={handleUploadClick}
            onButtonClick={handleButtonClick}
            onFileChange={handleFileChange}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            fileInputRef={fileInputRef}
          />
        ) : (
          <ToolCard
            title="Upload Image Sequence"
            description="Upload multiple images for tracking — select 3-10 sequential satellite images"
            cta="Track & Predict"
            user={user}
            uploadedImages={uploadedImages}
            uploadProgress={uploadProgress}
            isUploading={isUploading}
            onUploadClick={handleUploadClick}
            onButtonClick={handleButtonClick}
            onFileChange={handleFileChange}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            fileInputRef={fileInputRef}
          />
        )}
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <span className="text-accent">⎈</span> Analysis Results
          </div>
          <div className="mt-8 flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 text-center text-slate-400">
            <div className="text-4xl">🎯</div>
            <p className="mt-3 text-sm">Upload an image and run analysis to see results</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ToolCard({
  title,
  description,
  cta,
  user,
  uploadedImages,
  uploadProgress,
  isUploading,
  onUploadClick,
  onButtonClick,
  onFileChange,
  onDragOver,
  onDrop,
  fileInputRef,
}: {
  title: string
  description: string
  cta: string
  user: User | null
  uploadedImages: File[]
  uploadProgress: number
  isUploading: boolean
  onUploadClick: () => void
  onButtonClick: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-center gap-2 text-lg font-semibold text-white">
        <span className="text-accent">⬆</span> {title}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/tiff,image/tif"
        multiple
        onChange={onFileChange}
        className="hidden"
      />

      <div
        onClick={user ? onUploadClick : undefined}
        onDragOver={user ? onDragOver : undefined}
        onDrop={user ? onDrop : undefined}
        className={`mt-6 flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 text-center transition ${
          user ? 'cursor-pointer hover:border-accent hover:bg-white/10' : ''
        } ${isUploading ? 'border-accent bg-accent/10' : ''}`}
      >
        {!user && (
          <div className="mb-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs text-orange-300">
            Sign in required
          </div>
        )}

        {isUploading ? (
          <>
            <div className="text-4xl text-accent mb-4">⏳</div>
            <p className="text-sm text-slate-300 mb-2">Uploading images...</p>
            <div className="w-full max-w-xs bg-white/10 rounded-full h-2 mb-2">
              <div
                className="bg-gradient-to-r from-accent to-accentDark h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400">{Math.round(uploadProgress)}%</p>
          </>
        ) : uploadedImages.length > 0 ? (
          <>
            <div className="text-4xl text-green-400 mb-2">✓</div>
            <p className="text-sm text-green-300 font-semibold mb-1">
              {uploadedImages.length} image{uploadedImages.length > 1 ? 's' : ''} uploaded successfully!
            </p>
            <div className="mt-2 space-y-1">
              {uploadedImages.map((file, idx) => (
                <p key={idx} className="text-xs text-slate-400 truncate max-w-xs">
                  {file.name}
                </p>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="text-4xl text-accent">⇪</div>
            <p className="mt-4 text-sm text-slate-300">{description}</p>
            {!user && (
              <p className="mt-2 text-xs text-slate-400">Click to sign in and upload</p>
            )}
          </>
        )}
      </div>

      <button
        onClick={onButtonClick}
        disabled={isUploading || uploadedImages.length === 0}
        className="mt-5 w-full rounded-2xl bg-gradient-to-r from-accent to-accentDark px-4 py-3 text-sm font-semibold text-midnight shadow-glow transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {cta}
      </button>
    </div>
  )
}

export default TryTools

