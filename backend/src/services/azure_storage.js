const { BlobServiceClient } = require('@azure/storage-blob');
const crypto = require('crypto');

class AzureStorageService {
  constructor() {
    this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER || 'face-images';
    this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
  }

  async initializeContainer() {
    try {
      await this.containerClient.createIfNotExists();
      console.log('✅ Azure Storage container initialized');
    } catch (error) {
      console.log('⚠️ Azure Storage initialization failed:', error.message);
      console.log('🔄 Continuing without Azure Storage - local storage will be used');
      // Don't throw error - just log and continue
    }
  }

  async uploadFaceImage(studentId, imageBuffer, originalName) {
    try {
      // Generate unique filename
      const fileExtension = originalName.split('.').pop();
      const fileName = `faces/${studentId}/${crypto.randomUUID()}.${fileExtension}`;
      
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
      
      // Upload with metadata
      const metadata = {
        studentId: studentId.toString(),
        originalName: originalName,
        uploadedAt: new Date().toISOString(),
        contentType: 'image/jpeg'
      };

      await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
        metadata: metadata,
        blobHTTPHeaders: { blobContentType: 'image/jpeg' }
      });

      console.log(`✅ Face image uploaded for student ${studentId}: ${fileName}`);
      
      return {
        url: blockBlobClient.url,
        fileName: fileName,
        metadata: metadata
      };
    } catch (error) {
      console.error(`❌ Error uploading face image for student ${studentId}:`, error);
      throw error;
    }
  }

  async getFaceImage(studentId, fileName) {
    try {
      const blobClient = this.containerClient.getBlobClient(`faces/${studentId}/${fileName}`);
      
      const properties = await blobClient.getProperties();
      const downloadResponse = await blobClient.download();

      return {
        buffer: await streamToBuffer(downloadResponse.readableStreamBody),
        metadata: properties.metadata,
        contentType: properties.contentType
      };
    } catch (error) {
      console.error(`❌ Error retrieving face image for student ${studentId}:`, error);
      throw error;
    }
  }

  async listFaceImages(studentId) {
    try {
      const images = [];
      
      for await (const blob of this.containerClient.listBlobsFlat({
        prefix: `faces/${studentId}/`
      })) {
        images.push({
          name: blob.name,
          url: `${this.containerClient.url}/${blob.name}`,
          uploadedAt: blob.properties.lastModified,
          size: blob.properties.contentLength,
          metadata: blob.metadata
        });
      }

      return images;
    } catch (error) {
      console.error(`❌ Error listing face images for student ${studentId}:`, error);
      throw error;
    }
  }

  async deleteFaceImage(studentId, fileName) {
    try {
      const blobClient = this.containerClient.getBlobClient(`faces/${studentId}/${fileName}`);
      await blobClient.delete();
      
      console.log(`✅ Face image deleted for student ${studentId}: ${fileName}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting face image for student ${studentId}:`, error);
      throw error;
    }
  }

  async deleteAllFaceImages(studentId) {
    try {
      const images = await this.listFaceImages(studentId);
      const deletePromises = images.map(image => 
        this.deleteFaceImage(studentId, image.name.split('/').pop())
      );
      
      await Promise.all(deletePromises);
      console.log(`✅ All face images deleted for student ${studentId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting all face images for student ${studentId}:`, error);
      throw error;
    }
  }

  async uploadFaceEncoding(studentId, encodingData) {
    try {
      const fileName = `encodings/${studentId}.json`;
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
      
      const metadata = {
        studentId: studentId.toString(),
        uploadedAt: new Date().toISOString(),
        type: 'face-encoding'
      };

      const encodingJson = JSON.stringify(encodingData);
      await blockBlobClient.upload(encodingJson, encodingJson.length, {
        metadata: metadata,
        blobHTTPHeaders: { blobContentType: 'application/json' }
      });

      console.log(`✅ Face encoding uploaded for student ${studentId}`);
      
      return {
        url: blockBlobClient.url,
        fileName: fileName,
        metadata: metadata
      };
    } catch (error) {
      console.error(`❌ Error uploading face encoding for student ${studentId}:`, error);
      throw error;
    }
  }

  async getFaceEncoding(studentId) {
    try {
      const fileName = `encodings/${studentId}.json`;
      const blobClient = this.containerClient.getBlobClient(fileName);
      
      const downloadResponse = await blobClient.download();
      const buffer = await streamToBuffer(downloadResponse.readableStreamBody);
      
      return JSON.parse(buffer.toString());
    } catch (error) {
      console.error(`❌ Error retrieving face encoding for student ${studentId}:`, error);
      return null;
    }
  }

  async deleteFaceEncoding(studentId) {
    try {
      const fileName = `encodings/${studentId}.json`;
      const blobClient = this.containerClient.getBlobClient(fileName);
      await blobClient.delete();
      
      console.log(`✅ Face encoding deleted for student ${studentId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting face encoding for student ${studentId}:`, error);
      throw error;
    }
  }

  async getStorageStats() {
    try {
      const stats = {
        totalImages: 0,
        totalEncodings: 0,
        totalSize: 0,
        studentCounts: {}
      };

      for await (const blob of this.containerClient.listBlobsFlat()) {
        stats.totalSize += blob.properties.contentLength;
        
        if (blob.name.startsWith('faces/')) {
          stats.totalImages++;
          const parts = blob.name.split('/');
          const studentId = parts[1];
          stats.studentCounts[studentId] = (stats.studentCounts[studentId] || 0) + 1;
        } else if (blob.name.startsWith('encodings/')) {
          stats.totalEncodings++;
        }
      }

      return stats;
    } catch (error) {
      console.error('❌ Error getting storage stats:', error);
      throw error;
    }
  }
}

// Helper function to convert stream to buffer
async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

module.exports = new AzureStorageService();
