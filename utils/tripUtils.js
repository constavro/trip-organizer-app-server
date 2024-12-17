// Utility: Send Error Response
const sendError = (res, status, message, error = '') =>
    res.status(status).json({ message, ...(error && { error }) });
  
// Utility: Validate Pagination
const getPagination = (req) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    return { page, limit, skip: (page - 1) * limit };
  };

module.exports = { sendError, getPagination };