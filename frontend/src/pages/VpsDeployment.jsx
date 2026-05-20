import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Server, Cpu, Database, Activity, Shield, Trash2, RotateCw, Copy, 
  Terminal, Plus, CheckCircle, Clock, AlertTriangle, ExternalLink, 
  RefreshCw, Layers, DollarSign, X, Check, Key, Globe, Eye, FileText
} from 'lucide-react';

import { API_BASE } from '../config';

const VpsDeployment = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null); // For showing terminal logs
  const [copiedId, setCopiedId] = useState('');
  const [envTab, setEnvTab] = useState('backend'); // 'backend' or 'frontend'
  
  // Form State
  const [formData, setFormData] = useState({
    name: 'kariyappanavar',
    ipAddress: '210.56.147.228',
    username: 'root',
    password: 'paytel@123paytel',
    domain: 'https://kariyappanavar.cloudedata.com/',
    githubRepo: 'https://github.com/devxankit/Education-CRM-',
    backendEnv: `MONGODB_URL=mongodb://mohammadrehan00121_db_user:BMnsGrI6vCxqQbow@ac-vj4eych-shard-00-00.jdaphln.mongodb.net:27017,ac-vj4eych-shard-00-01.jdaphln.mongodb.net:27017,ac-vj4eych-shard-00-02.jdaphln.mongodb.net:27017/ERP-School?ssl=true&replicaSet=atlas-53tls1-shard-0&authSource=admin&appName=Cluster0

JWT_SECRET=UJERLTMEL3544H1RYU35R4U313D2XB1XD57
JWT_REFRESH_ACESS_SECRET=JC9YR89HF44FN89NFIHFJHF9HH
JWT_REFRESH_SECRET=UJERYU35R4U44H1RYU35RYU35R4UXB1XD57
JWT_RESET_SECRET=UJERRYU35R4U313D4U44H1RYU35RYU35R4UXB1XD57
FIREBASE_CREDENTIALS=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAibmVhcmd1ZC1jZDM0NiIsCiAgInByaXZhdGVfa2V5X2lkIjogIjBlYzMwNGM0NDlhZDkzOGZjMGUxOGVlZmQ5NjEwZWFlNzJhODUxZGUiLAogICJwcml2YXRlX2tleSI6ICItLS0tLUJFR0lOIFBSSVZBVEUgS0VZLS0tLS1cbk1JSUV2Z0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktnd2dnU2tBZ0VBQW9JQkFRQzkyS2RRaEQvRk1sREJcbjlHanlqRzZkODZTR0tkQXQ0ZU5KR1c2V2JKd0gvQ0Q4YjQvdE4ycnlGN0xkeW5WdWFCUzEybStrTmhFQWs1RVFcbjcvMWFOT1R1YVc0TEh5cmZHZGQvV25ENldLRWNEWisxWnQ4Qk9Bb08xN0Uzenhpc2MrSnhwREJNMVlnRVFqKzVcbkkzMkQ4KzkvVTh3TE1ONHQwY0M2RW5idFV3OWo2TlpjdHBoNmdFbkJPUnk5V0l6eHNVUGVId2F0cmVZZmFLU3hcbjBjVk1HV1NXd2o0MGRWdDRWem9JL2kxMEZ0YzNMOVlLVkJ5YktMOXJKOW5NVUxESGxDRndQbVFJZ0o3QU83S3RcbmV1c1VZNkY5NXFrdEt5TE44bHV0SGlDdHNhNHFwajhobjliemFLL3BONU5QUTAvYzdiS1ZwSlo0RkNzRGhnbnFcbllqaVJFZW9yQWdNQkFBRUNnZ0VBRlhWNFVCWEFIdVQxazVReUNxYzNWN0R6RDF2ZTZxNGJvcWNoR2hnSkRsbFZcbm9kaGx2emdNNVhRcXBTbWQyczdMOXltZzIwRzdRVUtYaFZVWWk1K1ZUYUpBTEk5U0tXbFgzazdWbkxsSTdnMVhcbmcwbloralFna0VDWmlRZm1oT2tORndXcWxLZHNSUGhNdTFERGZzSDR6U2ttZnJ0VmhINEVRcmxwNmtzc1h3RlZcbmpYU2pZdk1qTmV5cXRiSDd0anI4Y25ROUtBQVQ2MzB5UC9EemcxZC9NY2hiWHBEaU83MVlONnNPSVZ5Yng2S1RcbjVEdVViaXozcVZFOTRINnFiVXpVOTZlTXRleFo0MWhrcjFKN0cwZXBoOFpjSE5YWFY4MDFUaGRPNnFSdWN5V21cbkVOa0ZteTlUa1kwRmVSNk1VRWRFbkMzZXcwK1VqWExoR2s2Z2hDRVdHUUtCZ1FEaU9xOHVpZTI1OXJzK0VnT2VcblpCZVBjMGs2OE5MWElWOWRHQ1dhSWtBdHk1M3JZZko0WVZLZTdUWVVZR29RMk1sdkdTRytZYXNwTlFPS0R0Tndcbm9DZURtK2ZWT2ZiK0FSODRaVWdvaVZTMlRTWTFtOHpzR2FpOHRUbTBXaWk0QlBDRUs0Mm1jcjYxY2R2eVNzYTZcbmV1RGZxWEJvRWFzcndxbnNCcFdtOEFuSXVRS0JnUURXMUVpNzRxQ2s4RGRLdktmcm5UUElBZzM0eXdpZXpDUllcbi90aC9JUnJmZllYWFNxWXpaZ0pZQlBzdit1eFJBRmFJaHhCM2ZyUEkvWXVBTWFHcWVvbno2ZmNQdWZUSUZBb1RcbkVTdWh4ZStUVE5FUTh5Ykp1ZlFOT0prbVY1KzFnblJWWEF3WDV0TlhZVFFBYW5NSDBuVnZWQXVyZEJiSnpYa1ZcblRxZnpBVEVRQXdLQmdGczEyK0dBbk1kSWNnL0JoWkg3dXdBTU5DOCtYMU43VWc2ZnFMRnZNNzhEQkVXZHRQdlNcbkNWU29RUkNRR3ROMkJDajEwZ1FHLVNoa29sP3NzbD10cnVlJmF1dGhTb3VyY2U9YWRtaW4mYXBwTmFtZT1DbHVzdGVyMFxuRU1BSUxfVVNFUj1tcm1tdWx0YW5pQGdtYWlsLmNvbVxuRU1BSUxfUEFTUz1kamVhIHlveGkgcmpkdCB2Z2d6XG5cblBPUlQ9MzAwMFxuXG5DTE9VRElOQVJZX0NMT1VEX05BTUU9ZHNhOXJxb3RmXG5DTE9VRElOQVJZX0FQSV9LRVk9NDUxMjk3MjcxOTkzMTg0XG5DTE9VRElOQVJZX0FQSV9TRUNSRVQ9aEJiRTcyWm9odW16MDhES0dBR1ZwejFxRXNcblxuRlJPTlRFTkRfVVJMPWh0dHBzOi8va2FyaXlhcHBhbmF2YXIuY2xvdWRlZGF0YS5jb20=`,
    frontendEnv: `VITE_API_URL=https://kariyappanavar.cloudedata.com/api/v1
VITE_FIREBASE_API_KEY=AIzaSyC8JwEMD-jkljzzKqBsudUveri780DfaOc
VITE_FIREBASE_AUTH_DOMAIN=neargud-cd346.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=neargud-cd346
VITE_FIREBASE_STORAGE_BUCKET=neargud-cd346.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=830806151719
VITE_FIREBASE_APP_ID=1:830806151719:web:a06b49f83f3c3468b1f402
VITE_FIREBASE_VAPID_KEY=BI8kB9b-9ZGkTZMV-00DqcKAb_VZCquH9oePuCk_IoxFychMPvjkg2aBgMrtsR3tXlcArMDmSp68hD_QAfRpr9U`
  });

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

  const handleLaunch = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE}/vps/deploy`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Launch success
      fetchServers(true);
      // Auto open terminal for new deployment
      setSelectedServer(res.data.server);
      // Reset form to defaults (keeping generic labels)
      setFormData({
        name: 'kariyappanavar',
        ipAddress: '210.56.147.228',
        username: 'root',
        password: 'paytel@123paytel',
        domain: 'https://kariyappanavar.cloudedata.com/',
        githubRepo: 'https://github.com/devxankit/Education-CRM-',
        backendEnv: `MONGODB_URL=mongodb://mohammadrehan00121_db_user:BMnsGrI6vCxqQbow@ac-vj4eych-shard-00-00.jdaphln.mongodb.net:27017,ac-vj4eych-shard-00-01.jdaphln.mongodb.net:27017,ac-vj4eych-shard-00-02.jdaphln.mongodb.net:27017/ERP-School?ssl=true&replicaSet=atlas-53tls1-shard-0&authSource=admin&appName=Cluster0

