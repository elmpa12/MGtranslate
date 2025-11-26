'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, Video, Languages, Play, Square, Loader2, Wifi, WifiOff } from 'lucide-react'

// Dynamic URLs based on current hostname (works on LAN)
const getOrchestratorApi = () => {
  if (typeof window === 'undefined') return 'http://localhost:3001'
  return `http://${window.location.hostname}:3001`
}

const getOrchestratorWs = () => {
  if (typeof window === 'undefined') return 'ws://localhost:3001/ws'
  // Use wss:// if page is served over https, otherwise use ws://
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.hostname}:3001/ws`
}

export default function Home() {
  const [meetLink, setMeetLink] = useState('')
  const [sourceLang, setSourceLang] = useState('en-US')
  const [targetLang, setTargetLang] = useState('pt-BR')
  const [session, setSession] = useState(null)
  const [transcripts, setTranscripts] = useState([])
  const [botStatus, setBotStatus] = useState('idle')
  const [loading, setLoading] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [wsError, setWsError] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const transcriptsEndRef = useRef(null)

  // WebSocket connection with reconnection logic
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const wsUrl = getOrchestratorWs()
    console.log('Connecting to WebSocket:', wsUrl)

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected!')
        setWsConnected(true)
        setWsError(null)
        ws.send(JSON.stringify({ type: 'register', clientType: 'ui' }))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleWsMessage(message)
        } catch (e) {
          console.error('Failed to parse message:', e)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setWsError('Connection error')
      }

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason)
        setWsConnected(false)
        wsRef.current = null

        // Reconnect after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...')
          connectWebSocket()
        }, 3000)
      }
    } catch (err) {
      console.error('Failed to create WebSocket:', err)
      setWsError('Failed to connect')
    }
  }, [])

  useEffect(() => {
    connectWebSocket()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connectWebSocket])

  const handleWsMessage = (message) => {
    switch (message.type) {
      case 'session:created':
        setSession(message.session)
        break

      case 'bot:status':
        setBotStatus(message.status)
        break

      case 'transcript:new':
        setTranscripts(prev => [...prev, message.transcript])
        break

      case 'translation:new':
        setTranscripts(prev =>
          prev.map(t =>
            t.id === message.translation.transcriptId
              ? { ...t, translation: message.translation.text }
              : t
          )
        )
        break

      case 'session:ended':
        if (session?.id === message.sessionId) {
          setSession(null)
          setBotStatus('idle')
        }
        break
    }
  }

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcripts])

  const startSession = async () => {
    if (!meetLink) return

    setLoading(true)
    try {
      const res = await fetch(`${getOrchestratorApi()}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetLink, sourceLang, targetLang })
      })

      if (res.ok) {
        const data = await res.json()
        setSession(data)
        setTranscripts([])
        setBotStatus('starting')
      }
    } catch (err) {
      console.error('Failed to start session:', err)
    }
    setLoading(false)
  }

  const stopSession = async () => {
    if (!session) return

    setLoading(true)
    try {
      await fetch(`${getOrchestratorApi()}/sessions/${session.id}`, {
        method: 'DELETE'
      })
      setSession(null)
      setBotStatus('idle')
    } catch (err) {
      console.error('Failed to stop session:', err)
    }
    setLoading(false)
  }

  const statusColors = {
    idle: 'bg-gray-500',
    starting: 'bg-yellow-500',
    checking_auth: 'bg-yellow-500',
    joining: 'bg-yellow-500',
    waiting_admission: 'bg-orange-500',
    in_call: 'bg-green-500',
    error: 'bg-red-500',
    stopped: 'bg-gray-500'
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Languages className="w-10 h-10 text-blue-500" />
            <div>
              <h1 className="text-3xl font-bold">MGtranslate</h1>
              <p className="text-gray-400">Real-time Meeting Translation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wsConnected ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            <span className={`text-sm ${wsConnected ? 'text-green-500' : 'text-red-500'}`}>
              {wsConnected ? 'Connected' : wsError || 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <div className="grid gap-4">
            {/* Meet Link Input */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Google Meet Link</label>
              <input
                type="text"
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                value={meetLink}
                onChange={(e) => setMeetLink(e.target.value)}
                disabled={!!session}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>

            {/* Language Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Source Language</label>
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  disabled={!!session}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="pt-BR">Portuguese (BR)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Target Language</label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  disabled={!!session}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="pt-BR">Portuguese (BR)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                </select>
              </div>
            </div>

            {/* Status & Controls */}
            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${statusColors[botStatus]} animate-pulse`} />
                <span className="text-gray-300 capitalize">{botStatus.replace('_', ' ')}</span>
              </div>

              {!session ? (
                <button
                  onClick={startSession}
                  disabled={!meetLink || loading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  Start Translation
                </button>
              ) : (
                <button
                  onClick={stopSession}
                  disabled={loading}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5" />}
                  Stop
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Transcripts */}
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Live Transcription
          </h2>

          <div className="h-96 overflow-y-auto space-y-4 bg-gray-950 rounded-lg p-4">
            {transcripts.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {session ? 'Waiting for speech...' : 'Start a session to see transcripts'}
              </div>
            ) : (
              transcripts.map((t, i) => (
                <div key={t.id || i} className="border-l-2 border-blue-500 pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded">
                      {t.lang || 'detected'}
                    </span>
                    {t.direction && (
                      <span className="text-xs text-gray-500">{t.direction}</span>
                    )}
                  </div>
                  <p className="text-gray-300">{t.text}</p>
                  {t.translation && (
                    <p className="text-green-400 mt-1 text-sm">
                      → {t.translation}
                    </p>
                  )}
                  <span className="text-xs text-gray-600">{t.timestamp}</span>
                </div>
              ))
            )}
            <div ref={transcriptsEndRef} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-600 text-sm mt-8">
          MGtranslate v1.0 - Powered by Google Cloud AI
        </div>
      </div>
    </main>
  )
}
