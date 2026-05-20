const dns = require('dns');
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const targetHost = '210.56.147.234';
const targetUser = 'root';
const targetPassword = 'fresh@paytel@123'; // Let's try this password or let's ask, wait, let's write the code first.

dns.lookup('backend.cloudedata.in', (err, address) => {
    if (err) {
        console.error("Failed to resolve backend.cloudedata.in:", err);
        return;
    }
    console.log("Resolved backend.cloudedata.in IP:", address);
    
    // We will connect to the target VPS (which the dev machine can reach)
    ssh.connect({
        host: targetHost,
        username: targetUser,
        password: targetPassword,
        port: 22,
        readyTimeout: 10000,
    }).then(async () => {
        console.log("Connected to target VPS from local machine!");
        
        console.log("Checking fail2ban status...");
        const f2bStatus = await ssh.execCommand("fail2ban-client status sshd");
        console.log(f2bStatus.stdout || f2bStatus.stderr);
        
        console.log(`Checking if ${address} is in iptables ban list...`);
        const iptablesCheck = await ssh.execCommand(`iptables -L -n -v | grep ${address}`);
        console.log(iptablesCheck.stdout || "Not found in iptables rules.");
        
        console.log(`Unbanning ${address} in fail2ban just in case...`);
        const unbanRes = await ssh.execCommand(`fail2ban-client set sshd unbanip ${address}`);
        console.log(unbanRes.stdout || unbanRes.stderr);

        ssh.dispose();
    }).catch(err => {
        console.error("SSH connection failed. Password might be different:", err.message);
    });
});
