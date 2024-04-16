const express = require('express');
const router = express.Router();

const authController = require('../app/controllers/auth.controller');
const validationMiddlewares = require('../middlewares/validation.middleware');

router.post('/register', validationMiddlewares.signup, authController.register);
router.post('/login', validationMiddlewares.signin, authController.login);

module.exports = router;
