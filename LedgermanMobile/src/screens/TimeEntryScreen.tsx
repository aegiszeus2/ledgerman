import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { timeService } from '../services/api';

interface TimeEntryScreenProps {
  onSuccess: () => void;
  onGoBack: () => void;
}

export default function TimeEntryScreen({
  onSuccess,
  onGoBack,
}: TimeEntryScreenProps) {
  const [hours, setHours] = useState('');
  const [project, setProject] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!hours.trim() || !project.trim()) {
      Alert.alert('Error', 'Please fill in hours and project');
      return;
    }

    setLoading(true);
    try {
      await timeService.createEntry({
        date: new Date().toISOString().split('T')[0],
        hours: parseFloat(hours),
        project: project.trim(),
        notes: notes.trim() || undefined,
      });

      Alert.alert('Success', 'Time entry logged');
      onSuccess();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to log time entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onGoBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Log Time</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Hours</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter hours"
          value={hours}
          onChangeText={setHours}
          keyboardType="decimal-pad"
          editable={!loading}
        />

        <Text style={styles.label}>Project</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter project name"
          value={project}
          onChangeText={setProject}
          editable={!loading}
        />

        <Text style={styles.label}>Notes (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Add notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log Time</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 16,
    paddingTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
