'use client';

interface TabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = ['DASHBOARD', 'HISTORY', 'HOW IT WORKS'];

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav
      className="sticky z-40"
      style={{ top: 60, backgroundColor: '#0A0A0A' }}
    >
      <div className="mx-auto flex justify-evenly" style={{ maxWidth: 480 }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className="py-3"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '0.625rem',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: isActive ? '#49D400' : 'rgba(187,187,187,0.5)',
                borderBottom: isActive ? '2px solid #49D400' : '2px solid transparent',
                background: 'none',
                border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: isActive ? '#49D400' : 'transparent',
                cursor: 'pointer',
                paddingLeft: 8,
                paddingRight: 8,
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
