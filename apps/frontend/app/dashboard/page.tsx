"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { Activity, Plus, X, Server, ArrowRight, ChevronDown, Sun, Moon } from 'lucide-react';
import { useWebsites } from '@/hooks/useWebsites';
import axios from 'axios';
import { API_BACKEND_URL } from '@/config';
import { useAuth, UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

type UptimeStatus = "good" | "bad" | "unknown";

interface ProcessedWebsite {
  id: string;
  url: string;
  status: UptimeStatus;
  uptimePercentage: number;
  lastChecked: string;
  uptimeTicks: UptimeStatus[];
}

function CreateWebsiteModal({ isOpen, onClose }: { isOpen: boolean; onClose: (url: string | null) => void }) {
  const [url, setUrl] = useState('');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-[20px] p-6 w-full max-w-md shadow-2xl relative">
        <button onClick={() => onClose(null)} className="absolute top-4 right-4 text-slate-400 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-muted border border-slate-200 dark:border-white/10 flex items-center justify-center mb-4">
            <Server className="w-5 h-5 text-slate-500 dark:text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-foreground tracking-tight">Add Endpoint</h2>
          <p className="text-sm text-slate-500 dark:text-muted-foreground mt-1 font-light">Enter the URL of the service you want to monitor globally.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-muted-foreground tracking-wider uppercase mb-2">Endpoint URL</label>
          <input
            type="url"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-background border border-slate-200 dark:border-border rounded-xl text-slate-900 dark:text-foreground outline-none focus:border-slate-400 dark:focus:border-foreground/30 transition-all font-mono text-sm shadow-sm"
            placeholder="https://api.yourdomain.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-slate-100 dark:border-border">
          <button
            type="button"
            onClick={() => onClose(null)}
            className="px-5 py-2 text-sm font-medium text-slate-500 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={() => onClose(url)}
            className="px-6 py-2 text-sm font-semibold text-white dark:text-primary-foreground bg-slate-900 dark:bg-primary hover:opacity-90 rounded-full transition-all flex items-center shadow-md border border-slate-800 dark:border-none"
          >
            Deploy Monitor <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { websites, refreshWebsites } = useWebsites();
  const { getToken } = useAuth();
  const [expandedWebsiteId, setExpandedWebsiteId] = useState<string | null>(null);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light') setTheme('light');
    else setTheme('dark');
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const processedWebsites = useMemo(() => {
    return websites.map(website => {
      const sortedTicks = [...website.ticks].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const recentTicks = sortedTicks.filter(tick =>
        new Date(tick.createdAt) > thirtyMinutesAgo
      );

      const windows: UptimeStatus[] = [];
      for (let i = 0; i < 20; i++) {
        const windowStart = new Date(Date.now() - (i + 1) * 1.5 * 60 * 1000);
        const windowEnd = new Date(Date.now() - i * 1.5 * 60 * 1000);

        const windowTicks = recentTicks.filter(tick => {
          const tickTime = new Date(tick.createdAt);
          return tickTime >= windowStart && tickTime < windowEnd;
        });

        const upTicks = windowTicks.filter(tick => tick.status === 'Good').length;
        windows[19 - i] = windowTicks.length === 0 ? "unknown" : (upTicks / windowTicks.length) >= 0.5 ? "good" : "bad";
      }

      const totalTicks = sortedTicks.length;
      const upTicks = sortedTicks.filter(tick => tick.status === 'Good').length;
      const uptimePercentage = totalTicks === 0 ? 100 : (upTicks / totalTicks) * 100;

      const currentStatus = windows[windows.length - 1] === "unknown" ? "good" : windows[windows.length - 1];

      const lastChecked = sortedTicks[0]
        ? new Date(sortedTicks[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Never';

      return {
        id: website.id,
        url: website.url,
        status: currentStatus,
        uptimePercentage,
        lastChecked,
        uptimeTicks: windows.reverse(),
      };
    });
  }, [websites]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-slate-900 dark:text-foreground font-sans selection:bg-primary/20 transition-colors duration-300">

      {/* Sleek Vercel-style Navbar */}
      <nav className="sticky top-0 z-40 bg-white/70 dark:bg-black/40 backdrop-blur-xl border-b border-slate-200 dark:border-border transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push('/')}>
              <Activity className="h-5 w-5 text-slate-900 dark:text-foreground" />
              <span className="font-semibold text-sm tracking-wide text-slate-900 dark:text-foreground">DePIN Uptime</span>
            </div>
            <div className="h-4 w-px bg-slate-300 dark:bg-border hidden sm:block"></div>
            <div className="hidden sm:flex items-center text-sm font-medium mt-0.5">
              <span className="px-3 py-1 bg-slate-100 dark:bg-muted rounded-md text-slate-900 dark:text-foreground shadow-sm">Overview</span>
              <span className="px-3 py-1 text-slate-500 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground cursor-pointer transition">Logs</span>
              <span className="px-3 py-1 text-slate-500 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground cursor-pointer transition">Settings</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-muted transition-colors text-slate-500 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-8 h-8 rounded-full border border-slate-200 dark:border-white/10" } }} />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">

        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-foreground">Infrastructure</h1>
            <p className="text-sm text-slate-500 dark:text-muted-foreground mt-2 font-light">Monitor your deployed validator nodes and endpoints globally.</p>
          </div>
          <div className="mt-6 sm:mt-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 text-sm bg-slate-900 dark:bg-primary text-white dark:text-primary-foreground px-5 py-2 rounded-full font-semibold hover:opacity-90 transition-all shadow-md dark:shadow-primary/20 border border-slate-800 dark:border-none"
            >
              <span>Add Endpoint</span>
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm transition-colors duration-300">

          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-200 dark:border-border text-[11px] font-semibold text-slate-500 dark:text-muted-foreground uppercase tracking-widest bg-slate-50 dark:bg-white/[0.01]">
            <div className="col-span-12 sm:col-span-6 md:col-span-5">Service Target</div>
            <div className="hidden sm:block sm:col-span-2 text-center">Status</div>
            <div className="hidden md:block md:col-span-3 text-center">Pulse (30m)</div>
            <div className="hidden sm:block sm:col-span-4 md:col-span-2 text-right">Uptime</div>
          </div>

          <div className="flex flex-col divide-y divide-slate-100 dark:divide-white/[0.04]">
            {processedWebsites.map((website) => {
              const isUp = website.status === 'good';
              const isExpanded = expandedWebsiteId === website.id;

              return (
                <div key={website.id} className="group flex flex-col transition-colors">

                  {/* Row content */}
                  <div
                    onClick={() => setExpandedWebsiteId(isExpanded ? null : website.id)}
                    className={`grid grid-cols-12 gap-4 px-6 py-5 items-center cursor-pointer ${isExpanded ? 'bg-slate-50/50 dark:bg-white/[0.03]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}
                  >

                    {/* Identifier */}
                    <div className="col-span-12 sm:col-span-6 md:col-span-5 flex items-center space-x-4">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isUp ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)] animate-breathe' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,63,0.4)]'}`} />
                      <div className="overflow-hidden">
                        <h3 className="text-sm font-medium text-slate-900 dark:text-foreground truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center">
                          {website.url}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-gray-500 mt-1 uppercase tracking-wide">Last check: {website.lastChecked}</p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="hidden sm:flex sm:col-span-2 items-center justify-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${isUp ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'}`}>
                        {isUp ? 'Operational' : 'Degraded'}
                      </span>
                    </div>

                    {/* Sparkline (Pulse) */}
                    <div className="hidden md:flex md:col-span-3 items-center justify-center space-x-1.5 h-6">
                      {website.uptimeTicks.map((tick, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-full rounded-full transition-transform group-hover:scale-y-110 ${tick === 'good' ? 'bg-emerald-500/40 dark:bg-emerald-500/60' : tick === 'bad' ? 'bg-rose-500' : 'bg-slate-200 dark:bg-white/10'}`}
                          title={`Tick ${i}`}
                        />
                      ))}
                    </div>

                    {/* Total Uptime */}
                    <div className="hidden sm:flex sm:col-span-4 md:col-span-2 items-center justify-end space-x-3">
                      <span className="text-sm font-medium text-slate-900 dark:text-white font-mono">{website.uptimePercentage.toFixed(1)}%</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="col-span-12 px-6 pb-6 pt-2 bg-slate-50/50 dark:bg-white/[0.01]">
                      <div className="p-6 bg-white dark:bg-[#0A0A0A] rounded-xl border border-slate-200 dark:border-white/[0.04] grid grid-cols-1 md:grid-cols-3 gap-8 shadow-sm dark:shadow-none">

                        <div>
                          <h4 className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-gray-500 font-semibold mb-2">Endpoint ID</h4>
                          <p className="text-sm text-slate-700 dark:text-gray-300 font-mono break-all">{website.id}</p>
                        </div>

                        <div>
                          <h4 className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-gray-500 font-semibold mb-2">Response Time (Avg)</h4>
                          <div className="flex items-end space-x-2">
                            <span className="text-2xl font-semibold text-slate-900 dark:text-white leading-none">42</span>
                            <span className="text-sm text-slate-500 dark:text-gray-500 mb-0.5">ms</span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-gray-500 font-semibold mb-4">Global Region Routing</h4>
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden flex">
                            <div className="h-full bg-blue-500 w-[60%]" title="US East"></div>
                            <div className="h-full bg-purple-500 w-[25%]" title="EU Central"></div>
                            <div className="h-full bg-emerald-500 w-[15%]" title="AP East"></div>
                          </div>
                          <div className="flex justify-between mt-2 text-[10px] text-slate-500 dark:text-gray-400">
                            <div className="flex items-center space-x-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div><span>US: 60%</span></div>
                            <div className="flex items-center space-x-1"><div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div><span>EU: 25%</span></div>
                            <div className="flex items-center space-x-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span>AP: 15%</span></div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {processedWebsites.length === 0 && (
              <div className="py-24 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center mb-6">
                  <Activity className="w-8 h-8 text-slate-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">No Infrastructure Configured</h3>
                <p className="text-slate-500 dark:text-gray-500 mt-2 max-w-sm font-light">Deploy a monitor to start tracking your endpoints globally with sub-second resolution.</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-8 text-sm font-medium text-white dark:text-black bg-slate-900 dark:bg-white px-6 py-2.5 rounded-full hover:opacity-90 transition-colors shadow-md"
                >
                  Deploy your first Monitor
                </button>
              </div>
            )}
          </div>
        </div>

      </main>

      <CreateWebsiteModal
        isOpen={isModalOpen}
        onClose={async (url) => {
          if (url === null) {
            setIsModalOpen(false);
            return;
          }

          const token = await getToken();
          setIsModalOpen(false)
          if (!token) {
            alert("Authorization missing. Please authenticate first.");
            return;
          }
          try {
            await axios.post(`${API_BACKEND_URL}/api/v1/website`, {
              url,
            }, {
              headers: {
                Authorization: token,
              },
            });
            refreshWebsites();
          } catch (error) {
            console.error(error);
            alert("Deployment failed. Check URL and connectivity.");
          }
        }}
      />
    </div>
  );
}
