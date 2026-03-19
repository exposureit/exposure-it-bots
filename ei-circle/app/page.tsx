'use client'

import { useState, useEffect } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      document.cookie = 'ei_token=' + token + '; path=/; max-age=604800; samesite=lax'
      window.location.href = '/portal'
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      if (data.token) {
        window.location.href = '/portal'
      }
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{ backgroundColor: '#0A0A0A', minHeight: '100vh' }}
      className="flex items-center justify-center"
    >
      <div style={{ maxWidth: 400, width: '100%' }} className="px-6">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img
            src="/logo.png"
            alt="Exposure IT"
            width={60}
            height={60}
            className="rounded-full"
          />
        </div>

        {/* Brand Name */}
        <p
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 3,
            color: '#F1F1F1',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          EXPOSURE IT
        </p>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 10,
            letterSpacing: 2.5,
            color: '#49D400',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 32,
          }}
        >
          THE EI CIRCLE
        </p>

        {/* Description */}
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            color: '#BBBBBB',
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          Sign in to your rewards portal
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            style={{
              width: '100%',
              backgroundColor: '#111111',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: '12px 16px',
              color: '#F1F1F1',
              fontFamily: 'Inter, sans-serif',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#49D400')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.06)')}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              marginTop: 16,
              backgroundColor: '#49D400',
              color: '#000000',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              borderRadius: 12,
              padding: '12px 0',
              fontSize: 12,
              letterSpacing: 2,
              textTransform: 'uppercase',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'background-color 0.2s, opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = '#23F135'
            }}
            onMouseLeave={(e) => {
              if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = '#49D400'
            }}
          >
            {loading ? 'VERIFYING...' : 'ACCESS MY PORTAL'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <p
            style={{
              color: '#f87171',
              fontSize: 14,
              textAlign: 'center',
              marginTop: 12,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
