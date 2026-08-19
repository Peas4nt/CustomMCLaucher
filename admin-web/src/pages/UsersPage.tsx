import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { AdminUser, UserRole, UserStatus } from '../types';
import {
  Users,
  Shield,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Search,
  Loader2,
  Plus,
  Edit2,
  UserCheck,
  UserX,
  Lock,
  Mail,
  User,
  X,
  Save,
  Check,
} from 'lucide-react';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DEACTIVATED'>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('USER');
  const [formStatus, setFormStatus] = useState<UserStatus>('ACTIVE');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      const data = await adminApi.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('USER');
    setFormStatus('ACTIVE');
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormEmail(user.email);
    setFormPassword(''); // blank means keep current
    setFormRole(user.role);
    setFormStatus(user.status);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSubmitting(true);

    try {
      if (editingUser) {
        // Update user
        const updateData: any = {
          username: formUsername.trim(),
          email: formEmail.trim(),
          role: formRole,
          status: formStatus,
        };
        if (formPassword.trim()) {
          if (formPassword.trim().length < 6) {
            throw new Error('Password must be at least 6 characters');
          }
          updateData.password = formPassword.trim();
        }

        await adminApi.updateUser(editingUser.id, updateData);
        setSuccess(`User "${formUsername}" updated successfully`);
      } else {
        // Create user
        if (!formUsername.trim() || !formEmail.trim() || !formPassword.trim()) {
          throw new Error('Username, email, and password are required');
        }
        if (formPassword.trim().length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        await adminApi.createUser({
          username: formUsername.trim(),
          email: formEmail.trim(),
          password: formPassword.trim(),
          role: formRole,
        });
        setSuccess(`User "${formUsername}" created successfully`);
      }

      setTimeout(() => setSuccess(null), 3000);
      setIsModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save user');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: AdminUser) => {
    const newStatus: UserStatus = user.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    setError(null);
    try {
      await adminApi.updateUser(user.id, { status: newStatus });
      setSuccess(
        newStatus === 'ACTIVE'
          ? `Activated user "${user.username}"`
          : `Deactivated user "${user.username}"`
      );
      setTimeout(() => setSuccess(null), 2500);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!window.confirm(`Permanently delete user "${user.username}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await adminApi.deleteUser(user.id, true);
      setSuccess(`Permanently deleted user "${user.username}"`);
      setTimeout(() => setSuccess(null), 2500);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    if (statusFilter === 'ACTIVE') return matchesSearch && u.status === 'ACTIVE';
    if (statusFilter === 'DEACTIVATED') return matchesSearch && u.status === 'DEACTIVATED';
    return matchesSearch;
  });

  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const deactivatedCount = users.filter((u) => u.status === 'DEACTIVATED').length;

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#df9168]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#df9168] mb-1">
            <Users className="w-4 h-4" />
            <span>Accounts & Permissions</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">
            Registered Users Management
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Create, edit, deactivate, or remove registered launcher accounts and assign administrator privileges.
          </p>
        </div>

        {/* Add User Button */}
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider text-white terracotta-gradient hover:brightness-110 shadow-lg transition-all w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Filter Bar: Status Filters + Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
              statusFilter === 'ALL'
                ? 'bg-white/15 text-white border-white/30 shadow-sm'
                : 'bg-white/5 text-slate-400 border-transparent hover:text-white'
            }`}
          >
            All ({users.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-white/5 text-slate-400 border-transparent hover:text-emerald-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Active ({activeCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('DEACTIVATED')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
              statusFilter === 'DEACTIVATED'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-white/5 text-slate-400 border-transparent hover:text-amber-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Deactivated ({deactivatedCount})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[#d97757]"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-3xl bg-[#12141c] border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 bg-[#161822]">
                <th className="px-6 py-4">Player / Account</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-mono">
              {filteredUsers.map((user) => {
                const isDeactivated = user.status === 'DEACTIVATED';

                return (
                  <tr
                    key={user.id}
                    className={`transition-colors ${
                      isDeactivated
                        ? 'bg-amber-500/[0.02] hover:bg-amber-500/[0.05] opacity-75'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Avatar & Username */}
                    <td className="px-6 py-4 flex items-center gap-3.5">
                      <img
                        src={`https://minotar.net/helm/${user.username}/36.png`}
                        alt={user.username}
                        className={`w-9 h-9 rounded-xl object-cover border bg-black/40 shadow-sm transition-transform hover:scale-110 ${
                          isDeactivated ? 'border-white/5 opacity-50' : 'border-white/15'
                        }`}
                        onError={(e) => {
                          e.currentTarget.src = 'https://minotar.net/helm/Steve/36.png';
                        }}
                      />
                      <div>
                        <div
                          className={`font-bold text-sm ${
                            isDeactivated ? 'text-slate-400 line-through' : 'text-white'
                          }`}
                        >
                          {user.username}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: {user.id.substring(0, 8)}...
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-slate-300">{user.email}</td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      {user.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-[#d97757]/20 text-[#df9168] border border-[#d97757]/30 shadow-sm">
                          <Shield className="w-3 h-3" />
                          <span>ADMIN</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-white/5 text-slate-400 border border-white/5">
                          <span>PLAYER</span>
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {user.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>ACTIVE</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span>DEACTIVATED</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(user)}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-xs font-mono border border-white/5 flex items-center gap-1.5"
                          title="Edit user details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* Toggle Active / Deactivate */}
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`p-2 rounded-xl border transition-colors text-xs ${
                            user.status === 'ACTIVE'
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/20'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/20'
                          }`}
                          title={user.status === 'ACTIVE' ? 'Deactivate user' : 'Activate user'}
                        >
                          {user.status === 'ACTIVE' ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Permanent Delete Button */}
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors border border-white/5"
                          title="Permanently delete user"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-mono text-xs">
                    No users matching "{searchQuery}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-8 rounded-3xl bg-[#141720] border border-white/10 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                {editingUser ? 'Edit User Account' : 'Create New User'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Head Avatar Preview Banner */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1a1d26] border-2 border-[#d97757]/40 shadow-xl p-1 shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src={`https://minotar.net/helm/${formUsername.trim() || 'Steve'}/64.png`}
                  alt="Player Head"
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    e.currentTarget.src = 'https://minotar.net/helm/Steve/64.png';
                  }}
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Minecraft Skin Avatar
                </span>
                <div className="text-base font-black text-white truncate">
                  {formUsername.trim() || 'Steve'}
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  Real-time skin rendered from Minecraft avatar services.
                </p>
              </div>
            </div>

            {modalError && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveUser} className="space-y-4">
              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#df9168]" />
                  <span>Minecraft Username / Nickname</span>
                </label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="e.g. Steve_Craft"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[#d97757]"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#df9168]" />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="player@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[#d97757]"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#df9168]" />
                  <span>
                    {editingUser ? 'New Password (leave blank to keep)' : 'Password'}
                  </span>
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? '•••••••• (unchanged)' : '•••••••• (min 6 characters)'}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[#d97757]"
                />
              </div>

              {/* Role & Status Row */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                {/* Role */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                    System Role
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-[#d97757]"
                  >
                    <option value="USER">Player (Standard)</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                    Account Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as UserStatus)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-[#d97757]"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DEACTIVATED">Deactivated</option>
                  </select>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase font-mono text-white terracotta-gradient hover:brightness-110 shadow-lg disabled:opacity-50"
                >
                  {modalSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{editingUser ? 'Save Changes' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
