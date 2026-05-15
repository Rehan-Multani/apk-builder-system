const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String },
    role: { type: String, default: 'user' },
    createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

const buildSchema = new mongoose.Schema({
    buildId: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    appName: { type: String, required: true },
    packageName: { type: String, required: true },
    versionName: { type: String },
    versionCode: { type: String },
    status: { type: String, default: 'queued' },
    progress: { type: Number, default: 0 },
    error: { type: String },
    apkUrl: { type: String },
    aabUrl: { type: String },
    jksUrl: { type: String },
    keyAlias: { type: String },
    keyPassword: { type: String },
    storePassword: { type: String },
    googleServicesPath: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Build = mongoose.model('Build', buildSchema);

module.exports = { User, Build };
