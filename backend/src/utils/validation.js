const Joi = require('joi');

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validate UUID format
function isValidUUID(uuid) {
  return UUID_REGEX.test(uuid);
}

// Middleware to validate UUID parameters
function validateUUIDParam(paramName = 'id') {
  return (req, res, next) => {
    const uuid = req.params[paramName];
    if (!isValidUUID(uuid)) {
      return res.status(400).json({ error: `Invalid ${paramName} format` });
    }
    next();
  };
}

// Common Joi schemas
const commonSchemas = {
  uuid: Joi.string().uuid().required(),
  optionalUuid: Joi.string().uuid().optional(),
  periodCode: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
  positiveNumber: Joi.number().positive().required(),
  nonNegativeNumber: Joi.number().min(0).required(),
  optionalString: Joi.string().allow('').optional(),
  requiredString: Joi.string().min(1).required(),
  boolean: Joi.boolean().default(true),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
};

// Validation error handler
function handleValidationError(error, res) {
  return res.status(400).json({ 
    error: error.details[0].message,
    field: error.details[0].path.join('.')
  });
}

module.exports = {
  isValidUUID,
  validateUUIDParam,
  commonSchemas,
  handleValidationError,
  UUID_REGEX
};
