import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Rocket, ShieldCheck, Globe, Palette, Clock, CheckCircle, 
  Download, Loader2, Play, Info, Smartphone, AlertCircle, X, Settings, Package, XCircle 
} from 'lucide-react';

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
    splashDuration: '2', // Default 2 seconds
    buildType: 'apk',
    storePassword: '',
    keyPassword: '',
    keyAlias: '',
    keystoreName: '',
    autoUnique: false,
    useFirebase: false,
    fcmCurl: '',
    fcmStoreUrl: '',
    fcmBody: {},
    apiHeaders: {}
  });
  const [googleServices, setGoogleServices] = useState(null);
  const [firebaseAdmin, setFirebaseAdmin] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [icon, setIcon] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [splashImage, setSplashImage] = useState(null);
  const [splashPreview, setSplashPreview] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  const ESTIMATED_TOTAL_TIME = 420; // 7 minutes average

  const handleAppNameChange = (name, forceUnique = formData.autoUnique) => {
    let pkg = `com.${name.toLowerCase().replace(/\s+/g, '')}.app`;
    if (forceUnique) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      pkg = `com.${name.toLowerCase().replace(/\s+/g, '')}.v${suffix}`;
    }
    setFormData({ ...formData, appName: name, packageName: pkg });
  };

  const toggleUnique = () => {
    const newVal = !formData.autoUnique;
    setFormData(prev => ({ ...prev, autoUnique: newVal }));
    handleAppNameChange(formData.appName, newVal);
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
          if (res.data) setStatus(res.data);
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
      data.append('splashDuration', formData.splashDuration);
      data.append('buildType', formData.buildType);
      data.append('storePassword', formData.storePassword);
      data.append('keyPassword', formData.keyPassword);
      data.append('keyAlias', formData.keyAlias);
      data.append('keystoreName', formData.keystoreName);
      data.append('useFirebase', formData.useFirebase);
      data.append('fcmStoreUrl', formData.fcmStoreUrl);
      data.append('fcmBody', JSON.stringify(formData.fcmBody));
      data.append('apiHeaders', JSON.stringify(formData.apiHeaders));
      if (icon) data.append('icon', icon);
      if (splashImage) data.append('splash', splashImage);
      if (googleServices) data.append('googleServices', googleServices);
      if (firebaseAdmin) data.append('firebaseAdmin', firebaseAdmin);

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

  const [isSplashOpen, setIsSplashOpen] = useState(false);

  const splashOptions = [
    { id: 'color', label: 'Solid Color Background', icon: <Palette size={16} />, desc: 'Branded color with logo' },
    { id: 'image', label: 'Full Screen Image', icon: <Globe size={16} />, desc: 'Full screen splash artwork' }
  ];

  const [showSettings, setShowSettings] = useState(false);
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  const [passLoading, setPassLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passData.new !== passData.confirm) return alert('Passwords do not match');
    setPassLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.post(`${API_BASE.replace('/build', '')}/change-password`, {
        userId: user._id,
        currentPassword: passData.current,
        newPassword: passData.new
      });
      alert('Password updated successfully');
      setShowSettings(false);
      setPassData({ current: '', new: '', confirm: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update password');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="container py-8 animate-fade-in relative">
      <header className="flex justify-between items-start mb-12">
        <div className="text-left">
          <h1 className="text-4xl text-white">New Build Project</h1>
          <p className="text-slate-400 mt-2">Enter your website details to generate a production-ready APK or AAB.</p>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
          title="Change Password"
        >
          <Settings size={24} />
        </button>
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
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                      <Package size={16} /> Package Name
                    </label>
                    <button 
                      type="button"
                      onClick={toggleUnique}
                      className={`text-[10px] px-2 py-0.5 rounded-full transition-all border ${formData.autoUnique ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                    >
                      {formData.autoUnique ? '✓ Separate App Mode' : '+ Make Separate App'}
                    </button>
                  </div>
                  <div className="input-group">
                    <input 
                      type="text" 
                      placeholder="com.mystore.app"
                      value={formData.packageName}
                      onChange={(e) => setFormData({...formData, packageName: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Palette size={16} /> Splash Mode: <span className="text-white font-bold">{formData.splashMode === 'color' ? 'Color' : 'Image'}</span>
                      </label>
                      <p className="text-[10px] text-slate-500 mt-0.5">Switch to toggle between Solid Color or Full Image</p>
                    </div>
                    
                    {/* iOS Style Gradient Toggle */}
                    <div 
                      onClick={() => setFormData({...formData, splashMode: formData.splashMode === 'color' ? 'image' : 'color'})}
                      className={`relative w-16 h-8 rounded-full cursor-pointer transition-all duration-500 shadow-inner ${formData.splashMode === 'image' ? 'bg-gradient-to-r from-emerald-400 to-blue-500' : 'bg-slate-800'}`}
                    >
                      {/* Knob */}
                      <div 
                        className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-500 shadow-xl flex items-center justify-center ${formData.splashMode === 'image' ? 'left-9' : 'left-1'}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${formData.splashMode === 'image' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Conditional Sections */}
                <div className="animate-fade-in">
                  {formData.splashMode === 'color' ? (
                    <div className="space-y-2 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 animate-slide-up">
                      <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest block">Splash Background Color</label>
                      <div className="flex gap-3 mt-2">
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
                      <p className="text-[10px] text-slate-500 italic mt-2">* Your app icon will be centered on this color background.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 animate-slide-up">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Display Duration (Seconds)</label>
                        <div className="input-group w-24">
                          <input 
                            type="number" 
                            min="1" max="10"
                            value={formData.splashDuration}
                            onChange={(e) => setFormData({...formData, splashDuration: e.target.value})}
                          />
                        </div>
                      </div>

                      {/* Splash Image Upload moved here */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Splash Image (Full Screen)</label>
                        <div 
                          className="relative"
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-500'); }}
                          onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-indigo-500'); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files[0];
                            if (file && file.type.startsWith('image/')) handleSplashChange({ target: { files: [file] } });
                          }}
                        >
                          <label className={`flex flex-col items-center justify-center p-6 bg-slate-900/40 border-2 border-dashed ${splashPreview ? 'border-indigo-500/50' : 'border-slate-800'} rounded-2xl hover:border-indigo-500/50 transition-all cursor-pointer group min-h-[180px]`}>
                            {splashPreview ? (
                              <div className="relative w-32 h-32 mx-auto">
                                <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-indigo-500/50 bg-slate-900 flex items-center justify-center relative shadow-2xl">
                                  <img src={splashPreview} alt="Splash Preview" className="w-full h-full object-cover" />
                                  <button 
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); setSplashImage(null); setSplashPreview(null); }}
                                    className="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all z-[100]"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-2">
                                <Palette size={24} className="text-slate-500 mx-auto mb-2 group-hover:text-indigo-400" />
                                <p className="text-xs font-bold text-white">Upload Splash Image</p>
                                <p className="text-[10px] text-slate-500 uppercase mt-1">PNG/JPG Supported</p>
                              </div>
                            )}
                            <input type="file" className="hidden" accept="image/*" onChange={handleSplashChange} />
                          </label>
                        </div>
                      </div>
                    </div>
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
              </div>

              {/* Row 4: Icon Upload (Simplified) */}
              <div className="grid md:grid-cols-1 border-t border-slate-800 pt-8">
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
                    <label className={`flex flex-col items-center justify-center p-6 bg-slate-900/30 border-2 border-dashed ${iconPreview ? 'border-indigo-500/50' : 'border-slate-800'} rounded-2xl hover:border-indigo-500/50 transition-all cursor-pointer group min-h-[160px]`}>
                      {iconPreview ? (
                        <div className="relative w-32 h-32 mx-auto">
                          <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-indigo-500/50 bg-slate-900 flex items-center justify-center relative shadow-2xl">
                            <img src={iconPreview} alt="Icon Preview" className="w-full h-full object-cover" />
                            <button 
                              type="button"
                              onClick={(e) => { e.preventDefault(); setIcon(null); setIconPreview(null); }}
                              className="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all z-[100]"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <Rocket size={24} className="text-slate-500 mx-auto mb-2 group-hover:text-indigo-400" />
                          <p className="text-sm font-bold text-white">Upload App Logo</p>
                          <p className="text-[10px] text-slate-500 uppercase mt-1">PNG Required</p>
                        </div>
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={handleIconChange} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Row 5: Advanced Android Signing */}
              <div className="space-y-4 border-t border-slate-800 pt-8">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-indigo-500" size={18} />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Advanced Android Signing (Optional)</h3>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Store Password</label>
                    <div className="input-group">
                      <input 
                        type="password" 
                        placeholder="Min. 6 characters"
                        minLength={6}
                        value={formData.storePassword}
                        onChange={(e) => setFormData({...formData, storePassword: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Key Password</label>
                    <div className="input-group">
                      <input 
                        type="password" 
                        placeholder="Min. 6 characters"
                        minLength={6}
                        value={formData.keyPassword}
                        onChange={(e) => setFormData({...formData, keyPassword: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Key Alias</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        placeholder="Default: upload"
                        value={formData.keyAlias}
                        onChange={(e) => setFormData({...formData, keyAlias: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Keystore File Name</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        placeholder="Default: app_name.jks"
                        value={formData.keystoreName}
                        onChange={(e) => setFormData({...formData, keystoreName: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div> 
              
              {/* Row 6: Firebase & Push Notifications */}
              <div className="space-y-4 border-t border-slate-800 pt-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Rocket className="text-orange-500" size={18} />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Firebase & Push Notifications (Optional)</h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <input 
                    type="checkbox" 
                    id="useFirebase"
                    className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-indigo-500"
                    checked={formData.useFirebase}
                    onChange={(e) => setFormData({...formData, useFirebase: e.target.checked})}
                  />
                  <label htmlFor="useFirebase" className="text-xs text-slate-400">Enable Firebase Support (FCM)</label>
                </div>

                {formData.useFirebase && (
                  <div className="space-y-6 animate-slide-up">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Google Services JSON (For APK)</label>
                      <input 
                        type="file" 
                        accept=".json"
                        className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20"
                        onChange={(e) => setGoogleServices(e.target.files[0])}
                      />
                      <p className="text-[9px] text-slate-600">Download from Firebase Console (Settings &gt; Project Settings)</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">FCM Token Sync CURL (Paste from Postman/Docs)</label>
                      <div className="input-group">
                        <textarea 
                          rows="4"
                          placeholder='curl -X POST https://api.yoursite.com/tokens -H "Authorization: Bearer 123"'
                          className="!text-[10px] font-mono leading-relaxed p-3"
                          value={formData.fcmCurl}
                          onChange={(e) => {
                            const curl = e.target.value;
                            // Improved CURL Parser
                            const urlMatch = curl.match(/(?:https?:\/\/[^\s"']+)/);
                            const headers = {};
                            
                            // Match both -H and --header with or without quotes
                            const headerRegex = /(?:-H|--header)\s+["']?([^"']+)["']?/g;
                            let match;
                            while ((match = headerRegex.exec(curl)) !== null) {
                              const headerPart = match[1];
                              const colonIndex = headerPart.indexOf(':');
                              if (colonIndex > -1) {
                                const key = headerPart.substring(0, colonIndex).trim();
                                const value = headerPart.substring(colonIndex + 1).trim();
                                if (key) headers[key] = value;
                              }
                            }

                            // Extract Data/Body (-d or --data)
                            let body = {};
                            const dataMatch = curl.match(/(?:-d|--data)\s+['"]({.*})['"]/);
                            if (dataMatch && dataMatch[1]) {
                              try {
                                body = JSON.parse(dataMatch[1]);
                              } catch (e) {
                                console.log("Failed to parse CURL body:", e);
                              }
                            }
                            
                            setFormData({
                              ...formData, 
                              fcmCurl: curl,
                              fcmStoreUrl: urlMatch ? urlMatch[0] : '',
                              fcmBody: body,
                              apiHeaders: headers
                            });
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center px-1">
                        <p className="text-[9px] text-slate-600">Paste the CURL command provided by your backend developer.</p>
                        {formData.fcmStoreUrl && (
                          <span className="text-[9px] text-emerald-500 font-bold flex items-center gap-1 animate-pulse">
                            <CheckCircle size={10} /> Parsed Successfully
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 space-y-1 mb-2">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Signing Properties</p>
                      <div className="grid grid-cols-1 gap-1 text-[11px] font-mono">
                        <p className="text-slate-300"><span className="text-indigo-400">Alias:</span> {formData.keyAlias || 'upload'}</p>
                        <p className="text-slate-300"><span className="text-indigo-400">Key Pass:</span> {formData.keyPassword || 'rehan_password_2024'}</p>
                        <p className="text-slate-300"><span className="text-indigo-400">Store Pass:</span> {formData.storePassword || 'rehan_password_2024'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <a 
                        href={`https://backend.cloudedata.in${status.result?.apkUrl}`} 
                        className="btn-primary !bg-green-600 hover:!bg-green-700 !py-2 !text-sm"
                        download
                      >
                        <Download size={16} /> Download APK (Install)
                      </a>
                      <a 
                        href={`https://backend.cloudedata.in${status.result?.aabUrl}`} 
                        className="btn-secondary !border-green-500/30 !text-green-400 hover:!bg-green-500/10 !py-2 !text-sm"
                        download
                      >
                        <Download size={16} /> Download AAB (Play Store)
                      </a>
                      {status.result?.jksUrl && (
                        <a 
                          href={`https://backend.cloudedata.in${status.result?.jksUrl}`} 
                          className="btn-secondary !border-slate-700 !text-slate-400 hover:!bg-slate-800 !py-2 !text-sm"
                          download
                        >
                          <Download size={16} /> Download Keystore (JKS)
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {status?.state === 'failed' && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-red-500 font-bold text-sm">
                      <XCircle size={18} />
                      Build Failed
                    </div>
                    {status.error && (
                      <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Error Details</p>
                        <p className="text-xs text-red-400 font-mono break-all leading-relaxed whitespace-pre-wrap">
                          {status.error}
                        </p>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500 italic mt-2">
                      * Please check your configuration (URL, Passwords, Files) and try again.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Change Password Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="glass-card w-full max-w-md relative z-10 animate-slide-up border-indigo-500/30">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 text-white font-bold text-xl uppercase tracking-wider">
                <Settings className="text-indigo-500" size={24} /> Settings
              </div>
              <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Current Password</label>
                <div className="input-group">
                  <input 
                    type="password" 
                    required
                    value={passData.current}
                    onChange={(e) => setPassData({...passData, current: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">New Password</label>
                <div className="input-group">
                  <input 
                    type="password" 
                    required
                    value={passData.new}
                    onChange={(e) => setPassData({...passData, new: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Confirm New Password</label>
                <div className="input-group">
                  <input 
                    type="password" 
                    required
                    value={passData.confirm}
                    onChange={(e) => setPassData({...passData, confirm: e.target.value})}
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={passLoading}
                className="btn-primary w-full mt-4"
              >
                {passLoading ? <Loader2 className="animate-spin" size={20} /> : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
