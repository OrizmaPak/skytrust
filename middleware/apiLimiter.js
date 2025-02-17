const { BadRequestError } = require('../errors');

const apiLimiter = (req, res, next) => {
  // if (req.user.apiLimiter) {
  //   throw new BadRequestError('Test User. Read Only');
  // }
  console.log('it ran through the middleware')
  next();
};

module.exports = apiLimiter;
