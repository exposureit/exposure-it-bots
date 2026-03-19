import { NextResponse } from 'next/server'
import { getAgentByEmail } from '@/lib/sheets'
import { generateToken } from '@/lib/auth'

export async function POST(request: Request) {
  const { email } = await request.json()

  const agent = await getAgentByEmail(email)

  if (!agent) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  }

  const token = await generateToken(email)

  const response = NextResponse.json({ token })

  response.cookies.set('ei_token', token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  return response
}
