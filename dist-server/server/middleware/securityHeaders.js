/**
 * Helmet-equivalent HTTP Security Headers Middleware
 * Hardens Express server against XSS, clickjacking, MIME-sniffing, and SSL downgrade attacks.
 */
export function securityHeadersMiddleware(_req, res, next) {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // XSS Protection for older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Strict Transport Security (HSTS) - 1 year
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Content Security Policy
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' ws: wss: http: https:;");
    next();
}
