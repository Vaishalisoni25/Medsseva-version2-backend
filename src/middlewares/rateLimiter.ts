// import rateLimit from 'express-rate-limit';

// export const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 200,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
// });

// export const strictLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000,
//   max: 30,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { error: 'Too many sensitive actions from this IP, please try again after an hour.' },
// });


import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number.MAX_SAFE_INTEGER,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => true, // Disable rate limiting
});

export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: Number.MAX_SAFE_INTEGER,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => true, // Disable rate limiting
});