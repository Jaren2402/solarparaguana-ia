module.exports = {
  apps: [
    {
      name: 'solarparaguana',
      script: './index.js',
      cwd: __dirname,
      watch: false,
      max_memory_restart: '1000M',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'development',
        PORT: 18512
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 18512
      },
      autorestart: true,
      max_restarts: 10,
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
