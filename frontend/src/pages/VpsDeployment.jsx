import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Server, Cpu, Database, Activity, Shield, Trash2, RotateCw, Copy, 
  Terminal, Plus, CheckCircle, Clock, AlertTriangle, ExternalLink, 
  RefreshCw, Layers, DollarSign, X, Check, Key, Globe, Eye, FileText
} from 'lucide-react';

import { API_BASE } from '../config';

const VpsDeployment = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [envTab, setEnvTab] = useState('backend'); // 'backend' or 'frontend'
  
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    username: '',
    password: '',
    domain: '',
    githubRepo: '',
    backendDir: 'backend',
    frontendDir: 'frontend',
    mongoEnvVarName: 'MONGODB_URL',
    backendEnv: '',
    frontendEnv: ''
  });


  const handleLaunch = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE}/vps/deploy`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/servers');
      setFormData({
        name: '',
        ipAddress: '',
        username: '',
        password: '',
        domain: '',
        githubRepo: '',
        backendDir: 'backend',
        frontendDir: 'frontend',
        mongoEnvVarName: 'MONGODB_URL',
        backendEnv: '',
        frontendEnv: ''
      });
    } catch (err) {
      if (err.response?.data?.warning) {
        alert(`⚠️ NOTICE:\n${err.response.data.warning}`);
      } else {
        alert(err.response?.data?.error || 'Failed to trigger VPS deployment');
      }
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="container py-8 animate-fade-in relative">
      {/* Dynamic Ambient Background Glows */}
      <div className="glow-blob glow-blob-primary" />
      <div className="glow-blob glow-blob-secondary" />

      {/* Header section */}
      <header className="flex justify-between items-start mb-8 relative z-10">
        <div className="text-left">
          <h1 className="text-4xl text-white flex items-center gap-3 font-extrabold tracking-tight">
            <span className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 shadow-indigo-500/5 shadow-xl">
              <Server size={30} />
            </span>
            VPS One-Click Deployer
          </h1>
          <p className="text-slate-400 mt-3 max-w-xl text-sm leading-relaxed">
            Automate deployment of your backend and frontend project directly onto your existing Linux VPS via SSH with instant secure configuration.
          </p>
        </div>
      </header>


      {/* Setup Form Container */}
      <div className="relative z-10 max-w-3xl mx-auto mb-10">
              <div className="glass-card border border-white/5 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <Plus className="text-indigo-500 bg-indigo-500/10 p-1 rounded-lg" size={24} />
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

                  {/* Directory Names Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Terminal size={16} /> Backend Directory Name
                      </label>
                      <div className="input-group">
                        <input 
                          type="text" 
                          placeholder="e.g. backend or admin-backend"
                          value={formData.backendDir}
                          onChange={(e) => setFormData({...formData, backendDir: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Terminal size={16} /> Frontend Directory Name
                      </label>
                      <div className="input-group">
                        <input 
                          type="text" 
                          placeholder="e.g. frontend or admin-frontend"
                          value={formData.frontendDir}
                          onChange={(e) => setFormData({...formData, frontendDir: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* MongoDB Env Var Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                      <Database size={16} /> MongoDB Env Variable Name
                    </label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        placeholder="e.g. MONGODB_URL, DATABASE_URI, MONGO_CONNECTION_STRING"
                        value={formData.mongoEnvVarName}
                        onChange={(e) => setFormData({...formData, mongoEnvVarName: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  {/* Env Files Configuration */}
                  <div className="space-y-4 border-t border-slate-800 pt-6">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        <FileText size={16} className="text-indigo-400" /> Environment Configuration (.env files)
                      </label>
                      {/* Premium Tabs Slider */}
                      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 relative overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setEnvTab('backend')}
                          className="text-[11px] px-4 py-1.5 rounded-lg font-bold transition-all duration-200 cursor-pointer border-none relative z-10"
                          style={{ color: envTab === 'backend' ? '#fff' : '#64748b', background: 'transparent' }}
                        >
                          Backend Env
                        </button>
                        <button
                          type="button"
                          onClick={() => setEnvTab('frontend')}
                          className="text-[11px] px-4 py-1.5 rounded-lg font-bold transition-all duration-200 cursor-pointer border-none relative z-10"
                          style={{ color: envTab === 'frontend' ? '#fff' : '#64748b', background: 'transparent' }}
                        >
                          Frontend Env
                        </button>
                        <div
                          className="absolute top-1 bottom-1 bg-indigo-600 rounded-lg transition-all duration-300 ease-out z-0"
                          style={{
                            left: envTab === 'backend' ? '4px' : 'calc(50% + 2px)',
                            width: 'calc(50% - 6px)'
                          }}
                        />
                      </div>
                    </div>

                    <div className="animate-fade-in">
                      {envTab === 'backend' ? (
                        <div className="space-y-2">
                          <p className="text-[11px] text-slate-500 font-medium">Paste your Backend `.env` configuration file below. Kept secure on your server.</p>
                          <div className="input-group">
                            <textarea
                              rows="6"
                              className="font-mono text-xs leading-relaxed p-3.5"
                              placeholder="PORT=5000&#10;NODE_ENV=production&#10;JWT_SECRET=your_jwt_secret"
                              value={formData.backendEnv}
                              onChange={(e) => setFormData({...formData, backendEnv: e.target.value})}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[11px] text-slate-500 font-medium">Paste your Frontend `.env` configuration file below. Bundled during client build.</p>
                          <div className="input-group">
                            <textarea
                              rows="6"
                              className="font-mono text-xs leading-relaxed p-3.5"
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
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={submitting}
                      className="btn-primary !w-auto !px-8 !py-3 flex items-center gap-2.5 cursor-pointer border-none shadow-indigo-500/10 shadow-lg"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="animate-spin" size={16} />
                          Deploying to Server SSH...
                        </>
                      ) : (
                        <>
                          <Server size={16} />
                          Deploy to VPS
                        </>
                      )}
                    </motion.button>
                  </div>
                </form>
              </div>
      </div>


    </div>
  );
};

export default VpsDeployment;
