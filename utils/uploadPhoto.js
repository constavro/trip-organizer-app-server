// middleware/upload.js
const multer = require('multer');
const path = require('path');

// Using memory storage as files will be streamed to Azure Blob Storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    req.fileValidationError = 'Only image files (jpg, jpeg, png, gif) are allowed!';
    return cb(new Error('Only image files (jpg, jpeg, png, gif) are allowed!'), false);
  }
  cb(null, true);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Example: 5MB file size limit
});

module.exports = upload;