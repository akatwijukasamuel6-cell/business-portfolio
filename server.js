require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust one hop so HTTPS/real-IP detection works behind a reverse proxy or
// load balancer (typical for hosting platforms that terminate TLS).
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Data layer
// ---------------------------------------------------------------------------
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const initDataFile = (filename, defaultData) => {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
    return filePath;
};

const readData = (filename) => {
    const filePath = path.join(dataDir, filename);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
};

const writeData = (filename, data) => {
    const filePath = path.join(dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// ---------------------------------------------------------------------------
// Security configuration
// ---------------------------------------------------------------------------

// Session secret: prefer env var, otherwise generate once and persist so
// sessions survive server restarts.
const secretFile = path.join(dataDir, '.session-secret');
const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
    if (fs.existsSync(secretFile)) {
        return fs.readFileSync(secretFile, 'utf8').trim();
    }
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretFile, secret, { mode: 0o600 });
    return secret;
})();

// Default admin credentials (override with ADMIN_USERNAME / ADMIN_PASSWORD env vars).
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Seed the users store with a hashed password on first run.
initDataFile('users.json', []);
const seedAdmin = () => {
    const users = readData('users.json');
    if (!users.some(u => u.username === ADMIN_USERNAME)) {
        users.push({
            username: ADMIN_USERNAME,
            passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
            created: new Date().toISOString()
        });
        writeData('users.json', users);
        if (!process.env.ADMIN_PASSWORD) {
            console.log('============================================================');
            console.log('  Default admin account created.');
            console.log(`  Username: ${ADMIN_USERNAME}`);
            console.log('  Password: admin123  <-- CHANGE THIS IMMEDIATELY!');
            console.log('  Set ADMIN_USERNAME / ADMIN_PASSWORD env vars to override.');
            console.log('============================================================');
        }
    }
};
seedAdmin();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"]
        }
    },
    crossOriginResourcePolicy: { policy: 'same-origin' }
}));

// Restrict CORS: only allow explicitly configured origins (or same-origin).
app.use(cors({
    origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
        : false,
    credentials: true
}));

app.use(bodyParser.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'sid',
    cookie: {
        httpOnly: true,
        sameSite: 'strict',
        secure: 'auto',
        maxAge: 1000 * 60 * 60 * 8
    }
}));

// Rate limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again later.' }
});

const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' }
});

// Image uploads
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.avif'].includes(ext) ? ext : '.png';
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// ---------------------------------------------------------------------------
// Validation / sanitization helpers
// ---------------------------------------------------------------------------

const sanitizeString = (value, maxLength = 2000) => {
    if (value === undefined || value === null) return '';
    return String(value).trim().slice(0, maxLength);
};

// cleanBody validates/sanitizes a request body against a schema:
// { field: { required: bool, max: number, type: 'string'|'array' } }
const cleanBody = (body, schema) => {
    const cleaned = {};
    for (const [field, opts] of Object.entries(schema)) {
        const value = body[field];
        if (value === undefined || value === null || String(value).trim() === '') {
            if (opts.required) {
                const err = new Error(`${field} is required`);
                err.status = 400;
                throw err;
            }
            cleaned[field] = '';
            continue;
        }
        if (opts.type === 'array') {
            cleaned[field] = (Array.isArray(value) ? value : [value])
                .map(v => sanitizeString(v, opts.max || 500))
                .filter(Boolean);
        } else {
            cleaned[field] = sanitizeString(value, opts.max || 2000);
        }
    }
    return cleaned;
};

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

const requireAuth = (req, res, next) => {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ error: 'Unauthorized' });
};

// CSRF protection: all state-changing requests must echo the token issued to
// the session. The token is returned in the /api/auth/me response body, not a
// cookie, so cross-site requests cannot forge it.
const csrfProtect = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const token = req.headers['x-csrf-token'];
    if (token && req.session && req.session.csrfToken && token === req.session.csrfToken) {
        return next();
    }
    return res.status(403).json({ error: 'Invalid CSRF token' });
};

