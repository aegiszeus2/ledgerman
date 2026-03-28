import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Pressable,
} from 'react-native';
import { taskService } from '../services/api';
import { Task } from '../types/index';

interface TasksScreenProps {
  onGoBack: () => void;
  onNavigate: (screen: string, params?: any) => void;
}

type FilterStatus = 'All' | 'Pending' | 'Active' | 'Done';

export default function TasksScreen({
  onGoBack,
  onNavigate,
}: TasksScreenProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    filterTasks(filterStatus);
  }, [tasks, filterStatus]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await taskService.getTasks();
      setTasks(response.data);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to load tasks'
      );
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = (status: FilterStatus) => {
    if (status === 'All') {
      setFilteredTasks(tasks);
    } else {
      const statusMap: Record<FilterStatus, string> = {
        'All': '',
        'Pending': 'todo',
        'Active': 'active',
        'Done': 'done',
      };
      setFilteredTasks(tasks.filter((t) => t.status === statusMap[status]));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
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
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onGoBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Tasks</Text>
      </View>

      <View style={styles.filterContainer}>
        {(['All', 'Pending', 'Active', 'Done'] as FilterStatus[]).map((status) => (
          <Pressable
            key={status}
            onPress={() => setFilterStatus(status)}
            style={[
              styles.filterButton,
              filterStatus === status && styles.filterButtonActive,
            ]}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === status && styles.filterButtonTextActive,
              ]}
            >
              {status}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.taskItem}
            onPress={() => onNavigate('TaskDetail', { taskId: item.id })}
          >
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(item.status) },
              ]}
            />
            <View style={styles.taskContent}>
              <Text style={styles.taskTitle}>{item.title}</Text>
              {item.description && (
                <Text style={styles.taskDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <View style={styles.taskMeta}>
                <Text style={styles.taskStatus}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
                {item.due_date && (
                  <Text style={styles.taskDueDate}>
                    Due: {new Date(item.due_date).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks found</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
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
    marginRight: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  taskItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskStatus: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  taskDueDate: {
    fontSize: 12,
    color: '#999',
  },
  arrow: {
    fontSize: 24,
    color: '#007AFF',
    marginLeft: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
