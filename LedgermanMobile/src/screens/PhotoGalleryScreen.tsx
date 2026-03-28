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
  Image,
  Dimensions,
} from 'react-native';
import { photoService } from '../services/api';
import { Photo } from '../types/index';

interface PhotoGalleryScreenProps {
  onGoBack: () => void;
}

export default function PhotoGalleryScreen({ onGoBack }: PhotoGalleryScreenProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const response = await photoService.getPhotos();
      setPhotos(response.data);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to load photos'
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPhotos();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (selectedPhoto) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedPhoto(null)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Photo</Text>
        </View>

        <View style={styles.detailContainer}>
          <Image
            source={{ uri: selectedPhoto.url }}
            style={styles.fullImage}
            resizeMode="contain"
          />
          {selectedPhoto.caption && (
            <View style={styles.captionContainer}>
              <Text style={styles.captionLabel}>Caption</Text>
              <Text style={styles.captionText}>{selectedPhoto.caption}</Text>
            </View>
          )}
          <View style={styles.metaContainer}>
            <Text style={styles.metaLabel}>Uploaded</Text>
            <Text style={styles.metaValue}>
              {new Date(selectedPhoto.uploaded_at).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const numColumns = 2;
  const windowWidth = Dimensions.get('window').width;
  const imageSize = (windowWidth - 24) / numColumns;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onGoBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Photo Gallery</Text>
      </View>

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.photoTile, { width: imageSize, height: imageSize }]}
            onPress={() => setSelectedPhoto(item)}
          >
            <Image
              source={{ uri: item.url }}
              style={styles.photoImage}
              resizeMode="cover"
            />
            {item.caption && (
              <View style={styles.photoCaption}>
                <Text style={styles.photoCaptionText} numberOfLines={1}>
                  {item.caption}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No photos found</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
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
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  photoTile: {
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  photoImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  photoCaption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  photoCaptionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  fullImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 16,
  },
  captionContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  captionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  captionText: {
    fontSize: 14,
    color: '#333',
  },
  metaContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    color: '#333',
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
