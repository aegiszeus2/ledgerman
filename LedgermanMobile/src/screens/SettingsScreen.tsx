import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { workerService } from '../services/api';
import { Worker } from '../services/api';

interface SettingsScreenProps {
  worker: Worker | null;
  onGoBack: () => void;
  onLogout: () => void;
}

export default function SettingsScreen({
  worker,
  onGoBack,
  onLogout,
}: SettingsScreenProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [workerData, setWorkerData] = useState<Worker | null>(worker);
  const [editedWorker, setEditedWorker] = useState<Partial<Worker>>({});

  useEffect(() => {
    if (worker) {
      setWorkerData(worker);
      setEditedWorker(worker);
    }
  }, [worker]);

  const handleSave = async () => {
    if (!workerData) return;
    try {
      setSaving(true);
      const response = await workerService.updateWorker(
        workerData.id,
        editedWorker
      );
      setWorkerData(response.data);
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to update profile'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Logout',
        onPress: onLogout,
        style: 'destructive',
      },
    ]);
  };

  if (!workerData) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onGoBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        {!editing && (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={styles.editButton}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {editing ? (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={editedWorker.name || workerData.name}
                onChangeText={(text) =>
                  setEditedWorker({ ...editedWorker, name: text })
                }
                editable={!saving}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Company</Text>
              <Text style={styles.readOnlyValue}>{workerData.company}</Text>
            </View>

            {workerData.role && (
              <View style={styles.section}>
                <Text style={styles.label}>Role</Text>
                <TextInput
                  style={styles.input}
                  value={editedWorker.role || workerData.role || ''}
                  onChangeText={(text) =>
                    setEditedWorker({ ...editedWorker, role: text })
                  }
                  editable={!saving}
                />
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setEditing(false);
                  setEditedWorker(workerData);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{workerData.name}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Company</Text>
              <Text style={styles.value}>{workerData.company}</Text>
            </View>

            {workerData.role && (
              <View style={styles.section}>
                <Text style={styles.label}>Role</Text>
                <Text style={styles.value}>{workerData.role}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.label}>Worker ID</Text>
              <Text style={styles.value}>{workerData.id}</Text>
            </View>
          </>
        )}

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>App Version</Text>
          <Text style={styles.value}>1.0.0</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>API Endpoint</Text>
          <Text style={styles.value}>app.ledgerman.org/api</Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 16,
  },
  editButton: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: '#333',
  },
  readOnlyValue: {
    fontSize: 16,
    color: '#999',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
