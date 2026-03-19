'use client';

import React, { useState } from 'react';

/* ─── Shared Styles ─── */
const cardStyle: React.CSSProperties = {
  backgroundColor: '#111111',
  border: '1px solid rgba(255,255,255,0.06)',
};

const headerBtnStyle: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: '10px',
  letterSpacing: '2px',
  color: '#F1F1F1',
};

const bodyFont: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
};

/* ─── Chevron Component ─── */
function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className="inline-block transition-transform duration-200"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        fontSize: '10px',
        color: '#BBBBBB',
      }}
    >
      ▼
    </span>
  );
}

/* ─── Main Accordion Section ─── */
function AccordionSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl mb-3 overflow-hidden" style={cardStyle}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 uppercase"
        style={headerBtnStyle}
      >
        <span>{title}</span>
        <Chevron open={isOpen} />
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? '800px' : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="px-4 pb-4" style={bodyFont}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── FAQ Nested Accordion Item ─── */
function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-lg mb-2 overflow-hidden"
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        <span className="text-xs font-medium" style={{ color: '#F1F1F1' }}>
          {question}
        </span>
        <Chevron open={isOpen} />
      </button>
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          maxHeight: isOpen ? '200px' : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <p
          className="px-3 pb-3 text-xs leading-relaxed"
          style={{ color: '#BBBBBB', fontFamily: 'Inter, sans-serif' }}
        >
          {answer}
        </p>
      </div>
    </div>
  );
}

/* ─── Data ─── */
const tiers = [
  { name: 'Insider', points: '750 pts', reward: '$75 credit toward any service' },
  { name: 'Pro', points: '2,000 pts', reward: 'Free Zillow 3D Tour + Floor Plan' },
  { name: 'Elite', points: '4,000 pts', reward: 'Free Pro Photo Package ($279.99)' },
];

const bonusActions = [
  { action: 'Refer a new client', points: '+500 pts', note: 'per referral' },
  { action: 'Leave a Google Review', points: '+200 pts', note: 'one-time' },
  { action: 'Post on social + tag us', points: '+100 pts', note: 'up to 5x/year' },
  { action: 'Record a video testimonial', points: '+300 pts', note: 'one-time' },
];

const faqItems = [
  {
    q: 'Do my points expire?',
    a: 'No \u2014 as long as you book at least once every 12 months, your points stay active.',
  },
  {
    q: 'What happens when I hit Insider?',
    a: 'You get a $75 credit you can apply toward any Exposure It service on your next shoot.',
  },
  {
    q: "What\u2019s the Pro reward?",
    a: "A free Zillow 3D Tour + Interactive Floor Plan added to any shoot. That\u2019s a $124.99 value, on us.",
  },
  {
    q: 'What do I get at Elite?',
    a: "A completely free Pro Photo Package ($279.99 value). Book it like any other shoot \u2014 it\u2019s on us.",
  },
  {
    q: 'Do points reset after I redeem?',
    a: 'Points reset after you hit Elite and redeem your free shoot. Then you start climbing again.',
  },
  {
    q: 'How do I use my referral code?',
    a: 'Share it with any agent. They enter it when booking. You both get rewarded automatically.',
  },
  {
    q: 'When do points show up?',
    a: "Within minutes of your invoice being paid. You\u2019ll get a text confirmation.",
  },
];

/* ─── Main Component ─── */
export default function HowItWorks() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openFaqs, setOpenFaqs] = useState<Record<number, boolean>>({});

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFaq = (index: number) => {
    setOpenFaqs((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div>
      {/* Section 1: Earning Points */}
      <AccordionSection
        title="EARNING POINTS"
        isOpen={!!openSections['earning']}
        onToggle={() => toggleSection('earning')}
      >
        <p className="text-sm leading-relaxed" style={{ color: '#BBBBBB' }}>
          Every dollar you spend with Exposure It earns you 1 point. Points are automatically added
          after each paid invoice. No action needed on your end.
        </p>
      </AccordionSection>

      {/* Section 2: Reward Tiers */}
      <AccordionSection
        title="REWARD TIERS"
        isOpen={!!openSections['tiers']}
        onToggle={() => toggleSection('tiers')}
      >
        <div className="space-y-2">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="rounded-lg px-3 py-2.5 flex items-center justify-between"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(73,212,0,0.15)',
              }}
            >
              <div>
                <span
                  className="text-sm font-bold"
                  style={{ fontFamily: 'Poppins, sans-serif', color: '#49D400' }}
                >
                  {tier.name}
                </span>
                <span className="text-xs ml-2" style={{ color: 'rgba(187,187,187,0.5)' }}>
                  {tier.points}
                </span>
              </div>
              <span className="text-xs text-right" style={{ color: '#BBBBBB' }}>
                {tier.reward}
              </span>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* Section 3: Bonus Points */}
      <AccordionSection
        title="BONUS POINTS"
        isOpen={!!openSections['bonus']}
        onToggle={() => toggleSection('bonus')}
      >
        <div className="space-y-2">
          {bonusActions.map((item) => (
            <div
              key={item.action}
              className="flex items-center justify-between py-2 px-1"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div>
                <span className="text-sm" style={{ color: '#F1F1F1' }}>
                  {item.action}
                </span>
                <span className="text-xs ml-1.5" style={{ color: 'rgba(187,187,187,0.5)' }}>
                  ({item.note})
                </span>
              </div>
              <span
                className="text-sm font-bold shrink-0 ml-3"
                style={{ fontFamily: 'Poppins, sans-serif', color: '#49D400' }}
              >
                {item.points}
              </span>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* Section 4: FAQ */}
      <AccordionSection
        title="FAQ"
        isOpen={!!openSections['faq']}
        onToggle={() => toggleSection('faq')}
      >
        <div>
          {faqItems.map((item, index) => (
            <FaqItem
              key={index}
              question={item.q}
              answer={item.a}
              isOpen={!!openFaqs[index]}
              onToggle={() => toggleFaq(index)}
            />
          ))}
        </div>
      </AccordionSection>

      {/* Support Section */}
      <div className="mt-8">
        <p className="text-sm" style={{ fontFamily: 'Inter, sans-serif', color: '#BBBBBB' }}>
          Questions? Text us anytime.
        </p>
        <p
          className="font-bold mt-1"
          style={{ fontFamily: 'Poppins, sans-serif', fontSize: '20px', color: '#49D400' }}
        >
          (407) 618-4622
        </p>
      </div>
    </div>
  );
}
