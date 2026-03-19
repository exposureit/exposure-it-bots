'use client';

import CopyButton from './CopyButton';

interface ReferralCardProps {
  referralCode: string;
}

export default function ReferralCard({ referralCode }: ReferralCardProps) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: '#111111',
        border: '1px solid rgba(73,212,0,0.15)',
      }}
    >
      <p
        className="uppercase"
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: '9px',
          letterSpacing: '3px',
          color: '#49D400',
        }}
      >
        Your Referral Code
      </p>

      <div className="flex items-center justify-between mt-2">
        <p
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: '24px',
            fontWeight: 700,
            letterSpacing: '3px',
            color: '#F1F1F1',
          }}
        >
          {referralCode}
        </p>
        <CopyButton text={referralCode} />
      </div>

      <p className="mt-3" style={{ fontSize: '12px', color: '#BBBBBB' }}>
        Share with a fellow agent. They get $50 off their first shoot. You get 500 bonus points.
      </p>
    </div>
  );
}
