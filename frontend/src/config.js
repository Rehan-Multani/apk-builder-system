export const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173') 
  ? 'http://localhost:3000/api' 
  : 'https://backend.cloudedata.in/api';

export const BACKEND_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173')
  ? 'http://localhost:3000'
  : 'https://backend.cloudedata.in';
