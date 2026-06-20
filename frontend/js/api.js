// Determine API Base URL
let API_BASE = '/api';

// If running frontend locally from file system or a different port (e.g. VS Code Live Server)
if (window.location.protocol === 'file:' || window.location.port === '5500' || window.location.port === '3000') {
  API_BASE = 'http://localhost:5000/api';
}

const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('zynero_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    
    // Check if empty response (like DELETE request)
    const contentType = response.headers.get('content-type');
    let data = {};
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { message: await response.text() };
    }

    if (!response.ok) {
      throw new Error(data.message || 'Server error occurred');
    }

    return data;
  } catch (error) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error;
  }
};
