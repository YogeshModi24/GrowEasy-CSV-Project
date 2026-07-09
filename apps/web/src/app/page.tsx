'use client';

import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Upload, 
  FileText, 
  AlertTriangle, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Eye, 
  ShieldAlert,
  HelpCircle,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  ArrowRight,
  Sun,
  Moon
} from 'lucide-react';
import { GrowEasyRecord, GrowEasyCrmStatus, GrowEasyDataSource } from '@groweasy/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

type RawRow = Record<string, string>;

export default function Home() {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // UI state
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'valid' | 'skipped'>('all');

  // Processing State
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [results, setResults] = useState<GrowEasyRecord[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Theme Sync on Mount
  useEffect(() => {
    const storedTheme = localStorage.getItem('groweasy-theme') as 'dark' | 'light' | null;
    if (storedTheme) {
      setTheme(storedTheme);
      if (storedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    } else {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('groweasy-theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Virtualizer for previewing all raw rows
  const rowVirtualizer = useVirtualizer({
    count: rawRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44, // Height of individual rows (44px)
    overscan: 15,
    paddingStart: 44, // Size of the header row (44px) so rows start below it
  });

  // CSV parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setParseError('Please upload a valid CSV file.');
      return;
    }

    setFile(selectedFile);
    setParseError(null);
    setApiError(null);
    setResults([]);

    Papa.parse<RawRow>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setParseError('The uploaded CSV file is empty.');
          return;
        }
        setRawRows(results.data);
        if (results.meta.fields) {
          setHeaders(results.meta.fields);
        } else if (results.data[0]) {
          setHeaders(Object.keys(results.data[0]));
        }
      },
      error: (error) => {
        setParseError(`Failed to parse CSV: ${error.message}`);
      }
    });
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    setFile(null);
    setRawRows([]);
    setHeaders([]);
    setResults([]);
    setParseError(null);
    setApiError(null);
    setProgress(0);
    setProgressMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Call Streaming API Endpoint
  const handleExtract = async () => {
    if (rawRows.length === 0) return;

    setIsExtracting(true);
    setApiError(null);
    setProgress(0);
    setProgressMessage('Establishing connection to extraction backend...');

    try {
      const response = await fetch(`${API_URL}/api/csv/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rows: rawRows }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to process CSV rows.');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Readable stream not supported in this browser.');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (!dataStr) continue;

            const payload = JSON.parse(dataStr);
            if (payload.type === 'progress') {
              const current = payload.current;
              const total = payload.total;
              const pct = total > 0 ? Math.round((current / total) * 100) : 0;
              setProgress(pct);
              if (current === 0) {
                setProgressMessage(`Initializing parallel jobs... Total batches: ${total}`);
              } else {
                setProgressMessage(`Processing batch ${current} of ${total}...`);
              }
            } else if (payload.type === 'done') {
              setResults(payload.records || []);
              setProgress(100);
              setProgressMessage('Extraction complete!');
            } else if (payload.type === 'error') {
              throw new Error(payload.error || 'An error occurred during remote execution.');
            }
          }
        }
      }
    } catch (err) {
      setProgress(0);
      setProgressMessage('');
      setApiError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Export Results
  const handleDownloadCSV = () => {
    if (results.length === 0) return;
    const csv = Papa.unparse(results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `groweasy_cleaned_${file?.name || 'leads.csv'}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadJSON = () => {
    if (results.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(results, null, 2)
    )}`;
    const link = document.createElement('a');
    link.setAttribute('href', jsonString);
    link.setAttribute('download', `groweasy_cleaned_${file?.name?.replace('.csv', '') || 'leads'}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats
  const validRecords = results.filter(r => !r._skip_reason);
  const skippedRecords = results.filter(r => r._skip_reason);

  const displayedRecords = results.filter(r => {
    if (activeTab === 'valid') return !r._skip_reason;
    if (activeTab === 'skipped') return r._skip_reason;
    return true;
  });

  const getStatusBadge = (status: GrowEasyCrmStatus | null) => {
    switch (status) {
      case 'GOOD_LEAD_FOLLOW_UP':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Good Lead / Follow Up</span>;
      case 'DID_NOT_CONNECT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-450 border border-zinc-500/20 dark:text-zinc-400">Did Not Connect</span>;
      case 'BAD_LEAD':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Bad Lead</span>;
      case 'SALE_DONE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">Sale Done</span>;
      default:
        return <span className="text-zinc-500/60 dark:text-zinc-500/60 text-xs">-</span>;
    }
  };

  const getSourceBadge = (source: GrowEasyDataSource | null) => {
    if (!source) return <span className="text-zinc-550/60 dark:text-zinc-550/60 italic text-xs font-medium">Not specified</span>;
    return (
      <span className="px-2 py-0.5 rounded text-xs font-mono bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25">
        {source}
      </span>
    );
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 selection:bg-indigo-500/30 ${
      theme === 'dark' 
        ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black text-white' 
        : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-100 via-zinc-50 to-white text-zinc-900'
    }`}>
      {/* Background patterns */}
      <div className={`absolute inset-0 bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none transition-opacity duration-300 ${
        theme === 'dark' 
          ? 'bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] opacity-35' 
          : 'bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] opacity-55'
      }`} />

      {/* Header */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-md transition-colors duration-300 ${
        theme === 'dark' ? 'border-zinc-800/80 bg-zinc-955/70 bg-zinc-950/70' : 'border-zinc-200/80 bg-white/70 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className={`font-bold text-lg tracking-tight transition-colors duration-300 ${
                theme === 'dark' ? 'bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent' : 'text-zinc-800'
              }`}>GrowEasy CRM</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">AI Importer</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <a 
              href="https://github.com" 
              target="_blank" 
              className={`text-sm transition-colors ${theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-650 hover:text-zinc-900'}`}
            >
              Documentation
            </a>
            
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className={`rounded-xl transition-all duration-200 ${
                theme === 'dark' 
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-900' 
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-150 hover:bg-zinc-100'
              }`}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-12 py-8 pt-12 md:pt-16 relative">
        {/* Hero Info */}
        {results.length === 0 && !isExtracting && (
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h1 className={`text-4xl md:text-5xl font-extrabold tracking-tight mb-4 transition-colors duration-300 ${
              theme === 'dark' ? 'text-white' : 'text-zinc-850 text-zinc-900'
            }`}>
              Production-Grade <br />
              <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-400 bg-clip-text text-transparent dark:from-indigo-400 dark:via-indigo-300 dark:to-indigo-200">
                AI CSV Importer
              </span>
            </h1>
            <p className={`text-base leading-relaxed transition-colors duration-300 ${
              theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
            }`}>
              Upload any spreadsheet. The system will leverage Groq AI to clean, format, map columns, split phone numbers, determine statuses, and validate each row against the strict GrowEasy CRM schema.
            </p>
          </div>
        )}

        {/* Upload State / Preview State */}
        {results.length === 0 && !isExtracting && (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* Upload Zone */}
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleTriggerUpload}
                className={`group relative rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-12 text-center cursor-pointer transition-all duration-300 ${
                  isDragOver
                    ? 'scale-[1.01] animate-border-pulse border-indigo-500 bg-indigo-500/5 shadow-2xl shadow-indigo-500/10'
                    : theme === 'dark'
                      ? 'border-zinc-800 bg-zinc-900/10 hover:border-zinc-700 hover:bg-zinc-900/20'
                      : 'border-zinc-250 border-zinc-300 bg-zinc-50/50 hover:border-zinc-400 hover:bg-zinc-100/30'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".csv"
                  onChange={handleFileChange}
                />
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-indigo-500/40 group-hover:bg-indigo-500/5 transition-all duration-300 ${
                  theme === 'dark' ? 'bg-zinc-900/80 border border-zinc-800/80' : 'bg-white border border-zinc-200 shadow-sm'
                }`}>
                  <Upload className={`w-7 h-7 transition-colors ${theme === 'dark' ? 'text-zinc-400 group-hover:text-indigo-400' : 'text-zinc-500 group-hover:text-indigo-500'}`} />
                </div>
                <h3 className={`font-semibold text-lg mb-1 transition-colors duration-300 ${
                  theme === 'dark' ? 'text-zinc-200 group-hover:text-white' : 'text-zinc-800 group-hover:text-zinc-950'
                }`}>
                  Drag & drop CSV file
                </h3>
                <p className={`text-sm mb-6 max-w-xs transition-colors duration-300 ${
                  theme === 'dark' ? 'text-zinc-500' : 'text-zinc-450'
                }`}>
                  Supported formats: CSV. Max file size: 5MB.
                </p>
                <Button 
                  type="button" 
                  variant="outline" 
                  className={`rounded-xl transition-colors duration-250 ${
                    theme === 'dark'
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:text-white'
                      : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  Select File
                </Button>

                {parseError && (
                  <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center space-x-2 text-xs text-rose-450 text-rose-450">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>{parseError}</span>
                  </div>
                )}
              </div>
            ) : (
              /* Raw Data Preview */
              <Card className={`border rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-colors duration-300 ${
                theme === 'dark' ? 'bg-zinc-900/25 border-zinc-800/80 backdrop-blur-sm' : 'bg-white border-zinc-200 shadow-sm'
              }`}>
                <CardHeader className={`border-b px-6 py-4 flex flex-row items-center justify-between transition-colors duration-300 ${
                  theme === 'dark' ? 'border-zinc-800/80 bg-zinc-900/30' : 'border-zinc-200 bg-zinc-50/50'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-500">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className={`text-base font-bold transition-colors duration-300 ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-850 text-zinc-800'}`}>{file.name}</CardTitle>
                      <CardDescription className={`text-xs transition-colors duration-300 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-450'}`}>
                        {(file.size / 1024).toFixed(1)} KB • {rawRows.length} rows detected
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-lg text-xs ${
                      theme === 'dark' ? 'text-zinc-450 hover:text-white hover:bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                    }`}
                    onClick={handleClear}
                  >
                    Clear File
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className={`p-6 border-b transition-colors duration-300 ${theme === 'dark' ? 'border-zinc-800/50 bg-zinc-950/20' : 'border-zinc-200 bg-zinc-50/20'}`}>
                    <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 transition-colors duration-300 ${
                      theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
                    }`}>
                      <Eye className="w-3.5 h-3.5" />
                      Raw Data Preview (showing all {rawRows.length} rows virtualized)
                    </h4>
                    <p className={`text-xs mb-4 transition-colors duration-300 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-450'}`}>
                      This virtualized preview efficiently handles thousands of CSV rows while maintaining fluid scrolling. The AI extracts and cleans this entire list in concurrency-limited parallel batches.
                    </p>
                    
                    {/* Virtualized Table Scroll Window */}
                    <div
                      ref={parentRef}
                      className={`w-full overflow-auto max-h-[400px] border rounded-xl relative transition-colors duration-300 ${
                        theme === 'dark' ? 'border-zinc-800 bg-zinc-950/20' : 'border-zinc-250 bg-zinc-50/50'
                      }`}
                    >
                      {/* Sticky Header */}
                      <div className={`flex sticky top-0 z-20 min-w-max border-b transition-colors duration-300 ${
                        theme === 'dark' ? 'bg-zinc-900 border-zinc-850' : 'bg-zinc-100 border-zinc-200'
                      }`}>
                        {headers.map((header) => (
                          <div 
                            key={header} 
                            className={`text-xs font-semibold px-4 py-3 whitespace-nowrap text-left border-r transition-colors duration-300 ${
                              theme === 'dark' ? 'text-zinc-300 bg-zinc-900 border-zinc-800/50' : 'text-zinc-650 bg-zinc-100 border-zinc-200/50'
                            }`}
                            style={{ width: '180px', flexShrink: 0, flexGrow: 1 }}
                          >
                            {header}
                          </div>
                        ))}
                      </div>

                      {/* virtual height container */}
                      <div
                        style={{
                          height: `${rowVirtualizer.getTotalSize()}px`,
                          width: '100%',
                          position: 'relative',
                        }}
                      >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                          const row = rawRows[virtualRow.index];
                          return (
                            <div
                              key={virtualRow.key}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                display: 'flex',
                                width: '100%',
                                minWidth: 'max-content',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                              }}
                              className={`border-b items-center transition-colors duration-150 ${
                                theme === 'dark' 
                                  ? 'border-zinc-800/80 bg-zinc-900/5 hover:bg-zinc-800/35' 
                                  : 'border-zinc-200 bg-white hover:bg-zinc-100/85'
                              }`}
                            >
                              {headers.map((header) => (
                                <div
                                  key={header}
                                  className={`text-xs px-4 py-3 truncate text-left border-r transition-colors duration-300 ${
                                    theme === 'dark' ? 'text-zinc-400 border-zinc-800/20' : 'text-zinc-650 border-zinc-200/20'
                                  }`}
                                  style={{ width: '180px', flexShrink: 0, flexGrow: 1 }}
                                >
                                  {row[header] !== undefined && row[header] !== '' ? (
                                    row[header]
                                  ) : (
                                    <span className="text-zinc-500/60 dark:text-zinc-650 italic text-[11px]">empty</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className={`p-6 flex items-center justify-between flex-wrap gap-4 transition-colors duration-300 ${
                    theme === 'dark' ? 'bg-zinc-950/30' : 'bg-zinc-50'
                  }`}>
                    <div className={`flex items-center text-xs gap-1.5 transition-colors duration-300 ${
                      theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
                    }`}>
                      <HelpCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span>Security Mode: Groq API Key is loaded safely on the server backend.</span>
                    </div>
                    <Button
                      onClick={handleExtract}
                      className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 flex items-center space-x-2 transition-all duration-300"
                    >
                      <Sparkles className="w-4 h-4 text-white animate-pulse" />
                      <span>Extract & Clean with AI</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {apiError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col space-y-2 text-rose-600 dark:text-rose-455 text-rose-450">
                <div className="flex items-center space-x-2 text-sm font-semibold">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                  <span>Processing Failed</span>
                </div>
                <p className="text-xs pl-7 text-rose-650 dark:text-rose-400/80 leading-relaxed">
                  {apiError}
                </p>
                <div className="pl-7 pt-2 flex space-x-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`rounded-lg text-xs ${
                      theme === 'dark' 
                        ? 'border-rose-500/20 bg-rose-950/20 text-rose-300 hover:bg-rose-900/20 hover:text-white'
                        : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-900'
                    }`}
                    onClick={handleExtract}
                  >
                    Retry Extraction
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading / Processing State */}
        {isExtracting && (
          <div className="max-w-md mx-auto py-16 text-center space-y-6">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full" />
              <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
            </div>
            <div>
              <h2 className={`text-xl font-bold mb-1 transition-colors duration-305 ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-800'}`}>AI Extraction in Progress</h2>
              <p className={`text-xs max-w-xs mx-auto font-medium transition-colors duration-300 ${theme === 'dark' ? 'text-zinc-450 text-zinc-400' : 'text-zinc-550 text-zinc-650'}`}>
                {progressMessage || `Processing ${rawRows.length} rows in parallel batches...`}
              </p>
            </div>
            <div className="space-y-2">
              <Progress value={progress} className={`h-2 border transition-colors duration-300 ${
                theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
              }`} />
              <div className={`flex items-center justify-between text-[11px] px-1 transition-colors duration-300 ${
                theme === 'dark' ? 'text-zinc-500' : 'text-zinc-450'
              }`}>
                <span>Concurrency-limited parallel execution</span>
                <span>{progress}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Results State */}
        {results.length > 0 && !isExtracting && (
          <div className="space-y-8 mt-10 animate-in fade-in slide-in-from-bottom-6 duration-300">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <Card className={`border rounded-2xl transition-colors duration-300 ${
                theme === 'dark' ? 'bg-zinc-900/20 border-zinc-800/80 backdrop-blur-sm' : 'bg-white border-zinc-200 shadow-sm'
              }`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Total Processed</CardDescription>
                  <CardTitle className={`text-3xl font-extrabold transition-colors duration-300 ${theme === 'dark' ? 'text-zinc-105 text-zinc-100' : 'text-zinc-800'}`}>{results.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-zinc-500">Every CSV row mapped to GrowEasy CRM</p>
                </CardContent>
              </Card>
              <Card className={`border rounded-2xl transition-colors duration-300 ${
                theme === 'dark' ? 'bg-zinc-900/20 border-zinc-800/80 backdrop-blur-sm' : 'bg-white border-zinc-200 shadow-sm'
              }`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-emerald-500 text-xs uppercase tracking-wider font-semibold">Valid Leads</CardDescription>
                  <CardTitle className={`text-3xl font-extrabold transition-colors duration-300 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{validRecords.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-zinc-500">Passed strict validations & formatted by AI</p>
                </CardContent>
              </Card>
              <Card className={`border rounded-2xl transition-colors duration-300 ${
                theme === 'dark' ? 'bg-zinc-900/20 border-zinc-800/80 backdrop-blur-sm' : 'bg-white border-zinc-200 shadow-sm'
              }`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-amber-500 text-xs uppercase tracking-wider font-semibold">Skipped / Warnings</CardDescription>
                  <CardTitle className={`text-3xl font-extrabold transition-colors duration-300 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>{skippedRecords.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-zinc-500">Missing contact info or marked invalid</p>
                </CardContent>
              </Card>
            </div>

            {/* Results Table */}
            <Card className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${
              theme === 'dark' ? 'bg-zinc-900/20 border-zinc-800/80 backdrop-blur-sm' : 'bg-white border-zinc-200 shadow-sm'
            }`}>
              <CardHeader className={`border-b px-6 py-4 flex flex-row items-center justify-between flex-wrap gap-4 transition-colors duration-300 ${
                theme === 'dark' ? 'border-zinc-800/80 bg-zinc-900/30' : 'border-zinc-200 bg-zinc-50/50'
              }`}>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`text-sm font-semibold pb-1 border-b-2 transition-all ${
                      activeTab === 'all' 
                        ? 'border-indigo-500 text-indigo-600 dark:text-white' 
                        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:text-zinc-600'
                    }`}
                  >
                    All Leads ({results.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('valid')}
                    className={`text-sm font-semibold pb-1 border-b-2 transition-all ${
                      activeTab === 'valid' 
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:text-zinc-600'
                    }`}
                  >
                    Valid Only ({validRecords.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('skipped')}
                    className={`text-sm font-semibold pb-1 border-b-2 transition-all ${
                      activeTab === 'skipped' 
                        ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
                        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:text-zinc-600'
                    }`}
                  >
                    Skipped Only ({skippedRecords.length})
                  </button>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`rounded-lg flex items-center space-x-1.5 text-xs ${
                      theme === 'dark' 
                        ? 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950'
                    }`}
                    onClick={handleDownloadJSON}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`rounded-lg flex items-center space-x-1.5 text-xs ${
                      theme === 'dark' 
                        ? 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950'
                    }`}
                    onClick={handleDownloadCSV}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </Button>
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center space-x-1.5 text-xs"
                    onClick={handleClear}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className={`transition-colors duration-300 ${theme === 'dark' ? 'bg-zinc-950/20' : 'bg-zinc-50'}`}>
                    <TableRow className={`border-b transition-colors duration-300 hover:bg-transparent ${theme === 'dark' ? 'border-zinc-850' : 'border-zinc-200'}`}>
                      <TableHead className="text-zinc-400 text-xs px-6 py-4 whitespace-nowrap">Contact</TableHead>
                      <TableHead className="text-zinc-400 text-xs px-6 py-4 whitespace-nowrap">Company</TableHead>
                      <TableHead className="text-zinc-400 text-xs px-6 py-4 whitespace-nowrap">Location</TableHead>
                      <TableHead className="text-zinc-400 text-xs px-6 py-4 whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-zinc-400 text-xs px-6 py-4 whitespace-nowrap">Source</TableHead>
                      <TableHead className="text-zinc-400 text-xs px-6 py-4 whitespace-nowrap">Possession</TableHead>
                      <TableHead className="text-zinc-400 text-xs px-6 py-4 whitespace-nowrap">Status Note / Skip Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-zinc-500 text-sm">
                          No records match the selected filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedRecords.map((record, index) => {
                        const isSkipped = !!record._skip_reason;
                        return (
                          <TableRow 
                            key={index} 
                            className={`border-b transition-colors duration-150 ${
                              theme === 'dark'
                                ? isSkipped 
                                  ? 'bg-amber-500/[0.02] border-zinc-800/80 hover:bg-zinc-900/25' 
                                  : 'bg-transparent border-zinc-800/80 hover:bg-zinc-900/35'
                                : isSkipped
                                  ? 'bg-amber-500/[0.01] border-zinc-200 hover:bg-zinc-100/50'
                                  : 'bg-transparent border-zinc-200 hover:bg-zinc-100/80'
                            }`}
                          >
                            <TableCell className="px-6 py-4 max-w-[250px]">
                              <div className="flex flex-col space-y-1">
                                <div className={`font-semibold text-sm flex items-center gap-1.5 ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}>
                                  <User className="w-3.5 h-3.5 text-zinc-550 flex-shrink-0" />
                                  <span>{record.name || <span className="text-zinc-500/60 italic text-xs">unnamed</span>}</span>
                                </div>
                                {record.email && (
                                  <div className={`text-xs flex items-center gap-1.5 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-550 text-zinc-500'}`}>
                                    <Mail className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                    <span className="truncate">{record.email}</span>
                                  </div>
                                )}
                                {(record.mobile_without_country_code || record.country_code) && (
                                  <div className={`text-xs flex items-center gap-1.5 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-550 text-zinc-500'}`}>
                                    <Phone className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                    <span>
                                      {record.country_code || ''} {record.mobile_without_country_code || ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="px-6 py-4 text-xs">
                              {record.company ? (
                                <span className={`flex items-center gap-1.5 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                  <Building className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                  <span>{record.company}</span>
                                </span>
                              ) : (
                                <span className="text-zinc-500/60 dark:text-zinc-550/60 italic">Not specified</span>
                              )}
                            </TableCell>

                            <TableCell className="px-6 py-4 text-xs">
                              {(record.city || record.state || record.country) ? (
                                <div className={`flex items-center gap-1.5 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                  <MapPin className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                  <span>
                                    {[record.city, record.state, record.country].filter(Boolean).join(', ')}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-zinc-500/60 dark:text-zinc-550/60 italic">Not specified</span>
                              )}
                            </TableCell>

                            <TableCell className="px-6 py-4 whitespace-nowrap">
                              {isSkipped ? <span className="text-zinc-500/60 dark:text-zinc-500/60 text-xs">-</span> : getStatusBadge(record.crm_status)}
                            </TableCell>

                            <TableCell className="px-6 py-4 whitespace-nowrap">
                              {getSourceBadge(record.data_source)}
                            </TableCell>

                            <TableCell className="px-6 py-4 text-xs whitespace-nowrap">
                              {record.possession_time ? (
                                <div className={`flex items-center gap-1.5 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                  <Calendar className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                  <span>{record.possession_time}</span>
                                </div>
                              ) : (
                                <span className="text-zinc-500/65 dark:text-zinc-550/60 italic text-xs font-medium">Not specified</span>
                              )}
                            </TableCell>

                            <TableCell className="px-6 py-4 text-xs">
                              {isSkipped ? (
                                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 max-w-sm flex items-start gap-1.5">
                                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-semibold block text-[11px] uppercase tracking-wide">Skipped Row</span>
                                    <span>{record._skip_reason}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className={`${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-650' } max-w-sm`}>
                                  {record.crm_note || <span className="text-zinc-500/60 italic">No notes</span>}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
