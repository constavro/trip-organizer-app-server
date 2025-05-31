// utils/azureBlobService.js
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
const dotenv = require('dotenv');

dotenv.config();

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!AZURE_STORAGE_CONNECTION_STRING) {
  throw new Error("Azure Storage Connection string not found.");
}
const AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'user-photos'; // Default container name if not set

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(AZURE_STORAGE_CONTAINER_NAME);

// Ensure the container exists, create it if it doesn't
const createContainerIfNotExists = async () => {
  const exists = await containerClient.exists();
  if (!exists) {
    await containerClient.create({ access: 'blob' }); // 'blob' for anonymous read access to blobs
    console.log(`Container '${AZURE_STORAGE_CONTAINER_NAME}' created successfully with public blob access.`);
  }
};
// Call this function once when the service is initialized, or ensure container is pre-created.
createContainerIfNotExists().catch(console.error);


const uploadFileToBlob = async (fileBuffer, blobName, contentType) => {
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(fileBuffer, {
    blobHTTPHeaders: { blobContentType: contentType }
  });
  return blockBlobClient.url;
};

const deleteBlob = async (blobName) => {
  try {
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
    console.log(`Blob ${blobName} deleted successfully.`);
    return true;
  } catch (error) {
    console.error(`Error deleting blob ${blobName}:`, error.message);
    throw error; // Re-throw to be handled by the caller
  }
};

// Helper function to extract blob name from URL
const getBlobNameFromUrl = (blobUrl) => {
  if (!blobUrl) return null;
  try {
    const url = new URL(blobUrl);
    // The blob name is the path part after the container name.
    // e.g., https://<account>.blob.core.windows.net/<container>/<blobName>
    // The path will be /<container>/<blobName>
    // So we take the substring after /<container>/
    const pathSegments = url.pathname.split('/');
    // pathSegments will be ['', <containerName>, ...blobNameParts]
    if (pathSegments.length > 2) {
      return pathSegments.slice(2).join('/');
    }
    return null;
  } catch (error) {
    console.error("Error parsing blob URL to get blob name:", error);
    return null;
  }
};


module.exports = {
  uploadFileToBlob,
  deleteBlob,
  getBlobNameFromUrl,
  containerClient // Exporting for potential advanced use cases
};