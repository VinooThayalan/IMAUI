import { Shield, Menu, Check, X as XIcon, Search, ChevronDown, ChevronRight, Save, AlertCircle, CheckCircle } from 'lucide-react';
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

interface MenuItem {
  id: string;
  menu_name: string;
  label: string;
  section: string;
  sort_order: number;
}

interface UserMenuAccess {
  id: string;
  user_id: string;
  menu_item_id: string;
}

export function MenuAccess() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [userMenuAccess, setUserMenuAccess] = useState<UserMenuAccess[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadUserMenuAccess(selectedUserId);
    }
  }, [selectedUserId]);

  async function loadData() {
    try {
      setLoading(true);
      const [usersResult, menuResult] = await Promise.all([
        supabase.from('app_users').select('*').eq('role', 'user').order('full_name'),
        supabase.from('menu_items').select('*').eq('is_active', true).order('sort_order'),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (menuResult.error) throw menuResult.error;

      setUsers(usersResult.data || []);
      setMenuItems(menuResult.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserMenuAccess(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_menu_access')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      setUserMenuAccess(data || []);
      setPendingChanges(new Set((data || []).map(a => a.menu_item_id)));
    } catch (err: any) {
      setError(err.message);
    }
  }

  function toggleMenuItem(menuItemId: string) {
    setPendingChanges(prev => {
      const next = new Set(prev);
      if (next.has(menuItemId)) {
        next.delete(menuItemId);
      } else {
        next.add(menuItemId);
      }
      return next;
    });
  }

  function selectAll() {
    setPendingChanges(new Set(menuItems.map(m => m.id)));
  }

  function deselectAll() {
    setPendingChanges(new Set());
  }

  function toggleSection(section: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!selectedUserId) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const { error: deleteError } = await supabase
        .from('user_menu_access')
        .delete()
        .eq('user_id', selectedUserId);

      if (deleteError) throw deleteError;

      if (pendingChanges.size > 0) {
        const inserts = Array.from(pendingChanges).map(menuItemId => ({
          user_id: selectedUserId,
          menu_item_id: menuItemId,
        }));

        const { error: insertError } = await supabase
          .from('user_menu_access')
          .insert(inserts);

        if (insertError) throw insertError;
      }

      await loadUserMenuAccess(selectedUserId);
      setSuccessMessage('Menu access saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSaving(false);
    }
  }

  const sections = Array.from(new Set(menuItems.map(m => m.section)));
  const menuBySection = sections.map(section => ({
    section,
    items: menuItems.filter(m => m.section === section),
  }));

  const filteredUsers = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedUser = users.find(u => u.id === selectedUserId);

  const hasUnsavedChanges = (() => {
    if (!selectedUserId) return false;
    const currentIds = new Set(userMenuAccess.map(a => a.menu_item_id));
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
        <h1 className="text-3xl font-bold text-gray-900">Menu Access Management</h1>
        <p className="text-gray-600 mt-1">Control which menu items each user can see</p>
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  No regular users found. Admin users have access to all menus by default.
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
              <Menu className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700">Select a User</h3>
              <p className="text-gray-500 mt-2">Choose a user from the left panel to manage their menu access</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedUser?.full_name || selectedUser?.email}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedUser?.email}</p>
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

              <div className="p-4 space-y-4">
                {menuBySection.map(({ section, items }) => (
                  <div key={section} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection(section)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        {collapsedSections.has(section) ? (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="text-sm font-bold text-gray-700">{section}</span>
                        <span className="text-xs text-gray-500">
                          ({items.filter(i => pendingChanges.has(i.id)).length}/{items.length})
                        </span>
                      </div>
                    </button>
                    {!collapsedSections.has(section) && (
                      <div className="divide-y divide-gray-100">
                        {items.map(item => (
                          <label
                            key={item.id}
                            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                pendingChanges.has(item.id)
                                  ? 'bg-[#3e5a7d] border-[#3e5a7d]'
                                  : 'border-gray-300'
                              }`}>
                                {pendingChanges.has(item.id) && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-sm text-gray-800">{item.label}</span>
                            </div>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={pendingChanges.has(item.id)}
                              onChange={() => toggleMenuItem(item.id)}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
