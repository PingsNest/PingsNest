import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, Trash2, Key, CheckCircle, AlertTriangle, RefreshCw, Sliders } from 'lucide-react';

export interface UserAccount {
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: string[];
  mustChangePassword: boolean;
  createdAt: string;
}

const ALL_PERMISSIONS = [
  { id: 'view_metrics', label: 'View Overview Telemetry & Metrics' },
  { id: 'view_logs', label: 'View Live & Historical Logs' },
  { id: 'manage_urls', label: 'Manage URL Uptime Monitors' },
  { id: 'manage_alerts', label: 'Manage Alert Rules & Webhooks' },
  { id: 'manage_credentials', label: 'Manage AWS Credentials & Scope' },
  { id: 'manage_users', label: 'Manage User Accounts & Permissions (Admin)' },
];

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'operator' | 'viewer'>('operator');
  const [selectedPerms, setSelectedPerms] = useState<string[]>(['view_metrics', 'view_logs', 'manage_urls', 'manage_alerts']);
  const [submitting, setSubmitting] = useState(false);

  // Password Reset Modal State
  const [resetTargetUser, setResetTargetUser] = useState<string | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');

  const getToken = () => {
    return localStorage.getItem('nova_auth_token') || localStorage.getItem('api_gateway_monitor_token') || localStorage.getItem('token') || '';
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (err: any) {
      console.error('Failed fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showFlash = (text: string, ok: boolean) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleRolePresetChange = (role: 'admin' | 'operator' | 'viewer') => {
    setNewRole(role);
    if (role === 'admin') {
      setSelectedPerms(ALL_PERMISSIONS.map(p => p.id));
    } else if (role === 'operator') {
      setSelectedPerms(['view_metrics', 'view_logs', 'manage_urls', 'manage_alerts']);
    } else {
      setSelectedPerms(['view_metrics', 'view_logs']);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;

    setSubmitting(true);
    try {
      const token = getToken();
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          role: newRole,
          permissions: selectedPerms
        })
      });
      const data = await res.json();
      if (data.success) {
        showFlash(`User "${newUsername}" provisioned successfully. User must change password on first login.`, true);
        setShowCreateModal(false);
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
      } else {
        showFlash(data.error || 'Failed to create user account.', false);
      }
    } catch {
      showFlash('Network error creating user.', false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !resetNewPassword.trim()) return;

    try {
      const token = getToken();
      const res = await fetch(`/api/users/${resetTargetUser}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ resetPassword: resetNewPassword.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showFlash(`Password reset for user "${resetTargetUser}". Mandatory password update required on next login.`, true);
        setResetTargetUser(null);
        setResetNewPassword('');
        fetchUsers();
      } else {
        showFlash(data.error || 'Failed to reset password.', false);
      }
    } catch {
      showFlash('Network error resetting password.', false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === 'admin') {
      alert('Cannot delete default system admin account.');
      return;
    }
    if (!confirm(`Are you sure you want to revoke access for user "${username}"?`)) return;

    try {
      const token = getToken();
      const res = await fetch(`/api/users/${username}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showFlash(`User account "${username}" deleted successfully.`, true);
        fetchUsers();
      } else {
        showFlash(data.error || 'Failed to delete user.', false);
      }
    } catch {
      showFlash('Network error deleting user.', false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') return { label: '👑 Admin', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)' };
    if (role === 'operator') return { label: '🛠️ Operator', color: 'var(--color-primary)', bg: 'rgba(0, 242, 254, 0.1)', border: 'rgba(0, 242, 254, 0.25)' };
    return { label: '🔍 Viewer', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.1)', border: 'rgba(156, 163, 175, 0.25)' };
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <Shield size={22} color="#F59E0B" />
          </div>
          <div>
            <h3 style={{ fontSize: '17px', color: 'var(--text-primary)', margin: 0 }}>User Management & Access Control</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Manage system users, assign RBAC role permissions, reset credentials, and enforce security policies (No public registration).
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchUsers} disabled={loading} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '12px', gap: '6px' }}>
            <RefreshCw size={12} className={loading ? 'spin-anim' : ''} style={loading ? { animation: 'spin-anim 1s linear infinite' } : {}} />
            Refresh
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '12px', gap: '6px' }}>
            <UserPlus size={14} />
            Provision New User
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: message.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${message.ok ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          color: message.ok ? 'var(--color-success)' : 'var(--color-error)'
        }}>
          {message.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {message.text}
        </div>
      )}

      {/* Users List Table */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} color="var(--color-primary)" /> Registered System Accounts ({users.length})
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            🔐 Self-Registration Disabled (Admin Provisioned Only)
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-main)', color: 'var(--text-muted)', fontSize: '11px' }}>
                <th style={{ padding: '10px 12px' }}>USERNAME</th>
                <th style={{ padding: '10px 12px' }}>ROLE</th>
                <th style={{ padding: '10px 12px' }}>FIRST LOGIN STATUS</th>
                <th style={{ padding: '10px 12px' }}>PERMISSIONS TOKENS</th>
                <th style={{ padding: '10px 12px' }}>PROVISIONED DATE</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const rBadge = getRoleBadge(u.role);
                const permsList = Array.isArray(u.permissions) ? u.permissions : [];
                return (
                  <tr key={u.username} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {u.username}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        backgroundColor: rBadge.bg,
                        color: rBadge.color,
                        border: `1px solid ${rBadge.border}`
                      }}>
                        {rBadge.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {u.mustChangePassword ? (
                        <span style={{ fontSize: '11px', color: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                          ⚠️ Pending First-Login Update
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--color-success)', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          Active & Verified
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {permsList.map(p => (
                          <span key={p} style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-main)', color: 'var(--text-secondary)' }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'System Default'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setResetTargetUser(u.username)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                          title="Reset Password"
                        >
                          <Key size={11} /> Reset Pass
                        </button>
                        {u.username !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(u.username)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: 'var(--color-error)',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Delete User Account"
                          >
                            <Trash2 size={11} /> Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision User Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleCreateUser} className="glass-panel animate-slide-up" style={{ padding: '24px', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} color="var(--color-primary)" /> Provision System Account
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>USERNAME</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. devops_john"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>INITIAL PASSWORD (MUST CHANGE ON FIRST LOGIN)</label>
              <input
                type="password"
                className="input-field"
                placeholder="Initial Temporary Password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ROLE PRESET</label>
              <select className="input-field" value={newRole} onChange={e => handleRolePresetChange(e.target.value as any)}>
                <option value="operator">🛠️ Operator / DevOps (Alerts, URL Monitors, Telemetry)</option>
                <option value="viewer">🔍 Viewer (Read-Only Telemetry & SLA Reports)</option>
                <option value="admin">👑 System Admin (Full Privileges)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>GRANULAR PERMISSION TOKENS</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
                {ALL_PERMISSIONS.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedPerms.includes(p.id)}
                      onChange={() => {
                        setSelectedPerms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]);
                      }}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>
                {submitting ? 'Provisioning...' : 'Provision User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetTargetUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleResetPassword} className="glass-panel animate-slide-up" style={{ padding: '24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="#F59E0B" /> Reset User Password
              </div>
              <button type="button" onClick={() => setResetTargetUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Resetting password for user <strong style={{ color: 'var(--text-primary)' }}>{resetTargetUser}</strong>. User will be forced to change this password on next login.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>NEW TEMPORARY PASSWORD</label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter new temporary password"
                value={resetNewPassword}
                onChange={e => setResetNewPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={() => setResetTargetUser(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Reset Password</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