const adminGuard = [requireAuth, csrfProtect, writeLimiter];

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ user: req.session.user, csrfToken: req.session.csrfToken });
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
    try {
        const username = sanitizeString(req.body.username, 50);
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        const ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : (req.ip || 'unknown');
        const userAgent = (req.headers['user-agent'] || 'unknown').slice(0, 300);

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const users = readData('users.json');
        const user = users.find(u => u.username === username);

        if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
            sendLoginAlert({ username, success: false, ip, userAgent }).catch(error => {
                console.error('Login alert email failed:', error.message);
            });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.user = { username: user.username };
        req.session.csrfToken = crypto.randomBytes(24).toString('hex');

        sendLoginAlert({ username: user.username, success: true, ip, userAgent }).catch(error => {
            console.error('Login alert email failed:', error.message);
        });
        res.json({ user: { username: user.username }, csrfToken: req.session.csrfToken });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/auth/logout', adminGuard, (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// ---------------------------------------------------------------------------
// Content data initialization
// ---------------------------------------------------------------------------

initDataFile('projects.json', [
    { id: 1, title: 'E-Commerce Platform', description: 'A full-featured online store with payment integration, inventory management, and analytics dashboard.', image: '/images/project-1.jpg', category: 'Web Development', link: '#' },
    { id: 2, title: 'Fitness Tracker App', description: 'Mobile app for tracking workouts, nutrition, and health metrics with social features.', image: '/images/project-2.jpg', category: 'Mobile App', link: '#' },
    { id: 3, title: 'Task Management System', description: 'Collaborative project management tool with real-time updates and team analytics.', image: '/images/project-3.jpg', category: 'SaaS', link: '#' }
]);

initDataFile('blog.json', [
    { id: 1, title: 'Getting Started with Web Development', content: 'Web development is an exciting journey...', date: '2026-01-15', author: 'Admin' },
    { id: 2, title: 'Best Practices for Modern Websites', content: 'Creating a modern website requires...', date: '2026-02-01', author: 'Admin' },
    { id: 3, title: 'The Future of Digital Marketing', content: 'Digital marketing continues to evolve...', date: '2026-02-20', author: 'Admin' }
]);

initDataFile('services.json', [
    { id: 1, title: 'Web Development', description: 'Custom websites and web applications tailored to your needs', icon: 'code' },
    { id: 2, title: 'UI/UX Design', description: 'Beautiful and intuitive user interfaces that engage users', icon: 'paint-brush' },
    { id: 3, title: 'Digital Marketing', description: 'Strategic marketing to grow your online presence', icon: 'chart-line' },
    { id: 4, title: 'Consulting', description: 'Expert advice to help your business succeed online', icon: 'comments' }
]);

initDataFile('testimonials.json', [
    { id: 1, name: 'Sarah Johnson', role: 'CEO, TechStart', content: 'Working with this team was an incredible experience. They delivered beyond our expectations.', avatar: '/images/testimonial-1.jpg', rating: 5 },
    { id: 2, name: 'Michael Chen', role: 'Founder, DesignLab', content: 'Professional, creative, and highly skilled. They transformed our online presence completely.', avatar: '/images/testimonial-2.jpg', rating: 5 },
    { id: 3, name: 'Emily Rodriguez', role: 'CTO, CloudNine', content: 'The best investment we made for our business. Their solutions are innovative and scalable.', avatar: '/images/testimonial-3.jpg', rating: 5 }
]);

initDataFile('team.json', [
    { id: 1, name: 'John Smith', role: 'CEO & Founder', bio: 'Visionary leader with 15+ years in tech industry.', image: '/images/team-1.jpg', social: { twitter: '#', linkedin: '#' } },
    { id: 2, name: 'Lisa Wang', role: 'CTO', bio: 'Full-stack expert specializing in scalable architectures.', image: '/images/team-2.jpg', social: { twitter: '#', linkedin: '#' } },
    { id: 3, name: 'David Kim', role: 'Design Director', bio: 'Award-winning designer with a passion for UX.', image: '/images/team-3.jpg', social: { twitter: '#', linkedin: '#' } },
    { id: 4, name: 'Anna Petrova', role: 'Marketing Lead', bio: 'Digital marketing strategist driving brand growth.', image: '/images/team-4.jpg', social: { twitter: '#', linkedin: '#' } }
]);

initDataFile('careers.json', [
    { id: 1, title: 'Senior Frontend Developer', department: 'Engineering', location: 'Remote', type: 'Full-time', description: 'We are looking for an experienced frontend developer to join our team and build modern web applications.', requirements: ['5+ years React experience', 'TypeScript proficiency', 'UI/UX sensibility'], posted: '2026-03-01', status: 'open' },
    { id: 2, title: 'Backend Engineer', department: 'Engineering', location: 'San Francisco, CA', type: 'Full-time', description: 'Help us build scalable backend systems that power our platform.', requirements: ['Node.js expertise', 'Database design', 'API development'], posted: '2026-03-05', status: 'open' },
    { id: 3, title: 'UI/UX Designer', department: 'Design', location: 'Remote', type: 'Contract', description: 'Design beautiful and intuitive interfaces for our clients.', requirements: ['Figma proficiency', 'Design systems', 'User research'], posted: '2026-03-10', status: 'open' }
]);

initDataFile('applications.json', []);

initDataFile('messages.json', []);

initDataFile('pages.json', {
    about: {
        title: 'About Us',
        content: 'We are a dedicated team of professionals committed to delivering excellence in every project we undertake. With years of experience in web development, design, and digital marketing, we help businesses transform their digital presence.',
        mission: 'To empower businesses with innovative digital solutions that drive growth and success.',
        vision: 'To be the leading provider of digital transformation solutions worldwide.'
    },
    contact: {
        email: 'contact@business.com',
        phone: '+1 234 567 890',
        address: '123 Business Street, Tech City, TC 12345',
        social: {
            twitter: '#',
            linkedin: '#',
            github: '#'
        }
    }
});

// ---------------------------------------------------------------------------
// Public read API
// ---------------------------------------------------------------------------

app.get('/api/projects', (req, res) => {
    try {
        const projects = readData('projects.json');
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

app.get('/api/blog', (req, res) => {
    try {
        const blog = readData('blog.json');
        res.json(blog);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
});

app.get('/api/services', (req, res) => {
    try {
        const services = readData('services.json');
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});

app.get('/api/pages/:page', (req, res) => {
    try {
        const pages = readData('pages.json');
        const page = pages[req.params.page];
        if (page) {
            res.json(page);
        } else {
            res.status(404).json({ error: 'Page not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch page data' });
    }
});

app.get('/api/testimonials', (req, res) => {
    try {
        const testimonials = readData('testimonials.json');
        res.json(testimonials);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch testimonials' });
    }
});

app.get('/api/team', (req, res) => {
    try {
        const team = readData('team.json');
        res.json(team);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch team' });
    }
});

app.get('/api/careers', (req, res) => {
    try {
        const careers = readData('careers.json');
        res.json(careers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch careers' });
    }
});

// ---------------------------------------------------------------------------
// Projects (write)
// ---------------------------------------------------------------------------

app.post('/api/projects', adminGuard, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            title: { required: true, max: 120 },
            description: { required: true, max: 3000 },
            image: { required: true, max: 500 },
            category: { required: true, max: 100 },
            link: { required: true, max: 500 }
        });
        const projects = readData('projects.json');
        const newProject = { id: Date.now(), ...body };
        projects.push(newProject);
        writeData('projects.json', projects);
        res.json(newProject);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to create project' });
    }
});

app.put('/api/projects/:id', adminGuard, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            title: { required: true, max: 120 },
            description: { required: true, max: 3000 },
            image: { required: true, max: 500 },
            category: { required: true, max: 100 },
            link: { required: true, max: 500 }
        });
        const projects = readData('projects.json');
        const index = projects.findIndex(p => p.id == req.params.id);
        if (index !== -1) {
            projects[index] = { ...projects[index], ...body };
            writeData('projects.json', projects);
            res.json(projects[index]);
        } else {
            res.status(404).json({ error: 'Project not found' });
        }
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to update project' });
    }
});

