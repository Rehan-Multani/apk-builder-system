const { NodeSSH } = require('node-ssh');

async function check() {
    const ssh = new NodeSSH();
    try {
        await ssh.connect({
            host: '210.56.147.246',
            username: 'root',
            password: '@5V5@&28WZO2'
        });
        
        console.log('Connected to VPS!');
        
        const status = await ssh.execCommand('systemctl status mongod');
        console.log('--- MONGOD STATUS ---');
        console.log(status.stdout || status.stderr);
        
        const logs = await ssh.execCommand('journalctl -u mongod -n 50 --no-pager');
        console.log('--- MONGOD LOGS ---');
        console.log(logs.stdout || logs.stderr);

        const conf = await ssh.execCommand('cat /etc/mongod.conf');
        console.log('--- MONGOD CONF ---');
        console.log(conf.stdout || conf.stderr);

    } catch(err) {
        console.error(err);
    } finally {
        ssh.dispose();
    }
}

check();
