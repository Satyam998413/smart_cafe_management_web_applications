// Isolated from any real .env — tests never talk to the real JWT_SECRET,
// so a leaked test token can't be verified against production. Mirrors
// server/jest.setup.js.
process.env.JWT_SECRET = 'test-jwt-secret';
