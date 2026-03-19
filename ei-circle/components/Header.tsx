'use client';

interface HeaderProps {
  agentName: string;
}

export default function Header({ agentName }: HeaderProps) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 w-full"
      style={{ backgroundColor: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)' }}
    >
      <div className="mx-auto flex items-center justify-between px-4" style={{ maxWidth: 480, height: 60 }}>
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Exposure IT"
            className="rounded-full"
            style={{ width: 38, height: 38 }}
          />
          <div className="flex flex-col">
            <span
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '0.75rem',
                letterSpacing: '3px',
                color: '#F1F1F1',
                textTransform: 'uppercase',
                lineHeight: 1.3,
              }}
            >
              EXPOSURE IT
            </span>
            <span
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '0.5625rem',
                letterSpacing: '2.5px',
                color: '#49D400',
                textTransform: 'uppercase',
                lineHeight: 1.3,
              }}
            >
              THE EI CIRCLE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="animate-pulse rounded-full"
            style={{ width: 8, height: 8, backgroundColor: '#49D400', display: 'inline-block' }}
          />
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.75rem',
              color: '#BBBBBB',
            }}
          >
            {agentName}
          </span>
        </div>
      </div>
    </header>
  );
}
