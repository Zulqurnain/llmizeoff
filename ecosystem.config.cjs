module.exports = {
  apps: [{
    name: "llmizeoff-server",
    script: "/root/llmizeoff-server/server.js",
    cwd: "/root/llmizeoff-server",
    exec_mode: "fork",
    instances: 1,
    uid: "webapp",
    gid: "webapp",
    env: { HOME: "/home/webapp", PORT: "8080", HOSTNAME: "127.0.0.1", NODE_ENV: "production" }
  }]
};
