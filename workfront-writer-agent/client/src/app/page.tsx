"use client";

import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState("");
  const [pushStatus, setPushStatus] = useState<"idle" | "success" | "error">("idle");
  const [pushError, setPushError] = useState("");

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult("");
    setPushStatus("idle");

    try {
      const res = await fetch("http://localhost:3001/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      const content = data.choices?.[0]?.message?.content ?? JSON.stringify(data);
      setResult(content);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePushToWorkfront() {
    if (!result) return;
    setPushing(true);
    setPushStatus("idle");

    try {
      const res = await fetch("http://localhost:3001/push-to-workfront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: result }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Push failed");

      setPushStatus("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setPushError(msg);
      setPushStatus("error");
    } finally {
      setPushing(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Workfront Writer Agent</h1>
        <p className="text-gray-500 mb-8">Generate content using Writer AI and push it to Workfront</p>

        <textarea
          className="w-full h-40 p-4 border border-gray-300 rounded-xl text-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your prompt here..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
        >
          {loading ? "Generating..." : "Generate"}
        </button>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        {result && (
          <>
            <div className="mt-6 p-6 bg-white border border-gray-200 rounded-xl text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">
              {result}
            </div>

            <button
              onClick={handlePushToWorkfront}
              disabled={pushing}
              className="mt-4 w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-xl transition-colors"
            >
              {pushing ? "Pushing to Workfront..." : "Push to Workfront"}
            </button>

            {pushStatus === "success" && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                Successfully posted as a note on the Workfront project.
              </div>
            )}

            {pushStatus === "error" && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                Push failed: {pushError}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
