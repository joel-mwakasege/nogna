import React, { useState, useEffect } from 'react';
import { Users, Mail, Trash2, UserPlus, Shield, Clock, Copy, Check, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import { DeleteModal } from '../components/DeleteModal';

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscription_tier: string;
  subscription_expires_at: string | null;
  max_users: number;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
}

interface Invitation {
  id: string;
  token: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

export default function CompanySettings() {
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserEmail, setDeleteUserEmail] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteInviteId, setDeleteInviteId] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*, companies(*)')
        .eq('id', user.id)
        .single();

      if (!profile || !profile.companies) return;

      const isAdmin = profile.role === 'owner' || profile.role === 'admin';
      setIsOwnerOrAdmin(isAdmin);
      setCompany(profile.companies);
      setCompanyName(profile.companies.name);

      const { data: usersData } = await supabase
        .from('user_profiles')
        .select('id, email, name, role, created_at')
        .eq('company_id', profile.companies.id)
        .order('created_at', { ascending: false });

      setUsers(usersData || []);

      if (isAdmin) {
        const { data: invitesData } = await supabase
          .from('company_invitations')
          .select('id, token, email, role, expires_at, created_at')
          .eq('company_id', profile.companies.id)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        setInvitations(invitesData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteLoading(true);

    try {
      if (!company) throw new Error('No company loaded');

      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('email', inviteEmail)
        .eq('company_id', company.id)
        .maybeSingle();

      if (existingUser) {
        setInviteError('User is already a member of this company');
        return;
      }

      const { data: existingInvite } = await supabase
        .from('company_invitations')
        .select('*')
        .eq('email', inviteEmail)
        .eq('company_id', company.id)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (existingInvite) {
        setInviteError('An invitation has already been sent to this email');
        return;
      }

      const { data: newInvite, error } = await supabase
        .from('company_invitations')
        .insert({
          company_id: company.id,
          email: inviteEmail,
          role: inviteRole,
          invited_by: currentUserId,
        })
        .select('token')
        .single();

      if (error) throw error;

      const inviteLink = `${window.location.origin}/invite/${newInvite.token}`;
      setCreatedInviteLink(inviteLink);
      loadData();
    } catch (error: any) {
      setInviteError(error.message || 'Failed to create invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!createdInviteLink) return;
    await navigator.clipboard.writeText(createdInviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCloseInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteRole('user');
    setInviteError('');
    setCreatedInviteLink(null);
    setCopiedLink(false);
  };

  const handleRemoveUser = async () => {
    if (!deleteUserId) return;
    setDeleteLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: deleteUserId }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to remove user');

      loadData();
      setDeleteUserId(null);
      setDeleteUserEmail('');
    } catch (error: any) {
      console.error('Error removing user:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteInvitation = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('company_invitations')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;

      loadData();
      setDeleteInviteId(null);
    } catch (error) {
      console.error('Error deleting invitation:', error);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveMessage('');

    try {
      if (!company) throw new Error('No company loaded');

      const { error } = await supabase
        .from('companies')
        .update({ name: companyName })
        .eq('id', company.id);

      if (error) throw error;

      setSaveMessage('Company settings saved successfully');
      loadData();
    } catch (error: any) {
      setSaveMessage('Failed to save settings');
    } finally {
      setSaveLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-amber-100 text-amber-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      case 'suspended': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">You are not associated with any company. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Company Settings</h1>
        <p className="text-gray-600">Manage your company and team members</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-medium text-gray-600">Team Size</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{users.length} / {company.max_users}</p>
          <p className="text-xs text-gray-500 mt-1">Active users</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-green-600" />
            <h3 className="text-sm font-medium text-gray-600">Subscription</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900 capitalize">{company.subscription_tier}</p>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${getStatusBadgeColor(company.status)}`}>
            {company.status}
          </span>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-gray-600" />
            <h3 className="text-sm font-medium text-gray-600">Member Since</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">{new Date(company.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Company Information</h2>
          </div>
          <form onSubmit={handleUpdateCompany} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={!isOwnerOrAdmin || saveLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Slug</label>
              <input
                type="text"
                value={company.slug}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Contact support to change your slug</p>
            </div>

            {saveMessage && (
              <div className={`p-3 rounded-lg text-sm ${saveMessage.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {saveMessage}
              </div>
            )}

            {isOwnerOrAdmin && (
              <Button type="submit" disabled={saveLoading}>
                {saveLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </form>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
            {isOwnerOrAdmin && (
              users.length < company.max_users ? (
                <Button size="sm" onClick={() => setShowInviteModal(true)}>
                  <UserPlus className="w-4 h-4 mr-1" />
                  Invite Member
                </Button>
              ) : (
                <span className="text-xs text-red-600 font-medium">User limit reached</span>
              )
            )}
          </div>

          <div className="divide-y divide-gray-200">
            {users.map((user) => (
              <div key={user.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 text-sm">{user.name || 'Unnamed User'}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                {isOwnerOrAdmin && user.id !== currentUserId && user.role !== 'owner' && (
                  <button
                    onClick={() => { setDeleteUserId(user.id); setDeleteUserEmail(user.email); }}
                    className="text-red-500 hover:text-red-700 transition-colors ml-2 flex-shrink-0"
                    title="Remove user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {users.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-sm">No team members yet</div>
            )}
          </div>

          {isOwnerOrAdmin && invitations.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <h3 className="font-semibold text-gray-800 text-sm mb-3">Pending Invitations</h3>
              <div className="space-y-2">
                {invitations.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{invite.email}</p>
                        <p className="text-xs text-gray-500">
                          Expires {new Date(invite.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <button
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.token}`)}
                        className="text-blue-600 hover:text-blue-700 transition-colors"
                        title="Copy invite link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteInviteId(invite.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Cancel invitation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            {!createdInviteLink ? (
              <>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Invite Team Member</h3>

                {inviteError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                    {inviteError}
                  </div>
                )}

                <form onSubmit={handleInviteUser} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="colleague@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <Button type="button" variant="secondary" onClick={handleCloseInviteModal} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviteLoading} className="flex-1">
                      {inviteLoading ? 'Creating...' : 'Create Invitation'}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Invitation Created</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Share this link with <strong>{inviteEmail}</strong> to join as <strong>{inviteRole}</strong>
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Invitation Link</p>
                  <p className="text-sm text-gray-800 break-all font-mono leading-relaxed">{createdInviteLink}</p>
                </div>

                <div className="flex gap-3">
                  <Button variant="secondary" onClick={handleCopyLink} className="flex-1">
                    {copiedLink
                      ? <><Check className="w-4 h-4 mr-1" /> Copied!</>
                      : <><Copy className="w-4 h-4 mr-1" /> Copy Link</>
                    }
                  </Button>
                  <Button onClick={handleCloseInviteModal} className="flex-1">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Done
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deleteUserId && (
        <DeleteModal
          isOpen={true}
          onCancel={() => { setDeleteUserId(null); setDeleteUserEmail(''); }}
          onConfirm={handleRemoveUser}
          title="Remove User"
          message="Are you sure you want to permanently remove"
          itemName={deleteUserEmail}
          isLoading={deleteLoading}
        />
      )}

      {deleteInviteId && (
        <DeleteModal
          isOpen={true}
          onCancel={() => setDeleteInviteId(null)}
          onConfirm={() => handleDeleteInvitation(deleteInviteId)}
          title="Cancel Invitation"
          message="Are you sure you want to cancel the invitation for"
          itemName={invitations.find(i => i.id === deleteInviteId)?.email || 'this invitation'}
        />
      )}
    </main>
  );
}
