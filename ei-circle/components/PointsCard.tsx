'use client';

import AnimatedNumber from './AnimatedNumber';

interface PointsCardProps {
  availableBalance: number;
  currentTier: string;
  totalPoints: number;
}

const TIER_ORDER = ['None', 'Insider', 'Pro', 'Elite'];
const TIER_THRESHOLDS: Record<string, number> = {
  None: 0,
  Insider: 750,
  Pro: 2000,
  Elite: 4000,
};

function getTierProgress(currentTier: string, totalPoints: number) {
  const tier = currentTier || 'None';

  if (tier === 'Elite') {
    const progressInCycle = totalPoints % 4000;
    return {
      progress: progressInCycle,
      max: 4000,
      nextTier: 'Elite',
      ptsToNext: 4000 - progressInCycle,
      isElite: true,
    };
  }

  const tierIndex = TIER_ORDER.indexOf(tier);
  const nextTier = TIER_ORDER[tierIndex + 1] || 'Elite';
  const currentThreshold = TIER_THRESHOLDS[tier] ?? 0;
  const nextThreshold = TIER_THRESHOLDS[nextTier] ?? 4000;
  const progressInRange = totalPoints - currentThreshold;
  const rangeSize = nextThreshold - currentThreshold;

  return {
    progress: Math.max(0, Math.min(progressInRange, rangeSize)),
    max: rangeSize,
    nextTier,
    ptsToNext: Math.max(0, nextThreshold - totalPoints),
    isElite: false,
  };
}

export default function PointsCard({ availableBalance, currentTier, totalPoints }: PointsCardProps) {
  const { progress, max, nextTier, ptsToNext, isElite } = getTierProgress(currentTier, totalPoints);
  const progressPercent = max > 0 ? Math.min((progress / max) * 100, 100) : 0;

  const avgShootValue = 310;
  const shootsNeeded = Math.ceil(ptsToNext / avgShootValue);

  let motivationalText = '';
  if (isElite) {
    motivationalText = `${ptsToNext.toLocaleString()} pts to complete this Elite cycle`;
  } else if (ptsToNext < 500) {
    motivationalText = 'Almost there \u2014 one more shoot could push you over';
  } else {
    motivationalText = `${shootsNeeded} more shoot${shootsNeeded !== 1 ? 's' : ''} at your average to hit ${nextTier}`;
  }

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Green gradient top border */}
      <div
        className="h-[2px] w-full"
        style={{
          background: 'linear-gradient(to right, #49D400, #23F135)',
        }}
      />

      <div className="p-5">
        <div className="flex items-start justify-between">
          {/* Left: Balance */}
          <div>
            <p
              className="uppercase"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '9px',
                letterSpacing: '3px',
                color: 'rgba(187,187,187,0.5)',
              }}
            >
              Available Balance
            </p>
            <div
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '48px',
                fontWeight: 700,
                color: '#49D400',
                textShadow: '0 0 20px rgba(73,212,0,0.3)',
                lineHeight: 1.1,
              }}
            >
              <AnimatedNumber value={availableBalance} />
            </div>
          </div>

          {/* Right: Tier badge */}
          <div className="text-right flex-shrink-0 ml-4 pt-1">
            <p
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                color: '#F1F1F1',
              }}
            >
              {currentTier || 'None'}
            </p>
            <p
              className="uppercase"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '9px',
                letterSpacing: '3px',
                color: 'rgba(187,187,187,0.5)',
              }}
            >
              Current Tier
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div
            className="h-2 rounded-full w-full overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: 'linear-gradient(to right, #49D400, #23F135)',
                boxShadow: '0 0 8px rgba(73,212,0,0.4)',
              }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between">
            <p style={{ fontSize: '12px', color: 'rgba(187,187,187,0.5)' }}>
              {!isElite ? (
                <>
                  <span style={{ color: '#F1F1F1' }}>{ptsToNext.toLocaleString()}</span> pts to{' '}
                  <span style={{ color: '#F1F1F1' }}>{nextTier}</span>
                </>
              ) : (
                <>
                  <span style={{ color: '#F1F1F1' }}>{ptsToNext.toLocaleString()}</span> pts in current cycle
                </>
              )}
            </p>
          </div>

          <p className="mt-1" style={{ fontSize: '11px', color: 'rgba(187,187,187,0.5)' }}>
            {motivationalText}
          </p>
        </div>
      </div>
    </div>
  );
}
