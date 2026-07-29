import { query } from '../db.js';
/**
 * Authentication and RBAC Middleware.
 * Validates session token in Authorization header (`Bearer <token>`) or `x-session-token` header.
 */
export async function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const tokenHeader = req.headers['x-session-token'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : tokenHeader;
    if (!token) {
        res.status(401).json({ error: 'Authentication required. Missing bearer or session token.' });
        return;
    }
    try {
        const { rows } = await query(`SELECT s.token, s."expiresAt", u.username, u.role, u.permissions
       FROM sessions s
       JOIN users u ON s.username = u.username
       WHERE s.token = $1 AND s."expiresAt" > NOW()`, [token]);
        if (rows.length === 0) {
            res.status(401).json({ error: 'Invalid or expired session token.' });
            return;
        }
        const session = rows[0];
        req.user = {
            username: session.username,
            role: session.role || 'viewer',
            permissions: Array.isArray(session.permissions) ? session.permissions : []
        };
        next();
    }
    catch (err) {
        res.status(500).json({ error: 'Authentication verification failed: ' + err.message });
    }
}
/**
 * Require minimum user role (`admin` | `operator` | `viewer`)
 */
export function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthenticated' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: `Forbidden. Role '${req.user.role}' lacks required authorization.` });
            return;
        }
        next();
    };
}
