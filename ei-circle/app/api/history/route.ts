import { NextRequest, NextResponse } from 'next/server'
import { getOrdersByEmail } from '@/lib/sheets'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('ei_token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = verifyToken(token)

  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orders = await getOrdersByEmail(email)

  return NextResponse.json(orders)
}
