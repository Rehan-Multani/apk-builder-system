import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Rocket, CheckCircle, Loader2, Download, ShieldCheck, Globe, Smartphone, Palette, Package, Trash2, X } from 'lucide-react';

const API_BASE = `https://backend.cloudedata.in/api`;

const Dashboard = () => {
  const [formData, setFormData] = useState({
    url: '',
    appName: '',
    packageName: '',
    splashColor: '#6366f1',
    splashMode: 'color', // 'color' or 'image'
    versionName: '1.0.0',
    versionCode: '1',
    privacyUrl: '',
    splashDuration: '2', // Default 2 seconds
    buildType: 'apk'
  });
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [icon, setIcon] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [splashImage, setSplashImage] = useState(null);
  const [splashPreview, setSplashPreview] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  const ESTIMATED_TOTAL_TIME = 420; // 7 minutes average

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

  const handleSplashChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSplashImage(file);
      setSplashPreview(URL.createObjectURL(file));
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

  useEffect(() => {
    let timer;
    if (jobId && status?.state !== 'completed' && status?.state !== 'failed') {
      timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [jobId, status]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      data.append('url', formData.url);
      data.append('appName', formData.appName);
      data.append('packageName', formData.packageName);
      data.append('splashColor', formData.splashColor);
      data.append('versionName', formData.versionName);
      data.append('versionCode', formData.versionCode);
      data.append('privacyUrl', formData.privacyUrl);
      data.append('splashDuration', formData.splashDuration);
      data.append('buildType', formData.buildType);
      if (icon) data.append('icon', icon);
      if (splashImage) data.append('splash', splashImage);

      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE}/build`, data, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      setJobId(res.data.jobId);
      setStatus({ state: 'waiting', progress: 0 });
      setTimeElapsed(0);
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
        <p className="text-slate-400 mt-2">Enter your website details to generate a production-ready APK or AAB.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Row 1: URL & App Name */}
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

              {/* Row 2: Package Name, Splash Color & Duration */}
              <div className="grid md:grid-cols-3 gap-6">
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
                    <Palette size={16} /> Splash Mode
                  </label>
                  <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, splashMode: 'color'})}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formData.splashMode === 'color' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Color
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, splashMode: 'image'})}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formData.splashMode === 'image' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Image
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {formData.splashMode === 'color' ? (
                    <>
                      <label className="text-sm font-medium text-slate-400">Splash Background Color</label>
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
                            className="font-mono uppercase text-xs"
                            value={formData.splashColor}
                            onChange={(e) => setFormData({...formData, splashColor: e.target.value})}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="text-sm font-medium text-slate-400">Splash Duration (Sec)</label>
                      <div className="input-group">
                        <input 
                          type="number" 
                          min="1" max="10"
                          value={formData.splashDuration}
                          onChange={(e) => setFormData({...formData, splashDuration: e.target.value})}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Row 3: Versioning & Privacy */}
              <div className="grid md:grid-cols-3 gap-6 border-t border-slate-800 pt-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Version Name</label>
                  <div className="input-group">
                    <input 
                      type="text" 
                      placeholder="1.0.0"
                      value={formData.versionName}
                      onChange={(e) => setFormData({...formData, versionName: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Version Code</label>
                  <div className="input-group">
                    <input 
                      type="number" 
                      placeholder="1"
                      value={formData.versionCode}
                      onChange={(e) => setFormData({...formData, versionCode: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Privacy Policy URL</label>
                  <div className="input-group">
                    <input 
                      type="url" 
                      placeholder="https://..."
                      value={formData.privacyUrl}
                      onChange={(e) => setFormData({...formData, privacyUrl: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Icon & Splash Upload (Pro Design) */}
              <div className="grid md:grid-cols-2 gap-8 border-t border-slate-800 pt-8">
                {/* App Icon Upload */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wider">
                    <Rocket size={14} className="opacity-70" /> App Icon (512x512 PNG)
                  </label>
                  <div 
                    className="relative"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-500'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-indigo-500'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) handleIconChange({ target: { files: [file] } });
                    }}
                  >
                    <label className={`flex flex-col items-center justify-center p-6 bg-slate-900/30 border-2 border-dashed ${iconPreview ? 'border-indigo-500/50' : 'border-slate-800'} rounded-2xl hover:border-indigo-500/50 transition-all cursor-pointer group min-h-[200px]`}>
                      {iconPreview ? (
                        <div className="relative w-40 h-40 mx-auto">
                          <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-indigo-500/50 bg-slate-900 flex items-center justify-center relative shadow-2xl">
                            <img src={iconPreview} alt="Icon Preview" className="w-full h-full object-cover" />
                            <button 
                              type="button"
                              onClick={(e) => { e.preventDefault(); setIcon(null); setIconPreview(null); }}
                              className="absolute top-2 right-2 w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all z-[100] border-2 border-white/30"
                            >
                              <X size={16} strokeWidth={3} />
                            </button>
                          </div>
                          <p className="mt-2 text-[10px] font-bold text-indigo-400 flex items-center justify-center gap-1 uppercase tracking-widest">
                            <CheckCircle size={10} /> Icon Ready
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <div className="h-16 w-16 rounded-2xl bg-slate-800/50 flex items-center justify-center text-slate-500 mx-auto group-hover:bg-indigo-500 group-hover:text-white transition-all mb-4 shadow-inner">
                            <Rocket size={32} />
                          </div>
                          <p className="text-sm font-bold text-white mb-1">Upload App Logo</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Drag & Drop or Click</p>
                        </div>
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={handleIconChange} />
                    </label>
                  </div>
                </div>

                {/* Splash Image Upload */}
                <div className={`space-y-3 transition-all duration-500 ${formData.splashMode === 'image' ? 'opacity-100 scale-100' : 'opacity-20 grayscale pointer-events-none'}`}>
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wider">
                    <Palette size={14} className="opacity-70" /> {formData.splashMode === 'image' ? 'Splash Image (Required)' : 'Splash Image (Disabled)'}
                  </label>
                  <div 
                    className="relative"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-500'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-indigo-500'); }}
                    onDrop={(e) => {
                      if (formData.splashMode !== 'image') return;
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) handleSplashChange({ target: { files: [file] } });
                    }}
                  >
                    <label className={`flex flex-col items-center justify-center p-6 bg-slate-900/30 border-2 border-dashed ${splashPreview ? 'border-indigo-500/50' : 'border-slate-800'} rounded-2xl hover:border-indigo-500/50 transition-all cursor-pointer group min-h-[220px]`}>
                      {splashPreview ? (
                        <div className="relative w-40 h-40 mx-auto">
                          <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-indigo-500/50 bg-slate-900 flex items-center justify-center relative shadow-2xl">
                            <img src={splashPreview} alt="Splash Preview" className="w-full h-full object-cover" />
                            <button 
                              type="button"
                              onClick={(e) => { e.preventDefault(); setSplashImage(null); setSplashPreview(null); }}
                              className="absolute top-2 right-2 w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all z-[100] border-2 border-white/30"
                            >
                              <X size={16} strokeWidth={3} />
                            </button>
                          </div>
                          <p className="mt-2 text-[10px] font-bold text-indigo-400 flex items-center justify-center gap-1 uppercase tracking-widest">
                            <CheckCircle size={10} /> Splash Ready
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <div className="h-16 w-16 rounded-2xl bg-slate-800/50 flex items-center justify-center text-slate-500 mx-auto group-hover:bg-indigo-500 group-hover:text-white transition-all mb-4 shadow-inner">
                            <Palette size={32} />
                          </div>
                          <p className="text-sm font-bold text-white mb-1">Upload Splash Image</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                            {formData.splashMode === 'image' ? 'Drag & Drop or Click' : 'Switch to Image Mode to upload'}
                          </p>
                        </div>
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={handleSplashChange} disabled={formData.splashMode !== 'image'} />
                    </label>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading || (jobId && status?.state !== 'completed' && status?.state !== 'failed')}
                className="btn-primary mt-4 w-full"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Rocket size={20} />}
                {jobId ? 'Building Bundle...' : 'Generate App Package'}
              </button>
            </form>
          </div>
        </div>

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

                <div className="flex flex-col gap-2 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Time Elapsed</span>
                    <span className="text-white font-mono">{formatTime(timeElapsed)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Estimated Max Time</span>
                    <span className="text-indigo-400 font-bold">~7-8 Minutes</span>
                  </div>
                  {timeElapsed > 0 && status?.state !== 'completed' && (
                    <div className="mt-2 text-[10px] text-slate-500 italic">
                      * Builds take longer during Gradle compilation. Please stay on this page.
                    </div>
                  )}
                </div>

                {status?.state === 'completed' && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 text-green-500 font-bold text-sm">
                      <ShieldCheck size={18} />
                      Dual Build Successful
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <a 
                        href={status.result?.apkUrl} 
                        className="btn-primary !bg-green-600 hover:!bg-green-700 !py-2 !text-sm"
                        download
                      >
                        <Download size={16} /> Download APK (Install)
                      </a>
                      <a 
                        href={status.result?.aabUrl} 
                        className="btn-secondary !border-green-500/30 !text-green-400 hover:!bg-green-500/10 !py-2 !text-sm"
                        download
                      >
                        <Download size={16} /> Download AAB (Play Store)
                      </a>
                    </div>
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
