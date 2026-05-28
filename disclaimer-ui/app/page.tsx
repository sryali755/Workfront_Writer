'use client';

import { useState, useEffect, useRef } from 'react';

type Difference = {
  type: 'changed' | 'missing' | 'added' | 'punctuation';
  baseline_text: string;
  latest_text: string | null;
  description: string;
};

type Result = {
  status: 'MATCH' | 'MISMATCH';
  summary: string;
  differences: Difference[];
};

const TYPE_LABELS: Record<string, string> = {
  changed: 'CHANGED',
  missing: 'MISSING',
  added: 'ADDED',
  punctuation: 'PUNCTUATION',
};

const DIFF_COLORS: Record<string, string> = {
  missing: '#ef4444',
  added: '#22c55e',
  punctuation: '#3b82f6',
  changed: '#eab308',
};

function formatForWorkfront(result: Result) {
  const aiReviewResult = result.status === 'MATCH'
    ? `PASS — ${result.summary}`
    : `FAIL — ${result.summary}`;

  const differencesFound = result.differences.length === 0
    ? 'No differences found.'
    : result.differences.map((d, i) =>
        `${i + 1}. [${d.type.toUpperCase()}] ${d.description}\n   Baseline: "${d.baseline_text}"\n   Latest:   "${d.latest_text ?? 'MISSING'}"`
      ).join('\n\n');

  return { aiReviewResult, differencesFound };
}

