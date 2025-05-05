const { check } = require('express-validator')

exports.validateSignup = [
  check('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 50 })
    .withMessage("Name must be ≤50 charactersName must be "),

  check('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address'),

  check('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({min: 4})
    .withMessage('Password must be at least 4 characters')
]

exports.validateLogin = [
  check('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address'),

  check('password')
    .notEmpty()
    .withMessage('Password is required')
];
