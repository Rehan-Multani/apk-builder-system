import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Server, Cpu, Database, Activity, Shield, Trash2, RotateCw, Copy, 
  Terminal, Plus, CheckCircle, Clock, AlertTriangle, ExternalLink, 
  RefreshCw, Layers, DollarSign, X, Check, Key, Globe, Eye, FileText
} from 'lucide-react';

import { API_BASE } from '../config';

const ServerList = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState(null); // For showing terminal logs
  const [copiedId, setCopiedId] = useState('');
  
  const terminalEndRef = useRef(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedServer?.logs]);

  // Fetch servers list
  const fetchServers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/vps/servers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServers(res.data);
      
      // Update selected server in logs modal if it's currently open
      if (selectedServer) {
        const updated = res.data.find(s => s._id === selectedServer._id);
        if (updated) setSelectedServer(updated);
      }
    } catch (err) {
      console.error('Failed to fetch VPS servers:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  // Poll servers if any is deploying or rebooting
  useEffect(() => {
    const activePolling = servers.some(s => s.status === 'deploying' || s.status === 'rebooting');
    let intervalId;
    if (activePolling) {
      intervalId = setInterval(() => {
        fetchServers(true);
      }, 2000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [servers]);

  const [redeployServer, setRedeployServer] = useState(null);
  const [sshPassword, setSshPassword] = useState('');
  const [redeploying, setRedeploying] = useState(false);

  const handleAction = async (id, action) => {
    if (action === 'destroy' && !window.confirm('Are you absolutely sure you want to destroy this VPS instance? All deployment history and logs will be permanently deleted from the dashboard.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/vps/server/${id}/action`, { action }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (action === 'destroy') {
        if (selectedServer?._id === id) setSelectedServer(null);
        setServers(prev => prev.filter(s => s._id !== id));
      } else {
        fetchServers(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || `Failed to perform action ${action}`);
    }
  };

  const handleRedeploy = async (e) => {
    e.preventDefault();
    if (!redeployServer || !sshPassword) return;

    setRedeploying(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/vps/redeploy`, {
        serverId: redeployServer._id,
        password: sshPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Automatically open the logs window for the server being redeployed
      const target = servers.find(s => s._id === redeployServer._id);
      if (target) {
        setSelectedServer({
          ...target,
          status: 'deploying',
          progress: 0,
          logs: [`[${new Date().toLocaleTimeString()}] [SYSTEM] Initiating code redeployment sequence...`]
        });
      }

      setRedeployServer(null);
      setSshPassword('');
      fetchServers(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to initiate redeployment');
    } finally {
      setRedeploying(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  return (
    <div className="container py-8 animate-fade-in relative">
      {/* Dynamic Ambient Background Glows */}
      <div className="glow-blob glow-blob-primary" />
      <div className="glow-blob glow-blob-secondary" />



      {/* Main Tab Container */}
      <div className="relative z-10 max-w-4xl mx-auto mb-10">
        <div className="glass-card border border-white/5 shadow-2xl">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <Activity className="text-indigo-500 bg-indigo-500/10 p-1 rounded-lg" size={24} />
            Connected Servers & Deployments
          </h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <RefreshCw size={28} className="animate-spin mb-3 text-indigo-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">Fetching instances...</span>
            </div>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 opacity-60">
              <div className="w-16 h-16 bg-slate-900/50 rounded-2xl flex items-center justify-center mb-4 border border-slate-800 shadow-inner">
                <Server size={24} className="text-slate-450" />
              </div>
              <p className="text-sm font-bold text-slate-400">No active server deployments found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">Use the VPS Deploy tab to configure and launch your application stack.</p>
            </div>
          ) : (
            <div className="server-grid">
              <AnimatePresence>
                {servers.map((server, idx) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25, delay: idx * 0.05 }}
                    key={server._id}
                    className="server-card"
                  >
                    <div>
                      {/* Server Header */}
                      <div className="server-card-header">
                        <div>
                          <h4 className="server-card-name">
                            {server.name}
                          </h4>
                          <p className="server-card-domain">
                            {server.domain}
                          </p>
                        </div>
                        <span className={`badge badge-${
                          server.status === 'active' ? 'completed' : 
                          server.status === 'deploying' ? 'active' : 
                          server.status === 'rebooting' ? 'waiting' : 'failed'
                        }`}>
                          {server.status}
                        </span>
                      </div>

                      {/* Server IP & Progress bar */}
                      {server.status === 'deploying' ? (
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                              Deploying files...
                            </span>
                            <span className="text-indigo-400 font-bold">{server.progress}%</span>
                          </div>
                          <div className="progress-bar">
                            <div 
                              className="progress-fill bg-gradient-to-r from-indigo-500 to-purple-500"
                              style={{ width: `${server.progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="server-ip-box">
                          <span className="server-ip-text">
                            {server.ipAddress}
                          </span>
                          <div className="server-copy-btn-group">
                            <button
                              onClick={() => copyToClipboard(server.ipAddress, `ip-${server._id}`)}
                              className="btn-icon-sm"
                              title="Copy IP"
                            >
                              {copiedId === `ip-${server._id}` ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                            </button>
                            <button
                              onClick={() => copyToClipboard(`ssh ${server.username || 'root'}@${server.ipAddress}`, `ssh-${server._id}`)}
                              className="btn-icon-sm-text"
                              title="Copy SSH command"
                            >
                              {copiedId === `ssh-${server._id}` ? <Check size={12} className="text-green-500" /> : <Terminal size={12} />}
                              SSH
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Local MongoDB Credentials */}
                      {server.localMongoUrl && (
                        <div className="server-mongo-box">
                          <div className="server-mongo-header">
                            <span className="server-mongo-title">
                              <Database size={11} /> Local MongoDB URL:
                            </span>
                            <button
                              onClick={() => copyToClipboard(server.localMongoUrl, `mongo-url-${server._id}`)}
                              className="btn-icon-sm"
                              title="Copy Local MongoDB URL"
                            >
                              {copiedId === `mongo-url-${server._id}` ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                            </button>
                          </div>
                          <div className="server-mongo-url" title={server.localMongoUrl}>
                            {server.localMongoUrl}
                          </div>
                          <div className="server-mongo-pass-row">
                            <span>Username: <span style={{ color: '#fff', fontWeight: 'bold' }}>{server.localMongoUsername || 'db_user'}</span></span>
                            <button
                              onClick={() => copyToClipboard(server.localMongoUsername || 'db_user', `mongo-user-${server._id}`)}
                              className="btn-icon-sm"
                              title="Copy MongoDB Username"
                            >
                              {copiedId === `mongo-user-${server._id}` ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                            </button>
                          </div>
                          <div className="server-mongo-pass-row">
                            <span>Password: <span style={{ color: '#fff', fontWeight: 'bold' }}>{server.localMongoPassword}</span></span>
                            <button
                              onClick={() => copyToClipboard(server.localMongoPassword, `mongo-pass-${server._id}`)}
                              className="btn-icon-sm"
                              title="Copy MongoDB Password"
                            >
                              {copiedId === `mongo-pass-${server._id}` ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Config Specs */}
                      <div className="server-specs">
                        <span className="server-specs-repo" title={server.githubRepo}>🐙 {server.githubRepo.replace('https://github.com/', '')}</span>
                        <span>👤 {server.username}</span>
                      </div>
                    </div>

                    {/* Server Actions */}
                    <div className="server-actions-row">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setSelectedServer(server)}
                        className="btn-view-logs"
                      >
                        <Eye size={13} />
                        View Logs
                      </motion.button>
                      <button
                        onClick={() => setRedeployServer(server)}
                        disabled={server.status === 'deploying' || server.status === 'rebooting'}
                        className="btn-action-redeploy"
                        title="Pull updates & Redeploy project"
                      >
                        <RefreshCw size={13} className={server.status === 'deploying' ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => handleAction(server._id, 'reboot')}
                        disabled={server.status === 'deploying' || server.status === 'rebooting'}
                        className="btn-action-reboot"
                        title="Simulate Reboot"
                      >
                        <RotateCw size={13} className={server.status === 'rebooting' ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => handleAction(server._id, 'destroy')}
                        className="btn-action-destroy"
                        title="Delete Deployment"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Terminal logs viewer modal overlay */}
      <AnimatePresence>
        {selectedServer && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedServer(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="glass-card w-full max-w-3xl relative z-10 border border-indigo-500/20 !p-0 overflow-hidden flex flex-col max-h-[85vh] shadow-2xl rounded-3xl"
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-900/90 border-b border-slate-800/80 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {/* macOS colored window dots */}
                  <div className="flex items-center gap-1.5 mr-2">
                    <span className="w-3 h-3 rounded-full bg-[#ef4444] opacity-80" />
                    <span className="w-3 h-3 rounded-full bg-[#f59e0b] opacity-80" />
                    <span className="w-3 h-3 rounded-full bg-[#10b981] opacity-80" />
                  </div>
                  <div className="p-2 bg-indigo-500/15 text-indigo-400 rounded-xl border border-indigo-500/10">
                    <Terminal size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">SSH Deployment Logs: {selectedServer.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      IP: {selectedServer.ipAddress} • User: {selectedServer.username} • Domain: {selectedServer.domain}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {selectedServer.status === 'deploying' && (
                    <div className="flex items-center gap-2 text-xs text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-1 rounded-full animate-pulse border border-indigo-500/20">
                      <Clock size={12} className="animate-spin" />
                      Deploying... {selectedServer.progress}%
                    </div>
                  )}
                  <button 
                    onClick={() => setSelectedServer(null)} 
                    className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all border-none cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Modal Content - Bash Console */}
              <div className="p-5 bg-black/95 font-mono text-[11px] leading-relaxed flex-1 overflow-y-auto min-h-[380px] max-h-[500px] text-slate-300 select-text selection:bg-indigo-500/30 animate-fade-in scrollbar-thin">
                <div className="space-y-1.5">
                  <div className="text-slate-500 mb-2"># Starting deployment pipeline on SSH tunnel...</div>
                  {selectedServer.logs && selectedServer.logs.map((logLine, index) => {
                    let colorClass = 'text-slate-300';
                    if (logLine.includes('[SUCCESS]') || logLine.includes('completed successfully')) {
                      colorClass = 'text-green-400 font-semibold';
                    } else if (logLine.includes('->') || logLine.includes('Installing') || logLine.includes('Cloning') || logLine.includes('Building')) {
                      colorClass = 'text-indigo-300';
                    } else if (logLine.includes('[SYSTEM]')) {
                      colorClass = 'text-amber-400 font-semibold';
                    } else if (logLine.includes('failed') || logLine.includes('Error')) {
                      colorClass = 'text-red-400 font-semibold';
                    }
                    
                    return (
                      <div key={index} className={colorClass}>
                        {logLine}
                      </div>
                    );
                  })}
                  
                  {selectedServer.status === 'deploying' && (
                    <div className="flex items-center gap-1.5 text-indigo-400 mt-2">
                      <span className="inline-block w-1.5 h-3.5 bg-indigo-400 animate-pulse"></span>
                      <span>Configuring deployment environment...</span>
                    </div>
                  )}

                  {selectedServer.status === 'active' && (
                    <div className="text-green-400 mt-4 font-bold border-t border-green-950/40 pt-3.5 flex items-center gap-2">
                      <CheckCircle size={14} className="text-green-400" /> Setup completed successfully! Your application stack is online.
                    </div>
                  )}
                  
                  {/* Blinking Cursor at the bottom */}
                  <div className="pt-2 text-slate-600 flex items-center font-mono text-[10px]">
                    <span>{selectedServer.username || 'root'}@{selectedServer.name || 'vps'}:~$</span>
                    <span className="terminal-cursor" />
                  </div>

                  <div ref={terminalEndRef} />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-900/90 border-t border-slate-800/80 flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Press Esc or click outside to close logs.</span>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => copyToClipboard(selectedServer.logs?.join('\n') || '', 'logs-copy')}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-bold transition-all border-none cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedId === 'logs-copy' ? (
                      <>
                        <Check size={12} className="text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        Copy Terminal Logs
                      </>
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => copyToClipboard(`ssh ${selectedServer.username || 'root'}@${selectedServer.ipAddress}`, 'logs-ssh')}
                    disabled={selectedServer.status === 'deploying'}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all border-none cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedId === 'logs-ssh' ? (
                      <>
                        <Check size={12} className="text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Terminal size={12} />
                        Copy SSH Connection
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Redeployment password confirmation modal */}
      <AnimatePresence>
        {redeployServer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800/80 flex justify-between items-center bg-slate-950/40">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <RefreshCw className="text-indigo-400" size={18} />
                  Redeploy Application
                </h3>
                <button 
                  onClick={() => { setRedeployServer(null); setSshPassword(''); }}
                  className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all border-none cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleRedeploy} className="p-6 space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  You are about to pull latest commits from <strong className="text-indigo-400 font-bold">{redeployServer.githubRepo.replace('https://github.com/', '')}</strong>, re-install NPM packages, and restart PM2 processes on <strong className="text-white font-bold">{redeployServer.name}</strong> ({redeployServer.ipAddress}).
                </p>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Server SSH Password
                  </label>
                  <div className="input-group">
                    <input 
                      type="password"
                      placeholder="Enter password for SSH username root"
                      value={sshPassword}
                      onChange={(e) => setSshPassword(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setRedeployServer(null); setSshPassword(''); }}
                    className="flex-1 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={redeploying}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all border-none cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {redeploying ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        Initiating...
                      </>
                    ) : (
                      <>
                        <Check size={12} />
                        Update & Restart
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ServerList;
