'use client';

import { useEffect, useState } from 'react';

type ResultData = {
  issueName: string;
  aiReviewResult: string;
  differencesFound: string;
};

export default function ResultsPage() {
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [issueId, setIssueId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('issueId') ?? '';
    setIssueId(id);
    if (!id) {
      setError('No issue ID provided. Add ?issueId=YOUR_ID to the URL.');
      setLoading(false);
      return;
    }
    fetchResults(id);
  }, []);

  async function fetchResults(id: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/get-results?issueId=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to fetch results.');
      } else {
        setData(json);
      }
    } catch {
      setError('Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const isPass = data?.aiReviewResult?.startsWith('PASS');

  return (
    <main className="min-h-screen py-10 px-4" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0533 50%, #0a0a0a 100%)' }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-black tracking-tight" style={{ color: '#a855f7' }}>XFINITY</span>
            <span className="text-2xl font-light text-white">|</span>
            <span className="text-lg font-semibold text-white">AI Disclaimer Review — Results</span>
          </div>
          {issueId && (
            <p className="text-sm" style={{ color: '#a78bfa' }}>Issue ID: {issueId}</p>
          )}
        </div>

        {loading && (
          <div className="rounded-xl p-6 text-center" style={{ background: '#1a1a2e', border: '1px solid #4c1d95' }}>
            <p className="text-sm animate-pulse" style={{ color: '#a78bfa' }}>Fetching results from Workfront...</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl p-6" style={{ background: '#2d0a0a', border: '1px solid #7f1d1d' }}>
            <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-4">

            {/* Issue Name */}
            {data.issueName && (
              <div className="rounded-xl p-4" style={{ background: '#1a1a2e', border: '1px solid #4c1d95' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#c4b5fd' }}>Issue</p>
                <p className="text-base font-semibold text-white">{data.issueName}</p>
              </div>
            )}

            {/* AI Review Result */}
            <div className="rounded-xl p-4" style={{ background: '#13002b', border: `1px solid ${isPass ? '#166534' : '#7f1d1d'}` }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#a78bfa' }}>AI Review Result</p>
              <span
                className="inline-block px-4 py-2 rounded-full text-sm font-bold"
                style={isPass
                  ? { background: '#052e16', color: '#4ade80' }
                  : { background: '#2d0a0a', color: '#f87171' }}
              >
                {isPass ? '✅ PASS' : '❌ FAIL'} — {data.aiReviewResult.replace(/^(PASS|FAIL) — /, '')}
              </span>
            </div>

            {/* Differences Found */}
            <div className="rounded-xl p-4" style={{ background: '#13002b', border: '1px solid #4c1d95' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#a78bfa' }}>Differences Found</p>
              <pre className="text-sm whitespace-pre-wrap" style={{ color: '#d1d5db', fontFamily: 'inherit' }}>
                {data.differencesFound}
              </pre>
            </div>

            {/* Refresh button */}
            <button
              onClick={() => fetchResults(issueId)}
              className="px-6 py-2.5 text-white text-sm font-bold rounded-lg transition"
              style={{ background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }}
            >
              ↻ Refresh Results
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