app.delete('/api/projects/:id', adminGuard, (req, res) => {
    try {
        let projects = readData('projects.json');
        projects = projects.filter(p => p.id != req.params.id);
        writeData('projects.json', projects);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// ---------------------------------------------------------------------------
// Blog (write)
// ---------------------------------------------------------------------------

app.post('/api/blog', adminGuard, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            title: { required: true, max: 200 },
            content: { required: true, max: 10000 },
            author: { required: true, max: 100 }
        });
        const blog = readData('blog.json');
        const newPost = { id: Date.now(), date: new Date().toISOString().split('T')[0], ...body };
        blog.unshift(newPost);
        writeData('blog.json', blog);
        res.json(newPost);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to create blog post' });
    }
});

app.put('/api/blog/:id', adminGuard, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            title: { required: true, max: 200 },
            content: { required: true, max: 10000 },
            author: { required: true, max: 100 }
        });
        const blog = readData('blog.json');
        const index = blog.findIndex(b => b.id == req.params.id);
        if (index !== -1) {
            blog[index] = { ...blog[index], ...body };
            writeData('blog.json', blog);
            res.json(blog[index]);
        } else {
            res.status(404).json({ error: 'Blog post not found' });
        }
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to update blog post' });
    }
});

app.delete('/api/blog/:id', adminGuard, (req, res) => {
    try {
        let blog = readData('blog.json');
        blog = blog.filter(b => b.id != req.params.id);
        writeData('blog.json', blog);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete blog post' });
    }
});

