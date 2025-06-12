/**
 * Rate Limiting Middleware
 * API çağrılarını sınırlandırarak kontör tasarrufu sağlar
 */

const rateLimit = require('express-rate-limit');

// Genel rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // 15 dakikada maksimum 100 istek
  message: {
    error: "Çok fazla istek gönderildi",
    message: "15 dakika sonra tekrar deneyin",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API endpoint'leri için sıkı limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 10, // 1 dakikada maksimum 10 API çağrısı
  message: {
    error: "API çağrı limiti aşıldı",
    message: "1 dakika sonra tekrar deneyin",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Test endpoint'leri için gevşek limiter
const testLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 dakika
  max: 20, // 5 dakikada maksimum 20 test çağrısı
  message: {
    error: "Test endpoint limiti aşıldı",
    message: "5 dakika sonra tekrar deneyin",
    retryAfter: "5 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Cache temizleme için çok sıkı limiter
const cacheLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 5, // 1 saatte maksimum 5 cache temizleme
  message: {
    error: "Cache temizleme limiti aşıldı",
    message: "1 saat sonra tekrar deneyin",
    retryAfter: "1 hour"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  apiLimiter,
  testLimiter,
  cacheLimiter
};