export default function Home() {
  const [issueId, setIssueId]                   = useState('');
  const [issueName, setIssueName]               = useState('');
  const [baseline, setBaseline]                 = useState('');
  const [latest, setLatest]                     = useState('');
  const [uploadedContext, setUploadedContext]   = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [result, setResult]                     = useState<Result | null>(null);
  const [loadingFromWF, setLoadingFromWF]       = useState(false);
  const [comparing, setComparing]               = useState(false);
  const [saving, setSaving]                     = useState(false);
  const [savedToWorkfront, setSavedToWorkfront] = useState(false);
  const [error, setError]                       = useState('');
  const [dark, setDark]                         = useState(true);
  const fileInputRef                            = useRef<HTMLInputElement>(null);

  // Auto-load from Workfront if issueId is passed in the URL (e.g. from Workfront iframe embed)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('issueId');
    if (idFromUrl) {
      setIssueId(idFromUrl);
      handleLoadFromWorkfront(idFromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const th = {
    bg:             dark ? 'linear-gradient(135deg, #0a0a0a 0%, #1a0533 50%, #0a0a0a 100%)' : 'linear-gradient(135deg, #f3f0ff 0%, #ede9fe 50%, #f3f0ff 100%)',
    title:          dark ? '#a855f7' : '#7c3aed',
    divider:        dark ? '#ffffff' : '#7c3aed',
    subtitle:       dark ? '#a78bfa' : '#6d28d9',
    label:          dark ? '#c4b5fd' : '#4c1d95',
    labelSub:       dark ? '#7c3aed' : '#7c3aed',
    inputBg:        dark ? '#1a1a2e' : '#ffffff',
    inputBorder:    dark ? '#4c1d95' : '#c4b5fd',
    inputText:      dark ? '#e2e8f0' : '#1e1b4b',
    resultBg:       dark ? '#13002b' : '#faf5ff',
    resultBorder:   dark ? '#4c1d95' : '#c4b5fd',
    resultText:     dark ? '#d1d5db' : '#1e1b4b',
    diffBg:         dark ? '#1a0533' : '#f5f3ff',
    diffLabel:      dark ? '#a78bfa' : '#6d28d9',
    diffText:       dark ? '#e2e8f0' : '#1e1b4b',
    diffMeta:       dark ? '#6b7280' : '#6b7280',
    diffMetaVal:    dark ? '#d1d5db' : '#374151',
    clearBorder:    dark ? '#4c1d95' : '#c4b5fd',
    clearText:      dark ? '#c4b5fd' : '#6d28d9',
    muted:          dark ? '#6b7280' : '#6b7280',
    diffCount:      dark ? '#c4b5fd' : '#4c1d95',
    wfBannerBg:     dark ? '#0d1f0d' : '#f0fdf4',
    wfBannerBorder: dark ? '#166534' : '#86efac',
    wfBannerText:   dark ? '#4ade80' : '#15803d',
  };

  async function handleLoadFromWorkfront(id?: string) {
    const targetId = id ?? issueId;
    if (!targetId.trim()) return;
    setLoadingFromWF(true);
    setError('');
    setIssueName('');
    setResult(null);
    setSavedToWorkfront(false);
    try {
      const res = await fetch('/api/load-from-workfront', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: targetId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load from Workfront.');
      } else {
        setBaseline(data.baseline);
        setLatest(data.latest);
        setIssueName(data.name);
      }
    } catch {
      setError('Failed to connect to Workfront. Please try again.');
    } finally {
      setLoadingFromWF(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedContext(ev.target?.result as string ?? '');
    };
    reader.readAsText(file);
  }

  function handleRemoveFile() {
    setUploadedContext('');
    setUploadedFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleCompare() {
    if (!baseline.trim() || !latest.trim()) {
      setError('Please enter both baseline and latest disclaimer text.');
      return;
    }
    setComparing(true);
    setError('');
    setResult(null);
    setSavedToWorkfront(false);
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseline, latest, context: uploadedContext || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      } else {
        setResult(data);
      }
    } catch {
      setError('Failed to connect to the AI service. Please try again.');
    } finally {
      setComparing(false);
    }
  }

  async function handleSaveToWorkfront() {
    if (!result || !issueId.trim()) return;
    setSaving(true);
    setSavedToWorkfront(false);
    setError('');
    const { aiReviewResult, differencesFound } = formatForWorkfront(result);
    try {
      const res = await fetch('/api/save-to-workfront', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: issueId.trim(), aiReviewResult, differencesFound }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save to Workfront.');
      } else {
        setSavedToWorkfront(true);
      }
    } catch {
      setError('Failed to connect to Workfront. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setIssueId('');
    setIssueName('');
    setBaseline('');
    setLatest('');
    setUploadedContext('');
    setUploadedFileName('');
    setResult(null);
    setError('');
    setSavedToWorkfront(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <main className="min-h-screen py-10 px-4 transition-all duration-300" style={{ background: th.bg }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-black tracking-tight" style={{ color: th.title }}>XFINITY</span>
              <span className="text-2xl font-light" style={{ color: th.divider }}>|</span>
              <span className="text-lg font-semibold" style={{ color: th.divider }}>AI Disclaimer Review</span>
            </div>
            <p className="text-sm" style={{ color: th.subtitle }}>
              Load a Workfront issue or paste disclaimer text manually. Writer AI will compare and flag differences.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: th.subtitle }}>☀️</span>
            <button
              onClick={() => setDark(!dark)}
              className="relative inline-flex items-center w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none"
              style={{ background: dark ? '#7c3aed' : '#c4b5fd' }}
            >
              <span
                className="inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-300"
                style={{ transform: dark ? 'translateX(22px)' : 'translateX(4px)' }}
              />
            </button>
            <span className="text-xs" style={{ color: th.subtitle }}>🌙</span>
          </div>
        </div>

        {/* Step 1 — Load from Workfront */}
        <div className="mb-2">
          <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded" style={{ background: '#3b82f622', color: '#60a5fa' }}>
            STEP 1 — LOAD FROM WORKFRONT
          </span>
        </div>
        <div className="rounded-xl p-4 mb-6 transition-all duration-300" style={{ background: th.inputBg, border: `1px solid ${issueName ? '#166534' : th.inputBorder}` }}>
          <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: th.label }}>
            Workfront Issue ID <span className="font-normal normal-case tracking-normal" style={{ color: th.labelSub }}>(or skip and paste text manually below)</span>
          </label>
          <div className="flex gap-3 items-center">
            <input
              type="text"
              className="flex-1 p-2 rounded-lg text-sm focus:outline-none"
              style={{ background: dark ? '#0d0d1a' : '#f8f5ff', color: th.inputText, border: `1px solid ${th.inputBorder}` }}
              placeholder="e.g. 5e3f2a1b000c4d7e8f9a..."
              value={issueId}
              onChange={(e) => { setIssueId(e.target.value); setIssueName(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleLoadFromWorkfront()}
            />
            <button
              onClick={() => handleLoadFromWorkfront()}
              disabled={loadingFromWF || !issueId.trim()}
              className="px-5 py-2 text-white text-sm font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap"
              style={{ background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)' }}
            >
              {loadingFromWF ? 'Loading...' : '↓ Load from Workfront'}
            </button>
          </div>
          {issueName && (
            <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: th.wfBannerText }}>
              <span>✅</span>
              <span>Loaded: <strong>{issueName}</strong></span>
            </div>
          )}
        </div>

        {/* Step 2 — Review & Compare */}
        <div className="mb-2">
          <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded" style={{ background: '#7c3aed22', color: '#a78bfa' }}>
            STEP 2 — REVIEW & COMPARE
          </span>
        </div>
        <div className="flex flex-col gap-4 mb-6">

          {/* Baseline */}
          <div className="rounded-xl p-4 transition-all duration-300" style={{ background: th.inputBg, border: `1px solid ${th.inputBorder}` }}>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: th.label }}>
              1 — Baseline Disclaimer <span className="font-normal normal-case tracking-normal" style={{ color: th.labelSub }}>(approved version)</span>
            </label>
            <textarea
              className="w-full h-36 p-2 rounded-lg text-sm resize-none focus:outline-none"
              style={{ background: 'transparent', color: th.inputText, border: 'none' }}
              placeholder="Auto-populated from Workfront, or paste here manually..."
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
            />
          </div>

          {/* Latest */}
          <div className="rounded-xl p-4 transition-all duration-300" style={{ background: th.inputBg, border: `1px solid ${th.inputBorder}` }}>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: th.label }}>
              2 — Latest Disclaimer <span className="font-normal normal-case tracking-normal" style={{ color: th.labelSub }}>(version to check)</span>
            </label>
            <textarea
              className="w-full h-36 p-2 rounded-lg text-sm resize-none focus:outline-none"
              style={{ background: 'transparent', color: th.inputText, border: 'none' }}
              placeholder="Auto-populated from Workfront, or paste here manually..."
              value={latest}
              onChange={(e) => setLatest(e.target.value)}
            />
          </div>

          {/* File Upload — optional reference document */}
          <div className="rounded-xl p-4 transition-all duration-300" style={{ background: th.inputBg, border: `1px solid ${uploadedFileName ? '#7c3aed' : th.inputBorder}` }}>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: th.label }}>
              3 — Reference Document <span className="font-normal normal-case tracking-normal" style={{ color: th.labelSub }}>(optional — upload for additional context)</span>
            </label>
            {!uploadedFileName ? (
              <div
                className="flex flex-col items-center justify-center py-6 rounded-lg cursor-pointer transition"
                style={{ border: `2px dashed ${th.inputBorder}` }}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="text-2xl mb-2">📄</span>
                <p className="text-sm font-semibold" style={{ color: th.label }}>Click to upload a reference document</p>
                <p className="text-xs mt-1" style={{ color: th.muted }}>Supports .txt files — PDF support coming soon</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: dark ? '#1a0533' : '#f5f3ff' }}>
                <div className="flex items-center gap-2">
                  <span>📄</span>
                  <span className="text-sm font-semibold" style={{ color: th.label }}>{uploadedFileName}</span>
                  <span className="text-xs" style={{ color: th.muted }}>— loaded as reference context</span>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="text-xs px-2 py-1 rounded transition"
                  style={{ color: '#f87171', border: '1px solid #7f1d1d' }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={handleCompare}
            disabled={comparing}
            className="px-6 py-2.5 text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            style={{ background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }}
          >
            {comparing ? 'Comparing...' : '▶ Compare'}
          </button>

          {result && issueId.trim() && (
            <button
              onClick={handleSaveToWorkfront}
              disabled={saving || savedToWorkfront}
              className="px-6 py-2.5 text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              style={{ background: savedToWorkfront ? 'linear-gradient(90deg, #15803d, #22c55e)' : 'linear-gradient(90deg, #0369a1, #0ea5e9)' }}
            >
              {saving ? 'Saving...' : savedToWorkfront ? '✅ Saved to Workfront' : '↑ Save to Workfront'}
            </button>
          )}

          <button
            onClick={handleClear}
            className="px-6 py-2.5 text-sm font-semibold rounded-lg transition"
            style={{ background: 'transparent', border: `1px solid ${th.clearBorder}`, color: th.clearText }}
          >
            Clear
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-lg text-sm mb-6" style={{ background: '#2d0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {/* Step 3 — AI Results */}
        <div className="mb-2">
          <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded" style={{ background: '#22c55e22', color: '#4ade80' }}>
            STEP 3 — AI RESULTS
          </span>
        </div>
        <div className="flex flex-col gap-4">

          {/* AI Review Result */}
          <div className="rounded-xl p-4 transition-all duration-300" style={{ background: th.resultBg, border: `1px solid ${result ? '#7c3aed' : th.resultBorder}` }}>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#a78bfa' }}>
              4 — AI Review Result
            </label>
            {comparing && <p className="text-sm animate-pulse" style={{ color: '#a78bfa' }}>Analyzing with Writer AI...</p>}
            {!comparing && !result && <p className="text-sm" style={{ color: th.muted }}>Result will appear here after you click Compare.</p>}
            {result && (
              <div>
                <span
                  className="inline-block px-3 py-1 rounded-full text-sm font-bold mb-3"
                  style={result.status === 'MATCH'
                    ? { background: '#052e16', color: '#4ade80' }
                    : { background: '#2d0a0a', color: '#f87171' }}
                >
                  {result.status === 'MATCH' ? '✅ MATCH' : '❌ MISMATCH'}
                </span>
                <p className="text-sm" style={{ color: th.resultText }}>{result.summary}</p>
              </div>
            )}
          </div>

          {/* Differences Found */}
          <div className="rounded-xl p-4 transition-all duration-300" style={{ background: th.resultBg, border: `1px solid ${result && result.differences.length > 0 ? '#ef4444' : th.resultBorder}` }}>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#a78bfa' }}>
              5 — Differences Found
            </label>
            {comparing && <p className="text-sm animate-pulse" style={{ color: '#a78bfa' }}>Finding differences...</p>}
            {!comparing && !result && <p className="text-sm" style={{ color: th.muted }}>Differences will appear here after you click Compare.</p>}
            {result && result.differences.length === 0 && (
              <p className="text-sm" style={{ color: '#4ade80' }}>No differences found. The two versions match.</p>
            )}
            {result && result.differences.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold mb-2" style={{ color: th.diffCount }}>
                  {result.differences.length} difference{result.differences.length > 1 ? 's' : ''} found:
                </p>
                {result.differences.map((diff, i) => (
                  <div
                    key={i}
                    className="border-l-4 rounded-r-lg p-3"
                    style={{ borderLeftColor: DIFF_COLORS[diff.type] ?? '#eab308', background: th.diffBg }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold" style={{ color: th.diffMeta }}>{i + 1}.</span>
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: th.diffLabel }}>{TYPE_LABELS[diff.type] || diff.type}</span>
                    </div>
                    <p className="text-sm mb-2" style={{ color: th.diffText }}>{diff.description}</p>
                    <div className="text-xs space-y-1">
                      <div><span className="font-semibold" style={{ color: th.diffMeta }}>Baseline: </span><span style={{ color: th.diffMetaVal }}>&quot;{diff.baseline_text}&quot;</span></div>
                      <div><span className="font-semibold" style={{ color: th.diffMeta }}>Latest: </span><span style={{ color: th.diffMetaVal }}>&quot;{diff.latest_text ?? 'MISSING'}&quot;</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saved confirmation */}
          {savedToWorkfront && (
            <div className="rounded-xl p-4" style={{ background: th.wfBannerBg, border: `1px solid ${th.wfBannerBorder}` }}>
              <p className="text-sm font-semibold" style={{ color: th.wfBannerText }}>
                ✅ Results written back to Workfront issue <strong>{issueId}</strong>
              </p>
              <p className="text-xs mt-1" style={{ color: th.muted }}>
                The AI Review Result and Differences Found fields have been updated.
              </p>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
