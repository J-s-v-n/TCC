import type React from 'react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../firebase/config'
import { analyzeSingleImage, analyzeMultiPhase1, analyzeMultiPhase2, analyzeMultiPhase3, analyzeMultiImages, type AnalyzeSingleResponse, type AnalyzeMultiPhase1Response, type AnalyzeMultiPhase2Response, type AnalyzeMultiPhase3Response, type AnalyzeMultiResponse } from '../services/aiClient'

function TryTools() {
  const [activeTab, setActiveTab] = useState<'single' | 'multi'>('single')
  
  const handleTabChange = (tab: 'single' | 'multi') => {
    setActiveTab(tab)
    setAnalysisResult(null)
    setMultiPhase1Results(null)
    setMultiPhase2Results(null)
    setMultiPhase3Results(null)
    setMultiAnalysisResult(null)
    setAnalysisError('')
    setUploadError('')
    setUploadedImages([])
    setPhase1Complete(false)
    setPhase2Complete(false)
    setPhase3Complete(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  const [user, setUser] = useState<User | null>(null)
  const [uploadedImages, setUploadedImages] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string>('')
  const [analysisResult, setAnalysisResult] = useState<AnalyzeSingleResponse | null>(null)
  const [multiPhase1Results, setMultiPhase1Results] = useState<AnalyzeMultiPhase1Response | null>(null)
  const [multiPhase2Results, setMultiPhase2Results] = useState<AnalyzeMultiPhase2Response | null>(null)
  const [multiPhase3Results, setMultiPhase3Results] = useState<AnalyzeMultiPhase3Response | null>(null)
  const [multiAnalysisResult, setMultiAnalysisResult] = useState<AnalyzeMultiResponse | null>(null)
  const [analysisError, setAnalysisError] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [phase1Complete, setPhase1Complete] = useState(false)
  const [phase2Complete, setPhase2Complete] = useState(false)
  const [phase3Complete, setPhase3Complete] = useState(false)
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
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/tiff', 'image/tif', 'application/x-hdf', 'application/octet-stream']
    const validFiles = fileArray.filter(file => allowedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.h5'))

    if (validFiles.length === 0) {
      setUploadError('Please upload PNG, JPG, TIFF, or H5 images only')
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

    if (activeTab === 'multi' && validFiles.length < 6) {
      setUploadError('Please upload at least 6 H5 files for multi-image tracking and cyclogenesis prediction')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Check size (skip DB; only ensure we don't try to handle huge files client-side)
    const maxSizePerFile = 50 * 1024 * 1024 // 50MB
    const oversizedFiles = validFiles.filter(file => file.size > maxSizePerFile)
    if (oversizedFiles.length > 0) {
      setUploadError('File(s) too large. Maximum size is 50MB per file.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploadedImages(validFiles)
    setUploadError('')
    setAnalysisResult(null)
    setMultiPhase1Results(null)
    setMultiPhase2Results(null)
    setMultiAnalysisResult(null)
    setAnalysisError('')
    setIsUploading(false)
    setUploadProgress(100)

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
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/tiff', 'image/tif', 'application/x-hdf', 'application/octet-stream']
    const validFiles = files.filter(file => allowedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.h5'))
    
    if (validFiles.length === 0) {
      setUploadError('Please upload PNG, JPG, TIFF, or H5 images only')
      return
    }

    if (activeTab === 'single' && validFiles.length > 1) {
      setUploadError('Please upload only one image for single image detection')
      return
    }

    if (activeTab === 'multi' && validFiles.length < 6) {
      setUploadError('Please upload at least 6 H5 files for multi-image tracking and cyclogenesis prediction')
      return
    }

    const maxSizePerFile = 50 * 1024 * 1024 // 50MB
    const oversizedFiles = validFiles.filter(file => file.size > maxSizePerFile)
    if (oversizedFiles.length > 0) {
      setUploadError('File(s) too large. Maximum size is 50MB per file.')
      return
    }

    setUploadedImages(validFiles)
    setUploadError('')
    setAnalysisResult(null)
    setMultiPhase1Results(null)
    setMultiAnalysisResult(null)
    setAnalysisError('')
    setIsUploading(false)
    setUploadProgress(100)
  }

  const handleButtonClick = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    if (uploadedImages.length === 0) {
      setUploadError('Please upload images first')
      return
    }
    if (activeTab === 'single') {
      try {
        setIsAnalyzing(true)
        setAnalysisError('')
        setAnalysisResult(null)
        setMultiPhase1Results(null)
        setMultiPhase2Results(null)
        setMultiAnalysisResult(null)
        const file = uploadedImages[0]
        const response = await analyzeSingleImage(file)
        setAnalysisResult(response)
      } catch (err: any) {
        console.error('Analysis failed:', err)
        setAnalysisError(err?.message || 'Failed to analyze image')
      } finally {
        setIsAnalyzing(false)
      }
    }
  }

  const handlePhase1Click = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    if (uploadedImages.length === 0) {
      setUploadError('Please upload images first')
      return
    }
    if (uploadedImages.length < 6) {
      setUploadError('Please upload at least 6 H5 files')
      return
    }
    try {
      setIsAnalyzing(true)
      setAnalysisError('')
      const response = await analyzeMultiPhase1(uploadedImages)
      setMultiPhase1Results(response)
      setPhase1Complete(true)
    } catch (err: any) {
      console.error('Phase 1 analysis failed:', err)
      setAnalysisError(err?.message || 'Failed to analyze phase 1')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handlePhase2Click = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    if (uploadedImages.length === 0) {
      setUploadError('Please upload images first')
      return
    }
    if (uploadedImages.length < 6) {
      setUploadError('Please upload at least 6 H5 files')
      return
    }
    try {
      setIsAnalyzing(true)
      setAnalysisError('')
      const response = await analyzeMultiPhase2(uploadedImages)
      setMultiPhase2Results(response)
      setPhase2Complete(true)
    } catch (err: any) {
      console.error('Phase 2 analysis failed:', err)
      setAnalysisError(err?.message || 'Failed to analyze phase 2')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handlePhase3Click = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    if (uploadedImages.length === 0) {
      setUploadError('Please upload images first')
      return
    }
    if (uploadedImages.length < 6) {
      setUploadError('Please upload at least 6 H5 files')
      return
    }
    try {
      setIsAnalyzing(true)
      setAnalysisError('')
      const response = await analyzeMultiPhase3(uploadedImages)
      setMultiPhase3Results(response)
      setPhase3Complete(true)
    } catch (err: any) {
      console.error('Phase 3 analysis failed:', err)
      setAnalysisError(err?.message || 'Failed to analyze phase 3')
    } finally {
      setIsAnalyzing(false)
    }
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
          onClick={() => handleTabChange('single')}
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
          onClick={() => handleTabChange('multi')}
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
            description="Drag & drop or click to upload — Supports: PNG, JPG, TIFF, H5"
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
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <span className="text-accent">⬆</span> Upload Multiple H5 Files
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".h5"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onClick={user ? handleUploadClick : undefined}
              onDragOver={user ? handleDragOver : undefined}
              onDrop={user ? handleDrop : undefined}
              className={`mt-6 flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 text-center transition ${
                user ? 'cursor-pointer hover:border-accent hover:bg-white/10' : ''
              }`}
            >
              {!user && (
                <div className="mb-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs text-orange-300">
                  Sign in required
                </div>
              )}

              {uploadedImages.length > 0 ? (
                <>
                  <div className="text-4xl text-green-400 mb-2">✓</div>
                  <p className="text-sm text-green-300 font-semibold mb-1">
                    {uploadedImages.length} H5 file{uploadedImages.length > 1 ? 's' : ''} ready
                  </p>
                  <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
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
                  <p className="mt-4 text-sm text-slate-300">Upload at least 6 H5 files in chronological order</p>
                </>
              )}
            </div>

            {/* Phase Buttons */}
            <div className="mt-5 space-y-3">
              <button
                onClick={handlePhase1Click}
                disabled={!uploadedImages.length || uploadedImages.length < 6 || isAnalyzing}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing && !phase1Complete ? '⏳ Phase 1: TCC Detection...' : 'Phase 1: TCC Detection'}
              </button>

              <button
                onClick={handlePhase2Click}
                disabled={!phase1Complete || isAnalyzing}
                className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold shadow-glow transition ${
                  phase1Complete
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:brightness-110'
                    : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                }`}
              >
                {isAnalyzing && phase1Complete && !phase2Complete ? '⏳ Phase 2: Tracking...' : 'Phase 2: Tracking'}
              </button>

              <button
                onClick={handlePhase3Click}
                disabled={!phase2Complete || isAnalyzing}
                className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold shadow-glow transition ${
                  phase2Complete
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:brightness-110'
                    : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                }`}
              >
                {isAnalyzing && phase2Complete && !phase3Complete ? '⏳ Phase 3: Cyclogenesis...' : 'Phase 3: Cyclogenesis'}
              </button>
            </div>
          </div>
        )}
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <span className="text-accent">⎈</span> Analysis Results
          </div>
          <div className="mt-6 space-y-3 text-sm text-slate-300">
            {isAnalyzing && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-accent">
                  {activeTab === 'single' 
                    ? 'Running preprocessing + DBSCAN…' 
                    : 'Detecting TCCs on each frame…'}
                </p>
                <p className="text-xs text-slate-400">This may take a few seconds.</p>
              </div>
            )}
            {analysisError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                {analysisError}
              </div>
            )}
            {!analysisResult && !multiPhase1Results && !multiAnalysisResult && !isAnalyzing && !analysisError && (
              <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 text-center text-slate-400">
                <div className="text-4xl">🎯</div>
                <p className="mt-3 text-sm">Upload {activeTab === 'single' ? 'an image' : 'at least 6 H5 files'} and run analysis to see results</p>
              </div>
            )}
            {/* Single Image Results */}
            {analysisResult && activeTab === 'single' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold mb-2">Outputs</p>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-slate-400">Blob CSV (per-component)</p>
                      {analysisResult.csv_blobs_url ? (
                        <a className="text-accent hover:text-accentDark underline" href={analysisResult.csv_blobs_url} target="_blank" rel="noreferrer">
                          Open blob CSV
                        </a>
                      ) : (
                        <span className="text-slate-500">Not returned</span>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-400">Systems CSV (DBSCAN clusters)</p>
                      {analysisResult.csv_systems_url ? (
                        <a className="text-accent hover:text-accentDark underline" href={analysisResult.csv_systems_url} target="_blank" rel="noreferrer">
                          Open systems CSV
                        </a>
                      ) : (
                        <span className="text-slate-500">Not returned</span>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-400">Roll-up CSV (all frames)</p>
                      {analysisResult.csv_rollup_url ? (
                        <a className="text-accent hover:text-accentDark underline" href={analysisResult.csv_rollup_url} target="_blank" rel="noreferrer">
                          Open roll-up CSV
                        </a>
                      ) : (
                        <span className="text-slate-500">Not returned</span>
                      )}
                    </div>
                  </div>
                </div>
                {analysisResult.cluster_png_url && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-white font-semibold mb-2">Cluster Visualization</p>
                    <img
                      src={analysisResult.cluster_png_url}
                      alt="DBSCAN clusters"
                      className="w-full rounded-lg border border-white/10"
                    />
                  </div>
                )}
                {analysisResult.summary && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-slate-200">
                    <p className="font-semibold text-white">Summary</p>
                    <p className="text-sm">Systems: {analysisResult.summary.num_systems ?? '—'}</p>
                    <p className="text-sm">Blobs: {analysisResult.summary.num_blobs ?? '—'}</p>
                  </div>
                )}
              </div>
            )}
            {/* Multi Image Phase 1 Results */}
            {multiPhase1Results && activeTab === 'multi' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold mb-2">Phase 1: TCC Detection</p>
                  <p className="text-sm text-slate-400 mb-4">
                    Detected Tropical Cloud Clusters on {multiPhase1Results.total_frames} frames
                  </p>
                </div>
                
                {/* Frame Results Grid */}
                <div className="space-y-6">
                  {multiPhase1Results.results.map((frameResult, idx) => (
                    <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-4">
                        <p className="text-white font-semibold">Frame {frameResult.frame_idx + 1}</p>
                        <p className="text-xs text-slate-400">{frameResult.filename}</p>
                      </div>
                      
                      {/* Visualization */}
                      {frameResult.cluster_png_url && (
                        <div className="mb-4">
                          <p className="text-sm text-slate-300 mb-2">TCC Visualization</p>
                          <img
                            src={frameResult.cluster_png_url}
                            alt={`Frame ${frameResult.frame_idx + 1} clusters`}
                            className="w-full rounded-lg border border-white/10"
                          />
                        </div>
                      )}
                      
                      {/* Summary */}
                      {frameResult.summary && (
                        <div className="mb-4 grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-white/5 p-3">
                            <p className="text-xs text-slate-400">Systems (DBSCAN)</p>
                            <p className="text-lg font-semibold text-accent">{frameResult.summary.num_systems ?? '0'}</p>
                          </div>
                          <div className="rounded-lg bg-white/5 p-3">
                            <p className="text-xs text-slate-400">Blobs (Connected Components)</p>
                            <p className="text-lg font-semibold text-accent">{frameResult.summary.num_blobs ?? '0'}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Download CSVs */}
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-slate-400 mb-1">Blobs CSV</p>
                          {frameResult.csv_blobs_url ? (
                            <a 
                              className="inline-block text-accent hover:text-accentDark underline" 
                              href={frameResult.csv_blobs_url}
                              download={`frame_${frameResult.frame_idx}_blobs.csv`}
                            >
                              Download
                            </a>
                          ) : (
                            <span className="text-slate-500">Not available</span>
                          )}
                        </div>
                        <div>
                          <p className="text-slate-400 mb-1">Systems CSV</p>
                          {frameResult.csv_systems_url ? (
                            <a 
                              className="inline-block text-accent hover:text-accentDark underline" 
                              href={frameResult.csv_systems_url}
                              download={`frame_${frameResult.frame_idx}_systems.csv`}
                            >
                              Download
                            </a>
                          ) : (
                            <span className="text-slate-500">Not available</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Multi Image Phase 2 Results */}
            {multiPhase2Results && activeTab === 'multi' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold mb-2">Phase 2: TCC Tracking</p>
                  <p className="text-sm text-slate-400 mb-4">
                    Tracked Tropical Cloud Clusters across {multiPhase2Results.total_frames} frames with Track IDs assigned
                  </p>
                </div>

                {/* Frame Visualizations with Track IDs */}
                <div className="space-y-6">
                  {multiPhase2Results.frame_results.map((frameResult, idx) => (
                    <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-4">
                        <p className="text-white font-semibold">Frame {frameResult.frame_idx + 1}</p>
                        <p className="text-xs text-slate-400">{frameResult.filename}</p>
                      </div>

                      {/* Tracking Visualization */}
                      {frameResult.tracking_png_url && (
                        <div className="mb-4">
                          <p className="text-sm text-slate-300 mb-2">Track IDs Overlay</p>
                          <img
                            src={frameResult.tracking_png_url}
                            alt={`Frame ${frameResult.frame_idx + 1} tracking`}
                            className="w-full rounded-lg border border-white/10"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Track Statistics Summary */}
                {multiPhase2Results.track_stats && multiPhase2Results.track_stats.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white font-semibold mb-4">Track Statistics</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-slate-300">
                        <thead className="border-b border-white/10 text-slate-200">
                          <tr>
                            <th className="text-left px-2 py-2">Track ID</th>
                            <th className="text-center px-2 py-2">Frames</th>
                            <th className="text-center px-2 py-2">Start</th>
                            <th className="text-center px-2 py-2">End</th>
                            <th className="text-center px-2 py-2">Avg Area</th>
                            <th className="text-center px-2 py-2">Max Area</th>
                            <th className="text-center px-2 py-2">Avg Speed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {multiPhase2Results.track_stats.map((stat) => (
                            <tr key={stat.track_id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="px-2 py-2 font-semibold text-accent">TID:{stat.track_id}</td>
                              <td className="text-center px-2 py-2">{stat.num_frames}</td>
                              <td className="text-center px-2 py-2">{stat.start_frame}</td>
                              <td className="text-center px-2 py-2">{stat.end_frame}</td>
                              <td className="text-center px-2 py-2">{Math.round(stat.mean_area)}</td>
                              <td className="text-center px-2 py-2">{stat.max_area}</td>
                              <td className="text-center px-2 py-2">{stat.mean_speed.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Download Tracks CSV */}
                    <div className="mt-4">
                      <p className="text-slate-400 mb-2 text-sm">Full Track Data</p>
                      {multiPhase2Results.tracks_csv_url ? (
                        <a
                          className="inline-block text-accent hover:text-accentDark underline text-sm"
                          href={multiPhase2Results.tracks_csv_url}
                          download="tracks.csv"
                        >
                          Download Tracks CSV
                        </a>
                      ) : (
                        <span className="text-slate-500 text-sm">Not available</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Multi Image Phase 3 Results */}
            {multiPhase3Results && activeTab === 'multi' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold mb-2">Phase 3: Cyclogenesis Prediction</p>
                  <p className="text-sm text-slate-400 mb-4">
                    ConvLSTM-based next frame prediction with rule-based cyclogenesis detection
                  </p>
                </div>

                {/* Legend */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold mb-2">Legend</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-red-500"></div>
                      <span className="text-slate-300">Red: Cyclogenesis-prone convective systems (early stage)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-yellow-400"></div>
                      <span className="text-slate-300">Yellow: Normal TCC clusters</span>
                    </div>
                  </div>
                </div>

                {/* Visualizations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {multiPhase3Results.predicted_frame_url && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-white font-semibold mb-2 text-sm text-center">ConvLSTM Predicted Frame</p>
                      <img
                        src={multiPhase3Results.predicted_frame_url}
                        alt="Predicted next frame"
                        className="w-full rounded-lg border border-white/10"
                      />
                    </div>
                  )}
                  {multiPhase3Results.overlay_url && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-white font-semibold mb-2 text-sm text-center">Cyclogenesis Overlay</p>
                      <img
                        src={multiPhase3Results.overlay_url}
                        alt="Cyclogenesis overlay"
                        className="w-full rounded-lg border border-white/10"
                      />
                    </div>
                  )}
                </div>

                {/* Cyclogenesis Detection Summary */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold mb-3">Cyclogenesis Detection Summary</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10 p-3 border border-blue-400/30">
                      <p className="text-xs text-slate-400 mb-1">Total Tracks</p>
                      <p className="text-2xl font-bold text-blue-300">{multiPhase3Results.total_tracks}</p>
                    </div>
                    <div className={`rounded-lg p-3 border ${
                      multiPhase3Results.cyclone_prone_count > 0 
                        ? 'bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-400/30' 
                        : 'bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-400/30'
                    }`}>
                      <p className="text-xs text-slate-400 mb-1">Cyclone-Prone Tracks</p>
                      <p className={`text-2xl font-bold ${
                        multiPhase3Results.cyclone_prone_count > 0 ? 'text-red-300' : 'text-green-300'
                      }`}>{multiPhase3Results.cyclone_prone_count}</p>
                    </div>
                  </div>
                </div>

                {/* Cyclone-Prone Track Details */}
                {multiPhase3Results.cyclone_prone_count > 0 && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <p className="text-red-300 font-semibold mb-4">⚠️ Cyclone-Prone Tracks Detected</p>
                    <div className="space-y-3">
                      {multiPhase3Results.cyclone_prone_track_details.map((detail, idx) => (
                        <div key={idx} className="rounded-lg bg-red-900/20 border border-red-400/30 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-red-200">Track ID: {detail.track_id}</p>
                            <span className="text-xs bg-red-500/30 text-red-300 px-2 py-1 rounded">{detail.reason}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                            <p>Frames: <span className="text-white font-semibold">{detail.persistence_frames}</span></p>
                            <p>Speed: <span className="text-white font-semibold">{detail.mean_speed.toFixed(2)} px/f</span></p>
                            <p>Avg Area: <span className="text-white font-semibold">{Math.round(detail.mean_area)}</span></p>
                            <p>Max Area: <span className="text-white font-semibold">{detail.max_area}</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {multiPhase3Results.cyclone_prone_count === 0 && (
                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                    <p className="text-green-300 font-semibold mb-2">✓ No Immediate Cyclogenesis Threat</p>
                    <p className="text-sm text-slate-300">
                      All detected tracks lack the persistence and sustained motion required for cyclogenesis prediction.
                    </p>
                  </div>
                )}

                {/* CSV Downloads */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold mb-3">Download Results</p>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-slate-400 mb-1">Tracks CSV</p>
                      {multiPhase3Results.csv_tracks_url ? (
                        <a 
                          className="inline-block text-accent hover:text-accentDark underline" 
                          href={multiPhase3Results.csv_tracks_url} 
                          download="phase3_tracks.csv"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-slate-500">Not available</span>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">Cyclogenesis CSV</p>
                      {multiPhase3Results.csv_cyclogenesis_url ? (
                        <a 
                          className="inline-block text-accent hover:text-accentDark underline" 
                          href={multiPhase3Results.csv_cyclogenesis_url} 
                          download="phase3_cyclogenesis.csv"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-slate-500">Not available</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Multi Image Results */}
            {multiAnalysisResult && activeTab === 'multi' && (
              <div className="space-y-4">
                {/* Legend */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold mb-2">Legend</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-red-500"></div>
                      <span className="text-slate-300">Red: Cyclogenesis-prone convective systems (early stage)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-yellow-400"></div>
                      <span className="text-slate-300">Yellow: Normal TCC clusters</span>
                    </div>
                  </div>
                </div>
                
                {/* Images side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {multiAnalysisResult.last_frame_url && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-white font-semibold mb-2 text-sm text-center">Last Observed Frame</p>
                      <img
                        src={multiAnalysisResult.last_frame_url}
                        alt="Last observed frame"
                        className="w-full rounded-lg border border-white/10"
                      />
                    </div>
                  )}
                  {multiAnalysisResult.predicted_frame_url && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-white font-semibold mb-2 text-sm text-center">Predicted Next Frame</p>
                      <img
                        src={multiAnalysisResult.predicted_frame_url}
                        alt="Predicted next frame"
                        className="w-full rounded-lg border border-white/10"
                      />
                    </div>
                  )}
                  {multiAnalysisResult.overlay_url && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-white font-semibold mb-2 text-sm text-center">Overlay (Cyclogenesis)</p>
                      <img
                        src={multiAnalysisResult.overlay_url}
                        alt="Overlay with cyclogenesis highlights"
                        className="w-full rounded-lg border border-white/10"
                      />
                    </div>
                  )}
                </div>

                {/* CSV Downloads */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-white font-semibold mb-3">CSV Downloads</p>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-slate-400 mb-1">TCC Blobs CSV</p>
                      {multiAnalysisResult.csv_tcc_blobs_url ? (
                        <a 
                          className="inline-block text-accent hover:text-accentDark underline" 
                          href={multiAnalysisResult.csv_tcc_blobs_url} 
                          download="tcc_blobs.csv"
                        >
                          Download tcc_blobs.csv
                        </a>
                      ) : (
                        <span className="text-slate-500">Not available</span>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">Tracks CSV</p>
                      {multiAnalysisResult.csv_tracks_url ? (
                        <a 
                          className="inline-block text-accent hover:text-accentDark underline" 
                          href={multiAnalysisResult.csv_tracks_url} 
                          download="tracks.csv"
                        >
                          Download tracks.csv
                        </a>
                      ) : (
                        <span className="text-slate-500">Not available</span>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">Cyclogenesis CSV</p>
                      {multiAnalysisResult.csv_cyclogenesis_url ? (
                        <a 
                          className="inline-block text-accent hover:text-accentDark underline" 
                          href={multiAnalysisResult.csv_cyclogenesis_url} 
                          download="cyclogenesis.csv"
                        >
                          Download cyclogenesis.csv
                        </a>
                      ) : (
                        <span className="text-slate-500">Not available</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cyclone-prone Track IDs */}
                {multiAnalysisResult.cyclone_prone_track_ids && multiAnalysisResult.cyclone_prone_track_ids.length > 0 && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <p className="text-red-300 font-semibold mb-2">⚠️ Cyclone-Prone Tracks Detected</p>
                    <p className="text-sm text-slate-300 mb-2">
                      Track IDs with cyclogenesis potential: {multiAnalysisResult.cyclone_prone_track_ids.join(', ')}
                    </p>
                    <p className="text-xs text-slate-400">
                      These tracks show persistent motion and sustained speed, indicating potential cyclone development.
                    </p>
                  </div>
                )}
                {multiAnalysisResult.cyclone_prone_track_ids && multiAnalysisResult.cyclone_prone_track_ids.length === 0 && (
                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                    <p className="text-green-300 font-semibold mb-2">✓ No Cyclone-Prone Tracks</p>
                    <p className="text-sm text-slate-300">
                      No tracks detected with cyclogenesis potential based on the rule-based criteria.
                    </p>
                  </div>
                )}
              </div>
            )}
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
        accept="image/png,image/jpeg,image/jpg,image/tiff,image/tif,.h5"
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