// ---------------------------------------------------------------------------
// Services (write)
// ---------------------------------------------------------------------------

app.post('/api/services', adminGuard, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            title: { required: true, max: 120 },
            description: { required: true, max: 3000 },
            icon: { required: true, max: 50 }
        });
        const services = readData('services.json');
        const newService = { id: Date.now(), ...body };
        services.push(newService);
        writeData('services.json', services);
        res.json(newService);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to create service' });
    }
});

app.put('/api/services/:id', adminGuard, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            title: { required: true, max: 120 },
            description: { required: true, max: 3000 },
            icon: { required: true, max: 50 }
        });
        const services = readData('services.json');
        const index = services.findIndex(s => s.id == req.params.id);
        if (index !== -1) {
            services[index] = { ...services[index], ...body };
            writeData('services.json', services);
            res.json(services[index]);
        } else {
            res.status(404).json({ error: 'Service not found' });
        }
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to update service' });
    }
});

app.delete('/api/services/:id', adminGuard, (req, res) => {
    try {
        let services = readData('services.json');
        services = services.filter(s => s.id != req.params.id);
        writeData('services.json', services);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete service' });
    }
});

// ---------------------------------------------------------------------------
// Pages (write)
// ---------------------------------------------------------------------------

app.put('/api/pages/:page', adminGuard, (req, res) => {
    try {
        const pages = readData('pages.json');
        const pageKey = sanitizeString(req.params.page, 50);
        const existingData = pages[pageKey] || {};

        let cleaned;
        if (pageKey === 'about') {
            cleaned = cleanBody(req.body, {
                content: { required: true, max: 10000 },
                mission: { required: true, max: 1000 },
                vision: { required: true, max: 1000 }
            });
        } else if (pageKey === 'contact') {
            cleaned = cleanBody(req.body, {
                email: { required: true, max: 120 },
                phone: { required: true, max: 50 },
                address: { required: true, max: 300 }
            });
            cleaned.social = existingData.social || { twitter: '#', linkedin: '#', github: '#' };
        } else {
            return res.status(400).json({ error: 'Invalid page' });
        }

        pages[pageKey] = { ...existingData, ...cleaned };
        writeData('pages.json', pages);
        res.json(pages[pageKey]);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to update page data' });
    }
});

// ---------------------------------------------------------------------------
// Testimonials (write)
// ---------------------------------------------------------------------------

app.post('/api/testimonials', adminGuard, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            name: { required: true, max: 120 },
            role: { required: true, max: 200 },
            content: { required: true, max: 3000 },
            avatar: { required: false, max: 500 },
            rating: { required: true, max: 2 }
        });
        const testimonials = readData('testimonials.json');
        const newItem = { id: Date.now(), rating: 5, ...body };
        testimonials.push(newItem);
        writeData('testimonials.json', testimonials);
        res.json(newItem);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to create testimonial' });
    }
});

app.put('/api/testimonials/:id', adminGuard, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            name: { required: true, max: 120 },
            role: { required: true, max: 200 },
            content: { required: true, max: 3000 },
            avatar: { required: false, max: 500 },
            rating: { required: true, max: 2 }
        });
        const testimonials = readData('testimonials.json');
        const index = testimonials.findIndex(t => t.id == req.params.id);
        if (index !== -1) {
            testimonials[index] = { ...testimonials[index], ...body };
            writeData('testimonials.json', testimonials);
            res.json(testimonials[index]);
        } else {
            res.status(404).json({ error: 'Testimonial not found' });
        }
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to update testimonial' });
    }
});

