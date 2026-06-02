/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'kghub.tor1.digitaloceanspaces.com', pathname: '/**' },
      { protocol: 'https', hostname: 'tor1.digitaloceanspaces.com', pathname: '/kghub/**' },
    ],
  },
};

export default nextConfig;
