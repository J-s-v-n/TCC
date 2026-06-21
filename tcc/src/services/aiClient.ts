const API_BASE_URL = import.meta.env.VITE_AI_API_URL || 'http://localhost:8000'
const API_KEY = import.meta.env.VITE_AI_API_KEY

export type AnalyzeSingleResponse = {
  csv_blobs_url?: string
  csv_systems_url?: string
  csv_rollup_url?: string
  cluster_png_url?: string
  summary?: {
    num_systems?: number
    num_blobs?: number
  }
}

export type Phase1FrameResult = {
  frame_idx: number
  filename: string
  csv_blobs_url?: string
  csv_systems_url?: string
  cluster_png_url?: string
  summary?: {
    num_systems?: number
    num_blobs?: number
  }
}

export type AnalyzeMultiPhase1Response = {
  phase: 1
  total_frames: number
  results: Phase1FrameResult[]
}

export type Phase2FrameResult = {
  frame_idx: number
  filename: string
  tracking_png_url?: string
}

export type Phase2TrackStats = {
  track_id: number
  num_frames: number
  start_frame: number
  end_frame: number
  mean_area: number
  max_area: number
  mean_speed: number
}

export type AnalyzeMultiPhase2Response = {
  phase: 2
  total_frames: number
  frame_results: Phase2FrameResult[]
  tracks_csv_url?: string
  track_stats: Phase2TrackStats[]
}

export type Phase3CycloneProneDeal = {
  track_id: number
  reason: string
  persistence_frames: number
  mean_speed: number
  max_area: number
  mean_area: number
}

export type AnalyzeMultiPhase3Response = {
  phase: 3
  overlay_url?: string
  predicted_frame_url?: string
  csv_tracks_url?: string
  csv_cyclogenesis_url?: string
  cyclone_prone_track_ids: number[]
  cyclone_prone_track_details: Phase3CycloneProneDeal[]
  total_tracks: number
  cyclone_prone_count: number
}

export type AnalyzeMultiResponse = {
  last_frame_url?: string
  predicted_frame_url?: string
  overlay_url?: string
  csv_tcc_blobs_url?: string
  csv_tracks_url?: string
  csv_cyclogenesis_url?: string
  cyclone_prone_track_ids?: number[]
}

export async function analyzeSingleImage(file: File): Promise<AnalyzeSingleResponse> {
  const endpoint = `${API_BASE_URL.replace(/\/$/, '')}/analyze-single`
  const form = new FormData()
  form.append('file', file)

  const headers: Record<string, string> = {}
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`

  const res = await fetch(endpoint, {
    method: 'POST',
    body: form,
    headers,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed with status ${res.status}`)
  }

  return (await res.json()) as AnalyzeSingleResponse
}

export async function analyzeMultiPhase1(files: File[]): Promise<AnalyzeMultiPhase1Response> {
  if (files.length < 6) {
    throw new Error('At least 6 H5 files are required for multi-image phase 1 detection')
  }

  const endpoint = `${API_BASE_URL.replace(/\/$/, '')}/analyze-multi-phase1`
  const form = new FormData()
  
  // Append all files with field name "files" (FastAPI expects this)
  files.forEach((file) => {
    form.append('files', file)
  })

  // Do NOT set Content-Type header - browser will set it automatically with boundary
  const headers: Record<string, string> = {}
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`

  const res = await fetch(endpoint, {
    method: 'POST',
    body: form,
    headers,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let errorMessage = `Request failed with status ${res.status}`
    try {
      const errorJson = JSON.parse(text)
      if (errorJson.detail) {
        errorMessage = errorJson.detail
      }
    } catch {
      if (text) errorMessage = text
    }
    throw new Error(errorMessage)
  }

  return (await res.json()) as AnalyzeMultiPhase1Response
}

export async function analyzeMultiPhase2(files: File[]): Promise<AnalyzeMultiPhase2Response> {
  if (files.length < 6) {
    throw new Error('At least 6 H5 files are required for multi-image phase 2 tracking')
  }

  const endpoint = `${API_BASE_URL.replace(/\/$/, '')}/analyze-multi-phase2`
  const form = new FormData()
  
  // Append all files with field name "files" (FastAPI expects this)
  files.forEach((file) => {
    form.append('files', file)
  })

  // Do NOT set Content-Type header - browser will set it automatically with boundary
  const headers: Record<string, string> = {}
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`

  const res = await fetch(endpoint, {
    method: 'POST',
    body: form,
    headers,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let errorMessage = `Request failed with status ${res.status}`
    try {
      const errorJson = JSON.parse(text)
      if (errorJson.detail) {
        errorMessage = errorJson.detail
      }
    } catch {
      if (text) errorMessage = text
    }
    throw new Error(errorMessage)
  }

  return (await res.json()) as AnalyzeMultiPhase2Response
}

export async function analyzeMultiPhase3(files: File[]): Promise<AnalyzeMultiPhase3Response> {
  if (files.length < 6) {
    throw new Error('At least 6 H5 files are required for multi-image phase 3 cyclogenesis prediction')
  }

  const endpoint = `${API_BASE_URL.replace(/\/$/, '')}/analyze-multi-phase3`
  const form = new FormData()
  
  // Append all files with field name "files" (FastAPI expects this)
  files.forEach((file) => {
    form.append('files', file)
  })

  // Do NOT set Content-Type header - browser will set it automatically with boundary
  const headers: Record<string, string> = {}
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`

  const res = await fetch(endpoint, {
    method: 'POST',
    body: form,
    headers,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let errorMessage = `Request failed with status ${res.status}`
    try {
      const errorJson = JSON.parse(text)
      if (errorJson.detail) {
        errorMessage = errorJson.detail
      }
    } catch {
      if (text) errorMessage = text
    }
    throw new Error(errorMessage)
  }

  return (await res.json()) as AnalyzeMultiPhase3Response
}

export async function analyzeMultiImages(files: File[]): Promise<AnalyzeMultiResponse> {
  if (files.length < 6) {
    throw new Error('At least 6 H5 files are required for multi-image tracking')
  }

  const endpoint = `${API_BASE_URL.replace(/\/$/, '')}/analyze-multi`
  const form = new FormData()
  
  // Append all files with field name "files" (FastAPI expects this)
  files.forEach((file) => {
    form.append('files', file)
  })

  // Do NOT set Content-Type header - browser will set it automatically with boundary
  const headers: Record<string, string> = {}
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`

  const res = await fetch(endpoint, {
    method: 'POST',
    body: form,
    headers,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let errorMessage = `Request failed with status ${res.status}`
    try {
      const errorJson = JSON.parse(text)
      if (errorJson.detail) {
        errorMessage = errorJson.detail
      }
    } catch {
      if (text) errorMessage = text
    }
    throw new Error(errorMessage)
  }

  return (await res.json()) as AnalyzeMultiResponse
}


