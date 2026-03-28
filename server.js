const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const prefix = req.path.includes('signature') ? 'sig' : 'logo';
        cb(null, `${prefix}_${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Only JPG/PNG images are allowed!'));
    }
});

// MongoDB Connection with Auto-reconnection Logic
const connectDB = async () => {
    try {
        console.log('Attempting to connect to MongoDB...');
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`✅ [SUCCESS] MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`❌ [ERROR] MongoDB Connection Failed: ${err.message}`);
        console.log('Retrying connection in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

connectDB();

// Schemas
const ExamSchema = new mongoose.Schema({
    uniName: String,
    semester: String,
    centre: String,
    program: String,
    exams: [{
        subjectName: String,
        subjectCode: String,
        date: String,
        startTime: String,
        endTime: String,
        reportingTime: String
    }]
});

const ApplicationSchema = new mongoose.Schema({
    name: String,
    rollNumber: String,
    regNumber: { type: String, unique: true },
    mobileNumber: String,
    email: String,
    status: { type: String, default: 'pending' },
    appliedDate: { type: String, default: () => new Date().toLocaleString() }
});

const SettingsSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: mongoose.Schema.Types.Mixed
});

// Models
const Exam = mongoose.model('Exam', ExamSchema);
const Application = mongoose.model('Application', ApplicationSchema);
const Setting = mongoose.model('Setting', SettingsSchema);

// API Routes

// Health check / Status
app.get('/api/status', (req, res) => {
    const status = mongoose.connection.readyState;
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    res.json({
        success: true,
        status: states[status] || "unknown",
        dbName: mongoose.connection.name || "not connected"
    });
});

// Exam Details
app.get('/api/exam-details', async (req, res) => {
    try {
        const details = await Exam.findOne();
        res.json(details);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/exam-details', async (req, res) => {
    try {
        await Exam.deleteMany({});
        const details = new Exam(req.body);
        await details.save();
        res.status(201).json(details);
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// Applications
app.get('/api/applications', async (req, res) => {
    try {
        const applications = await Application.find();
        res.json(applications);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/applications', async (req, res) => {
    try {
        const application = new Application(req.body);
        await application.save();
        res.status(201).json(application);
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

app.patch('/api/applications/:id', async (req, res) => {
    try {
        const application = await Application.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(application);
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

app.post('/api/clear-all', async (req, res) => {
    try {
        await Application.deleteMany({});
        await Exam.deleteMany({});
        await Setting.deleteMany({});
        res.json({ success: true, message: 'All data cleared' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Settings
app.get('/api/settings/:key', async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: req.params.key });
        res.json(setting ? setting.value : null);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        const setting = await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
        res.json({ success: true, setting });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

app.post('/api/upload-logo', upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

        const logoUrl = `/uploads/${req.file.filename}`;

        // Save to settings
        await Setting.findOneAndUpdate({ key: 'uniLogo' }, { value: logoUrl }, { upsert: true });

        res.json({ success: true, logoUrl });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/upload-signature', upload.single('signature'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

        const sigUrl = `/uploads/${req.file.filename}`;

        // Save to settings
        await Setting.findOneAndUpdate({ key: 'controllerSig' }, { value: sigUrl }, { upsert: true });

        res.json({ success: true, sigUrl });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Admin Login
app.post('/api/admin-login', (req, res) => {
    const { username, password } = req.body;

    // Load fresh from env or defaults
    const adminUser = (process.env.ADMIN_USER || 'nist').trim();
    const adminPass = (process.env.ADMIN_PASS || 'nist2026').trim();

    // Trim incoming request data too
    const loginUser = (username || '').trim();
    const loginPass = (password || '').trim();

    console.log(`\n--- LOGIN ATTEMPT ---`);
    console.log(`Received -> User: "${loginUser}", Pass: "${loginPass}"`);
    console.log(`Expected -> User: "${adminUser}", Pass: "${adminPass}"`);

    const isUserMatch = loginUser.toLowerCase() === adminUser.toLowerCase();
    const isPassMatch = loginPass === adminPass;

    console.log(`Match Result -> User: ${isUserMatch}, Pass: ${isPassMatch}`);

    if (isUserMatch && isPassMatch) {
        console.log(`✅ [LOGIN SUCCESS]`);
        res.json({ success: true });
    } else {
        console.log(`❌ [LOGIN FAILED]`);
        res.status(401).json({
            success: false,
            message: 'Invalid credentials',
            debug: {
                userMatch: isUserMatch,
                passMatch: isPassMatch
            }
        });
    }
});

// SPA Fallback (Catch-all)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=========================================`);
    console.log(`ADMIT CARD SYSTEM SERVER STARTED`);
    console.log(`Local Access: http://localhost:${PORT}`);
    const adminUser = process.env.ADMIN_USER || 'nist';
    console.log(`Admin User: ${adminUser}`);
    console.log(`=========================================\n`);
});
