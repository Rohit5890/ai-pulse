import { HNStory, CategoryFilter } from '../types';

export const KEYWORDS = [
  'ai',
  'artificial intelligence',
  'gpt',
  'gemini',
  'openai',
  'claude',
  'anthropic',
  'llm',
  'machine learning',
  'deepmind',
  'neural',
  'robotics',
  'transformer',
  'deep learning',
  'midjourney',
  'stable diffusion',
  'copilot',
  'pytorch',
  'tensorflow',
  'meta ai'
];

/**
 * Filter an article title to check if it represents AI News
 */
export function isAINews(title: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  
  // Direct matches of full terms or bordered keywords
  return KEYWORDS.some(k => {
    // Avoid false positives (e.g., "claim" for "ai") by checking word boundaries
    if (k === 'ai') {
      return /\bai\b/i.test(lower) || lower.includes(' ai ') || lower.startsWith('ai ') || lower.endsWith(' ai');
    }
    return lower.includes(k);
  });
}

/**
 * Classifies a story into one or more categories
 */
export function classifyStory(story: HNStory): CategoryFilter[] {
  const categories: CategoryFilter[] = ['all'];
  const title = (story.title || '').toLowerCase();

  // LLM classification
  if (
    ['gpt', 'llm', 'claude', 'gemini', 'llama', 'prompt', 'chatgpt', 'copilot', 'anthropic', 'openai'].some(k =>
      title.includes(k)
    )
  ) {
    categories.push('llm');
  }

  // Models classification
  if (
    ['model', 'transformer', 'weights', 'architecture', 'finetuning', 'fine-tune', 'diffusion', 'midjourney', 'sora'].some(k =>
      title.includes(k)
    )
  ) {
    categories.push('models');
  }

  // Companies / Startups
  if (
    ['openai', 'anthropic', 'google', 'deepmind', 'meta', 'nvidia', 'microsoft', 'startup', 'amazon', 'funding', 'valuation', 'hugging face', 'y combinator'].some(k =>
      title.includes(k)
    )
  ) {
    categories.push('companies');
  }

  // Research classification
  if (
    ['paper', 'arxiv', 'research', 'dataset', 'benchmark', 'algorithm', 'reinforcement', 'neural network', 'deep learning', 'machine learning'].some(k =>
      title.includes(k)
    )
  ) {
    categories.push('research');
  }

  return categories;
}

interface FetchProgress {
  total: number;
  completed: number;
  percentage: number;
}

/**
 * Fetch and filter Hacker News items
 */
export async function fetchAINews(
  onProgress?: (progress: FetchProgress) => void,
  limit: number = 250
): Promise<HNStory[]> {
  try {
    // Get top stories
    const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!topStoriesRes.ok) throw new Error('Failed to fetch top stories list');
    
    const ids: number[] = await topStoriesRes.ok ? await topStoriesRes.json() : [];
    if (!ids || ids.length === 0) return [];

    // Slice stories to check
    const targetIds = ids.slice(0, limit);
    const total = targetIds.length;
    let completed = 0;
    const stories: HNStory[] = [];

    // Utility to update progress
    const updateProgress = () => {
      completed++;
      if (onProgress) {
        onProgress({
          total,
          completed,
          percentage: Math.round((completed / total) * 100),
        });
      }
    };

    // Sub-batch size to handle concurrent fetches safely
    const batchSize = 40;
    for (let i = 0; i < targetIds.length; i += batchSize) {
      const batchIds = targetIds.slice(i, i + batchSize);
      
      const batchPromises = batchIds.map(async (id) => {
        try {
          const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!itemRes.ok) {
            updateProgress();
            return null;
          }
          const item: HNStory = await itemRes.json();
          updateProgress();
          
          if (item && item.title && isAINews(item.title)) {
            return item;
          }
        } catch (e) {
          console.error(`Error fetching HN item ${id}:`, e);
          updateProgress();
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      for (const res of batchResults) {
        if (res) stories.push(res);
      }
    }

    return stories;
  } catch (error) {
    console.error('Error fetching AI news:', error);
    throw error;
  }
}
