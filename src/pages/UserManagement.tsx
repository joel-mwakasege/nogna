import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Shield, UserX, UserCheck, Trash2, UserPlus, X, CreditCard as Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import { DeleteModal } from '../components/DeleteModal';
import { useTenant } from '../contexts/TenantContext';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: 'owner' | 'admin' | 'user';
  is_active: boolean;
  created_at: string;
}

export default function UserManagement() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { isAdmin, isOwner, user: currentUser } = useAuth();
  const { company } = useTenant();
  const companyId = company?.id;
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; userId: string | null }>({
    isOpen: false,
    userId: null,
  });
  const [roleChangeModal, setRoleChangeModal] = useState<{
    isOpen: boolean;
    userId: string | null;
    currentRole: string;
    newRole: string;
    userEmail: string;
  }>({
    isOpen: false,
    userId: null,
    currentRole: '',
    newRole: '',
    userEmail: '',
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [addUserModal, setAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const [roleChangeError, setRoleChangeError] = useState('');
  const [editUserModal, setEditUserModal] = useState<{
    isOpen: boolean;
    userId: string | null;
    currentEmail: string;
    currentName: string | null;
  }>({
    isOpen: false,
    userId: null,
    currentEmail: '',
    currentName: null,
  });
  const [editUserName, setEditUserName] = useState('');
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserError, setEditUserError] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      navigate(p('/dashboard'));
      return;
    }
    fetchUsers();
  }, [isAdmin, navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('user_profiles')
      .select('*')
      .eq('company_id', companyId || '')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const openRoleChangeModal = (userId: string, currentRole: string, userEmail: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    if (currentRole === 'admin' && newRole === 'user') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        setRoleChangeError('Cannot demote the last admin. At least one admin must remain in the system.');
        return;
      }
    }

    setRoleChangeError('');
    setRoleChangeModal({
      isOpen: true,
      userId,
      currentRole,
      newRole,
      userEmail,
    });
  };

  const confirmRoleChange = async () => {
    if (!roleChangeModal.userId) return;

    setActionLoading(roleChangeModal.userId);

    const { error } = await (supabase as any)
      .from('user_profiles')
      .update({ role: roleChangeModal.newRole, updated_at: new Date().toISOString() })
      .eq('id', roleChangeModal.userId);

    if (!error) {
      await fetchUsers();
      setRoleChangeModal({
        isOpen: false,
        userId: null,
        currentRole: '',
        newRole: '',
        userEmail: '',
      });
    }
    setActionLoading(null);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    setActionLoading(userId);

    const { error } = await (supabase as any)
      .from('user_profiles')
      .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (!error) {
      await fetchUsers();
    }
    setActionLoading(null);
  };

  const handleDeleteUser = async () => {
    if (!deleteModal.userId) return;

    setActionLoading(deleteModal.userId);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert('Not authenticated');
        setActionLoading(null);
        return;
      }

      // Call edge function to delete user
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: deleteModal.userId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Delete user error:', result);
        alert(`Failed to delete user: ${result.error || 'Unknown error'}`);
        setActionLoading(null);
        setDeleteModal({ isOpen: false, userId: null });
        return;
      }

      // Success - refresh users
      await fetchUsers();
    } catch (error) {
      console.error('Delete user exception:', error);
      alert(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setActionLoading(null);
    setDeleteModal({ isOpen: false, userId: null });
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError('');
    setAddUserLoading(true);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setAddUserError('Not authenticated');
        setAddUserLoading(false);
        return;
      }

      // Call edge function to create user
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          ...(newUserName ? { name: newUserName } : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setAddUserError(result.error || 'Failed to create user');
        setAddUserLoading(false);
        return;
      }

      // Success - refresh users and close modal
      await fetchUsers();
      setAddUserModal(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('user');
    } catch (error) {
      setAddUserError('An unexpected error occurred');
    }

    setAddUserLoading(false);
  };

  const openEditUserModal = (userId: string, currentEmail: string, currentName: string | null) => {
    setEditUserModal({
      isOpen: true,
      userId,
      currentEmail,
      currentName,
    });
    setEditUserName(currentName || '');
    setEditUserError('');
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditUserError('');
    setEditUserLoading(true);

    try {
      if (!editUserModal.userId) {
        setEditUserError('Invalid user');
        setEditUserLoading(false);
        return;
      }

      const { error: profileError } = await (supabase as any)
        .from('user_profiles')
        .update({
          name: editUserName || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editUserModal.userId);

      if (profileError) {
        setEditUserError(profileError.message || 'Failed to update user profile');
        setEditUserLoading(false);
        return;
      }

      await fetchUsers();
      setEditUserModal({
        isOpen: false,
        userId: null,
        currentEmail: '',
        currentName: null,
      });
      setEditUserName('');
    } catch (error) {
      setEditUserError('An unexpected error occurred');
    }

    setEditUserLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            </div>
            <Button onClick={() => setAddUserModal(true)}>
              <UserPlus className="w-4 h-4" />
              Add User
            </Button>
          </div>
          <p className="text-gray-600">Manage user accounts and permissions</p>
        </div>

        {roleChangeError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{roleChangeError}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.name || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {user.role === 'owner' ? (
                          <Shield className="w-4 h-4 text-blue-600" />
                        ) : user.role === 'admin' ? (
                          <Shield className="w-4 h-4 text-green-600" />
                        ) : (
                          <Users className="w-4 h-4 text-gray-400" />
                        )}
                        <span className={`text-sm font-medium ${
                          user.role === 'owner' ? 'text-blue-600' : user.role === 'admin' ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {user.role === 'owner' ? 'Owner' : user.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={user.is_active ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {user.role !== 'owner' && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openEditUserModal(user.id, user.email, user.name)}
                              disabled={actionLoading === user.id}
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openRoleChangeModal(user.id, user.role, user.email)}
                              disabled={actionLoading === user.id}
                            >
                              <Shield className="w-4 h-4" />
                              {user.role === 'admin' ? 'Make User' : 'Make Admin'}
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => toggleUserStatus(user.id, user.is_active)}
                              disabled={actionLoading === user.id}
                            >
                              {user.is_active ? (
                                <>
                                  <UserX className="w-4 h-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-4 h-4" />
                                  Activate
                                </>
                              )}
                            </Button>

                            {isOwner && user.id !== currentUser?.id && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setDeleteModal({ isOpen: true, userId: user.id })}
                                disabled={actionLoading === user.id}
                                className="!bg-red-100 !text-red-800 hover:!bg-red-200"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </Button>
                            )}
                          </>
                        )}
                        {user.role === 'owner' && (
                          <span className="text-sm text-gray-500 italic">Owner Account</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
            </div>
          )}
        </div>
      </div>

      <DeleteModal
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false, userId: null })}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message="Are you sure you want to delete"
        itemName={users.find(u => u.id === deleteModal.userId)?.email || 'this user'}
        isLoading={actionLoading === deleteModal.userId}
      />

      {/* Role Change Confirmation Modal */}
      {roleChangeModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Confirm Role Change
                </h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>
                    You are about to change the role of <strong>{roleChangeModal.userEmail}</strong>:
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Current Role:</span>
                      <span className={`font-semibold ${
                        roleChangeModal.currentRole === 'admin' ? 'text-purple-600' : 'text-gray-700'
                      }`}>
                        {roleChangeModal.currentRole === 'admin' ? 'Administrator' : 'User'}
                      </span>
                    </div>
                    <div className="flex items-center justify-center text-gray-400">
                      ↓
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">New Role:</span>
                      <span className={`font-semibold ${
                        roleChangeModal.newRole === 'admin' ? 'text-purple-600' : 'text-gray-700'
                      }`}>
                        {roleChangeModal.newRole === 'admin' ? 'Administrator' : 'User'}
                      </span>
                    </div>
                  </div>
                  {roleChangeModal.newRole === 'admin' && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-purple-800 text-xs font-medium">
                        Administrators have full access to all system features including user management,
                        settings, and sensitive data.
                      </p>
                    </div>
                  )}
                  {roleChangeModal.newRole === 'user' && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-amber-800 text-xs font-medium">
                        This user will lose administrative privileges and will only have standard user access.
                        They will no longer be able to manage users or modify system settings.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRoleChangeModal({
                  isOpen: false,
                  userId: null,
                  currentRole: '',
                  newRole: '',
                  userEmail: '',
                })}
                disabled={actionLoading === roleChangeModal.userId}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmRoleChange}
                disabled={actionLoading === roleChangeModal.userId}
                className="flex-1"
              >
                {actionLoading === roleChangeModal.userId ? 'Changing...' : 'Confirm Change'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {addUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New User</h3>
              <button
                onClick={() => {
                  setAddUserModal(false);
                  setNewUserEmail('');
                  setNewUserPassword('');
                  setNewUserName('');
                  setNewUserRole('user');
                  setAddUserError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  id="name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min. 6 characters"
                  minLength={6}
                  required
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  id="role"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {addUserError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{addUserError}</p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setAddUserModal(false);
                    setNewUserEmail('');
                    setNewUserPassword('');
                    setNewUserName('');
                    setNewUserRole('user');
                    setAddUserError('');
                  }}
                  disabled={addUserLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addUserLoading}
                  className="flex-1"
                >
                  {addUserLoading ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUserModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
              <button
                onClick={() => {
                  setEditUserModal({
                    isOpen: false,
                    userId: null,
                    currentEmail: '',
                    currentName: null,
                  });
                  setEditUserName('');
                  setEditUserError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="edit-email"
                  value={editUserModal.currentEmail}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                  disabled
                />
                <p className="mt-1 text-xs text-gray-500">
                  Email cannot be changed
                </p>
              </div>

              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  id="edit-name"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Smith"
                />
                {editUserModal.currentName && (
                  <p className="mt-1 text-xs text-gray-500">
                    Current: {editUserModal.currentName}
                  </p>
                )}
              </div>

              {editUserError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{editUserError}</p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditUserModal({
                      isOpen: false,
                      userId: null,
                      currentEmail: '',
                      currentName: null,
                    });
                    setEditUserName('');
                    setEditUserError('');
                  }}
                  disabled={editUserLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editUserLoading}
                  className="flex-1"
                >
                  {editUserLoading ? 'Updating...' : 'Update User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
