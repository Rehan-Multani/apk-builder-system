import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Rocket, CheckCircle, Loader2, Download, ShieldCheck, Globe, Smartphone, Palette, Package } from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:3000/api`;

const Dashboard = () => {
  const [formData, setFormData] = useState({
    url: 'https://wapixo.com/app',
    appName: 'Wapixo',
    packageName: 'com.wapixo.app',
    splashColor: '#6366f1'
  });
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [icon, setIcon] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);

  const handleAppNameChange = (name) => {
    const pkg = `com.${name.toLowerCase().replace(/\s+/g, '')}.app`;
    setFormData({ ...formData, appName: name, packageName: pkg });
  };

  const handleIconChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setIcon(file);
      setIconPreview(URL.createObjectURL(file));
    }
  };

  useEffect(() => {
    let interval;
    if (jobId && status?.state !== 'completed' && status?.state !== 'failed') {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_BASE}/status/${jobId}`);
          setStatus(res.data);
        } catch (err) {
          console.error('Status fetch error:', err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [jobId, status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      data.append('url', formData.url);
      data.append('appName', formData.appName);
      data.append('packageName', formData.packageName);
      data.append('splashColor', formData.splashColor);
      if (icon) data.append('icon', icon);

      const res = await axios.post(`${API_BASE}/build`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setJobId(res.data.jobId);
      setStatus({ state: 'waiting', progress: 0 });
    } catch (err) {
      alert('Failed to start build');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-8 animate-fade-in">
      <header className="text-center mb-12">
        <h1 className="text-4xl text-white">New Build Project</h1>
        <p className="text-slate-400 mt-2">Enter your website details to generate a production-ready APK.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Globe size={16} /> Website URL
                  </label>
                  <div className="input-group">
                    <input 
                      type="url" 
                      placeholder="https://example.com"
                      value={formData.url}
                      onChange={(e) => setFormData({...formData, url: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Smartphone size={16} /> App Name
                  </label>
                  <div className="input-group">
                    <input 
                      type="text" 
                      placeholder="My Store"
                      value={formData.appName}
                      onChange={(e) => handleAppNameChange(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Package size={16} /> Package Name
                  </label>
                  <div className="input-group">
                    <input 
                      type="text" 
                      placeholder="com.mystore.app"
                      value={formData.packageName}
                      onChange={(e) => setFormData({...formData, packageName: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Palette size={16} /> Splash Color
                  </label>
                  <div className="flex gap-3">
                    <input 
                      type="color" 
                      className="h-11 w-16 bg-slate-900 border-none rounded-lg cursor-pointer p-0"
                      value={formData.splashColor}
                      onChange={(e) => setFormData({...formData, splashColor: e.target.value})}
                    />
                    <div className="input-group flex-1">
                      <input 
                        type="text" 
                        className="font-mono uppercase"
                        value={formData.splashColor}
                        onChange={(e) => setFormData({...formData, splashColor: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Rocket size={16} /> App Icon (Optional)
                  </label>
                  <div className="flex gap-4 items-center">
                    <div className="h-20 w-20 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden">
                      {iconPreview ? (
                        <img src={iconPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Rocket size={24} className="text-slate-600" />
                      )}
                    </div>
                    <label className="btn-secondary cursor-pointer !py-2 !px-4">
                      Choose Icon
                      <input type="file" className="hidden" accept="image/*" onChange={handleIconChange} />
                    </label>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading || (jobId && status?.state !== 'completed' && status?.state !== 'failed')}
                className="btn-primary mt-4"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Rocket size={20} />}
                {jobId ? 'Building APK...' : 'Start Build Process'}
              </button>
            </form>
          </div>
        </div>

        {/* Status Section */}
        <div className="space-y-6">
          <div className="glass-card h-full">
            <h3 className="font-bold text-white mb-6 flex items-center gap-2">
              <CheckCircle className="text-indigo-500" size={20} /> Build Status
            </h3>
            
            {!jobId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 opacity-50">
                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
                  <Rocket size={24} />
                </div>
                <p className="text-sm text-slate-400">No active builds.<br/>Fill the form to start.</p>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <span className={`badge badge-${status?.state || 'waiting'}`}>
                    {status?.state || 'Initializing'}
                  </span>
                  <span className="text-2xl font-bold font-mono text-white">{status?.progress || 0}%</span>
                </div>

                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${status?.progress || 0}%` }}
                  />
                </div>

                {status?.state === 'completed' && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 text-green-500 font-bold text-sm">
                      <ShieldCheck size={18} />
                      APK Build Successful
                    </div>
                    <a 
                      href={status.result?.apkUrl} 
                      className="btn-primary !bg-green-600 hover:!bg-green-700"
                      download
                    >
                      <Download size={18} /> Download APK
                    </a>
                  </div>
                )}

                {status?.state === 'failed' && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-danger text-sm font-bold">Build Failed</p>
                    <p className="text-xs text-slate-400 mt-1">Please check your configuration and try again.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
