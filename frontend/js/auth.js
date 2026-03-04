// js/auth.js - Shared authentication functions

const API_CONFIG = {
    BASE_URL: 'http://localhost:3000' // Ganti dengan URL backend Anda
};

// Get token from localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Get user data from localStorage
function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Check if user is authenticated
function isAuthenticated() {
    const token = getToken();
    const user = getUser();
    return !!(token && user && user.id);
}

// Check authentication and redirect to login if not authenticated
function requireAuth(redirectTo = '../login.html') {
    if (!isAuthenticated()) {
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

// Check role-based access
function requireRole(role, redirectTo = '../login.html') {
    if (!requireAuth(redirectTo)) return false;
    
    const user = getUser();
    if (user.role !== role) {
        alert(`Akses ditolak! Halaman ini khusus untuk ${role}.`);
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

// Logout function
function logout(redirectTo = '../login.html') {
    // Clear all auth data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    
    // Redirect to login
    window.location.href = redirectTo;
}

// Make API call with authentication
async function apiCall(endpoint, options = {}) {
    const token = getToken();
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
    };
    
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        });
        
        if (response.status === 401) {
            // Token expired or invalid
            logout();
            throw new Error('Sesi telah berakhir. Silakan login kembali.');
        }
        
        return response;
    } catch (error) {
        console.error('API Call Error:', error);
        throw error;
    }
}

// Save auth data after login
function saveAuth(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

// Get user display name
function getUserDisplayName() {
    const user = getUser();
    if (!user) return 'Pengguna';
    return user.name || user.email || 'Pengguna';
}

// Check if token is expired
function isTokenExpired() {
    try {
        const token = getToken();
        if (!token) return true;
        
        // Decode token (simple check - in production use proper JWT decode)
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        
        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
    } catch (error) {
        return true;
    }
}

// Refresh token (if you have refresh token endpoint)
async function refreshToken() {
    try {
        const response = await apiCall('/api/auth/refresh', {
            method: 'POST'
        });
        
        if (response.ok) {
            const data = await response.json();
            saveAuth(data.token, data.user);
            return true;
        }
    } catch (error) {
        console.error('Refresh token failed:', error);
    }
    return false;
}

// Export functions to global window object
window.auth = {
    getToken,
    getUser,
    isAuthenticated,
    requireAuth,
    requireRole,
    logout,
    apiCall,
    saveAuth,
    getUserDisplayName,
    isTokenExpired,
    refreshToken
};

// Auto-check token on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on login page - if yes, don't redirect
    const isLoginPage = window.location.pathname.includes('login.html');
    
    if (!isLoginPage && isAuthenticated() && isTokenExpired()) {
        // Try to refresh token or logout
        refreshToken().catch(() => logout());
    }
});