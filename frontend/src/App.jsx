import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Rocket, CheckCircle, Loader2, Download, ShieldCheck } from 'lucide-react';

const API_BASE = 'http://localhost:3000/api';

function App() {
  const [formData, setFormData] = useState({
    url: '',
    appName: '',
    packageName: '',
    splashColor: '#ffffff'
  });
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

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
      const res = await axios.post(`${API_BASE}/build`, formData);
      setJobId(res.data.jobId);
      setStatus({ state: 'waiting', progress: 0 });
    } catch (err) {
      alert('Failed to start build');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="glass-card">
        <h1>APK Builder Pro</h1>
        <p className="subtitle">Convert any website into a high-performance Android App in minutes.</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Website URL</label>
            <input 
              type="url" 
              placeholder="https://your-website.com" 
              required 
              value={formData.url}
              onChange={(e) => setFormData({...formData, url: e.target.value})}
            />
          </div>

          <div className="input-group">
            <label>App Name</label>
            <input 
              type="text" 
              placeholder="My Awesome App" 
              required 
              value={formData.appName}
              onChange={(e) => setFormData({...formData, appName: e.target.value})}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="input-group">
              <label>Package Name (Optional)</label>
              <input 
                type="text" 
                placeholder="com.company.app" 
                value={formData.packageName}
                onChange={(e) => setFormData({...formData, packageName: e.target.value})}
              />
            </div>
            <div className="input-group">
              <label>Splash Color</label>
              <input 
                type="color" 
                value={formData.splashColor}
                onChange={(e) => setFormData({...formData, splashColor: e.target.value})}
              />
            </div>
          </div>

          <button type="submit" disabled={loading || (jobId && status?.state !== 'completed' && status?.state !== 'failed')}>
            {loading ? <Loader2 className="animate-spin inline mr-2" /> : <Rocket className="inline mr-2" size={20} />}
            {jobId ? 'Build in Progress...' : 'Generate APK Now'}
          </button>
        </form>

        {jobId && status && (
          <div className="status-container animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold flex items-center gap-2">
                {status.state === 'completed' ? <CheckCircle className="text-success" /> : <Loader2 className="animate-spin text-primary" />}
                Status: <span className={`badge badge-${status.state}`}>{status.state}</span>
              </span>
              <span className="text-dim">{status.progress}%</span>
            </div>
            
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${status.progress}%` }}></div>
            </div>

            {status.state === 'completed' && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-success" />
                  <div>
                    <p className="font-bold">Build Successful!</p>
                    <p className="text-sm text-dim">Your APK is ready for download.</p>
                  </div>
                </div>
                <a 
                  href={status.result.apkUrl} 
                  className="bg-success hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  download
                >
                  <Download size={18} /> Download
                </a>
              </div>
            )}
          </div>
        )}
      </div>
      
      <p className="text-center mt-8 text-dim text-sm">
        &copy; 2026 APK Builder System. Powered by Antigravity AI.
      </p>
    </div>
  );
}

export default App;
