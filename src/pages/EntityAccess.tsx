import { Shield, MapPin, Check, Search, Save, AlertCircle, CheckCircle, Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AppUserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
}

interface EntityRow {
  id: string;
  entity_id: string | null;
  name: string;
  type: string;
  entity_types: { name: string } | null;
}

interface UserEntityAccess {
  id: string;
  user_id: string;
  entity_id: string;
}

export function EntityAccess() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [userEntityAccess, setUserEntityAccess] = useState<UserEntityAccess[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [entitySearchQuery, setEntitySearchQuery] = useState('');
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadUserEntityAccess(selectedUserId);
    }
  }, [selectedUserId]);

  async function loadData() {
    try {
      setLoading(true);
      const [usersResult, entitiesResult] = await Promise.all([
        supabase.from('app_users').select('*').eq('role', 'user').order('full_name'),
        supabase.from('entities').select('id, entity_id, name, type, entity_types(name)').order('entity_id'),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (entitiesResult.error) throw entitiesResult.error;

      setUsers(usersResult.data || []);
      setEntities(entitiesResult.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserEntityAccess(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_entity_access')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      setUserEntityAccess(data || []);
      setPendingChanges(new Set((data || []).map(a => a.entity_id)));
    } catch (err: any) {
      setError(err.message);
    }
  }

  function toggleEntity(entityId: string) {
    setPendingChanges(prev => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  }

  function selectAll() {
    setPendingChanges(new Set(entities.map(e => e.id)));
  }

  function deselectAll() {
    setPendingChanges(new Set());
  }

  async function handleSave() {
    if (!selectedUserId) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const { error: deleteError } = await supabase
        .from('user_entity_access')
        .delete()
        .eq('user_id', selectedUserId);

      if (deleteError) throw deleteError;

      if (pendingChanges.size > 0) {
        const inserts = Array.from(pendingChanges).map(entityId => ({
          user_id: selectedUserId,
          entity_id: entityId,
        }));

        const { error: insertError } = await supabase
          .from('user_entity_access')
          .insert(inserts);

        if (insertError) throw insertError;
      }

      await loadUserEntityAccess(selectedUserId);
      setSuccessMessage('Entity access saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSaving(false);
    }
  }

  const filteredUsers = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const filteredEntities = entities.filter(e =>
    e.name.toLowerCase().includes(entitySearchQuery.toLowerCase()) ||
    (e.entity_id || '').toLowerCase().includes(entitySearchQuery.toLowerCase())
  );

  const selectedUser = users.find(u => u.id === selectedUserId);

  const hasUnsavedChanges = (() => {
    if (!selectedUserId) return false;
    const currentIds = new Set(userEntityAccess.map(a => a.entity_id));
    if (currentIds.size !== pendingChanges.size) return true;
    for (const id of pendingChanges) {
      if (!currentIds.has(id)) return true;
    }
    return false;
  })();

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-gray-500 mt-2">You do not have permission to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Entity Access Management</h1>
        <p className="text-gray-600 mt-1">Control which entities each user can view and manage</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{successMessage}</span>
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Select User</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  No regular users found. Admin users have access to all entities by default.
                </div>
              ) : (
                filteredUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors border-b border-gray-100 last:border-b-0 ${
                      selectedUserId === u.id
                        ? 'bg-blue-50 border-l-2 border-l-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-xs font-semibold text-gray-700">
                      {(u.full_name || u.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.full_name || 'No name'}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    {!u.is_active && (
                      <span className="text-xs text-red-500 font-medium">Inactive</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex-1">
          {!selectedUserId ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700">Select a User</h3>
              <p className="text-gray-500 mt-2">Choose a user from the left panel to manage their entity access</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedUser?.full_name || selectedUser?.email}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {pendingChanges.size} of {entities.length} entities selected
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button onClick={deselectAll} className="text-xs text-gray-600 hover:text-gray-800 font-medium">
                    Deselect All
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasUnsavedChanges}
                    className="flex items-center space-x-2 px-4 py-2 bg-[#3e5a7d] text-white rounded-lg hover:bg-[#2d4562] transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search entities..."
                    value={entitySearchQuery}
                    onChange={(e) => setEntitySearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1 max-h-[calc(100vh-400px)] overflow-y-auto">
                  {filteredEntities.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No entities found</p>
                    </div>
                  ) : (
                    filteredEntities.map(entity => (
                      <label
                        key={entity.id}
                        className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-200"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            pendingChanges.has(entity.id)
                              ? 'bg-[#3e5a7d] border-[#3e5a7d]'
                              : 'border-gray-300'
                          }`}>
                            {pendingChanges.has(entity.id) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{entity.name}</p>
                            <p className="text-xs text-gray-500">
                              {entity.entity_id} - {entity.entity_types?.name || entity.type}
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={pendingChanges.has(entity.id)}
                          onChange={() => toggleEntity(entity.id)}
                        />
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
