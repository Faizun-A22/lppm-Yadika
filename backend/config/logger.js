const fs = require('fs');
const path = require('path');

// Buat folder logs jika belum ada
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Simple logger implementation
const logger = {
    info: (message) => {
        const logMessage = `[INFO] ${new Date().toISOString()} - ${message}\n`;
        console.log('\x1b[32m%s\x1b[0m', logMessage); // Green color
        fs.appendFileSync(path.join(logsDir, 'info.log'), logMessage);
    },
    
    error: (message, error) => {
        const logMessage = `[ERROR] ${new Date().toISOString()} - ${message} ${error ? error.stack || error : ''}\n`;
        console.error('\x1b[31m%s\x1b[0m', logMessage); // Red color
        fs.appendFileSync(path.join(logsDir, 'error.log'), logMessage);
    },
    
    warn: (message) => {
        const logMessage = `[WARN] ${new Date().toISOString()} - ${message}\n`;
        console.warn('\x1b[33m%s\x1b[0m', logMessage); // Yellow color
        fs.appendFileSync(path.join(logsDir, 'warn.log'), logMessage);
    },
    
    debug: (message) => {
        if (process.env.NODE_ENV === 'development') {
            const logMessage = `[DEBUG] ${new Date().toISOString()} - ${message}\n`;
            console.debug('\x1b[34m%s\x1b[0m', logMessage); // Blue color
            fs.appendFileSync(path.join(logsDir, 'debug.log'), logMessage);
        }
    }
};

module.exports = logger;