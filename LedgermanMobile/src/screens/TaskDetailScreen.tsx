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
  Pressable,
} from 'react-native';
import { taskService } from '../services/api';
import { Task } from '../types/index';

interface TaskDetailScreenProps {
  taskId: string;
  onGoBack: () => void;
}

export default function TaskDetailScreen({
  taskId,
  onGoBack,
}: TaskDetailScreenProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    try {
      setLoading(true);
      const response = await taskService.getTaskById(taskId);
      setTask(response.data);
      setEditedTask(response.data);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to load task'
      );
      onGoBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!task) return;
    try {
      setSaving(true);
      await taskService.updateTask(task.id, editedTask);
      setTask({ ...task, ...editedTask });
      setEditing(false);
      Alert.alert('Success', 'Task updated successfully');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to update task'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (status: string) => {
    setEditedTask({ ...editedTask, status });
  };

  const handleDelete = () => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            setSaving(true);
            await taskService.deleteTask(taskId);
            Alert.alert('Success', 'Task deleted successfully');
            onGoBack();
          } catch (error: any) {
            Alert.alert(
              'Error',
              error.response?.data?.message || 'Failed to delete task'
            );
          } finally {
            setSaving(false);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Task not found</Text>
      </View>
    );
  }

  const statusOptions = ['todo', 'active', 'done'];
  const currentStatus = editedTask.status || task.status;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onGoBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Details</Text>
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
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={editedTask.title || task.title}
                onChangeText={(text) =>
                  setEditedTask({ ...editedTask, title: text })
                }
                editable={!saving}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={editedTask.description || task.description || ''}
                onChangeText={(text) =>
                  setEditedTask({ ...editedTask, description: text })
                }
                multiline
                numberOfLines={4}
                editable={!saving}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusContainer}>
                {statusOptions.map((status) => (
                  <Pressable
                    key={status}
                    onPress={() => handleStatusChange(status)}
                    style={[
                      styles.statusButton,
                      currentStatus === status && styles.statusButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        currentStatus === status && styles.statusButtonTextActive,
                      ]}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Due Date</Text>
              <TextInput
                style={styles.input}
                value={editedTask.due_date || task.due_date || ''}
                onChangeText={(text) =>
                  setEditedTask({ ...editedTask, due_date: text })
                }
                placeholder="YYYY-MM-DD"
                editable={!saving}
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setEditing(false);
                  setEditedTask(task);
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
              <Text style={styles.label}>Title</Text>
              <Text style={styles.value}>{task.title}</Text>
            </View>

            {task.description && (
              <View style={styles.section}>
                <Text style={styles.label}>Description</Text>
                <Text style={styles.value}>{task.description}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.label}>Status</Text>
              <Text
                style={[
                  styles.value,
                  styles.statusBadge,
                  {
                    color: getStatusColor(task.status),
                  },
                ]}
              >
                {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
              </Text>
            </View>

            {task.due_date && (
              <View style={styles.section}>
                <Text style={styles.label}>Due Date</Text>
                <Text style={styles.value}>
                  {new Date(task.due_date).toLocaleDateString()}
                </Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.label}>Created</Text>
              <Text style={styles.value}>
                {new Date(task.created_at).toLocaleDateString()}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Text style={styles.deleteButtonText}>Delete Task</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'todo':
      return '#007AFF';
    case 'active':
      return '#FF9500';
    case 'done':
      return '#34C759';
    default:
      return '#999';
  }
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
  statusBadge: {
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#333',
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  statusButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  statusButtonTextActive: {
    color: '#fff',
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
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 24,
  },
});
