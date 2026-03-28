import React, { useState, useCallback } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { photoService, projectService, PhotoUploadRequest } from '../services/api';
import { imageToBase64, createThumbnail, getImageFilename, formatBytes, getBase64Size } from '../utils/imageUtils';
import { Project, Photo } from '../types/index';

interface PhotoUploadScreenProps {
  onSuccess: () => void;
  onGoBack: () => void;
  workerId?: string;
}

export default function PhotoUploadScreen({
  onSuccess,
  onGoBack,
  workerId,
}: PhotoUploadScreenProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<{ uri: string; filename: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageSize, setImageSize] = useState<string>('');

  React.useEffect(() => {
    loadProjects();
    requestCameraPermissions();
  }, []);

  const requestCameraPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert('Permission Required', 'Camera and library access is required to upload photos.');
    }
  };

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

  const handlePickImage = async (source: 'camera' | 'library') => {
    try {
      let result;

      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const base64 = await imageToBase64(asset.uri);
        const size = getBase64Size(base64);

        setSelectedImage({
          uri: asset.uri,
          filename: getImageFilename(asset.uri),
        });
        setImageSize(formatBytes(size));
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to select image. ' + error.message);
    }
  };

  const handleUploadPhoto = async () => {
    if (!selectedProject) {
      Alert.alert('Error', 'Please select a project');
      return;
    }

    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image');
      return;
    }

    setUploading(true);
    try {
      // Convert image to base64
      const blobB64 = await imageToBase64(selectedImage.uri);

      // Create thumbnail
      const thumbnail = await createThumbnail(selectedImage.uri);

      // Prepare upload data
      const uploadData: PhotoUploadRequest = {
        projectId: selectedProject,
        workerId: workerId || '',
        date: new Date().toISOString().split('T')[0],
        filename: selectedImage.filename,
        blobB64,
        thumbnailB64: thumbnail.base64,
      };

      // Upload to backend
      const response = await photoService.uploadPhoto(uploadData);

      if (response.data.id || response.status === 201) {
        Alert.alert('Success', 'Photo uploaded successfully');
        setCaption('');
        setSelectedImage(null);
        setImageSize('');
        onSuccess();
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || error.message || 'Failed to upload photo'
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

        <Text style={styles.label}>Select Photo</Text>
        <View style={styles.imagePickerButtons}>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => handlePickImage('camera')}
            disabled={uploading}
          >
            <Text style={styles.pickerButtonText}>📷 Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => handlePickImage('library')}
            disabled={uploading}
          >
            <Text style={styles.pickerButtonText}>🖼️ Gallery</Text>
          </TouchableOpacity>
        </View>

        {selectedImage && (
          <>
            <View style={styles.imagePreview}>
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.previewImage}
              />
              <View style={styles.imageInfo}>
                <Text style={styles.imageFilename}>{selectedImage.filename}</Text>
                <Text style={styles.imageSize}>{imageSize}</Text>
              </View>
            </View>

            <Text style={styles.label}>Photo Caption (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter photo caption"
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
          </>
        )}

        {!selectedImage && (
          <Text style={styles.helpText}>
            Tap "Camera" or "Gallery" to select a photo to upload.
          </Text>
        )}
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
  imagePickerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  imagePreview: {
    marginTop: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  imageInfo: {
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  imageFilename: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  imageSize: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
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
