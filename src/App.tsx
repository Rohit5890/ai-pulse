/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Search,
  RefreshCw,
  Bookmark,
  ExternalLink,
  Award,
  Clock,
  Share2,
  TrendingUp,
  BrainCircuit,
  Filter,
  Check,
  AlertTriangle,
  BookOpen,
  ArrowUp,
  ChevronRight,
  Info
} from 'lucide-react';
import { HNStory, CategoryFilter } from './types';
import { fetchAINews, classifyStory } from './utils/news';
import { useBookmarks } from './hooks/useBookmarks';
import { getRelativeTime } from './utils/time';

export default function App() {
  const [stories, setStories] = useState<HNStory[]>(() => {
    try {
      const cached = localStorage.getItem('ai_pulse_cached_news');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryFilter | 'saved'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'score'>('default');
  const [loading, setLoading] = useState(stories.length === 0);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ total: 100, completed: 0, percentage: 0 });
  const [lastUpdated, setLastUpdated] = useState<number | null>(() => {
    const saved = localStorage.getItem('ai_pulse_last_updated');
    return saved ? parseInt(saved, 10) : null;
  });
  
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { bookmarks, toggleBookmark, isBookmarked } = useBookmarks();
  
  // Back to top visible ref
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Trigger loading of news
  const loadNewsData = async (force: boolean = false) => {
    if (syncing) return;
    setSyncing(true);
    if (stories.length === 0) setLoading(true);

    try {
      // Fetch up to 250 items to scan for AI content
      const freshStories = await fetchAINews((progress) => {
        setSyncProgress(progress);
      }, 250);

      if (freshStories.length > 0) {
        setStories(freshStories);
        localStorage.setItem('ai_pulse_cached_news', JSON.stringify(freshStories));
        const now = Date.now();
        setLastUpdated(now);
        localStorage.setItem('ai_pulse_last_updated', now.toString());
        showToast('Successfully synced latest AI news!');
      } else {
        showToast('Sync complete. No new items found.');
      }
    } catch (err) {
      console.error(err);
      showToast('Sync failed. Please check network connections.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  // Auto-refresh timer
  useEffect(() => {
    // Initial fetch if cache is empty or stale (> 5 minutes)
    const STALE_LIMIT = 5 * 60 * 1000;
    const isStale = !lastUpdated || (Date.now() - lastUpdated) > STALE_LIMIT;
    
    if (stories.length === 0 || isStale) {
      loadNewsData();
    }

    // Set interval for every 5 minutes (300000 ms) as specified
    const interval = setInterval(() => {
      loadNewsData();
    }, 300000);

    return () => clearInterval(interval);
  }, []);

  // Update last status timer
  useEffect(() => {
    const updateRelative = () => {
      if (!lastUpdated) {
        setTimeSinceUpdate('never shadow updated');
        return;
      }
      const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
      if (seconds < 60) {
        setTimeSinceUpdate('Just now');
      } else {
        const mins = Math.floor(seconds / 60);
        setTimeSinceUpdate(`${mins}m ago`);
      }
    };

    updateRelative();
    const interval = setInterval(updateRelative, 30000); // update every 30s
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Back to top scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 3500);
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard!');
  };

  // Filter and sort core logic
  const filteredStories = stories.filter((story) => {
    // Search filter
    const matchesSearch =
      story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (story.by || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Tab category filter
    if (activeTab === 'saved') {
      return isBookmarked(story.id);
    } else if (activeTab === 'all') {
      return true;
    } else {
      const categories = classifyStory(story);
      return categories.includes(activeTab);
    }
  });

  // Sort logic
  const sortedStories = [...filteredStories].sort((a, b) => {
    if (sortBy === 'score') {
      return (b.score || 0) - (a.score || 0);
    }
    // Default is HN top stories ranking order (descending index in original array)
    return 0; // keeps the original natural curated order of top stories
  });

  // Stats calculation
  const stats = {
    total: filteredStories.filter(s => activeTab === 'saved' ? true : true).length,
    highestScore: filteredStories.reduce((max, s) => Math.max(max, s.score || 0), 0),
    avgScore: Math.round(
      filteredStories.length
        ? filteredStories.reduce((sum, s) => sum + (s.score || 0), 0) / filteredStories.length
        : 0
    ),
    bookmarkedCount: stories.filter(s => isBookmarked(s.id)).length
  };

  const tabs: { id: CategoryFilter | 'saved'; label: string; icon: any }[] = [
    { id: 'all', label: 'All AI Stream', icon: Activity },
    { id: 'llm', label: 'LLMs & GPT', icon: BrainCircuit },
    { id: 'models', label: 'Models & Architecture', icon: Filter },
    { id: 'research', label: 'Core Research', icon: BookOpen },
    { id: 'companies', label: 'Industry & Startups', icon: TrendingUp },
    { id: 'saved', label: `Pins (${stats.bookmarkedCount})`, icon: Bookmark }
  ];

  const getScoreColor = (score: number = 0) => {
    if (score >= 400) return 'text-violet-400 bg-violet-400/10 border-violet-500/20';
    if (score >= 150) return 'text-cyan-400 bg-cyan-400/10 border-cyan-500/20';
    return 'text-slate-400 bg-slate-400/10 border-slate-500/10';
  };

  const getScoreBadgeShadow = (score: number = 0) => {
    if (score >= 400) return 'shadow-[0_0_12px_rgba(167,139,250,0.15)]';
    if (score >= 150) return 'shadow-[0_0_12px_rgba(34,211,238,0.15)]';
    return '';
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col relative z-10 pb-16 selection:bg-cyan-500/30 selection:text-white font-sans" id="appRoot">
      {/* Top interactive scan-line effect */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-cyan-400 to-violet-500 opacity-80 z-50 pointer-events-none" id="topBumper"></div>

      {/* Navigation - Glass Card Header */}
      <nav className="w-full border-b border-white/10 glass-card z-30 sticky top-0" id="mainNavbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-10 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-cyan-400 font-orbitron text-2xl font-bold tracking-tighter">AI PULSE</div>
            <div className="h-4 w-[1px] bg-white/20 mx-2 hidden sm:block"></div>
            <div className="text-[10px] text-white/50 font-orbitron tracking-widest uppercase hidden sm:block">Intelligence Stream</div>
          </div>

          {/* Live status badge with Tooltip */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <button
                 onClick={() => loadNewsData(true)}
                 disabled={syncing}
                 className="flex items-center gap-3 px-4 py-2 bg-[#00FFFF]/10 border border-[#00FFFF]/20 rounded-full select-none cursor-pointer hover:bg-cyan-500/15 transition-all text-xs outline-none disabled:opacity-50 font-orbitron font-bold uppercase tracking-widest text-cyan-400"
                 id="liveBtn"
              >
                <div className="pulse-dot"></div>
                <span>{syncing ? 'SYNCING_CORE...' : 'Live Feed'}</span>
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${syncing ? 'animate-spin' : 'hover:scale-110 transition-transform'}`} />
              </button>
              
              <div className="absolute top-12 right-0 px-4 py-2.5 rounded-xl bg-black/95 border border-cyan-500/30 text-cyan-400 text-[10px] font-orbitron whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-[0_0_15px_rgba(0,255,255,0.15)] text-center z-50">
                AUTO-REFRESH_ACTIVE
                <br />
                <span className="text-slate-400 lowercase italic font-sans font-light">last updated: {timeSinceUpdate}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Progress Sync Bar */}
      {syncing && (
        <div className="w-full max-w-7xl mx-auto mt-4 px-4 sm:px-10" id="syncBar">
          <div className="h-1 w-full bg-slate-950 rounded-full overflow-hidden border border-white/[0.04]">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
              initial={{ width: '0%' }}
              animate={{ width: `${syncProgress.percentage}%` }}
              transition={{ ease: 'easeOut', duration: 0.1 }}
            />
          </div>
          <div className="flex justify-between items-center mt-1.5 text-[10px] font-orbitron tracking-wider text-slate-400">
            <span>SYNCING NEWSFLOW_DATA_NODES...</span>
            <span className="text-cyan-400">{syncProgress.percentage}% ({syncProgress.completed}/{syncProgress.total})</span>
          </div>
        </div>
      )}

      {/* Hero Display section */}
      <section className="w-full max-w-7xl mx-auto pt-16 pb-12 px-4 sm:px-10 text-center flex flex-col items-center justify-center" id="heroSection">
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-orbitron font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight leading-tight uppercase">
            The Future of <span className="text-cyan-400 drop-shadow-[0_0_15px_rgba(0,255,255,0.4)]">Artificial Intelligence</span>
          </h2>
          <p className="max-w-2xl mx-auto mt-4 text-slate-400 text-base sm:text-lg font-light leading-relaxed">
            Real-time tracking of neural breakthroughs, model performance, and global AI infrastructure shifts.
          </p>
        </motion.div>

        {/* Search Input Box */}
        <div className="w-full max-w-xl mt-8 relative" id="searchWidget">
          <input
            type="text"
            id="searchBox"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the intelligence network..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-6 pr-28 py-4 text-white placeholder:text-white/20 outline-none focus:border-cyan-400/50 focus:bg-white/10 transition-all text-sm select-text"
          />
          <button 
            type="button"
            onClick={() => setSearchQuery('')}
            className={`absolute right-3 top-2.5 bottom-2.5 px-5 bg-cyan-400 text-[#050816] font-orbitron font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all uppercase text-[10px] tracking-wider ${
              searchQuery ? 'opacity-100 pointer-events-auto' : 'opacity-40 pointer-events-none'
            }`}
          >
            {searchQuery ? 'CLEAR' : 'SEARCH'}
          </button>
        </div>
      </section>

      {/* Stats Bento Grid Panel */}
      <section className="w-full max-w-7xl mx-auto mb-10 px-4 sm:px-10" id="statsGrid">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-[#00FFFF]/30 transition-all">
            <span className="text-[10px] font-orbitron text-slate-400 uppercase tracking-widest">Active Stream</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl sm:text-3xl font-bold font-orbitron text-white">{stats.total}</span>
              <span className="text-slate-400 text-xs font-light">Articles</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-[#00FFFF]/30 transition-all">
            <span className="text-[10px] font-orbitron text-slate-400 uppercase tracking-widest">Peak Consensus</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl sm:text-3xl font-bold font-orbitron text-cyan-400">▲{stats.highestScore}</span>
              <span className="text-slate-400 text-xs font-light">pts</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-[#00FFFF]/30 transition-all">
            <span className="text-[10px] font-orbitron text-slate-400 uppercase tracking-widest">Avg Weight</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl sm:text-3xl font-bold font-orbitron text-white">{stats.avgScore}</span>
              <span className="text-slate-400 text-xs font-light">pts</span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-[#00FFFF]/30 transition-all">
            <span className="text-[10px] font-orbitron text-slate-400 uppercase tracking-widest">Synchronized</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-xs sm:text-sm font-semibold font-orbitron text-cyan-400 uppercase tracking-wider">
                {lastUpdated ? getRelativeTime(Math.floor(lastUpdated / 1000)) : 'Never'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Tabs & Sorters */}
      <section className="w-full max-w-7xl mx-auto mb-8 px-4 sm:px-10" id="filtersPanel">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between border-b border-white/10 pb-4 gap-4">
          {/* Categorized Tabs */}
          <div className="flex flex-wrap gap-2" id="tabsList">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all duration-200 cursor-pointer select-none font-orbitron ${
                    isActive
                      ? 'bg-[#00FFFF]/15 border border-[#00FFFF]/40 text-[#00FFFF]'
                      : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : ''}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Sort Toggles */}
          <div className="flex items-center gap-3 text-xs self-end xl:self-auto" id="sortingList">
            <span className="text-[10px] font-orbitron text-slate-500 uppercase tracking-widest">Sort sequence</span>
            <div className="bg-white/5 p-1 border border-white/10 rounded-xl flex gap-1">
              <button
                onClick={() => setSortBy('default')}
                className={`px-4 py-2 rounded-lg font-bold font-orbitron text-[10px] tracking-wider uppercase transition-all cursor-pointer select-none ${
                  sortBy === 'default'
                    ? 'bg-white/10 border border-white/10 text-cyan-400'
                    : 'text-white/40 hover:text-white'
                }`}
                id="sortDefault"
              >
                HN Default
              </button>
              <button
                onClick={() => setSortBy('score')}
                className={`px-4 py-2 rounded-lg font-bold font-orbitron text-[10px] tracking-wider uppercase transition-all cursor-pointer select-none ${
                  sortBy === 'score'
                    ? 'bg-white/10 border border-white/10 text-cyan-400'
                    : 'text-white/40 hover:text-white'
                }`}
                id="sortScore"
              >
                Ranked
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main News Stream Grid */}
      <main className="w-full max-w-7xl mx-auto flex-1 px-4 sm:px-10" id="newsSection">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center" id="fullLoader">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/10 border-t-cyan-400 animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-4 border-violet-500/20 border-b-violet-400 animate-spin animate-reverse"></div>
              <BrainCircuit className="w-6 h-6 text-cyan-400 absolute inset-0 m-auto" />
            </div>
            <h3 className="font-orbitron text-lg font-bold tracking-widest text-[#00FFFF] uppercase animate-pulse">Establishing Signal Lock</h3>
            <p className="text-slate-400 text-xs mt-2 max-w-xs leading-relaxed font-light italic">
              Clustering and mapping live AI consensus indexes from real-time global developer streams...
            </p>
          </div>
        ) : sortedStories.length === 0 ? (
          <div className="text-center py-20 glass-card rounded-2xl flex flex-col items-center p-8" id="emptyDisplay">
            <AlertTriangle className="w-12 h-12 text-slate-500 mb-3 animate-bounce" />
            <h3 className="font-orbitron text-lg font-bold text-slate-300 uppercase tracking-wider">Empty Signal Stream</h3>
            <p className="text-slate-400 text-xs mt-2 max-w-md font-light">
              {searchQuery
                ? `No AI breakthroughs matched search keyword "${searchQuery}". Try broadening your inputs.`
                : activeTab === 'saved'
                ? `You have not pinned any news articles yet. Click the bookmark bookmark icon on any card to capture it in your database.`
                : 'No AI specific streams detected in recent scans. Click the sync trigger at the top right to force-index fresh HN stacks.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-orbitron text-xs rounded-lg hover:bg-cyan-500/20 transition-colors"
              >
                Reset Search Filters
              </button>
            )}
          </div>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            id="storyCardsGrid"
          >
            <AnimatePresence mode="popLayout">
              {sortedStories.map((story) => {
                const bookmarked = isBookmarked(story.id);
                // Classify components
                const storyCategories = classifyStory(story).filter((c) => c !== 'all');
                
                return (
                  <motion.article
                    key={story.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="glass-card rounded-2xl p-6 flex flex-col hover:border-[#00FFFF]/40 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group hover:shadow-[0_0_20px_rgba(0,255,255,0.1)] relative"
                    onClick={() => {
                      if (story.url) {
                        window.open(story.url, '_blank');
                      } else {
                        window.open(`https://news.ycombinator.com/item?id=${story.id}`, '_blank');
                      }
                    }}
                  >
                    {/* Top action layout */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {/* Points badge */}
                        <div className="text-[#00FFFF] font-orbitron text-xs font-bold uppercase tracking-wider">
                          ▲ {story.score || 0} POINTS
                        </div>
                        {/* Categorized tags */}
                        {storyCategories.map((cat) => (
                          <span
                            key={cat}
                            className="text-[10px] text-white/30 uppercase font-bold border border-white/20 px-2 py-0.5 rounded font-orbitron tracking-wider"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Headline */}
                    <div className="block mt-1 flex-1">
                      <h3 className="text-white text-base font-semibold group-hover:text-[#00FFFF] leading-snug tracking-wide transition-colors duration-200 line-clamp-3">
                        {story.title}
                      </h3>
                    </div>

                    {/* Footer Info line */}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-4 border-t border-white/5 text-xs text-white/40 mt-6 select-none">
                      <div className="flex items-center gap-2 overflow-hidden truncate">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-500 to-violet-500 flex-shrink-0 animate-pulse"></div>
                        <span className="text-[11px] font-light">
                          by <span className="text-white/70 font-semibold">{story.by || 'unknown'}</span>
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2.5 shrink-0 text-[10px]">
                        <div className="flex items-center gap-1 text-white/30">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{getRelativeTime(story.time)}</span>
                        </div>
                        {/* Pins & Share Actions */}
                        <div className="flex items-center gap-1 shrink-0 z-30">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleBookmark(story.id);
                            }}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              bookmarked ? 'text-[#00FFFF]' : 'text-white/30 hover:text-white'
                            }`}
                            title={bookmarked ? 'Remove pin' : 'Pin story'}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              copyToClipboard(story.url || `https://news.ycombinator.com/item?id=${story.id}`);
                            }}
                            className="p-1.5 text-white/30 hover:text-white transition-colors cursor-pointer"
                            title="Copy link"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto h-16 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between px-4 sm:px-10 text-[9px] uppercase tracking-[0.2em] text-white/30 font-orbitron mt-20 gap-3" id="mainFooter">
        <div>Node ID: AIS-PULSE-NODE-01</div>
        <div className="flex gap-4 sm:gap-8 flex-wrap justify-center">
          <span>Hacker News Stream</span>
          <span>•</span>
          <span className="text-[#00FFFF]">System Status: Operational</span>
        </div>
      </footer>

      {/* Micro Floating Toast Overlay */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-950/95 border border-cyan-400/40 text-cyan-400 text-xs font-mono shadow-[0_4px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(6,182,212,0.2)] backdrop-blur-xl"
            id="toastNotification"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back to top button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 p-2.5 rounded-xl bg-slate-900 border border-white/[0.08] hover:border-cyan-400 text-slate-400 hover:text-cyan-400 transition-all z-40 cursor-pointer shadow-lg"
            title="Back to top"
            id="scrollTopBtn"
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
