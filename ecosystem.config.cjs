module.exports = {
  apps: [
    {
      name: 'kghub',
      script: 'node_modules/.bin/next',
      args: 'start -p 4000',
      cwd: '/opt/kghub/app',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
