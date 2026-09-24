/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@tensorflow/tfjs-node', '@mapbox/node-pre-gyp'],
};

export default nextConfig;
