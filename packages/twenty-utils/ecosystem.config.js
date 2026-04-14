'use strict';

const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../..');
const serverRoot = path.join(repositoryRoot, 'packages/twenty-server');
const frontRoot = path.join(repositoryRoot, 'packages/twenty-front');
const dotenvPath = path.join(serverRoot, '.env');

const serverEnv = {
  DOTENV_CONFIG_PATH: dotenvPath,
};

const serverApps = [
  {
    name: 'twenty-api',
    cwd: serverRoot,
    script: 'dist/main.js',
    interpreter: 'node',
    node_args: '-r dotenv/config',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 20,
    min_uptime: '10s',
    merge_logs: true,
    time: true,
    env: {
      ...serverEnv,
      NODE_ENV: 'development',
    },
    env_production: {
      ...serverEnv,
      NODE_ENV: 'production',
    },
  },
  {
    name: 'twenty-worker',
    cwd: serverRoot,
    script: 'dist/queue-worker/queue-worker.js',
    interpreter: 'node',
    node_args: '-r dotenv/config',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 20,
    min_uptime: '10s',
    merge_logs: true,
    time: true,
    env: {
      ...serverEnv,
      NODE_ENV: 'development',
    },
    env_production: {
      ...serverEnv,
      NODE_ENV: 'production',
    },
  },
];

const frontApp =
  process.env.TWENTY_PM2_NO_FRONT === '1'
    ? []
    : [
        {
          name: 'twenty-front',
          cwd: frontRoot,
          script: '/bin/sh',
          args: '-c "exec npx --yes serve@14 -s build -l tcp://127.0.0.1:3001"',
          instances: 1,
          exec_mode: 'fork',
          autorestart: true,
          max_restarts: 20,
          min_uptime: '10s',
          merge_logs: true,
          time: true,
          env: {
            NODE_ENV: 'development',
          },
          env_production: {
            NODE_ENV: 'production',
          },
        },
      ];

module.exports = {
  apps: [...serverApps, ...frontApp],
};
