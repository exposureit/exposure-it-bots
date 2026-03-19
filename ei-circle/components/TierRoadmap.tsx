'use client';

interface TierRoadmapProps {
  currentTier: string;
}

const TIER_ORDER = ['None', 'Insider', 'Pro', 'Elite'];

const TIERS = [
  {
    name: 'Insider',
    points: 750,
    description: '$75 credit toward any service',
    icon: '\u{1F3E0}',
  },
  {
    name: 'Pro',
    points: 2000,
    description: 'Free Zillow 3D Tour + Floor Plan',
    icon: '\u2B50',
  },
  {
    name: 'Elite',
    points: 4000,
    description: 'Free Pro Photo Package ($279.99)',
    icon: '\u{1F3C6}',
  },
];

function getTierStatus(tierName: string, currentTier: string): 'achieved' | 'current' | 'future' {
  const currentIndex = TIER_ORDER.indexOf(currentTier || 'None');
  const tierIndex = TIER_ORDER.indexOf(tierName);

  if (tierIndex < currentIndex) return 'achieved';
  if (tierIndex === currentIndex) return 'current';
  return 'future';
}

export default function TierRoadmap({ currentTier }: TierRoadmapProps) {
  return (
    <div>
      <h2
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: '18px',
          fontWeight: 700,
          color: '#F1F1F1',
          marginBottom: '12px',
        }}
      >
        Reward Tiers<span style={{ color: '#49D400' }}>.</span>
      </h2>

      <div className="flex flex-col gap-3">
        {TIERS.map((tier) => {
          const status = getTierStatus(tier.name, currentTier);

          return (
            <div
              key={tier.name}
              className="rounded-xl p-4 flex items-center gap-4 transition-opacity"
              style={{
                backgroundColor: status === 'achieved' ? 'rgba(73,212,0,0.05)' : '#111111',
                border: '1px solid rgba(255,255,255,0.06)',
                borderLeft: status === 'current' ? '2px solid #49D400' : undefined,
                opacity: status === 'future' ? 0.5 : 1,
              }}
            >
              {/* Icon */}
              <span className="text-2xl flex-shrink-0">{tier.icon}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 700,
                      color: '#F1F1F1',
                      fontSize: '14px',
                    }}
                  >
                    {tier.name}
                  </p>
                  {status === 'current' && (
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: '9px',
                        fontWeight: 600,
                        letterSpacing: '1px',
                        color: '#49D400',
                        backgroundColor: 'rgba(73,212,0,0.1)',
                      }}
                    >
                      CURRENT
                    </span>
                  )}
                  {status === 'achieved' && (
                    <span style={{ color: '#49D400', fontSize: '14px' }}>{'\u2713'}</span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: '11px',
                    color: 'rgba(187,187,187,0.5)',
                    marginTop: '2px',
                  }}
                >
                  {tier.points.toLocaleString()} pts
                </p>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#BBBBBB',
                    marginTop: '2px',
                  }}
                >
                  {tier.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
