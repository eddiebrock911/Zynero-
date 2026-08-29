// Determine API Base URL dynamically
let API_BASE = '/api';

// Fallback to local server only when opening HTML files directly from filesystem
if (window.location.protocol === 'file:') {
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
    
    // Check response content type
    const contentType = response.headers.get('content-type');
    let data = {};
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: text || 'Server response error' };
    }

    if (!response.ok) {
      // Handle expired or invalid session token
      if (response.status === 401 && token) {
        localStorage.removeItem('zynero_token');
        localStorage.removeItem('zynero_user');
      }
      throw new Error(data.message || 'Server error occurred');
    }

    return data;
  } catch (error) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error;
  }
};
