import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  ScrollView,
} from 'react-native';
import { photoService, projectService } from '../services/api';
import { Project, Photo } from '../types/index';

interface PhotoUploadScreenProps {
  onSuccess: () => void;
  onGoBack: () => void;
}

export default function PhotoUploadScreen({
  onSuccess,
  onGoBack,
}: PhotoUploadScreenProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await projectService.getProjects();
      setProjects(response.data);
      if (response.data.length > 0) {
        setSelectedProject(response.data[0].id);
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to load projects'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPhoto = async () => {
    if (!selectedProject) {
      Alert.alert('Error', 'Please select a project');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('project_id', selectedProject);
      if (caption) {
        formData.append('caption', caption);
      }
      // In a real app, you would append actual image data here
      // For now, this is a placeholder for the photo upload structure

      const response = await photoService.uploadPhoto(formData);

      if (response.data.id) {
        Alert.alert('Success', 'Photo uploaded successfully');
        setCaption('');
        onSuccess();
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to upload photo'
      );
    } finally {
      setUploading(false);
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onGoBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Photo</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Select Project</Text>
        <View style={styles.projectSelector}>
          {projects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={[
                styles.projectOption,
                selectedProject === project.id &&
                  styles.projectOptionSelected,
              ]}
              onPress={() => setSelectedProject(project.id)}
            >
              <Text
                style={[
                  styles.projectOptionText,
                  selectedProject === project.id &&
                    styles.projectOptionTextSelected,
                ]}
              >
                {project.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Photo Caption</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter photo caption (optional)"
          value={caption}
          onChangeText={setCaption}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.uploadButton, uploading && styles.buttonDisabled]}
          onPress={handleUploadPhoto}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.uploadButtonText}>Upload Photo</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Note: Photo selection from camera/gallery will be integrated with
          react-native-image-picker in the next update.
        </Text>
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
    marginRight: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  form: {
    padding: 16,
    backgroundColor: '#fff',
    margin: 8,
    borderRadius: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  projectSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  projectOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  projectOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  projectOptionText: {
    fontSize: 14,
    color: '#333',
  },
  projectOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
    textAlignVertical: 'top',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#999',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