app.delete('/api/testimonials/:id', adminGuard, (req, res) => {
    try {
        let testimonials = readData('testimonials.json');
        testimonials = testimonials.filter(t => t.id != req.params.id);
        writeData('testimonials.json', testimonials);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete testimonial' });
    }
});

// ---------------------------------------------------------------------------
// Team (write)
// ---------------------------------------------------------------------------

app.post('/api/team', adminGuard, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            name: { required: true, max: 120 },
            role: { required: true, max: 150 },
            bio: { required: false, max: 2000 },
            image: { required: false, max: 500 }
        });
        const team = readData('team.json');
        const newMember = { id: Date.now(), social: { twitter: '#', linkedin: '#' }, ...body };
        team.push(newMember);
        writeData('team.json', team);
        res.json(newMember);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to create team member' });
    }
});

app.put('/api/team/:id', adminGuard, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            name: { required: true, max: 120 },
            role: { required: true, max: 150 },
            bio: { required: false, max: 2000 },
            image: { required: false, max: 500 }
        });
        const team = readData('team.json');
        const index = team.findIndex(m => m.id == req.params.id);
        if (index !== -1) {
            team[index] = { ...team[index], ...body };
            writeData('team.json', team);
            res.json(team[index]);
        } else {
            res.status(404).json({ error: 'Team member not found' });
        }
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to update team member' });
    }
});

app.delete('/api/team/:id', adminGuard, (req, res) => {
    try {
        let team = readData('team.json');
        team = team.filter(m => m.id != req.params.id);
        writeData('team.json', team);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete team member' });
    }
});

// ---------------------------------------------------------------------------
// Careers (write)
// ---------------------------------------------------------------------------

app.post('/api/careers', adminGuard, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            title: { required: true, max: 150 },
            department: { required: true, max: 100 },
            location: { required: true, max: 150 },
            type: { required: true, max: 50 },
            description: { required: true, max: 5000 },
            requirements: { type: 'array', max: 500 },
            status: { required: false, max: 20 }
        });
        const careers = readData('careers.json');
        const newJob = { id: Date.now(), posted: new Date().toISOString().split('T')[0], status: 'open', ...body };
        careers.push(newJob);
        writeData('careers.json', careers);
        res.json(newJob);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to create job' });
    }
});

app.put('/api/careers/:id', adminGuard, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            title: { required: true, max: 150 },
            department: { required: true, max: 100 },
            location: { required: true, max: 150 },
            type: { required: true, max: 50 },
            description: { required: true, max: 5000 },
            requirements: { type: 'array', max: 500 },
            status: { required: false, max: 20 }
        });
        const careers = readData('careers.json');
        const index = careers.findIndex(c => c.id == req.params.id);
        if (index !== -1) {
            careers[index] = { ...careers[index], ...body };
            writeData('careers.json', careers);
            res.json(careers[index]);
        } else {
            res.status(404).json({ error: 'Job not found' });
        }
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to update job' });
    }
});