JWT_SECRET=UJERLTMEL3544H1RYU35R4U313D2XB1XD57
JWT_REFRESH_ACESS_SECRET=JC9YR89HF44FN89NFIHFJHF9HH
JWT_REFRESH_SECRET=UJERYU35R4U44H1RYU35RYU35R4UXB1XD57
JWT_RESET_SECRET=UJERRYU35R4U313D4U44H1RYU35RYU35R4UXB1XD57
FIREBASE_CREDENTIALS=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAibmVhcmd1ZC1jZDM0NiIsCiAgInByaXZhdGVfa2V5X2lkIjogIjBlYzMwNGM0NDlhZDkzOGZjMGUxOGVlZmQ5NjEwZWFlNzJhODUxZGUiLAogICJwcml2YXRlX2tleSI6ICItLS0tLUJFR0lOIFBSSVZBVEUgS0VZLS0tLS1cbk1JSUV2Z0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktnd2dnU2tBZ0VBQW9JQkFRQzkyS2RRaEQvRk1sREJcbjlHanlqRzZkODZTR0tkQXQ0ZU5KR1c2V2JKd0gvQ0Q4YjQvdE4ycnlGN0xkeW5WdWFCUzEybStrTmhFQWs1RVFcbjcvMWFOT1R1YVc0TEh5cmZHZGQvV25ENldLRWNEWisxWnQ4Qk9Bb08xN0Uzenhpc2MrSnhwREJNMVlnRVFqKzVcbkkzMkQ4KzkvVTh3TE1ONHQwY0M2RW5idFV3OWo2TlpjdHBoNmdFbkJPUnk5V0l6eHNVUGVId2F0cmVZZmFLU3hcbjBjVk1HV1NXd2o0MGRWdDRWem9JL2kxMEZ0YzNMOVlLVkJ5YktMOXJKOW5NVUxESGxDRndQbVFJZ0o3QU83S3RcbmV1c1VZNkY5NXFrdEt5TE44bHV0SGlDdHNhNHFwajhobjliemFLL3BONU5QUTAvYzdiS1ZwSlo0RkNzRGhnbnFcbllqaVJFZW9yQWdNQkFBRUNnZ0VBRlhWNFVCWEFIdVQxazVReUNxYzNWN0R6RDF2ZTZxNGJvcWNoR2hnSkRsbFZcbm9kaGx2emdNNVhRcXBTbWQyczdMOXltZzIwRzdRVUtYaFZVWWk1K1ZUYUpBTEk5U0tXbFgzazdWbkxsSTdnMVhcbmcwbloralFna0VDWmlRZm1oT2tORndXcWxLZHNSUGhNdTFERGZzSDR6U2ttZnJ0VmhINEVRcmxwNmtzc1h3RlZcbmpYU2pZdk1qTmV5cXRiSDd0anI4Y25ROUtBQVQ2MzB5UC9EemcxZC9NY2hiWHBEaU83MVlONnNPSVZ5Yng2S1RcbjVEdVViaXozcVZFOTRINnFiVXpVOTZlTXRleFo0MWhrcjFKN0cwZXBoOFpjSE5YWFY4MDFUaGRPNnFSdWN5V21cbkVOa0ZteTlUa1kwRmVSNk1VRWRFbkMzZXcwK1VqWExoR2s2Z2hDRVdHUUtCZ1FEaU9xOHVpZTI1OXJzK0VnT2VcblpCZVBjMGs2OE5MWElWOWRHQ1dhSWtBdHk1M3JZZko0WVZLZTdUWVVZR29RMk1sdkdTRytZYXNwTlFPS0R0Tndcbm9DZURtK2ZWT2ZiK0FSODRaVWdvaVZTMlRTWTFtOHpzR2FpOHRUbTBXaWk0QlBDRUs0Mm1jcjYxY2R2eVNzYTZcbmV1RGZxWEJvRWFzcndxbnNCcFdtOEFuSXVRS0JnUURXMUVpNzRxQ2s4RGRLdktmcm5UUElBZzM0eXdpZXpDUllcbi90aC9JUnJmZllYWFNxWXpaZ0pZQlBzdit1eFJBRmFJaHhCM2ZyUEkvWXVBTWFHcWVvbno2ZmNQdWZUSUZBb1RcbkVTdWh4ZStUVE5FUTh5Ykp1ZlFOT0prbVY1KzFnblJWWEF3WDV0TlhZVFFBYW5NSDBuVnZWQXVyZEJiSnpYa1ZcblRxZnpBVEVRQXdLQmdGczEyK0dBbk1kSWNnL0JoWkg3dXdBTU5DOCtYMU43VWc2ZnFMRnZNNzhEQkVXZHRQdlNcbkNWU29RUkNRR3ROMkJDajEwZ1FHLVNoa29sP3NzbD10cnVlJmF1dGhTb3VyY2U9YWRtaW4mYXBwTmFtZT1DbHVzdGVyMFxuRU1BSUxfVVNFUj1tcm1tdWx0YW5pQGdtYWlsLmNvbVxuRU1BSUxfUEFTUz1kamVhIHlveGkgcmpkdCB2Z2d6XG5cblBPUlQ9MzAwMFxuXG5DTE9VRElOQVJZX0NMT1VEX05BTUU9ZHNhOXJxb3RmXG5DTE9VRElOQVJZX0FQSV9LRVk9NDUxMjk3MjcxOTkzMTg0XG5DTE9VRElOQVJZX0FQSV9TRUNSRVQ9aEJiRTcyWm9odW16MDhES0dBR1ZwejFxRXNcblxuRlJPTlRFTkRfVVJMPWh0dHBzOi8va2FyaXlhcHBhbmF2YXIuY2xvdWRlZGF0YS5jb20=`,
        frontendEnv: `VITE_API_URL=https://kariyappanavar.cloudedata.com/api/v1
