'use client';

interface QuickStatsProps {
  totalShoots: number;
  memberSince: string;
}

export default function QuickStats({ totalShoots, memberSince }: QuickStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Shoots */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: '#111111',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <p
          className="uppercase"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: '9px',
            letterSpacing: '3px',
            color: 'rgba(187,187,187,0.5)',
          }}
        >
          Shoots
        </p>
        <p
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: '28px',
            fontWeight: 700,
            color: '#F1F1F1',
            lineHeight: 1.2,
            marginTop: '4px',
          }}
        >
          {totalShoots}
        </p>
      </div>

      {/* Member Since */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: '#111111',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <p
          className="uppercase"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: '9px',
            letterSpacing: '3px',
            color: 'rgba(187,187,187,0.5)',
          }}
        >
          Member Since
        </p>
        <p
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: '14px',
            color: '#F1F1F1',
            lineHeight: 1.4,
            marginTop: '8px',
          }}
        >
          {memberSince}
        </p>
      </div>
    </div>
  );
}
