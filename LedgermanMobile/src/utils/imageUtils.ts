import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Convert image URI to base64 string
 */
export async function imageToBase64(imageUri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

/**
 * Create a thumbnail from an image URI
 */
export async function createThumbnail(
  imageUri: string,
  width: number = 150,
  height: number = 150
): Promise<{ uri: string; base64: string }> {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(imageUri, [
      { resize: { width, height } },
    ]);

    const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return {
      uri: manipResult.uri,
      base64,
    };
  } catch (error) {
    console.error('Error creating thumbnail:', error);
    throw error;
  }
}

/**
 * Extract filename from image URI
 */
export function getImageFilename(imageUri: string): string {
  try {
    const parts = imageUri.split('/');
    const filename = parts[parts.length - 1];
    return filename || 'image.jpg';
  } catch (error) {
    console.error('Error extracting filename:', error);
    return `image_${Date.now()}.jpg`;
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Calculate size of base64 string in bytes
 */
export function getBase64Size(base64String: string): number {
  // Base64 string size is approximately 4/3 of the original data
  // Formula: Math.ceil(length * 3 / 4)
  const padding = (base64String.match(/=/g) || []).length;
  return Math.ceil((base64String.length * 3) / 4) - padding;
}

/**
 * Validate image file size
 */
export function validateImageSize(
  base64String: string,
  maxSizeMB: number = 10
): boolean {
  const sizeInBytes = getBase64Size(base64String);
  const sizeInMB = sizeInBytes / (1024 * 1024);
  return sizeInMB <= maxSizeMB;
}
