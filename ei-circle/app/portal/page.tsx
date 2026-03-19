'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import TabNav from '@/components/TabNav'
import PointsCard from '@/components/PointsCard'
import QuickStats from '@/components/QuickStats'
import ReferralCard from '@/components/ReferralCard'
import TierRoadmap from '@/components/TierRoadmap'
import HistoryList from '@/components/HistoryList'
import HowItWorks from '@/components/HowItWorks'

interface AgentData {
  email: string
  name: string
  phone: string
  agentId: string
  totalPoints: number
  currentTier: string
  totalShoots: number
  pointsRedeemed: number
  availableBalance: number
  referralCode: string
  memberSince: string
  portalLink: string
}

interface Order {
  orderId: string
  servicesOrdered: string
  invoiceAmount: string
  pointsThisOrder: number
  creditUsed: string
  status: string
  dateOrdered: string
  datePaid: string
  referralOrder: string
  notes: string
}

type Tab = 'DASHBOARD' | 'HISTORY' | 'HOW IT WORKS'

export default function PortalPage() {
  const [agent, setAgent] = useState<AgentData | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentRes, historyRes] = await Promise.all([
          fetch('/api/agent'),
          fetch('/api/history'),
        ])

        if (agentRes.status === 401 || historyRes.status === 401) {
          window.location.href = '/'
          return
        }

        const agentData = await agentRes.json()
        const historyData = await historyRes.json()

        setAgent(agentData)
        setOrders(historyData)
      } catch {
        window.location.href = '/'
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const firstName = agent?.name?.split(' ')[0] || ''

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0A0A0A', minHeight: '100vh', paddingTop: 60 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 96px' }}>
          {/* Skeleton placeholders */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                backgroundColor: '#111111',
                borderRadius: 12,
                height: i === 1 ? 80 : i === 2 ? 160 : 120,
                marginBottom: 16,
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
          ))}
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#0A0A0A', minHeight: '100vh' }}>
      <Header agentName={agent?.name || ''} />
      <TabNav activeTab={activeTab} onTabChange={(tab: string) => setActiveTab(tab as Tab)} />

      <div style={{ paddingTop: 60, maxWidth: 480, margin: '0 auto', padding: '60px 16px 96px' }}>
        {activeTab === 'DASHBOARD' && agent && (
          <>
            {/* Welcome Section */}
            <div style={{ marginBottom: 24 }}>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  color: 'rgba(187,187,187,0.5)',
                }}
              >
                Welcome back,
              </span>
              <h1
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 30,
                  fontWeight: 700,
                  color: '#F1F1F1',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {firstName}
                <span style={{ color: '#49D400' }}>.</span>
              </h1>
            </div>

            <PointsCard
              availableBalance={agent.availableBalance}
              currentTier={agent.currentTier}
              totalPoints={agent.totalPoints}
            />
            <QuickStats totalShoots={agent.totalShoots} memberSince={agent.memberSince} />
            <ReferralCard referralCode={agent.referralCode} />
            <TierRoadmap currentTier={agent.currentTier} />
          </>
        )}

        {activeTab === 'HISTORY' && <HistoryList orders={orders} />}

        {activeTab === 'HOW IT WORKS' && <HowItWorks />}
      </div>

      {/* Fixed Footer */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          textAlign: 'center',
          padding: '16px 0',
          background: 'linear-gradient(to bottom, transparent, #0A0A0A)',
          zIndex: 40,
        }}
      >
        <p
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 9,
            letterSpacing: 3,
            color: 'rgba(187,187,187,0.3)',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          EXPOSURE IT REAL ESTATE MEDIA — THE EI CIRCLE
        </p>
      </div>
    </div>
  )
}
