'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type PromptRow = {
  id: string;
  chapter_number: number | null;
  category: string | null;
  title: string | null;
  prompt_text: string | null;
  usage_tips: string | null;
  is_free_tier: boolean | null;
};

export default function PromptsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      // 1) Require login
      const userRes = await supabase.auth.getUser();
      const user = userRes.data.user;
      if (!user) {
        router.push('/settings');
        return;
      }

      // 2) Load ONLY free-tier prompts
      const res = await supabase
        .from('prompts')
        .select('id, chapter_number, category, title, prompt_text, usage_tips, is_free_tier')
        .eq('is_free_tier', true)
        .order('chapter_number', { ascending: true })
        .order('title', { ascending: true });

      if (!alive) return;

      if (res.error) {
        setError(res.error.message);
        setPrompts([]);
      } else {
        setPrompts((res.data ?? []) as PromptRow[]);
      }

      setLoading(false);
    }

    load();

    return () => {
      alive = false;
    };
  }, [router]);

  const countText = useMemo(() => {
    if (loading) return 'Loading…';
    if (error) return 'Could not load prompts';
    return `${prompts.length} free prompts`;
  }, [loading, error, prompts.length]);

  async function copyPrompt(p: PromptRow) {
    const text = p.prompt_text ?? '';
    if (!text.trim()) return;

    await navigator.clipboard.writeText(text);
    setCopiedId(p.id);
    window.setTimeout(() => setCopiedId(null), 900);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-[#6B4A2E]">Prompts</h1>
        <p className="mt-1 text-sm text-gray-500">{countText}</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
          <div className="mt-2 text-xs text-red-700">
            If you inserted rows and still see this, fix table access in Supabase (step below).
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          Loading your free prompt library…
        </div>
      ) : (
        <div className="space-y-3">
          {prompts.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-[#6B4A2E]">
                    {p.title ?? 'Untitled prompt'}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {typeof p.chapter_number === 'number' ? `Chapter ${p.chapter_number}` : 'Chapter —'}
                    {p.category ? ` • ${p.category}` : ''}
                  </div>
                </div>

                <button
                  onClick={() => copyPrompt(p)}
                  className="rounded-lg bg-[#1C6F66] px-3 py-2 text-sm font-medium text-white hover:bg-[#155A52]"
                >
                  {copiedId === p.id ? 'Copied' : 'Copy'}
                </button>
              </div>

              {p.usage_tips ? (
                <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  {p.usage_tips}
                </div>
              ) : null}

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-[#1C6F66]">View prompt text</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
                  {p.prompt_text ?? ''}
                </pre>
              </details>
            </div>
          ))}

          {prompts.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
              No free prompts found yet.
              <div className="mt-2 text-xs text-gray-500">
                Go back to Supabase → SQL Editor → run the insert script again.
              </div>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
