import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { 
  Zap, Link2, LinkIcon, Unlink, CheckCircle, XCircle, AlertCircle,
  Settings, RefreshCw, Copy, ChevronDown, ChevronUp, X, Eye, EyeOff,
  Activity, Clock
} from 'lucide-react-native';
import { useGaapIntegration } from '@/hooks/useGaapIntegration';
import * as Clipboard from 'expo-clipboard';

interface AdminGaapProps {
  stores: { id: string; name: string; address: string }[];
}

export function AdminGaap({ stores }: AdminGaapProps) {
  const {
    stats, statsLoading, fetchStats,
    syncLog, syncLogLoading, fetchSyncLog,
    configs, configsLoading, fetchConfigs,
    saveConfig, removeConfig,
    webhookUrl,
  } = useGaapIntegration();

  const [activeSection, setActiveSection] = useState<'overview' | 'sync' | 'config'>('overview');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [configApiKey, setConfigApiKey] = useState('');
  const [configWebhookSecret, setConfigWebhookSecret] = useState('');
  const [configGaapStoreId, setConfigGaapStoreId] = useState('');
  const [configEnv, setConfigEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [configActive, setConfigActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [syncFilter, setSyncFilter] = useState<string>('');

  useEffect(() => {
    fetchStats();
    fetchSyncLog();
    fetchConfigs();
  }, []);

  const handleCopyWebhookUrl = async () => {
    await Clipboard.setStringAsync(webhookUrl);
    Alert.alert('Copied!', 'Webhook URL copied to clipboard. Register this URL with GAAP.');
  };

  const handleSaveConfig = async () => {
    if (!selectedStoreId) {
      Alert.alert('Error', 'Please select a store.');
      return;
    }
    setSaving(true);
    const result = await saveConfig(selectedStoreId, {
      api_key: configApiKey || undefined,
      webhook_secret: configWebhookSecret || undefined,
      environment: configEnv,
      is_active: configActive,
      gaap_store_id: configGaapStoreId || undefined,
    });
    setSaving(false);

    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      Alert.alert('Success', 'GAAP configuration saved!');
      setShowConfigModal(false);
      resetConfigForm();
    }
  };

  const handleDeleteConfig = (storeId: string, storeName: string) => {
    Alert.alert(
      'Remove GAAP Config',
      `Remove GAAP integration for "${storeName}"? This will stop syncing POS transactions for this store.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeConfig(storeId);
            if (result.error) Alert.alert('Error', result.error);
          },
        },
      ]
    );
  };

  const handleEditConfig = (config: any) => {
    setSelectedStoreId(config.store_id);
    setConfigApiKey(config.api_key || '');
    setConfigWebhookSecret(config.webhook_secret || '');
    setConfigGaapStoreId(config.config_metadata?.gaap_store_id || '');
    setConfigEnv(config.environment);
    setConfigActive(config.is_active);
    setShowConfigModal(true);
  };

  const resetConfigForm = () => {
    setSelectedStoreId('');
    setConfigApiKey('');
    setConfigWebhookSecret('');
    setConfigGaapStoreId('');
    setConfigEnv('sandbox');
    setConfigActive(false);
    setShowApiKey(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle, color: '#10b981' };
      case 'failed': return { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, color: '#ef4444' };
      case 'unmatched': return { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertCircle, color: '#f59e0b' };
      case 'duplicate': return { bg: 'bg-gray-100', text: 'text-gray-600', icon: RefreshCw, color: '#6b7280' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600', icon: AlertCircle, color: '#6b7280' };
    }
  };

  const sections = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'sync', label: 'Sync Log', icon: RefreshCw },
    { key: 'config', label: 'Config', icon: Settings },
  ] as const;

  return (
    <View className="gap-4">
      <View className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
        <Text className="font-bold text-amber-900">Automatic GAAP ingestion is unavailable</Text>
        <Text className="text-amber-900 mt-2">The legacy processor is disabled while the ledger integration is verified. For app orders, use branch fulfilment to record the full GAAP sale or credit note reference. Configuration changes here do not enable automatic points.</Text>
      </View>
      {/* Section Tabs */}
      <View className="flex-row bg-white p-1 rounded-xl border border-gray-100">
        {sections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <TouchableOpacity
              key={section.key}
              onPress={() => setActiveSection(section.key)}
              className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg ${
                activeSection === section.key ? 'bg-blue-600' : ''
              }`}
            >
              <SectionIcon size={14} color={activeSection === section.key ? '#fff' : '#6b7280'} />
              <Text className={`text-xs font-semibold ${
                activeSection === section.key ? 'text-white' : 'text-gray-500'
              }`}>
                {section.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Webhook URL Banner */}
      <TouchableOpacity
        onPress={handleCopyWebhookUrl}
        className="bg-blue-50 rounded-xl p-4 border border-blue-200 flex-row items-center"
        activeOpacity={0.7}
      >
        <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
          <Zap size={20} color="#2563eb" />
        </View>
        <View className="flex-1 mr-2">
          <Text className="text-blue-800 font-bold text-sm">Webhook URL</Text>
          <Text className="text-blue-600 text-xs mt-0.5" numberOfLines={1}>{webhookUrl}</Text>
        </View>
        <Copy size={18} color="#2563eb" />
      </TouchableOpacity>

      {/* ─── Overview Section ─── */}
      {activeSection === 'overview' && (
        <View className="gap-3">
          {statsLoading ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : stats ? (
            <>
              {/* Stats Grid */}
              <View className="flex-row gap-3">
                <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
                  <View className="flex-row items-center gap-2 mb-2">
                    <CheckCircle size={14} color="#10b981" />
                    <Text className="text-gray-500 text-xs font-medium">Synced</Text>
                  </View>
                  <Text className="text-2xl font-bold text-gray-900">{stats.totalSynced}</Text>
                </View>
                <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
                  <View className="flex-row items-center gap-2 mb-2">
                    <XCircle size={14} color="#ef4444" />
                    <Text className="text-gray-500 text-xs font-medium">Failed</Text>
                  </View>
                  <Text className="text-2xl font-bold text-red-600">{stats.totalFailed}</Text>
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
                  <View className="flex-row items-center gap-2 mb-2">
                    <AlertCircle size={14} color="#f59e0b" />
                    <Text className="text-gray-500 text-xs font-medium">Unmatched</Text>
                  </View>
                  <Text className="text-2xl font-bold text-amber-600">{stats.totalUnmatched}</Text>
                </View>
                <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Link2 size={14} color="#2563eb" />
                    <Text className="text-gray-500 text-xs font-medium">Linked Users</Text>
                  </View>
                  <Text className="text-2xl font-bold text-blue-600">{stats.linkedCustomers}</Text>
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Zap size={14} color="#a855f7" />
                    <Text className="text-gray-500 text-xs font-medium">Points Awarded</Text>
                  </View>
                  <Text className="text-2xl font-bold text-purple-600">{stats.totalPointsAwarded.toLocaleString()}</Text>
                </View>
                <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Clock size={14} color="#6b7280" />
                    <Text className="text-gray-500 text-xs font-medium">Last Webhook</Text>
                  </View>
                  <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                    {stats.lastWebhookAt 
                      ? new Date(stats.lastWebhookAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Never'
                    }
                  </Text>
                </View>
              </View>

              {/* Integration Status */}
              <View className="bg-white rounded-2xl p-4 border border-gray-100">
                <Text className="font-bold text-gray-900 mb-3">Integration Status</Text>
                <View className="flex-row items-center gap-3 mb-2">
                  <View className={`w-3 h-3 rounded-full ${configs.some(c => c.is_active) ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <Text className="text-gray-700 font-medium">
                    {configs.some(c => c.is_active) ? 'Active' : 'Not Active'} — {configs.filter(c => c.is_active).length} store(s) connected
                  </Text>
                </View>
                <Text className="text-gray-500 text-xs">
                  Register the webhook URL above with GAAP to start receiving POS transactions automatically.
                </Text>
              </View>
            </>
          ) : (
            <Text className="text-center text-gray-500 py-8">Unable to load stats</Text>
          )}
        </View>
      )}

      {/* ─── Sync Log Section ─── */}
      {activeSection === 'sync' && (
        <View className="gap-3">
          {/* Filter Row */}
          <View className="flex-row gap-2">
            {['', 'success', 'failed', 'unmatched'].map(status => (
              <TouchableOpacity
                key={status}
                onPress={() => {
                  setSyncFilter(status);
                  fetchSyncLog({ status: status || undefined });
                }}
                className={`px-3 py-1.5 rounded-full border ${
                  syncFilter === status ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                }`}
              >
                <Text className={`text-xs font-semibold capitalize ${
                  syncFilter === status ? 'text-white' : 'text-gray-600'
                }`}>
                  {status || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Refresh */}
          <TouchableOpacity
            onPress={() => fetchSyncLog({ status: syncFilter || undefined })}
            className="flex-row items-center justify-center gap-2 bg-white rounded-xl py-2 border border-gray-100"
          >
            <RefreshCw size={14} color="#6b7280" />
            <Text className="text-gray-600 text-xs font-semibold">Refresh Log</Text>
          </TouchableOpacity>

          {syncLogLoading ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : syncLog.length > 0 ? (
            syncLog.map(entry => {
              const statusStyle = getStatusColor(entry.sync_status);
              const StatusIcon = statusStyle.icon;
              const isExpanded = expandedLogId === entry.id;

              return (
                <TouchableOpacity
                  key={entry.id}
                  onPress={() => setExpandedLogId(isExpanded ? null : entry.id)}
                  className="bg-white rounded-xl p-4 border border-gray-100"
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3 flex-1">
                      <View className={`w-8 h-8 rounded-full items-center justify-center ${statusStyle.bg}`}>
                        <StatusIcon size={16} color={statusStyle.color} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-gray-800 text-sm" numberOfLines={1}>
                          {entry.gaap_transaction_id}
                        </Text>
                        <Text className="text-gray-400 text-xs mt-0.5">
                          {new Date(entry.synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end gap-1">
                      {entry.points_awarded > 0 && (
                        <Text className="font-bold text-emerald-600 text-sm">+{entry.points_awarded} pts</Text>
                      )}
                      <View className={`px-2 py-0.5 rounded-full ${statusStyle.bg}`}>
                        <Text className={`text-xs font-semibold capitalize ${statusStyle.text}`}>{entry.sync_status}</Text>
                      </View>
                    </View>
                  </View>

                  {isExpanded && (
                    <View className="mt-3 pt-3 border-t border-gray-100">
                      {entry.gaap_receipt_number && (
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-xs text-gray-500">Receipt</Text>
                          <Text className="text-xs font-medium text-gray-700">{entry.gaap_receipt_number}</Text>
                        </View>
                      )}
                      {entry.transaction_amount != null && (
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-xs text-gray-500">Amount</Text>
                          <Text className="text-xs font-medium text-gray-700">R{Number(entry.transaction_amount).toFixed(2)}</Text>
                        </View>
                      )}
                      {entry.error_message && (
                        <View className="bg-red-50 rounded-lg p-2 mt-1">
                          <Text className="text-xs text-red-600">{entry.error_message}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <View className="bg-white rounded-2xl py-12 items-center border border-gray-100">
              <RefreshCw size={32} color="#cbd5e1" />
              <Text className="text-gray-500 font-medium mt-3">No sync entries yet</Text>
              <Text className="text-gray-400 text-xs mt-1">Transactions will appear here when GAAP sends them.</Text>
            </View>
          )}
        </View>
      )}

      {/* ─── Config Section ─── */}
      {activeSection === 'config' && (
        <View className="gap-3">
          <TouchableOpacity
            onPress={() => {
              resetConfigForm();
              setShowConfigModal(true);
            }}
            className="bg-blue-600 rounded-xl py-3 px-4 flex-row items-center justify-center gap-2"
          >
            <LinkIcon size={18} color="white" />
            <Text className="text-white font-bold">Connect Store to GAAP</Text>
          </TouchableOpacity>

          {configsLoading ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : configs.length > 0 ? (
            configs.map(config => {
              const store = stores.find(s => s.id === config.store_id);
              return (
                <View key={config.id} className="bg-white rounded-xl p-4 border border-gray-100">
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <Text className="font-bold text-gray-900">{store?.name || 'Unknown Store'}</Text>
                      <Text className="text-xs text-gray-500 mt-0.5">{store?.address}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View className={`px-2 py-1 rounded-full ${config.is_active ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                        <Text className={`text-xs font-bold ${config.is_active ? 'text-emerald-700' : 'text-gray-500'}`}>
                          {config.is_active ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                      <View className={`px-2 py-1 rounded-full ${config.environment === 'production' ? 'bg-red-100' : 'bg-blue-100'}`}>
                        <Text className={`text-xs font-bold ${config.environment === 'production' ? 'text-red-700' : 'text-blue-700'}`}>
                          {config.environment}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {config.config_metadata?.gaap_store_id && (
                    <View className="flex-row items-center mb-2">
                      <Text className="text-xs text-gray-500 mr-1">GAAP Store ID:</Text>
                      <Text className="text-xs font-mono text-gray-700">{config.config_metadata.gaap_store_id}</Text>
                    </View>
                  )}

                  {config.last_sync_error && (
                    <View className="bg-red-50 rounded-lg p-2 mb-3">
                      <Text className="text-xs text-red-600">Last error: {config.last_sync_error}</Text>
                    </View>
                  )}

                  <View className="flex-row gap-2 mt-1">
                    <TouchableOpacity
                      onPress={() => handleEditConfig(config)}
                      className="flex-1 py-2 rounded-lg items-center bg-blue-50 border border-blue-200"
                    >
                      <Text className="text-blue-600 font-medium text-sm">Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteConfig(config.store_id!, store?.name || 'this store')}
                      className="flex-1 py-2 rounded-lg items-center bg-red-50 border border-red-200"
                    >
                      <Text className="text-red-600 font-medium text-sm">Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <View className="bg-white rounded-2xl py-12 items-center border border-gray-100">
              <Settings size={32} color="#cbd5e1" />
              <Text className="text-gray-500 font-medium mt-3">No stores connected</Text>
              <Text className="text-gray-400 text-xs mt-1 text-center px-8">
                Connect a store to GAAP POS to start syncing transactions automatically.
              </Text>
            </View>
          )}

          {/* Help Card */}
          <View className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <Text className="font-bold text-amber-800 mb-1">Setup Guide</Text>
            <Text className="text-amber-700 text-xs leading-5">
              1. Contact GAAP at 0861 745 260 to get API credentials{'\n'}
              2. Enter your API key and webhook secret above{'\n'}
              3. Ask GAAP to register your webhook URL{'\n'}
              4. Set the environment to "sandbox" first to test{'\n'}
              5. Once verified, switch to "production"
            </Text>
          </View>
        </View>
      )}

      {/* ─── Config Modal ─── */}
      <Modal visible={showConfigModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">GAAP Store Config</Text>
              <TouchableOpacity onPress={() => setShowConfigModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Store Selector */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Select Store *</Text>
                {stores.map(store => (
                  <TouchableOpacity
                    key={store.id}
                    onPress={() => setSelectedStoreId(store.id)}
                    className={`px-4 py-3 rounded-xl mb-2 border ${
                      selectedStoreId === store.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Text className={`font-medium ${selectedStoreId === store.id ? 'text-blue-700' : 'text-gray-700'}`}>
                      {store.name}
                    </Text>
                    <Text className="text-xs text-gray-500">{store.address}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* GAAP Store ID */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">GAAP Store ID</Text>
                <TextInput
                  value={configGaapStoreId}
                  onChangeText={setConfigGaapStoreId}
                  placeholder="e.g. GAAP-STORE-001"
                  className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                />
                <Text className="text-xs text-gray-400 mt-1">The store identifier in GAAP's system</Text>
              </View>

              {/* API Key */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">API Key</Text>
                <View className="flex-row items-center">
                  <TextInput
                    value={configApiKey}
                    onChangeText={setConfigApiKey}
                    placeholder="Enter GAAP API key"
                    secureTextEntry={!showApiKey}
                    className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowApiKey(!showApiKey)}
                    className="ml-2 p-2"
                  >
                    {showApiKey ? <EyeOff size={20} color="#6b7280" /> : <Eye size={20} color="#6b7280" />}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Webhook Secret */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">Webhook Secret</Text>
                <TextInput
                  value={configWebhookSecret}
                  onChangeText={setConfigWebhookSecret}
                  placeholder="Shared secret for signature verification"
                  secureTextEntry
                  className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                />
              </View>

              {/* Environment */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Environment</Text>
                <View className="flex-row gap-2">
                  {(['sandbox', 'production'] as const).map(env => (
                    <TouchableOpacity
                      key={env}
                      onPress={() => setConfigEnv(env)}
                      className={`flex-1 py-2.5 rounded-xl items-center border ${
                        configEnv === env
                          ? env === 'production' ? 'bg-red-600 border-red-600' : 'bg-blue-600 border-blue-600'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <Text className={`font-medium capitalize ${configEnv === env ? 'text-white' : 'text-gray-600'}`}>
                        {env}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Active Toggle */}
              <TouchableOpacity
                onPress={() => setConfigActive(!configActive)}
                className={`flex-row items-center justify-between p-4 rounded-xl border mb-4 ${
                  configActive ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <View>
                  <Text className="font-medium text-gray-900">Integration Active</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    {configActive ? 'Webhook will process incoming transactions' : 'Webhook will ignore transactions from this store'}
                  </Text>
                </View>
                <View className={`w-6 h-6 rounded-full items-center justify-center ${configActive ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                  {configActive && <CheckCircle size={16} color="#fff" />}
                </View>
              </TouchableOpacity>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSaveConfig}
                disabled={saving}
                className="bg-blue-600 rounded-xl py-3.5 items-center mt-2 mb-8"
              >
                <Text className="text-white font-bold text-base">
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
