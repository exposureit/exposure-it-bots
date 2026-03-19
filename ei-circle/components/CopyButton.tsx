'use client';

import { useState, useEffect } from 'react';

interface CopyButtonProps {
  text: string;
}

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timeout = setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Fallback silently
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="rounded px-3 py-1"
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: '0.5625rem',
        letterSpacing: '2px',
        color: '#49D400',
        border: '1px solid rgba(73,212,0,0.15)',
        background: 'transparent',
        cursor: 'pointer',
      }}
    >
      {copied ? '\u2713 COPIED' : 'COPY'}
    </button>
  );
}