app.delete('/api/careers/:id', adminGuard, (req, res) => {
    try {
        let careers = readData('careers.json');
        careers = careers.filter(c => c.id != req.params.id);
        writeData('careers.json', careers);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

// ---------------------------------------------------------------------------
// Job Applications
// ---------------------------------------------------------------------------

app.post('/api/applications', writeLimiter, (req, res) => {
    try {
        const body = cleanBody(req.body, {
            jobId: { required: true, max: 30 },
            name: { required: true, max: 150 },
            email: { required: true, max: 150 },
            phone: { required: false, max: 50 },
            coverLetter: { required: true, max: 5000 }
        });
        const applications = readData('applications.json');
        const newApp = { id: Date.now(), date: new Date().toISOString().split('T')[0], ...body };
        applications.push(newApp);
        writeData('applications.json', applications);
        res.json(newApp);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to submit application' });
    }
});

app.get('/api/applications', adminGuard, (req, res) => {
    try {
        const applications = readData('applications.json');
        res.json(applications);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

app.delete('/api/applications/:id', adminGuard, (req, res) => {
    try {
        let applications = readData('applications.json');
        applications = applications.filter(a => a.id != req.params.id);
        writeData('applications.json', applications);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete application' });
    }
});

// ---------------------------------------------------------------------------
// Contact form + messages
// ---------------------------------------------------------------------------

const createTransporter = () => nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    } : undefined
});

const getMailTo = () => process.env.MAIL_TO || readData('pages.json').contact.email;

const sendMail = async ({ to, subject, text, replyTo }) => {
    if (!process.env.SMTP_HOST) return false;
    const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@business.com';
    const transporter = createTransporter();
    await transporter.sendMail({ from, to, subject, text, replyTo });
    return true;
};

const sendContactEmail = async ({ name, email, subject, message }) => {
    return sendMail({
        to: getMailTo(),
        replyTo: email,
        subject: `[Website Contact] ${subject || 'New message'} from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject || '(none)'}\n\n${message}`
    });
};

const sendLoginAlert = async ({ username, success, ip, userAgent }) => {
    const action = success ? 'Successful login' : 'Failed login attempt';
    return sendMail({
        to: getMailTo(),
        subject: `[Security] ${action} on your website`,
        text:
            `${success ? 'A successful login' : 'A failed login attempt'} was detected on your website.\n\n` +
            `Status: ${success ? 'SUCCESS' : 'FAILED'}\n` +
            `Username tried: ${username}\n` +
            `IP address: ${ip}\n` +
            `Browser / User-Agent: ${userAgent}\n` +
            `Time: ${new Date().toLocaleString()}\n\n` +
            `If this was not you, please review your admin security immediately.`
    });
};

app.post('/api/contact', writeLimiter, async (req, res) => {
    try {
        const body = cleanBody(req.body, {
            name: { required: true, max: 150 },
            email: { required: true, max: 150 },
            subject: { required: false, max: 200 },
            message: { required: true, max: 5000 }
        });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
            return res.status(400).json({ error: 'Please provide a valid email address' });
        }

        const messages = readData('messages.json');
        const newMsg = { id: Date.now(), date: new Date().toISOString(), ...body };
        messages.unshift(newMsg);
        writeData('messages.json', messages);

        let emailed = false;
        if (process.env.SMTP_HOST) {
            emailed = await sendContactEmail(body).catch(error => {
                console.error('Email send failed:', error.message);
                return false;
            });
        }

        res.json({ success: true, emailed });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: status === 400 ? error.message : 'Failed to send message' });
    }
});

app.get('/api/messages', adminGuard, (req, res) => {
    try {
        const messages = readData('messages.json');
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.delete('/api/messages/:id', adminGuard, (req, res) => {
    try {
        let messages = readData('messages.json');
        messages = messages.filter(m => m.id != req.params.id);
        writeData('messages.json', messages);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// Send a test email so the admin can verify SMTP configuration.
app.post('/api/contact/test', adminGuard, async (req, res) => {
    if (!process.env.SMTP_HOST) {
        return res.status(400).json({ error: 'SMTP is not configured. Set SMTP_HOST (and SMTP_USER / SMTP_PASS) in the .env file.' });
    }
    const pages = readData('pages.json');
    const to = process.env.MAIL_TO || pages.contact.email;
    try {
        await sendContactEmail({
            name: 'Website Test',
            email: process.env.MAIL_FROM || process.env.SMTP_USER || 'test@business.com',
            subject: 'SMTP configuration test',
            message: 'If you can read this email, your website contact form is working correctly.'
        });
        res.json({ success: true, to });
    } catch (error) {
        console.error('Test email failed:', error.message);
        res.status(500).json({ error: `Email failed: ${error.message}` });
    }
});

// ---------------------------------------------------------------------------
// Image upload (admin only)
// ---------------------------------------------------------------------------

app.post('/api/upload', adminGuard, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ url: '/uploads/' + req.file.filename });
});

// ---------------------------------------------------------------------------
// 404 + error handling + SPA fallback
// ---------------------------------------------------------------------------

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 5MB)' : 'Upload failed';
        return res.status(400).json({ error: message });
    }
    if (err && err.message === 'Only image files are allowed') {
        return res.status(400).json({ error: err.message });
    }
    console.error('Unhandled error:', err.message);
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
        return res.status(400).json({ error: 'Invalid request body' });
    }
    res.status(500).json({ error: 'Internal server error' });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
