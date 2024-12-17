// Utility: Send Error Response
const sendError = (res, status, message, error = '') =>
    res.status(status).json({ message, ...(error && { error }) });

module.exports = { sendError };