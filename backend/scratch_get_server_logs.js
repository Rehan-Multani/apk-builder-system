const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://mohammadrehan00121_db_user:B26NSBDyNU9qS6y4@ac-14bobaj-shard-00-00.1exhb3f.mongodb.net:27017,ac-14bobaj-shard-00-01.1exhb3f.mongodb.net:27017,ac-14bobaj-shard-00-02.1exhb3f.mongodb.net:27017/apkbuilder?ssl=true&replicaSet=atlas-h5gn4h-shard-0&authSource=admin&appName=Cluster0';

mongoose.connect(MONGO_URI).then(async () => {
    console.log("Connected to MongoDB!");
    const db = mongoose.connection.db;
    const servers = await db.collection('vpsservers').find().sort({ createdAt: -1 }).toArray();
    if (servers.length === 0) {
        console.log("No servers found!");
    } else {
        const latest = servers[0];
        console.log("Latest Server ID:", latest.serverId);
        console.log("=== Latest Server Logs ===");
        latest.logs.forEach(log => console.log(log));
    }
    mongoose.disconnect();
}).catch(console.error);