VITE_FIREBASE_API_KEY=AIzaSyC8JwEMD-jkljzzKqBsudUveri780DfaOc
VITE_FIREBASE_AUTH_DOMAIN=neargud-cd346.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=neargud-cd346
VITE_FIREBASE_STORAGE_BUCKET=neargud-cd346.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=830806151719
VITE_FIREBASE_APP_ID=1:830806151719:web:a06b49f83f3c3468b1f402
VITE_FIREBASE_VAPID_KEY=BI8kB9b-9ZGkTZMV-00DqcKAb_VZCquH9oePuCk_IoxFychMPvjkg2aBgMrtsR3tXlcArMDmSp68hD_QAfRpr9U`
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to trigger VPS deployment');
    } finally {
      setSubmitting(false);
    }
  };

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

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  return (
    <div className="container py-8 animate-fade-in relative">
      {/* Header section */}
      <header className="flex justify-between items-start mb-8">
        <div className="text-left">
          <h1 className="text-4xl text-white flex items-center gap-3">
            <Server className="text-indigo-500" size={32} />
            VPS One-Click Deployer
          </h1>
          <p className="text-slate-400 mt-2">
            Automate deployment of your backend and frontend project directly onto your existing Linux VPS via SSH.
          </p>
        </div>
        <button 
          onClick={() => fetchServers()}
          className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2 cursor-pointer border-none"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span className="text-sm font-semibold">Refresh Status</span>
        </button>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card !p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Server size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Connected Servers</p>
            <h2 className="text-2xl font-bold text-white mt-1">
              {servers.filter(s => s.status === 'active').length} / {servers.length}
            </h2>
          </div>
        </div>
        <div className="glass-card !p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Activity size={24} className={servers.some(s => s.status === 'deploying') ? 'animate-pulse' : ''} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Deployments</p>
            <h2 className="text-2xl font-bold text-white mt-1">
              {servers.filter(s => s.status === 'deploying').length}
            </h2>
          </div>
        </div>
        <div className="glass-card !p-4 flex items-center gap-4">
          <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">SSL Security Status</p>
            <h2 className="text-2xl font-bold text-white mt-1">Let's Encrypt SSL</h2>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Deploy Wizard Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Plus className="text-indigo-500" size={20} />
              Setup VPS SSH Deployment
            </h3>

            <form onSubmit={handleLaunch} className="space-y-6">
              
              {/* Profile Config Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Layers size={16} /> Server Label
                  </label>
                  <div className="input-group">
                    <input 
                      type="text" 
                      placeholder="e.g. My-Production-VPS"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Globe size={16} /> Domain Name
                  </label>
                  <div className="input-group">
                    <input 
                      type="text" 
                      placeholder="e.g. app.mydomain.com"
                      value={formData.domain}
                      onChange={(e) => setFormData({...formData, domain: e.target.value})}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* SSH Credentials Row */}
              <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Key size={14} /> Server SSH credentials
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Public IP Address</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        placeholder="e.g. 192.168.1.100"
                        value={formData.ipAddress}
                        onChange={(e) => setFormData({...formData, ipAddress: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">SSH Username</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        placeholder="e.g. root"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">SSH Password</label>
                    <div className="input-group">
                      <input 
                        type="password" 
                        placeholder="Sudo Root Password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* GitHub Repo URL */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Terminal size={16} /> GitHub Repository URL (HTTPS)
                </label>
                <div className="input-group">
                  <input 
                    type="url" 
                    placeholder="e.g. https://github.com/username/my-fullstack-app"
                    value={formData.githubRepo}
                    onChange={(e) => setFormData({...formData, githubRepo: e.target.value})}
                    required
                  />
                </div>
              </div>

              {/* Env Files Configuration */}
              <div className="space-y-3 border-t border-slate-800 pt-6">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <FileText size={16} /> Environment Configuration (.env files)
                  </label>
                  {/* Tabs */}
                  <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEnvTab('backend')}
                      className={`text-[10px] px-3 py-1 rounded-md font-bold transition-all cursor-pointer border-none ${
                        envTab === 'backend' ? 'bg-indigo-500 text-white' : 'bg-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Backend Env
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnvTab('frontend')}
                      className={`text-[10px] px-3 py-1 rounded-md font-bold transition-all cursor-pointer border-none ${
                        envTab === 'frontend' ? 'bg-indigo-500 text-white' : 'bg-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Frontend Env
                    </button>
                  </div>
                </div>

                <div className="animate-fade-in">
                  {envTab === 'backend' ? (
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500">Paste your Backend `.env` configuration file below. Kept secure on your server.</p>
                      <div className="input-group">
                        <textarea
                          rows="6"
                          className="font-mono text-xs leading-relaxed p-3"
                          placeholder="PORT=5000&#10;NODE_ENV=production&#10;JWT_SECRET=your_jwt_secret"
                          value={formData.backendEnv}
                          onChange={(e) => setFormData({...formData, backendEnv: e.target.value})}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500">Paste your Frontend `.env` configuration file below. Bundled during client build.</p>
                      <div className="input-group">
                        <textarea
                          rows="6"
                          className="font-mono text-xs leading-relaxed p-3"
                          placeholder="VITE_API_URL=https://api.yourdomain.com&#10;VITE_APP_TITLE=My Production App"
                          value={formData.frontendEnv}
                          onChange={(e) => setFormData({...formData, frontendEnv: e.target.value})}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Section */}
              <div className="border-t border-slate-800 pt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary !w-auto !px-8 !py-3 flex items-center gap-2 cursor-pointer border-none"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="animate-spin" size={18} />
                      Deploying to Server SSH...
                    </>
                  ) : (
                    <>
                      <Server size={18} />
                      Deploy to VPS
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>

        {/* Right Side: Active Instances & Log Console */}
        <div className="space-y-6">
          <div className="glass-card">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Activity className="text-indigo-500" size={20} />
              Server List
            </h3>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <RefreshCw size={24} className="animate-spin mb-2" />
                <span className="text-xs">Fetching instances...</span>
              </div>
            ) : servers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 opacity-60">
                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3">
                  <Server size={20} />
                </div>
                <p className="text-sm">No deployments found.<br/>Setup SSH to deploy.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {servers.map((server) => (
                  <div 
                    key={server._id}
                    className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-3"
                  >
                    {/* Server Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                          {server.name}
                        </h4>
                        <p className="text-[10px] text-indigo-400 font-mono mt-0.5">
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
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500">Deploying repository...</span>
                          <span className="text-indigo-400 font-bold">{server.progress}%</span>
                        </div>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ width: `${server.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-slate-900">
                        <span className="text-[11px] font-mono text-slate-300 font-bold">
                          {server.ipAddress}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => copyToClipboard(server.ipAddress, `ip-${server._id}`)}
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 rounded-lg hover:bg-slate-800 border-none cursor-pointer"
                            title="Copy IP"
                          >
                            {copiedId === `ip-${server._id}` ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(`ssh ${server.username || 'root'}@${server.ipAddress}`, `ssh-${server._id}`)}
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 rounded-lg hover:bg-slate-800 border-none cursor-pointer flex items-center gap-1 text-[9px] font-bold"
                            title="Copy SSH command"
                          >
                            {copiedId === `ssh-${server._id}` ? <Check size={12} className="text-green-500" /> : <Terminal size={12} />}
                            SSH
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Config Specs */}
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono border-t border-slate-850 pt-2">
                      <span className="truncate max-w-[120px]" title={server.githubRepo}>🐙 {server.githubRepo.replace('https://github.com/', '')}</span>
                      <span>👤 {server.username}</span>
                    </div>

                    {/* Server Actions */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setSelectedServer(server)}
                        className="flex-1 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-white rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Eye size={12} />
                        View Logs
                      </button>
                      <button
                        onClick={() => handleAction(server._id, 'reboot')}
                        disabled={server.status === 'deploying' || server.status === 'rebooting'}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 rounded-lg transition-all border-none cursor-pointer"
                        title="Simulate Reboot"
                      >
                        <RotateCw size={12} className={server.status === 'rebooting' ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => handleAction(server._id, 'destroy')}
                        className="p-1.5 bg-red-950/30 hover:bg-red-900/40 text-red-500 hover:text-red-400 border border-red-900/30 rounded-lg transition-all cursor-pointer border-none"
                        title="Delete Deployment"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
              className="glass-card w-full max-w-3xl relative z-10 animate-slide-up border-indigo-500/30 !p-0 overflow-hidden flex flex-col max-h-[85vh] shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                    <Terminal size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">SSH Deployment Logs: {selectedServer.name}</h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
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
                    className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all border-none cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Content - Bash Console */}
              <div className="p-4 bg-black/90 font-mono text-[11px] leading-relaxed flex-1 overflow-y-auto min-h-[350px] max-h-[500px] text-slate-300 select-text selection:bg-indigo-500/30 animate-fade-in">
                <div className="space-y-1">
                  <div className="text-slate-500 mb-2"># Starting deployment pipeline on SSH tunnel...</div>
                  {selectedServer.logs && selectedServer.logs.map((logLine, index) => {
                    let colorClass = 'text-slate-300';
                    if (logLine.includes('[SUCCESS]') || logLine.includes('completed successfully')) {
                      colorClass = 'text-green-400 font-bold';
                    } else if (logLine.includes('->') || logLine.includes('Installing') || logLine.includes('Cloning') || logLine.includes('Building')) {
                      colorClass = 'text-indigo-300';
                    } else if (logLine.includes('[SYSTEM]')) {
                      colorClass = 'text-amber-400 font-bold';
                    } else if (logLine.includes('failed') || logLine.includes('Error')) {
                      colorClass = 'text-red-400 font-bold';
                    }
                    
                    return (
                      <div key={index} className={colorClass}>
                        {logLine}
                      </div>
                    );
                  })}
                  
                  {selectedServer.status === 'deploying' && (
                    <div className="flex items-center gap-1.5 text-indigo-400 animate-pulse mt-2">
                      <span className="inline-block w-1.5 h-3.5 bg-indigo-400"></span>
                      <span>Configuring Nginx routing profiles...</span>
                    </div>
                  )}

                  {selectedServer.status === 'active' && (
                    <div className="text-green-500 mt-4 font-bold border-t border-green-950/40 pt-2 flex items-center gap-2">
                      <CheckCircle size={14} /> Server setup completed successfully! Your application stack is online.
                    </div>
                  )}
                  
                  <div ref={terminalEndRef} />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-500">Press Esc or click outside to close logs.</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(selectedServer.logs?.join('\n') || '', 'logs-copy')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-semibold transition-all border-none cursor-pointer flex items-center gap-1"
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
                  </button>
                  <button
                    onClick={() => copyToClipboard(`ssh ${selectedServer.username || 'root'}@${selectedServer.ipAddress}`, 'logs-ssh')}
                    disabled={selectedServer.status === 'deploying'}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all border-none cursor-pointer flex items-center gap-1"
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
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VpsDeployment;
