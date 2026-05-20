const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({
  host: '210.56.147.234',
  username: 'root',
  password: 'paytel@123paytel', // The user entered this SSH password
  port: 22,
  readyTimeout: 30000,
}).then(async () => {
  console.log("Connected successfully! Checking Nginx error logs...");
  
  const resLogs = await ssh.execCommand("tail -n 50 /var/log/nginx/error.log");
  console.log("=== Nginx Error Logs ===");
  console.log(resLogs.stdout || resLogs.stderr || "No logs found.");
  
  const resPermissions = await ssh.execCommand("namei -l /var/www/frontend.cloudata.in/frontend/dist");
  console.log("=== Permissions ===");
  console.log(resPermissions.stdout || resPermissions.stderr);

  ssh.dispose();
}).catch(console.error);
